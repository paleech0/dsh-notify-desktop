/**
 * The waiting-confirmation reminder (decision D5): when a session has been
 * blocked on the user for longer than the configured window and the first
 * toast did not get a reaction, one extra toast is sent. Pure decision here,
 * timer in the plugin body.
 */
import type { NotifySettings, PendingKind } from '../types.ts';
/** The default reminder delay, in minutes. */
export declare const REMIND_DEFAULT_MINUTES = 10;
/** One blocking interaction the client is tracking. */
export interface PendingWait {
    /** `sessionId:requestId` — the identity used by the reminder bookkeeping. */
    readonly key: string;
    readonly sessionId: string;
    readonly requestId: string;
    readonly kind: PendingKind;
    /** When the wait was first observed (client clock, ms). */
    readonly firstSeenAt: number;
    /** Whether the single reminder for this wait has already been sent. */
    readonly reminded: boolean;
}
/** Convert the configured minutes into milliseconds (at least one minute). */
export declare function remindAfterMs(minutes: number): number;
/**
 * Pick the waits that are due for their one reminder.
 * @param waits - every currently tracked, still-unanswered wait.
 * @param settings - the live settings (master and per-scenario switches).
 * @param now - the current clock (ms).
 * @returns the waits to remind about, in tracking order.
 */
export declare function dueReminders(waits: readonly PendingWait[], settings: NotifySettings, now: number): PendingWait[];
