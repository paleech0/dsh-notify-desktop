/**
 * The notification decision: everything between "the session list changed" and
 * "show a toast", expressed as pure functions over injected clock and view
 * state. No DOM read and no `Date.now()` happens in here, so every rule is
 * unit-testable.
 *
 * Semantics follow the ZCode reference behaviour: master switch, per-situation
 * switch, edge-triggered only, a short de-duplication window keyed by turn or
 * request id, and no toast while the user is already looking at that session.
 * Every toast also carries its situation, which is what the per-situation sound
 * and popup-text choices are keyed by.
 */
import type { NotifyReason, NotifySettings, PendingKind, SoundId } from '../types.ts'
import type { NotifyScenario } from '../scenarios.ts'

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

/** The situation one turn-end reason belongs to. */
export function scenarioOfReason(reason: NotifyReason): NotifyScenario {
  switch (reason) {
    case 'completed': return 'completed'
    case 'error': return 'error'
    case 'aborted': return 'aborted'
    case 'blocked': return 'blocked'
    case 'max-tokens': return 'max-tokens'
  }
}

/** The situation one blocking interaction belongs to. */
export function scenarioOfPending(kind: PendingKind): NotifyScenario {
  switch (kind) {
    case 'approval': return 'approval'
    case 'question': return 'question'
    case 'plan-review': return 'plan-review'
  }
}

/** The situation one trigger belongs to. */
export function scenarioOfTrigger(trigger: NotifyTrigger): NotifyScenario {
  return trigger.kind === 'turn' ? scenarioOfReason(trigger.reason) : scenarioOfPending(trigger.pending)
}

/**
 * Whether a situation is switched on.
 *
 * The reminder has no switch of its own: it only exists while at least one
 * waiting situation is enabled, and each tracked wait is additionally filtered
 * by its own kind inside {@link dueReminders}.
 * @param settings - the live settings.
 * @param scenario - the situation to test.
 * @returns true when the situation may notify.
 */
export function scenarioEnabled(settings: NotifySettings, scenario: NotifyScenario): boolean {
  switch (scenario) {
    case 'completed': return settings.notifyCompleted
    case 'error': return settings.notifyError
    case 'aborted': return settings.notifyAborted
    case 'blocked': return settings.notifyBlocked
    case 'max-tokens': return settings.notifyMaxTokens
    case 'approval': return settings.notifyApproval
    case 'question': return settings.notifyQuestion
    case 'plan-review': return settings.notifyPlanReview
    case 'reminder':
      return settings.notifyApproval || settings.notifyQuestion || settings.notifyPlanReview
  }
}

/**
 * The sound one situation plays.
 *
 * `sound`-only mode plays the situation's own choice; `notify`-only mode mutes
 * every toast (the sound-only route never runs for it); `both` is the
 * historical behaviour. The old `soundEnabled` boolean and its AND with the
 * master switch collapse into this one field.
 * @param settings - the live settings.
 * @param scenario - the situation.
 * @returns the chosen sound, or 'silent' when toasts are muted.
 */
export function scenarioSound(settings: NotifySettings, scenario: NotifyScenario): SoundId {
  return settings.mode === 'notify' ? 'silent' : settings.sounds[scenario]
}

/**
 * Whether a notification in this mode plays a sound without raising a toast.
 * The caller routes the decision to the host's sound-only route instead of
 * showing anything.
 * @param settings - the live settings.
 * @returns true when nothing visual is raised.
 */
export function isSoundOnly(settings: NotifySettings): boolean {
  return settings.mode === 'sound'
}

/** A decision to show one toast. */
export interface NotifyDecision {
  /** The situation the signal belongs to. */
  readonly scenario: NotifyScenario
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
  const scenario = scenarioOfTrigger(trigger)
  if (!scenarioEnabled(settings, scenario)) return null
  // ZCode's window suppression: while the harness window is focused the user is
  // already in front of the app, so nothing toasts. 0.2.0-rc.2 exposes no
  // "currently open session" signal, so the focused window is the whole input.
  if (input.focused) return null
  const window = input.dedupeWindowMs ?? DEDUPE_MS
  const seenAt = input.recent.get(input.dedupeKey)
  if (seenAt !== undefined && input.now - seenAt < window) return null
  return {
    scenario,
    sound: scenarioSound(settings, scenario),
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
