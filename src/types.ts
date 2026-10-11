/**
 * dsh-notify-desktop shared contract: the host projection's wire payload and
 * the client's persisted preferences.
 *
 * The host half registers one session projection (the session-projection seam
 * delivers it to every browser client without any harness allowlist change);
 * the client half reads it off the session list's `projectionValues`, decides
 * whether a Windows notification is warranted, and shows it. No harness source
 * is touched and no forwarded-event allowlist is extended.
 */
import type {} from '@deepseek-ai/dsh-session-projection/types'

/** Why a turn ended, restricted to the kinds worth a notification. */
export type NotifyReason = 'completed' | 'error' | 'aborted' | 'blocked' | 'max-tokens'

/** A live user interaction currently blocking a session. */
export type PendingKind = 'approval' | 'question' | 'plan-review'

/** One blocking interaction, keyed by the id its decision will arrive with. */
export interface PendingInteraction {
  /** Which interaction this is; `plan-review` is a question tagged with the plan-review intent. */
  readonly kind: PendingKind
  /** Approval request id or tool call id — the de-duplication key for notifications. */
  readonly requestId: string
  /** One-line human summary (tool name / approval reason / question header). */
  readonly summary: string
}

/**
 * The host projection's wire payload: the last finished turn plus every
 * interaction currently waiting on the user.
 */
export interface NotifyProjectionValue {
  /** The turn number that last ended (0 before the first finished turn). */
  readonly turn: number
  /** Why it ended — the raw TurnEndReason kind; the client maps the five known kinds. */
  readonly reason: string
  /** The turn's final assistant text, bounded host-side. */
  readonly body: string
  /** Every blocking interaction, in first-seen order. */
  readonly pending: readonly PendingInteraction[]
  /** Host clock (ms) of the last event folded into this value. */
  readonly updatedAt: number
}

/**
 * One selectable sound.
 *
 * Two kinds exist. An `event` is played by the toast itself (the only sounds
 * Microsoft's `toast > audio` reference accepts); a `file` names a wav inside
 * the Windows media folder, which the toast cannot reference at all — the host
 * plays it in the same process that raises the toast, with the toast muted.
 * The file kind exists because of a measurement: the five notification events
 * resolve to four wavs on this machine (SMS and IM are literally the same file)
 * and every one of them is a short, near-identical chime.
 */
export interface SoundChoice {
  /** Stable id persisted in the settings. */
  readonly id: string
  /** A `ms-winsoundevent:` value, when the toast can play this sound itself. */
  readonly event?: string
  /** A file name inside the Windows media folder, played by the host. */
  readonly file?: string
}

/** The selectable sounds, softest first. */
export const SOUND_CHOICES: readonly SoundChoice[] = Object.freeze([
  { id: 'system:default', event: 'ms-winsoundevent:Notification.Default' },
  { id: 'system:im', event: 'ms-winsoundevent:Notification.IM' },
  { id: 'system:mail', event: 'ms-winsoundevent:Notification.Mail' },
  { id: 'system:calendar', event: 'ms-winsoundevent:Notification.Reminder' },
  { id: 'file:ding', file: 'ding.wav' },
  { id: 'file:chimes', file: 'chimes.wav' },
  { id: 'file:notify', file: 'Windows Notify.wav' },
  { id: 'file:notify-legacy', file: 'notify.wav' },
  { id: 'file:message-nudge', file: 'Windows Message Nudge.wav' },
  { id: 'file:tada', file: 'tada.wav' },
  { id: 'file:exclamation', file: 'Windows Exclamation.wav' },
  { id: 'file:error', file: 'Windows Error.wav' },
  { id: 'file:critical-stop', file: 'Windows Critical Stop.wav' },
  { id: 'file:alarm-1', file: 'Alarm01.wav' },
  { id: 'file:alarm-2', file: 'Alarm02.wav' },
  { id: 'file:alarm-3', file: 'Alarm03.wav' },
  { id: 'file:ring-1', file: 'Ring01.wav' },
  { id: 'file:ring-2', file: 'Ring02.wav' },
  { id: 'file:ring-3', file: 'Ring03.wav' },
  { id: 'silent' },
])

/**
 * One selectable sound's id.
 *
 * Three shapes exist: a fixed id from {@link SOUND_CHOICES} ('silent',
 * 'system:*', 'file:*'), an `author:<file>` for a sound shipped with the
 * plugin, and a `custom:<file>` for a file the user imported into the
 * custom-sound folder. The two library shapes are produced by the host's
 * folder listing, never typed by hand.
 */
export type SoundId = string

