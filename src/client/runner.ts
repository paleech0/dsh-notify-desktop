/**
 * Edge detection over the session list: what changed since the previous tick.
 * The host projection is monotonic per session (turn numbers only grow, pending
 * interactions appear and disappear by id), so an advance past the last
 * observation IS a fresh signal.
 */
import type { PendingInteraction, NotifyProjectionValue } from '../types.ts'

/** The projection key this plugin reads off `projectionValues`. */
export const NOTIFY_PROJECTION_KEY = 'notify'

/**
 * Fold one session's projection turn observation.
 * @param previousTurn - the turn last observed for this session (undefined = seed).
 * @param projection - the current projection value (absent = nothing yet).
 * @returns the next observed turn and whether it advanced past the previous.
 */
export function turnAdvance(
  previousTurn: number | undefined,
  projection: NotifyProjectionValue | undefined,
): { nextTurn: number; fresh: boolean } {
  const turn = projection?.turn ?? 0
  return { nextTurn: turn, fresh: previousTurn !== undefined && turn > previousTurn }
}

/**
 * How old a projection event may be and still count as "just happened".
 *
 * The host folds a session's history asynchronously, so a client that starts
 * early observes a half-folded projection and seeds its baseline there; when the
 * fold catches up, a turn that ended long ago looks like an advance. Measured:
 * a session that finished yesterday re-notified on startup because of exactly
 * that. A real turn end is observed within seconds, so a minute separates the
 * two cases with room to spare.
 */
export const FRESH_EVENT_MS = 60_000

/**
 * Whether a folded event is recent enough to notify about.
 * @param updatedAt - the projection's event time (0 = nothing folded yet).
 * @param now - the client clock (ms).
 * @returns true when the event happened inside the freshness window.
 */
export function isFresh(updatedAt: number, now: number): boolean {
  return updatedAt > 0 && now - updatedAt <= FRESH_EVENT_MS
}

/**
 * The blocking interactions that appeared since the last tick.
 * @param known - request ids already observed for this session.
 * @param pending - the projection's current pending list.
 * @returns the newly appeared interactions, in projection order.
 */
export function newPending(
  known: ReadonlySet<string>,
  pending: readonly PendingInteraction[],
): PendingInteraction[] {
  return pending.filter(entry => !known.has(entry.requestId))
}

/**
 * The cross-source key for one ask.
 *
 * Questions can arrive from two places — the session projection (tool-call
 * asks) and the host's question queue (service-level asks such as the plan
 * review) — and the two carry different ids for the same ask. The queue cannot
 * even name the session for a tool-call ask, so the key must not include the
 * session: it is the summary alone. The cost is that two sessions asking
 * identically-worded questions inside the window notify once.
 * @param summary - the ask's one-line summary.
 * @returns the dedupe key.
 */
export function askKey(summary: string): string {
  return 'ask:' + summary.slice(0, 40)
}

/**
 * Whether a dedupe key was recorded inside the window.
 * @param recent - the record of recent decisions.
 * @param key - the key to test.
 * @param now - the current clock (ms).
 * @param windowMs - how long a recorded key suppresses its twin.
 * @returns true when the twin was recorded recently.
 */
export function recentlyKeyed(
  recent: ReadonlyMap<string, number>,
  key: string,
  now: number,
  windowMs: number,
): boolean {
  const at = recent.get(key)
  return at !== undefined && now - at < windowMs
}

/** How long one ask's cross-source twin stays suppressed, in milliseconds. */
export const ASK_TWIN_MS = 5_000

/** The request ids currently pending, for pruning tracked waits. */
export function liveRequestIds(pending: readonly PendingInteraction[]): Set<string> {
  return new Set(pending.map(entry => entry.requestId))
}

