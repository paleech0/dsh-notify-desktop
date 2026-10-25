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
import type { NotifyReason, NotifySettings, PendingKind, SoundId } from '../types.ts';
import type { NotifyScenario } from '../scenarios.ts';
/** The de-duplication window: two identical signals inside it collapse into one. */
export declare const DEDUPE_MS = 3000;
/** Map a raw projection reason to a notifiable reason, or undefined when unknown. */
export declare function asReason(reason: string | undefined): NotifyReason | undefined;
/** Whether the per-outcome switch for a turn-end reason is on. */
export declare function reasonEnabled(settings: NotifySettings, reason: NotifyReason): boolean;
/** Whether the switch for one kind of blocking interaction is on. */
export declare function pendingEnabled(settings: NotifySettings, kind: PendingKind): boolean;
/** What triggered this decision. */
export type NotifyTrigger = {
    readonly kind: 'turn';
    readonly reason: NotifyReason;
} | {
    readonly kind: 'pending';
    readonly pending: PendingKind;
};
/** The situation one turn-end reason belongs to. */
export declare function scenarioOfReason(reason: NotifyReason): NotifyScenario;
/** The situation one blocking interaction belongs to. */
export declare function scenarioOfPending(kind: PendingKind): NotifyScenario;
/** The situation one trigger belongs to. */
export declare function scenarioOfTrigger(trigger: NotifyTrigger): NotifyScenario;
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
export declare function scenarioEnabled(settings: NotifySettings, scenario: NotifyScenario): boolean;
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
export declare function scenarioSound(settings: NotifySettings, scenario: NotifyScenario): SoundId;
/**
 * Whether a notification in this mode plays a sound without raising a toast.
 * The caller routes the decision to the host's sound-only route instead of
 * showing anything.
 * @param settings - the live settings.
 * @returns true when nothing visual is raised.
 */
export declare function isSoundOnly(settings: NotifySettings): boolean;
/** A decision to show one toast. */
export interface NotifyDecision {
    /** The situation the signal belongs to. */
    readonly scenario: NotifyScenario;
    /** The sound this toast plays ('silent' included). */
    readonly sound: SoundId;
    /** The de-duplication key this decision claims. */
    readonly dedupeKey: string;
}
/** The full input of one decision, all of it injected. */
export interface DecisionInput {
    readonly settings: NotifySettings;
    readonly trigger: NotifyTrigger;
    /** The session the signal belongs to. */
    readonly sessionId: string;
    /** Whether the application window has focus. */
    readonly focused: boolean;
    /** The de-duplication key for this exact signal. */
    readonly dedupeKey: string;
    /** Injected clock (ms). */
    readonly now: number;
    /** Recently shown dedupe keys with their timestamps. */
    readonly recent: ReadonlyMap<string, number>;
    /** The window inside which an identical key is dropped. */
    readonly dedupeWindowMs?: number;
}
/**
 * Decide whether one signal becomes a toast.
 * @param input - the settings, trigger, view state, clock, and dedupe memory.
 * @returns the decision, or null when this signal must stay silent.
 */
export declare function decideNotification(input: DecisionInput): NotifyDecision | null;
/**
 * Record one shown decision in the dedupe memory, pruning entries older than
 * the window so the map cannot grow without bound.
 * @param recent - the existing memory (mutated in place).
 * @param dedupeKey - the key to record.
 * @param now - the current clock (ms).
 * @param windowMs - the retention window.
 */
export declare function rememberDecision(recent: Map<string, number>, dedupeKey: string, now: number, windowMs?: number): void;
