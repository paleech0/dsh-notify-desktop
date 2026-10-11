/**
 * dsh-notify-desktop client half.
 *
 * Reads the host `notify` projection off the session list (the projection seam
 * delivers it for every session, so a background session notifies exactly like
 * the visible one), decides whether the signal deserves a Windows toast, shows
 * it, and — on click — raises the window and jumps to that session.
 *
 * Nothing here extends a harness allowlist: the projection, the session list,
 * the settings slot, and the locale registry are all ordinary plugin seams.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
// Type-only: the ctx.locale Context merge.
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the settings.section SlotMap entry.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: the renderer-owned ctx.slots registry merge.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { asReason, decideNotification, groupSound, rememberDecision } from './decision.ts'
import { NS, en, fmt, zh } from './locales.ts'
import { activateSession, focusWindowRequest } from './navigate.ts'
import {
  bodyText,
  ensureNotificationPermission,
  appWindowFocused,
  clearSoundCache,
  deleteSound,
  importSound,
  notificationTag,
  pendingTag,
  pickSoundFile,
  previewToast,
  silenceSounds,
  soundCacheInfo,
  soundLibrary,
  reminderTag,
  report,
  shortPendingKey,
  shortReasonKey,
  showToast,
} from './notifier.ts'
import type { PendingKind, SoundId } from '../types.ts'
import { plainSummary, toastTitle, workspaceName } from './summary.ts'
import { dueReminders, type PendingWait } from './reminder.ts'
import { FOCUS_HEADER, QUESTIONS_ROUTE } from '../protocol.ts'
import {
  ASK_TWIN_MS,
  NOTIFY_PROJECTION_KEY,
  askKey,
  isFresh,
  liveRequestIds,
  newPending,
  recentlyKeyed,
  turnAdvance,
} from './runner.ts'
import { NotifySettingsSection, type NotifySectionInjected } from './SettingsSection.tsx'
import { createSettingsStore } from './settings.ts'
import { adoptStyles } from './styles.ts'

/**
 * Required client services: the session list, the slot registry, the locale
 * registry, and the remote channel that forwards questions.
 */
export const inject = ['sessions', 'slots', 'locale']

/** The slice of the sessions service this plugin reads. */
interface SessionsListFace {
  readonly list: {
    getSnapshot(): SessionListState
    subscribe(listener: () => void): () => void
  }
}

/** The slice of the workspace service this plugin uses. */
interface WorkspaceFace {
  openSession?(sessionId: string): void
}

/** How often unanswered waits are re-checked, in milliseconds. */
export const REMINDER_TICK_MS = 30_000

/** How often the client polls the host's question queue, in milliseconds. */
export const QUESTION_POLL_MS = 2_000

/** The identity of one tracked wait. */
function waitKey(sessionId: string, requestId: string): string {
  return sessionId + ':' + requestId
}

