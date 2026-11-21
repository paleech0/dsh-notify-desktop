/**
 * dsh-notify-desktop client half.
 *
 * Reads the host `notify` projection off the session list (the projection seam
 * delivers it for every session, so a background session notifies exactly like
 * the visible one), decides whether the signal deserves a Windows toast, shows
 * it, and — on click — raises the window and jumps to that session.
 *
 * Every situation carries its own sound and popup text. The sounds are a plain
 * settings map; the texts are saved by the host to disk and cached here, with
 * only the chosen template id in the settings.
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
import {
  asReason,
  decideNotification,
  isSoundOnly,
  rememberDecision,
  scenarioEnabled,
  scenarioOfPending,
  scenarioOfReason,
  scenarioSound,
} from './decision.ts'
import { NS, en, fmt, zh } from './locales.ts'
import { createTranslator, resolveLanguage, type ResolvedLanguage } from './language.ts'
import { activateSession, focusWindowRequest } from './navigate.ts'
import {
  ensureNotificationPermission,
  appWindowFocused,
  clearSoundCache,
  deleteSound,
  importSound,
  renameSound,
  notificationTag,
  pendingTag,
  pickSoundFile,
  playSoundOnly,
  previewToast,
  silenceSounds,
  soundCacheInfo,
  soundLibrary,
  reminderTag,
  report,
  shortScenarioKey,
  showToast,
} from './notifier.ts'
import type { PendingKind, PluginLanguage } from '../types.ts'
import { DEFAULT_BODY_TEMPLATE, DEFAULT_TEXT_CHOICE, DEFAULT_TITLE_TEMPLATE } from '../types.ts'
import {
  SCENARIO_IDS,
  TEXT_LIMIT_PER_SCENARIO,
  templateOf,
  type NotifyScenario,
} from '../scenarios.ts'
import { plainSummary, workspaceName } from './summary.ts'
import { renderBody, renderTitle, type TemplateParts } from './template.ts'
import { dueReminders, type PendingWait } from './reminder.ts'
import { FOCUS_HEADER, QUESTIONS_ROUTE } from '../protocol.ts'
import {
  ASK_TWIN_MS,
  NOTIFY_PROJECTION_KEY,
  askKey,
  isFresh,
  newPending,
  recentlyKeyed,
  turnAdvance,
} from './runner.ts'
import { NotifySettingsSection, type NotifySectionInjected } from './SettingsSection.tsx'
import { createSettingsStore } from './settings.ts'
import { createTextStore } from './texts.ts'
import { pushNotification } from './channels.ts'
import { adoptStyles } from './styles.ts'

/**
 * Required client services: the session list, the slot registry, the locale
 * registry, and the remote channel that forwards questions.
 */
export const inject = ['sessions', 'slots', 'locale']

/**
 * The list-row field this half reads beyond the published `SessionListState`:
 * a delegated child row carries `origin: 'subagent'` (the sidebar hides those
 * rows by the same field), while an ordinary or forked conversation has none.
 */
interface SessionRowOrigin {
  readonly origin?: 'subagent'
}

/** The slice of the sessions service this plugin reads. */
interface SessionsListFace {
  readonly list: {
    getSnapshot(): SessionListState
    subscribe(listener: () => void): () => void
  }
}