/** The sounds the two library folders currently hold. */
export interface SoundLibrary {
  /** Sounds shipped with the plugin. */
  readonly author: readonly LibrarySound[]
  /** Sounds the user imported. */
  readonly custom: readonly LibrarySound[]
}

/** One sound in a library folder. */
export interface LibrarySound {
  /** The id to store, e.g. 'custom:chime.mp3'. */
  readonly id: string
  /** The display name (file name without its extension). */
  readonly name: string
  /** The file name on disk. */
  readonly file: string
  /** Size in bytes. */
  readonly bytes: number
}

/** How a sound is played. */
export interface ResolvedSound {
  /** The toast event to embed, when there is one. */
  readonly event?: string
  /** The media file to play from the host, when there is one. */
  readonly file?: string
  /** Whether this choice means silence. */
  readonly silent: boolean
}

/**
 * Resolve one sound id.
 * @param id - a `SoundChoice` id, or anything else (treated as the default).
 * @returns how to play it; unknown ids fall back to the default event.
 */
export function resolveSound(id: SoundId): ResolvedSound {
  const choice = SOUND_CHOICES.find(entry => entry.id === id)
  if (choice === undefined) return { event: 'ms-winsoundevent:Notification.Default', silent: false }
  if (choice.id === 'silent') return { silent: true }
  return {
    ...(choice.event === undefined ? {} : { event: choice.event }),
    ...(choice.file === undefined ? {} : { file: choice.file }),
    silent: false,
  }
}

/** Every selectable id, for validation. */
export const SOUND_IDS: readonly string[] = Object.freeze(SOUND_CHOICES.map(choice => choice.id))

/**
 * The four situations that can sound different.
 *
 * Nine scenarios would be more flexible but a nuisance to configure; these four
 * match what a user actually distinguishes: something finished, something
 * failed, something is waiting for you, and the reminder that it is still
 * waiting.
 */
export const SOUND_GROUPS = Object.freeze(['finished', 'error', 'attention', 'reminder'] as const)

/** One situation group. */
export type SoundGroup = (typeof SOUND_GROUPS)[number]

/** The chosen sound per situation group. */
export type NotifySounds = Readonly<Record<SoundGroup, SoundId>>

/** The client-persisted notification preferences. */
export interface NotifySettings {
  /** Master switch; false disables every notification. */
  readonly enabled: boolean
  /** Whether toasts play a sound at all; false silences every group. */
  readonly soundEnabled: boolean
  /** The sound each situation group plays. */
  readonly sounds: NotifySounds
  readonly notifyCompleted: boolean
  readonly notifyError: boolean
  readonly notifyAborted: boolean
  readonly notifyBlocked: boolean
  readonly notifyMaxTokens: boolean
  /** Notify while a session waits for a tool-approval decision. */
  readonly notifyApproval: boolean
  /** Notify while a session waits for an answer to a question. */
  readonly notifyQuestion: boolean
  /** Notify while a session waits for a plan review. */
  readonly notifyPlanReview: boolean
  /** Minutes an unanswered blocking interaction may wait before one reminder. */
  readonly remindAfterMinutes: number
}

/**
 * Defaults: everything on, sounds on, one reminder after ten minutes.
 *
 * The sound defaults are the set the user auditioned against: chimes for work
 * that simply finished, the unmistakable Windows error for a failure, ding for
 * anything waiting on the user, and Exclamation for the nudge that it is still
 * waiting.
 */
export const DEFAULT_SETTINGS: NotifySettings = Object.freeze({
  enabled: true,
  soundEnabled: true,
  sounds: Object.freeze({
    finished: 'file:chimes',
    error: 'file:error',
    attention: 'file:ding',
    reminder: 'file:exclamation',
  }) satisfies NotifySounds,
  notifyCompleted: true,
  notifyError: true,
  notifyAborted: false,
  notifyBlocked: true,
  notifyMaxTokens: true,
  notifyApproval: true,
  notifyQuestion: true,
  notifyPlanReview: true,
  remindAfterMinutes: 10,
})

/** The reasons a turn may end with, in the client's notifiable vocabulary. */
export const NOTIFY_REASONS: readonly NotifyReason[] = Object.freeze([
  'completed',
  'error',
  'aborted',
  'blocked',
  'max-tokens',
])

/**
 * The client connection came back up; emitted by the api gateway's client
 * service. Declared here because 0.2.0-rc.2 ships no type entry for it, and the
 * runner re-seeds its baselines on that edge.
 */
declare module '@deepseek-ai/cordis' {
  interface Events {
    'connection/reset'(): void
  }
}

/** The projection key this plugin owns. */
declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    notify: NotifyProjectionValue
  }
}