/**
 * Compose the notification surface.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  adoptStyles()
  report('client bundle loaded')
  // The shell reports 'default' on a fresh app start; without this request the
  // first toast of every app run is dropped by the renderer.
  void ensureNotificationPermission().then(permission => {
    report('notification permission=' + permission)
  })
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-notify-desktop: dictionaries')
  const t = ctx.locale.bind(NS)

  const store = createSettingsStore()
  const set = (patch: Parameters<typeof store.update>[0]): void => {
    store.update(patch)
    // A file sound is played by a host child that would otherwise run to the
    // end of its wav; switching sound off must stop it right away.
    if (patch.soundEnabled === false) void silenceSounds()
  }
  // Read through the service store rather than the ctx.sessions property proxy:
  // the host session package merges a different sessions member and the two
  // collide in one bundle.
  const sessions = ctx.get('sessions') as unknown as SessionsListFace
  const workspace = ctx.get('uiWorkspace') as WorkspaceFace | undefined
  const recent = new Map<string, number>()
  /** Last logged projection shape per session (diagnostics only). */
  const seenShape = new Map<string, string>()
  const observedTurn = new Map<string, number>()
  const knownPending = new Map<string, Set<string>>()
  const waits = new Map<string, PendingWait>()
  /** Highest question sequence already handled from the host queue. */
  let questionSeq = 0

  /**
   * The workspace label of a session, for a toast title.
   * @param sessionId - the session to name.
   * @returns the workspace name, the session display title, or an empty string.
   */
  const sessionLabel = (sessionId: string): string => {
    const rows = sessions.list.getSnapshot().byId as unknown as Record<string, { displayTitle?: string; cwd?: string } | undefined>
    const row = rows[sessionId]
    return workspaceName(row?.cwd) || row?.displayTitle || ''
  }

  const activate = (sessionId: string): void => {
    void activateSession(
      { focusWindow: () => focusWindowRequest(), openSession: (id: string) => workspace?.openSession?.(id) },
      sessionId,
    )
  }

  /** One ask that may deserve a toast, from either source. */
  interface AskCandidate {
    /** The owning session ('' when the host cannot name it). */
    readonly sessionId: string
    /** The ask's identity inside its session. */
    readonly requestId: string
    readonly kind: PendingKind
    /** The one-line summary that becomes the body. */
    readonly summary: string
    /** When the wait started (client clock, ms). */
    readonly firstSeenAt: number
    /** Where the ask came from, for the diagnostics line. */
    readonly source: 'projection' | 'host queue'
    /** The toast title label: the workspace name, or '' when unknown. */
    readonly label: string
  }

  /**
   * Decide one ask, show its toast, and start tracking its wait.
   *
   * Both sources funnel through here: the projection (approvals and tool-call
   * questions) and the host's question queue (service-level asks such as the
   * plan review). One ask can arrive from both, so the shared key decides which
   * source gets to toast.
   * @param ask - the ask to consider.
   */
  const notifyAsk = (ask: AskCandidate): void => {
    const settings = store.getSnapshot()
    const now = Date.now()
    const focused = isFocused()
    const where = ask.kind + ' ' + ask.requestId + ' (' + ask.source + ')'
    const shared = askKey(ask.summary)
    if (ask.kind !== 'approval' && recentlyKeyed(recent, shared, now, ASK_TWIN_MS)) {
      report('pending ' + where + ' twin of the other source -> suppressed')
      return
    }
    const decision = decideNotification({
      settings,
      trigger: { kind: 'pending', pending: ask.kind },
      sessionId: ask.sessionId,
      focused,
      dedupeKey: ask.sessionId + ':request:' + ask.requestId,
      now,
      recent,
    })
    waits.set(waitKey(ask.sessionId, ask.requestId), {
      key: waitKey(ask.sessionId, ask.requestId),
      sessionId: ask.sessionId,
      requestId: ask.requestId,
      kind: ask.kind,
      firstSeenAt: ask.firstSeenAt,
      reminded: false,
    })
    report('pending ' + where + ' focused=' + String(focused)
      + ' -> ' + (decision === null ? 'suppressed' : 'toast'))
    if (decision === null) return
    showToast({
      title: toastTitle(ask.label, t(shortPendingKey(ask.kind))),
      body: bodyText(plainSummary(ask.summary), t('notify.pendingBody')),
      tag: pendingTag(ask.sessionId, ask.requestId),
      sound: decision.sound,
      // A sessionless ask can still raise the window, just not jump.
      onClick: ask.sessionId === ''
        ? () => {
          void focusWindowRequest()
        }
        : () => {
          activate(ask.sessionId)
        },
    })
    rememberDecision(recent, ask.sessionId + ':request:' + ask.requestId, now)
    if (ask.kind !== 'approval') rememberDecision(recent, shared, now)
  }

  /**
   * The host's OS-level answer to "is our window the foreground window?".
   *
   * `document.hasFocus()` alone is not enough: measured twice in six seconds it
   * claimed "unfocused" while the user was looking at the window, and every
   * toast that decision produced was one the user was already staring at. When
   * the document says unfocused the host's answer gets the final say.
   */
  let hostFocused = false

  /**
   * When the document last held focus.
   *
   * The document loses focus for reasons that do not mean the user left — the
   * question view and the settings panel are separate views — so a focus the
   * document held moments ago still counts as "the user is here". The cost is a
   * notification raised in the first seconds after the user really does switch
   * away being suppressed, which is the harmless direction.
   */
  let lastFocusAt = 0

  /** How long a document focus keeps counting after the document lost it. */
  const FOCUS_GRACE_MS = 5000

  /** Whether the user is plausibly looking at the app right now. */
  const isFocused = (): boolean =>
    (typeof document !== 'undefined' && document.hasFocus())
    || hostFocused
    || Date.now() - lastFocusAt < FOCUS_GRACE_MS

  /** Ask the host for the OS-level answer and remember it. */
  const refreshHostFocus = (): void => {
    void appWindowFocused().then(focused => {
      hostFocused = focused
    }, () => undefined)
  }

  const tick = (): void => {
    const state = sessions.list.getSnapshot()
    const settings = store.getSnapshot()
    const now = Date.now()
    const focused = isFocused()
    // 0.2.0-rc.2's SessionListState carries no "currently open session" signal,
    // so the focused window is the whole suppression input here.
    for (const id of state.ids) {
      const summary = state.byId[id]
      if (summary === undefined) continue
      const projection = summary.projectionValues?.[NOTIFY_PROJECTION_KEY]
      // The toast names the workspace (recognisable) rather than the session's
      // DSH-generated one-word title.
      const toastName = workspaceName(summary.cwd) || summary.displayTitle || summary.title || ''
      const shape = projection === undefined
        ? 'absent'
        : projection.turn + '/' + projection.reason + '/pending:' + String(projection.pending.length)
      const ownList = (projection?.pending ?? []).map(entry => entry.kind + ':' + entry.requestId).join('|')
      const shapeWithPending = shape + ' own=[' + ownList + ']'
      // Only sessions that actually carry state are reported: the host keeps a
      // bounded ring of client lines, and a scan of every idle session would
      // evict the interesting ones.
      const interesting = projection !== undefined || ownList !== ''
      if (interesting && seenShape.get(id) !== shapeWithPending) {
        seenShape.set(id, shapeWithPending)
        report('scan ' + id.slice(0, 12) + ' projection=' + shape
          + ' own=[' + ownList + '] focused=' + String(focused))
      }

      // --- finished turns -------------------------------------------------
      const advanced = turnAdvance(observedTurn.get(id), projection)
      observedTurn.set(id, advanced.nextTurn)
      // A turn the fold only just caught up with is history, not news.
      const turnIsFresh = projection !== undefined && isFresh(projection.updatedAt, now)
      if (advanced.fresh && projection !== undefined && !turnIsFresh) {
        report('turn ' + String(projection.turn) + ' reason=' + String(projection.reason)
          + ' stale (' + String(Math.max(0, Math.round((now - projection.updatedAt) / 1000))) + 's old) -> suppressed')
      }
      if (advanced.fresh && projection !== undefined && turnIsFresh) {
        const reason = asReason(projection.reason)
        const dedupeKey = id + ':turn:' + String(projection.turn)
        const decision = reason === undefined
          ? null
          : decideNotification({
            settings,
            trigger: { kind: 'turn', reason },
            sessionId: id,
            focused,
            dedupeKey,
            now,
            recent,
          })
        report('turn ' + String(projection.turn) + ' reason=' + String(reason)
          + ' focused=' + String(focused) + ' -> ' + (decision === null ? 'suppressed' : 'toast'))
        if (decision !== null && reason !== undefined) {
          showToast({
            title: toastTitle(toastName, t(shortReasonKey(reason))),
            body: bodyText(plainSummary(projection.body), t('notify.emptyBody')),
            tag: notificationTag(id, projection.turn),
            sound: decision.sound,
            onClick: () => {
              activate(id)
            },
          })
          rememberDecision(recent, dedupeKey, now)
        }
      }

      // --- blocking interactions ------------------------------------------
      // This fold covers approvals and tool-call questions (tool/call and
      // tool/ptc-dispatch*); service-level asks such as the plan review never
      // reach the session log and arrive through the host's queue instead.
      const pending = projection?.pending ?? []
      const previous = knownPending.get(id)
      const live = liveRequestIds(pending)
      if (previous === undefined) {
        // First observation seeds the baseline: history is never re-notified.
        knownPending.set(id, live)
        for (const entry of pending) {
          waits.set(waitKey(id, entry.requestId), {
            key: waitKey(id, entry.requestId),
            sessionId: id,
            requestId: entry.requestId,
            kind: entry.kind,
            firstSeenAt: now,
            reminded: false,
          })
        }
        continue
      }
      // Same staleness rule as turns: an ask the fold only just caught up with
      // was already answered in reality, so it must not toast.
      const askIsFresh = projection !== undefined && isFresh(projection.updatedAt, now)
      for (const entry of newPending(previous, pending)) {
        if (!askIsFresh) {
          report('pending ' + entry.kind + ' ' + entry.requestId + ' (projection) stale -> suppressed')
          continue
        }
        notifyAsk({
          sessionId: id,
          requestId: entry.requestId,
          kind: entry.kind,
          summary: entry.summary,
          firstSeenAt: now,
          source: 'projection',
          label: toastName,
        })
      }
      for (const requestId of [...previous]) {
        if (!live.has(requestId)) {
          previous.delete(requestId)
          waits.delete(waitKey(id, requestId))
        }
      }
      for (const requestId of live) previous.add(requestId)
      knownPending.set(id, previous)
    }

    // Drop state for sessions that are gone.
    const liveSessions = new Set<string>(state.ids)
    for (const id of [...observedTurn.keys()]) if (!liveSessions.has(id)) observedTurn.delete(id)
    for (const id of [...knownPending.keys()]) if (!liveSessions.has(id)) knownPending.delete(id)
    for (const entry of [...waits.values()]) if (!liveSessions.has(entry.sessionId)) waits.delete(entry.key)
  }

  /**
   * Poll the host's question queue and notify for every new open question.
   *
   * This is the only source of question notifications: a service-level ask
   * (the plan review) never reaches a projection, and a global client plugin
   * cannot subscribe to the agent-scoped waterfall that carries it (measured),
   * so the host observes and the client decides.
   */
  const pollQuestions = (): void => {
    // Keep the OS-level focus answer warm, but only while the document claims to
    // be unfocused: that is the only case where it can change a decision.
    if (typeof document === 'undefined' || !document.hasFocus()) {
      refreshHostFocus()
    } else {
      hostFocused = false
      lastFocusAt = Date.now()
    }
    const fetchImpl = globalThis.fetch
    if (fetchImpl === undefined) return
    void fetchImpl(QUESTIONS_ROUTE, { headers: { [FOCUS_HEADER]: '1' } })
      .then(response => (response.ok ? response.json() : undefined))
      .then((payload: unknown) => {
        const items = (payload as { items?: unknown } | undefined)?.items
        if (!Array.isArray(items)) return
        for (const raw of items) {
          const item = raw as {
            seq?: unknown
            key?: unknown
            sessionId?: unknown
            kind?: unknown
            summary?: unknown
            at?: unknown
            open?: unknown
          }
          const seq = typeof item.seq === 'number' ? item.seq : 0
          const key = typeof item.key === 'string' ? item.key : ''
          const sessionId = typeof item.sessionId === 'string' ? item.sessionId : ''
          // A service-level ask carries no session the host can name; it still
          // deserves a toast, just without the session-jump click.
          if (seq === 0 || key === '') continue
          const waitId = waitKey(sessionId, key)
          if (item.open !== true) {
            waits.delete(waitId)
            continue
          }
          if (seq <= questionSeq) continue
          questionSeq = seq
          notifyAsk({
            sessionId,
            requestId: key,
            kind: item.kind === 'plan-review' ? 'plan-review' : 'question',
            summary: typeof item.summary === 'string' ? item.summary : '',
            firstSeenAt: typeof item.at === 'number' ? item.at : Date.now(),
            source: 'host queue',
            label: sessionLabel(sessionId),
          })
        }
      })
      .catch(() => undefined)
  }

  const remind = (): void => {
    const settings = store.getSnapshot()
    const now = Date.now()
    const focused = isFocused()
    for (const due of dueReminders([...waits.values()], settings, now)) {
      const current = waits.get(due.key)
      if (current === undefined || current.reminded) continue
      waits.set(due.key, { ...current, reminded: true })
      if (focused) continue
      showToast({
        title: toastTitle(sessionLabel(due.sessionId), t('notify.shortReminder')),
        body: fmt(t('notify.reminderBody'), { minutes: String(settings.remindAfterMinutes) }),
        tag: reminderTag(due.sessionId, due.requestId),
        sound: groupSound(settings, 'reminder'),
        onClick: () => {
          activate(due.sessionId)
        },
      })
    }
  }

  const sendTest = (sound?: SoundId): void => {
    // A fresh tag per click: a stale same-tag entry in the action center would
    // otherwise swallow the next test. previewToast always takes the host path
    // so the exact sound plays, focus or not.
    previewToast({
      title: t('notify.testTitle'),
      body: t('notify.testBody'),
      tag: 'dsh-notify-test-' + String(Date.now()),
      sound: sound ?? groupSound(store.getSnapshot(), 'finished'),
      onClick: () => {
        void focusWindowRequest()
      },
    })
  }

  ctx.effect(() => {
    // Coming back to the window is the user answering the notification: a sound
    // that is still playing should stop right there. Same route as the sound
    // switch, and a no-op when nothing is playing.
    const onFocus = (): void => {
      lastFocusAt = Date.now()
      hostFocused = false
      void silenceSounds().then(() => undefined, () => {
        // The host reports a successful stop itself; only a failure needs a line.
        report('silence request failed')
      })
    }
    const onBlur = (): void => {
      // The document may have lost focus to another view of this same window,
      // so ask the OS before believing that the user walked away.
      refreshHostFocus()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
  })

  ctx.effect(() => {
    const reseed = (): void => {
      observedTurn.clear()
      knownPending.clear()
      waits.clear()
    }
    const offReset = ctx.on('connection/reset', reseed)
    // Seed before subscribing so a pre-existing completion is not re-notified.
    tick()
    const off = sessions.list.subscribe(tick)
    return () => {
      off()
      offReset()
    }
  }, 'dsh-notify-desktop: session watcher')

  ctx.effect(() => {
    const timer = setInterval(remind, REMINDER_TICK_MS)
    return () => {
      clearInterval(timer)
    }
  }, 'dsh-notify-desktop: reminder timer')

  ctx.effect(() => {
    const timer = setInterval(pollQuestions, QUESTION_POLL_MS)
    return () => {
      clearInterval(timer)
    }
  }, 'dsh-notify-desktop: question poll')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'notify',
    order: 60,
    label: () => t('nav'),
    locale: NS,
    inject: (): NotifySectionInjected => ({
    store,
    set,
    sendTest,
    pickFile: pickSoundFile,
    loadLibrary: soundLibrary,
    importSound,
    deleteSound,
    cacheInfo: soundCacheInfo,
    clearCache: clearSoundCache,
  }),
  }, NotifySettingsSection))
}