/** The slice of the workspace service this plugin uses. */
interface WorkspaceFace {
  /** `openSession` takes a session id or a subagent address; we only need the id. */
  openSession?(target: unknown): void
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
  const store = createSettingsStore()
  /** The DSH interface locale id, which the `auto` language choice follows. */
  const activeLocale = (): string => {
    try {
      return ctx.locale.getSnapshot().active
    } catch {
      // A locale service that cannot answer yet reads as English, which is the
      // documented fallback for every locale this plugin does not ship.
      return 'en'
    }
  }
  /** The language the plugin's own copy uses right now. */
  const language = (): ResolvedLanguage => resolveLanguage(store.getSnapshot().language, activeLocale())
  // Read through this instead of ctx.locale.bind: the section's toggle pins the
  // plugin's language without touching the rest of the app.
  const t = createTranslator(language)
  const texts = createTextStore()
  const set = (patch: Parameters<typeof store.update>[0]): void => {
    store.update(patch)
    // A file sound is played by a host child that would otherwise run to the
    // end of its wav; switching the master off, or the mode to notify-only,
    // must stop the sound that is already playing right away.
    if (patch.enabled === false || patch.mode === 'notify') void silenceSounds()
  }
  // Read through the service store rather than the ctx.sessions property proxy:
  // the host session package merges a different sessions member and the two
  // collide in one bundle.
  const sessions = ctx.get('sessions') as unknown as SessionsListFace
  const workspace = ctx.get('uiWorkspace') as WorkspaceFace | undefined
  const recent = new Map<string, number>()
  /**
   * The session the user is currently viewing: the last one they opened in the
   * sidebar. DSH exposes no "currently open session" signal, so we learn it by
   * observing `openSession`. Until the first navigation it is undefined, and the
   * per-session muting rule then simply does nothing.
   */
  let activeSessionId: string | undefined = undefined
  /**
   * Extract a session id from an `openSession` argument (a bare id, or a
   * subagent address carrying one) and remember it as the viewed session.
   * @param target - the argument the workspace service was called with.
   */
  const trackViewedSession = (target: unknown): void => {
    const id = typeof target === 'string'
      ? target
      : (target !== null && typeof target === 'object' && typeof (target as { sessionId?: unknown }).sessionId === 'string'
        ? (target as { sessionId: string }).sessionId
        : undefined)
    if (id !== undefined) activeSessionId = id
  }
  // Observe every `openSession` navigation by wrapping the method on the same
  // service instance the UI uses. A sidebar click then records the viewed
  // session. If the instance cannot be patched, the feature degrades to a no-op
  // rather than throwing.
  if (workspace !== undefined && typeof workspace.openSession === 'function') {
    const originalOpen = (workspace.openSession as (target: unknown) => void).bind(workspace)
    try {
      Object.defineProperty(workspace, 'openSession', {
        configurable: true,
        writable: true,
        value: (target: unknown): void => {
          trackViewedSession(target)
          originalOpen(target)
        },
      })
    } catch {
      report('could not observe openSession; viewed-session muting disabled')
    }
  }
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

  /** Whether a session is a delegated child (a `subagent` row on the list). */
  const isSubagentSession = (sessionId: string): boolean => {
    const rows = sessions.list.getSnapshot().byId as unknown as Record<string, SessionRowOrigin | undefined>
    return rows[sessionId]?.origin === 'subagent'
  }

  /**
   * Compose one situation's popup text: its chosen template, or the built-in
   * one when the choice is `default` or the saved template vanished.
   * @param scenario - the situation being announced.
   * @param parts - the live placeholder values.
   * @param fallbackBody - the line used when the body has no content at all.
   * @returns the title and body to hand to the toast layer.
   */
  const textFor = (
    scenario: NotifyScenario,
    parts: { readonly workspace: string; readonly status: string; readonly body: string; readonly minutes?: string },
    fallbackBody: string,
  ): { title: string; body: string } => {
    const choice = store.getSnapshot().texts[scenario]
    const template = choice === DEFAULT_TEXT_CHOICE ? undefined : templateOf(texts.getSnapshot(), scenario, choice)
    if (choice !== DEFAULT_TEXT_CHOICE && template === undefined) {
      report('text template missing: ' + scenario + ' ' + choice + ' -> default')
    }
    return {
      title: renderTitle(template === undefined ? DEFAULT_TITLE_TEMPLATE : template.title, parts),
      body: renderBody(template === undefined ? DEFAULT_BODY_TEMPLATE : template.body, parts, fallbackBody),
    }
  }

  /**
   * The body fallback of one situation's built-in wording: the line shown when
   * a template's `{内容}` has nothing to fill in.
   * @param scenario - the situation.
   * @returns the fallback line.
   */
  const fallbackBodyOf = (scenario: NotifyScenario): string => {
    switch (scenario) {
      case 'completed':
      case 'error':
      case 'aborted':
      case 'blocked':
      case 'max-tokens':
        return t('notify.emptyBody')
      case 'approval':
      case 'question':
      case 'plan-review':
        return t('notify.pendingBody')
      case 'reminder':
        return fmt(t('notify.reminderBody'), { minutes: String(store.getSnapshot().remindAfterMinutes) })
    }
  }

