/**
 * Host-side question observation.
 *
 * The host fires the `user-questions/request` waterfall for every question —
 * tool-call questions and service-level asks such as the plan review alike —
 * so a global listener here is the only seam that sees all of them. Detection
 * lives here; every notification decision stays in the client half, which owns
 * the focus state, the settings and the reminder bookkeeping.
 */
import type { PendingKind } from './types.ts'

/** One question as the host observed it, ready for the client to poll. */
export interface QuestionRecord {
  /** Monotonic sequence, so a poller can tell new records from old ones. */
  readonly seq: number
  /** Identity for dedupe: the tool call id when there is one, else the question id. */
  readonly key: string
  /** The session the question belongs to ('' when the ask named no agent). */
  readonly sessionId: string
  /** Which scenario switch governs it. */
  readonly kind: PendingKind
  /** The one-line summary the toast shows. */
  readonly summary: string
  /** When the ask started (host clock, ms). */
  readonly at: number
  /** False once the ask settled (answered, aborted or timed out). */
  open: boolean
}

/** One question inside a forwarded request. */
interface RequestedQuestion {
  readonly id?: unknown
  readonly header?: unknown
  readonly question?: unknown
  readonly intent?: { readonly kind?: unknown } | undefined
}

/** The slice of a forwarded request this module reads. */
interface ForwardedAsk {
  readonly questions?: unknown
  readonly wait?: { readonly callId?: unknown } | undefined
  readonly agent?: { readonly session?: unknown } | undefined
}

/** One string field, or an empty string. */
function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Describe one forwarded ask.
 * @param input - the request the waterfall handed over.
 * @param seq - the sequence number to stamp on the record.
 * @param at - the observation time.
 * @returns the record, or undefined when the request carries no question.
 */
export function questionRecordOf(input: unknown, seq: number, at: number): QuestionRecord | undefined {
  const ask = input as ForwardedAsk | undefined
  const list = ask?.questions
  if (!Array.isArray(list) || list.length === 0) return undefined
  const first = list[0] as RequestedQuestion | null
  if (first === null || typeof first !== 'object') return undefined
  const kind: PendingKind = first.intent?.kind === 'plan-review' ? 'plan-review' : 'question'
  const summary = text(first.header) || text(first.question) || text(first.id)
  const callId = text(ask?.wait?.callId)
  const key = callId !== '' ? callId : 'q:' + (text(first.id) || summary)
  const agent = ask?.agent as { session?: unknown; sessionId?: unknown; id?: unknown } | undefined
  const sessionId = text(agent?.session) || text(agent?.sessionId) || text(agent?.id)
  return { seq, key, sessionId, kind, summary, at, open: true }
}

/**
 * Keep a bounded, oldest-first window of question records.
 * @param records - the live list (mutated in place).
 * @param limit - how many records to keep.
 */
export function trimQuestions(records: QuestionRecord[], limit: number): void {
  while (records.length > limit) records.shift()
}
