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
import type { NotifyReason, NotifySettings, PendingKind, SoundGroup, SoundId } from '../types.ts';
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
/** Which of the four situations a trigger belongs to. */
export declare function soundGroupOf(trigger: NotifyTrigger): SoundGroup;
/**
 * The sound one situation group plays.
 * @param settings - the live settings.
 * @param group - the situation group.
 * @returns the chosen sound, or 'silent' when sounds are switched off.
 */
export declare function groupSound(settings: NotifySettings, group: SoundGroup): SoundId;
/** A decision to show one toast. */
export interface NotifyDecision {
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