  /**
   * Mirror one situation out to the external channels (Bark / Telegram / …).
   *
   * It rides the same decision that raised the toast, so it fires exactly when
   * the toast would (never while the window is focused, per the subagent gears,
   * or for a muted viewed session) — pushing to the phone only when the user is
   * away. The title/body come from the same template the toast uses. Level is a
   * coarse severity for the channels that rank messages.
   * @param scenario - the situation being announced.
   * @param parts - the live placeholder values.
   * @param fallbackBody - the line used when the body has no content.
   */
  const emitExternal = (
    scenario: NotifyScenario,
    parts: { readonly workspace: string; readonly status: string; readonly body: string; readonly minutes?: string },
    fallbackBody: string,
  ): void => {
    const text = textFor(scenario, parts, fallbackBody)
    const level = scenario === 'error'
      ? 'error'
      : scenario === 'approval' || scenario === 'question' || scenario === 'plan-review' || scenario === 'reminder'
        ? 'warning'
        : 'info'
    pushNotification({
      title: text.title,
      body: text.body,
      level,
      scenario,
      source: parts.workspace,
      timestamp: Date.now(),
      vars: {
        '工作区': parts.workspace,
        '状态': parts.status,
        '内容': parts.body,
        '分钟': parts.minutes ?? '',
      },
    })
  }

