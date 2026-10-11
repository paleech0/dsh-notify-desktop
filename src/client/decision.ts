/**
 * The notification decision: everything between "the session list changed" and
 * "show a toast", expressed as pure functions over injected clock and view
 * state. No DOM read and no `Date.now()` happens in here, so every rule is
 * unit-testable.
 *
 * Semantics follow the ZCode reference behaviour: master switch, per-scenario
 * switch, edge-triggered only, a short de-duplication window keyed by turn or
 * request id, and no toast while the user is already looking at that session.
 */
import type { NotifyReason, NotifySettings, PendingKind, SoundGroup, SoundId } from '../types.ts'

/** The de-duplication window: two identical signals inside it collapse into one. */
export const DEDUPE_MS = 3000

/** Map a raw projection reason to a notifiable reason, or undefined when unknown. */
export function asReason(reason: string | undefined): NotifyReason | undefined {
  switch (reason) {
    case 'completed':
    case 'error':
    case 'aborted':
    case 'blocked':
    case 'max-tokens':
      return reason
    default:
      return undefined
  }
}

/** Whether the per-outcome switch for a turn-end reason is on. */
export function reasonEnabled(settings: NotifySettings, reason: NotifyReason): boolean {
  switch (reason) {
    case 'completed': return settings.notifyCompleted
    case 'error': return settings.notifyError
    case 'aborted': return settings.notifyAborted
    case 'blocked': return settings.notifyBlocked
    case 'max-tokens': return settings.notifyMaxTokens
  }
}

/** Whether the switch for one kind of blocking interaction is on. */
export function pendingEnabled(settings: NotifySettings, kind: PendingKind): boolean {
  switch (kind) {
    case 'approval': return settings.notifyApproval
    case 'question': return settings.notifyQuestion
    case 'plan-review': return settings.notifyPlanReview
  }
}

/** What triggered this decision. */
export type NotifyTrigger =
  | { readonly kind: 'turn'; readonly reason: NotifyReason }
  | { readonly kind: 'pending'; readonly pending: PendingKind }

/** Which of the four situations a trigger belongs to. */
export function soundGroupOf(trigger: NotifyTrigger): SoundGroup {
  if (trigger.kind === 'turn') return trigger.reason === 'error' ? 'error' : 'finished'
  return 'attention'
}

/**
 * The sound one situation group plays.
 * @param settings - the live settings.
 * @param group - the situation group.
 * @returns the chosen sound, or 'silent' when sounds are switched off.
 */
export function groupSound(settings: NotifySettings, group: SoundGroup): SoundId {
  return settings.soundEnabled ? settings.sounds[group] : 'silent'
}

/** A decision to show one toast. */
export interface NotifyDecision {
  /** The sound this toast plays ('silent' included). */
  readonly sound: SoundId
  /** The de-duplication key this decision claims. */
  readonly dedupeKey: string
}

/** The full input of one decision, all of it injected. */
export interface DecisionInput {
  readonly settings: NotifySettings
  readonly trigger: NotifyTrigger
  /** The session the signal belongs to. */
  readonly sessionId: string
  /** Whether the application window has focus. */
  readonly focused: boolean
  /** The de-duplication key for this exact signal. */
  readonly dedupeKey: string
  /** Injected clock (ms). */
  readonly now: number
  /** Recently shown dedupe keys with their timestamps. */
  readonly recent: ReadonlyMap<string, number>
  /** The window inside which an identical key is dropped. */
  readonly dedupeWindowMs?: number
}

/**
 * Decide whether one signal becomes a toast.
 * @param input - the settings, trigger, view state, clock, and dedupe memory.
 * @returns the decision, or null when this signal must stay silent.
 */
export function decideNotification(input: DecisionInput): NotifyDecision | null {
  const { settings, trigger } = input
  if (!settings.enabled) return null
  const scenarioOn = trigger.kind === 'turn'
    ? reasonEnabled(settings, trigger.reason)
    : pendingEnabled(settings, trigger.pending)
  if (!scenarioOn) return null
  // ZCode's window suppression: while the harness window is focused the user is
  // already in front of the app, so nothing toasts. 0.2.0-rc.2 exposes no
  // "currently open session" signal, so the focused window is the whole input.
  if (input.focused) return null
  const window = input.dedupeWindowMs ?? DEDUPE_MS
  const seenAt = input.recent.get(input.dedupeKey)
  if (seenAt !== undefined && input.now - seenAt < window) return null
  return {
    sound: groupSound(settings, soundGroupOf(trigger)),
    dedupeKey: input.dedupeKey,
  }
}

/**
 * Record one shown decision in the dedupe memory, pruning entries older than
 * the window so the map cannot grow without bound.
 * @param recent - the existing memory (mutated in place).
 * @param dedupeKey - the key to record.
 * @param now - the current clock (ms).
 * @param windowMs - the retention window.
 */
export function rememberDecision(
  recent: Map<string, number>,
  dedupeKey: string,
  now: number,
  windowMs: number = DEDUPE_MS,
): void {
  recent.set(dedupeKey, now)
  for (const [key, at] of recent) {
    if (now - at >= windowMs) recent.delete(key)
  }
}
