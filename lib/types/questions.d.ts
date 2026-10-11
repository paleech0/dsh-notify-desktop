/**
 * Host-side question observation.
 *
 * The host fires the `user-questions/request` waterfall for every question —
 * tool-call questions and service-level asks such as the plan review alike —
 * so a global listener here is the only seam that sees all of them. Detection
 * lives here; every notification decision stays in the client half, which owns
 * the focus state, the settings and the reminder bookkeeping.
 */
import type { PendingKind } from './types.ts';
/** One question as the host observed it, ready for the client to poll. */
export interface QuestionRecord {
    /** Monotonic sequence, so a poller can tell new records from old ones. */
    readonly seq: number;
    /** Identity for dedupe: the tool call id when there is one, else the question id. */
    readonly key: string;
    /** The session the question belongs to ('' when the ask named no agent). */
    readonly sessionId: string;
    /** Which scenario switch governs it. */
    readonly kind: PendingKind;
    /** The one-line summary the toast shows. */
    readonly summary: string;
    /** When the ask started (host clock, ms). */
    readonly at: number;
    /** False once the ask settled (answered, aborted or timed out). */
    open: boolean;
}
/**
 * Describe one forwarded ask.
 * @param input - the request the waterfall handed over.
 * @param seq - the sequence number to stamp on the record.
 * @param at - the observation time.
 * @returns the record, or undefined when the request carries no question.
 */
export declare function questionRecordOf(input: unknown, seq: number, at: number): QuestionRecord | undefined;
/**
 * Keep a bounded, oldest-first window of question records.
 * @param records - the live list (mutated in place).
 * @param limit - how many records to keep.
 */
export declare function trimQuestions(records: QuestionRecord[], limit: number): void;
