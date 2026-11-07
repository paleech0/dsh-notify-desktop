/**
 * The waiting-confirmation reminder (decision D5): when a session has been
 * blocked on the user for longer than the configured window and the first
 * toast did not get a reaction, one extra toast is sent. Pure decision here,
 * timer in the plugin body.
 */
import type { NotifySettings, PendingKind } from '../types.ts'
import { pendingEnabled } from './decision.ts'

/** The default reminder delay, in minutes. */
export const REMIND_DEFAULT_MINUTES = 10

/** One blocking interaction the client is tracking. */
export interface PendingWait {
  /** `sessionId:requestId` — the identity used by the reminder bookkeeping. */
  readonly key: string
  readonly sessionId: string
  readonly requestId: string
  readonly kind: PendingKind
  /** The ask's one-line summary; the reminder toast's `{内容}` placeholder. */
  readonly summary: string
  /** When the wait was first observed (client clock, ms). */
  readonly firstSeenAt: number
  /** Whether a reminder for this wait has already been sent. */
  readonly reminded: boolean
  /** When the last reminder went out (0 = none yet); drives the repeat interval. */
  readonly lastRemindedAt: number
}

/** Convert the configured minutes into milliseconds (at least one minute). */
export function remindAfterMs(minutes: number): number {
  return Math.max(1, Math.round(minutes)) * 60_000
}

/**
 * When a wait's next reminder is due.
 *
 * The first one counts from the moment the wait appeared; later ones count from
 * the previous reminder, so `repeat` stays on its own cadence even when the
 * timer ticks late.
 * @param wait - the tracked wait.
 * @param settings - the live settings.
 * @returns the clock value at which the next reminder may fire.
 */
export function nextReminderAt(wait: PendingWait, settings: NotifySettings): number {
  return wait.lastRemindedAt === 0
    ? wait.firstSeenAt + remindAfterMs(settings.remindAfterMinutes)
    : wait.lastRemindedAt + remindAfterMs(settings.remindEveryMinutes)
}

/**
 * Pick the waits that are due for a reminder.
 *
 * `once` and `sticky` fire a single time each; `repeat` keeps firing on the
 * shorter interval until the wait is answered.
 * @param waits - every currently tracked, still-unanswered wait.
 * @param settings - the live settings (master and per-scenario switches).
 * @param now - the current clock (ms).
 * @returns the waits to remind about, in tracking order.
 */
export function dueReminders(
  waits: readonly PendingWait[],
  settings: NotifySettings,
  now: number,
): PendingWait[] {
  if (!settings.enabled) return []
  return waits.filter(wait =>
    pendingEnabled(settings, wait.kind)
    && (settings.reminderMode === 'repeat' || !wait.reminded)
    && now >= nextReminderAt(wait, settings),
  )
}