  /**
   * Move the first template iteration's global title/body pair into the saved
   * text library: one template per enabled situation, selected for it.
   *
   * The pair lived in the settings; its content belongs on disk now. Running
   * this at start-up (after the library has loaded) keeps the migration out of
   * the synchronous settings reader, and leaving `legacyText` in place until it
   * succeeds makes a failed host call retry on the next launch.
   */
  const migrateLegacyText = async (): Promise<void> => {
    const settings = store.getSnapshot()
    const legacy = settings.legacyText
    if (legacy === null) return
    const name = t('notify.legacyTextName')
    const nextTexts = { ...settings.texts }
    let migrated = 0
    for (const scenario of SCENARIO_IDS) {
      if (!scenarioEnabled(settings, scenario)) continue
      const library = texts.getSnapshot()
      const existing = library[scenario].find(entry => entry.title === legacy.title && entry.body === legacy.body)
      if (existing !== undefined) {
        if (nextTexts[scenario] === DEFAULT_TEXT_CHOICE) nextTexts[scenario] = existing.id
        continue
      }
      if (library[scenario].length >= TEXT_LIMIT_PER_SCENARIO) continue
      const saved = await texts.save(scenario, { name, title: legacy.title, body: legacy.body })
      if (!saved.ok) {
        report('legacy text migration failed: ' + scenario + ' ' + saved.problem)
        return
      }
      nextTexts[scenario] = saved.template.id
      migrated += 1
    }
    store.update({ texts: nextTexts, legacyText: null })
    report('legacy text migrated into ' + String(migrated) + ' situation(s)')
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
    /** The owning session's list origin, when the caller already knows it. */
    readonly sessionOrigin?: 'subagent'
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
    const sessionOrigin = ask.sessionOrigin ?? (isSubagentSession(ask.sessionId) ? 'subagent' : undefined)
    // The `silent` gear drops a child's waits entirely: no toast, and no wait
    // entry either, so its reminder cannot fire later.
    const silencedChild = sessionOrigin === 'subagent' && settings.subagentMode === 'silent'
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
      ...(sessionOrigin === undefined ? {} : { sessionOrigin }),
      ...(activeSessionId === undefined ? {} : { activeSessionId }),
      focused,
      dedupeKey: ask.sessionId + ':request:' + ask.requestId,
      now,
      recent,
    })
    if (!silencedChild) {
      waits.set(waitKey(ask.sessionId, ask.requestId), {
        key: waitKey(ask.sessionId, ask.requestId),
        sessionId: ask.sessionId,
        requestId: ask.requestId,
        kind: ask.kind,
        summary: ask.summary,
        firstSeenAt: ask.firstSeenAt,
        reminded: false,
        lastRemindedAt: 0,
      })
    }
    const mutedViewed = decision === null && !settings.notifyViewedUnfocused && activeSessionId !== undefined && ask.sessionId === activeSessionId
    const delivery = decision === null
      ? (silencedChild ? 'suppressed (subagent silent)' : mutedViewed ? 'suppressed (viewed session)' : 'suppressed')
      : isSoundOnly(settings) ? 'sound-only' : 'toast'
    report('pending ' + where + ' focused=' + String(focused) + ' -> ' + delivery)
    if (decision === null) return
    const scenario = scenarioOfPending(ask.kind)
    const parts = {
      workspace: ask.label,
      status: t(shortScenarioKey(scenario)),
      body: plainSummary(ask.summary),
    }
    emitExternal(scenario, parts, fallbackBodyOf(scenario))
    if (isSoundOnly(settings)) {
      // The sound-only mode never raises anything: the decision's sound goes to
      // the host's sound-only route and the ask stays invisible.
      playSoundOnly(decision.sound)
    } else {
      const text = textFor(scenario, parts, fallbackBodyOf(scenario))
      showToast({
        title: text.title,
        body: text.body,
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
    }
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

  /**
   * Ask the host for the OS-level answer and remember it.
   * @param fresh - bypass the host's cache (the window just lost focus).
   */
  const refreshHostFocus = (fresh = false): void => {
    void appWindowFocused(fresh).then(focused => {
      hostFocused = focused
    }, () => undefined)
  }

  /**
   * The name a notification shows for one session.
   *
   * The workspace (recognisable) rather than the session's DSH-generated
   * one-word title. Computed only when a toast is actually composed.
   * @param summary - the session row.
   * @returns the display name, or '' when the row carries none.
   */
  const toastNameOf = (
    summary: { readonly cwd?: string; readonly displayTitle?: string; readonly title?: string },
  ): string => workspaceName(summary.cwd) || summary.displayTitle || summary.title || ''

  const tick = (): void => {
    const state = sessions.list.getSnapshot()
    const settings = store.getSnapshot()
    const now = Date.now()
    const focused = isFocused()
    // Two suppression inputs: the focused window (nothing toasts while the user
    // is in front of the app), and the session the user is currently viewing
    // (tracked via `openSession`, because DSH exposes no "currently open session"
    // signal of its own). In the background the viewed session is muted only when its always-mute switch is off; while focused the window rule above already covers it.
    for (const id of state.ids) {
      const summary = state.byId[id]
      if (summary === undefined) continue
      const sessionOrigin = (summary as unknown as SessionRowOrigin).origin
      const projection = summary.projectionValues?.[NOTIFY_PROJECTION_KEY]
      // The cheap shape is the whole comparison key. Building the pending id
      // list and the workspace name for every session on every tick was the
      // bulk of this loop's work, and neither is needed until something changed
      // or a toast is actually composed.
      const shape = projection === undefined
        ? 'absent'
        : projection.turn + '/' + projection.reason + '/pending:' + String(projection.pending.length)
      // Only sessions that actually carry state are reported: the host keeps a
      // bounded ring of client lines, and a scan of every idle session would
      // evict the interesting ones.
      if (projection !== undefined && seenShape.get(id) !== shape) {
        seenShape.set(id, shape)
        const ownList = projection.pending.map(entry => entry.kind + ':' + entry.requestId).join('|')
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
            ...(sessionOrigin === undefined ? {} : { sessionOrigin }),
            ...(activeSessionId === undefined ? {} : { activeSessionId }),
            focused,
            dedupeKey,
            now,
            recent,
          })
        const mutedSubagent = decision === null && sessionOrigin === 'subagent'
        const mutedViewed = decision === null && !settings.notifyViewedUnfocused && activeSessionId !== undefined && id === activeSessionId
        const delivery = decision === null
          ? (mutedSubagent ? 'suppressed (subagent ' + settings.subagentMode + ')' : mutedViewed ? 'suppressed (viewed session)' : 'suppressed')
          : isSoundOnly(settings) ? 'sound-only' : 'toast'
        report('turn ' + String(projection.turn) + ' reason=' + String(reason)
          + ' focused=' + String(focused) + ' -> ' + delivery)
        if (decision !== null && reason !== undefined) {
          const scenario = scenarioOfReason(reason)
          const parts = {
            workspace: toastNameOf(summary),
            status: t(shortScenarioKey(scenario)),
            body: plainSummary(projection.body),
          }
          emitExternal(scenario, parts, fallbackBodyOf(scenario))
          if (isSoundOnly(settings)) {
            playSoundOnly(decision.sound)
          } else {
            const text = textFor(scenario, parts, fallbackBodyOf(scenario))
            showToast({
              title: text.title,
              body: text.body,
              tag: notificationTag(id, projection.turn),
              sound: decision.sound,
              onClick: () => {
                activate(id)
              },
            })
          }
          rememberDecision(recent, dedupeKey, now)
        }
      }

      // --- blocking interactions ------------------------------------------
      // This fold covers approvals and tool-call questions (tool/call and
      // tool/ptc-dispatch*); service-level asks such as the plan review never
      // reach the session log and arrive through the host's queue instead.
      const pending = projection?.pending ?? []
      const previous = knownPending.get(id)
      if (previous === undefined) {
        // First observation seeds the baseline: history is never re-notified.
        const seeded = new Set<string>()
        for (const entry of pending) {
          seeded.add(entry.requestId)
          waits.set(waitKey(id, entry.requestId), {
            key: waitKey(id, entry.requestId),
            sessionId: id,
            requestId: entry.requestId,
            kind: entry.kind,
            summary: entry.summary,
            firstSeenAt: now,
            reminded: false,
            lastRemindedAt: 0,
          })
        }
        knownPending.set(id, seeded)
        continue
      }
      // Same staleness rule as turns: an ask the fold only just caught up with
      // was already answered in reality, so it must not toast.
      const askIsFresh = projection !== undefined && isFresh(projection.updatedAt, now)
      const arrivals = newPending(previous, pending)
      for (const entry of arrivals) previous.add(entry.requestId)
      for (const entry of arrivals) {
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
          label: toastNameOf(summary),
          ...(sessionOrigin === undefined ? {} : { sessionOrigin }),
        })
      }
      // A departure is the only way the observed set can outgrow the projection,
      // so the live-id set is built only when that actually happened.
      if (previous.size !== pending.length) {
        const live = new Set<string>()
        for (const entry of pending) live.add(entry.requestId)
        for (const requestId of previous) {
          if (live.has(requestId)) continue
          previous.delete(requestId)
          waits.delete(waitKey(id, requestId))
        }
      }
      knownPending.set(id, previous)
    }

    // Drop state for sessions that are gone.
    const liveSessions = new Set<string>(state.ids)
    for (const id of [...observedTurn.keys()]) if (!liveSessions.has(id)) observedTurn.delete(id)
    for (const id of [...knownPending.keys()]) if (!liveSessions.has(id)) knownPending.delete(id)
    for (const id of [...seenShape.keys()]) if (!liveSessions.has(id)) seenShape.delete(id)
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
    const minutes = String(settings.remindAfterMinutes)
    for (const due of dueReminders([...waits.values()], settings, now)) {
      const wait = waits.get(due.key)
      if (wait === undefined) continue
      if (wait.reminded && settings.reminderMode !== 'repeat') continue
      waits.set(due.key, { ...wait, reminded: true, lastRemindedAt: now })
      if (focused) continue
      // The viewed session is redundant only when its always-mute switch is off; while focused the rule above already skips it.
      if (!settings.notifyViewedUnfocused && activeSessionId !== undefined && due.sessionId === activeSessionId) continue
      // A child session switched to `silent` after its wait was tracked must not
      // remind either: that gear promises nothing at all from a child.
      if (settings.subagentMode === 'silent' && isSubagentSession(due.sessionId)) continue
      const parts = {
        workspace: sessionLabel(due.sessionId),
        status: t(shortScenarioKey('reminder')),
        body: plainSummary(wait.summary),
        minutes,
      }
      emitExternal('reminder', parts, fallbackBodyOf('reminder'))
      const sound = scenarioSound(settings, 'reminder')
      if (isSoundOnly(settings)) {
        playSoundOnly(sound)
        continue
      }
      const text = textFor('reminder', parts, fallbackBodyOf('reminder'))
      // The sticky mode is only worth its extra plumbing on the first reminder:
      // a toast that never leaves the screen must not be raised twice.
      const sticky = settings.reminderMode === 'sticky' && !wait.reminded
      showToast({
        title: text.title,
        body: text.body,
        tag: reminderTag(due.sessionId, due.requestId) + (sticky ? '-s' : ''),
        sound,
        sticky,
        ...(sticky ? { dismissLabel: t('notify.dismiss') } : {}),
        onClick: () => {
          activate(due.sessionId)
        },
      })
    }
  }

  /** The test toast: fixed copy, fixed default sound, immune to every setting below the master switch. */
  const sendTest = (): void => {
    // A fresh tag per click: a stale same-tag entry in the action center would
    // otherwise swallow the next test. previewToast always takes the host path
    // so the toast pops, focus or not.
    previewToast({
      title: t('notify.testTitle'),
      body: t('notify.testBody'),
      tag: 'dsh-notify-test-' + String(Date.now()),
      sound: 'system:default',
      onClick: () => {
        void focusWindowRequest()
      },
    })
  }

  /**
   * The placeholder values one preview renders with: a real workspace name when
   * there is one, and obvious sample text for everything else.
   * @param scenario - the situation being previewed.
   * @returns the values the chosen text is filled with.
   */
  const previewParts = (scenario: NotifyScenario): TemplateParts => {
    const ids = sessions.list.getSnapshot().ids
    const first = ids.length > 0 ? ids[0] : undefined
    const label = first === undefined ? '' : sessionLabel(first)
    const parts: TemplateParts = {
      workspace: label === '' ? t('notify.previewWorkspace') : label,
      status: t(shortScenarioKey(scenario)),
      body: t('notify.previewSampleBody'),
    }
    // Only the reminder has a value for {分钟}; everywhere else the token must
    // vanish in the preview exactly like it does in a real notification.
    return scenario === 'reminder'
      ? { ...parts, minutes: String(store.getSnapshot().remindAfterMinutes) }
      : parts
  }

  /**
   * Audition one situation the way a real notification in the current mode
   * would deliver it: its chosen text and sound, toast + sound, muted toast, or
   * the sound alone.
   * @param scenario - the situation whose settings to show.
   */
  const previewScenario = (scenario: NotifyScenario): void => {
    const settings = store.getSnapshot()
    const sound = scenarioSound(settings, scenario)
    if (isSoundOnly(settings)) {
      report('preview sound-only: ' + scenario + ' sound=' + sound)
      playSoundOnly(sound)
      return
    }
    const parts = previewParts(scenario)
    const text = textFor(scenario, parts, fallbackBodyOf(scenario))
    report('preview ' + scenario + ' mode=' + settings.mode + ' sound=' + sound)
    previewToast({
      title: text.title,
      body: text.body,
      tag: 'dsh-notify-preview-' + scenario + '-' + String(Date.now()),
      sound,
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
      // so ask the OS before believing that the user walked away — and ask for a
      // fresh answer, because the cached one predates the switch.
      refreshHostFocus(true)
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
  })

  // The saved popup texts live on disk; load them once, then finish any
  // template migration the previous shape left behind.
  void texts.load().then(() => migrateLegacyText(), () => undefined)

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

  // The settings navigation reads this entry's label, and a fresh registration is
  // what makes it re-read one — so a plugin-language change re-registers the
  // section instead of leaving an English "Notifications" beside Chinese copy.
  ctx.slots.inject('settings.section', () => {
    const register = (): (() => void) => ctx.slots.register({
      name: 'settings.section',
      id: 'notify',
      order: 60,
      label: () => t('nav'),
      locale: NS,
      inject: (): NotifySectionInjected => ({
        store,
        set,
        sendTest,
        previewScenario,
        texts,
        pickFile: pickSoundFile,
        loadLibrary: soundLibrary,
        importSound,
        deleteSound,
        renameSound,
        cacheInfo: soundCacheInfo,
        clearCache: clearSoundCache,
        tr: t,
        language,
        setLanguage: (value: PluginLanguage) => {
          set({ language: value })
        },
        subscribeLanguage: (listener: () => void) => {
          const offStore = store.subscribe(listener)
          const offLocale = ctx.locale.subscribe(listener)
          return () => {
            offStore()
            offLocale()
          }
        },
      }),
    }, NotifySettingsSection)
    let dispose = register()
    let current = language()
    /** Re-register only when the resolved language really changed. */
    const refresh = (): void => {
      const next = language()
      if (next === current) return
      current = next
      dispose()
      dispose = register()
    }
    const offStore = store.subscribe(refresh)
    const offLocale = ctx.locale.subscribe(refresh)
    return () => {
      offStore()
      offLocale()
      dispose()
    }
  })
}
