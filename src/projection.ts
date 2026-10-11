/**
 * The `notify` projection unit: a pure fold of one session's committed events
 * into the last finished turn plus every interaction currently blocking on the
 * user. Registered on `ctx.sessionProjections`, whose seam drives `apply` over
 * every committed event and hands the `wire` view to every browser client — no
 * harness change and no forwarded-event allowlist extension.
 *
 * Everything here is pure: the fold returns the SAME state reference for
 * events it does not care about, because the registry's change feed gates on
 * `Object.is` of the view.
 */
import { z, type ZodType } from 'zod'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
// Type-only: merges the approval audit events (approval/asked, approval/decided)
// into SessionEventMap — 0.2.0-rc.2 declares them in this package, not in
// dsh-session itself.
import type {} from '@deepseek-ai/dsh-user-approval'
import type { NotifyProjectionValue, PendingInteraction, PendingKind } from './types.ts'

/** Character budget for the projected reply text. */
export const MAX_BODY_CHARS = 400

/** The projection key this plugin owns. */
export const NOTIFY_KEY = 'notify'

/** One finished turn, as far as notifications are concerned. */
interface FinishedTurn {
  readonly turn: number
  readonly reason: string
  readonly body: string
}

/** Fold state plus its cached wire view (the view must be reference-stable). */
export interface NotifyState {
  /** Events at or below this seq are fork-inherited and skipped. */
  readonly inheritedEventCount: number
  /** The open turn's accumulated reply text; null outside a turn. */
  readonly open: { readonly turn: number; readonly text: string } | null
  /** The last finished turn; null before the first one. */
  readonly last: FinishedTurn | null
  /** Blocking interactions, in first-seen order. */
  readonly pending: readonly PendingInteraction[]
  /** Host clock (ms) of the last folded event. */
  readonly updatedAt: number
  /** Cached wire view; rebuilt only when the fold changed. */
  readonly view: NotifyProjectionValue
}

/** The empty-log view. */
export const EMPTY_VIEW: NotifyProjectionValue = Object.freeze({
  turn: 0,
  reason: '',
  body: '',
  pending: Object.freeze([]) as readonly PendingInteraction[],
  updatedAt: 0,
})

/**
 * Bound one reply to the body budget, ellipsizing on overflow.
 * @param text - the accumulated reply text.
 * @param maxChars - the character budget.
 * @returns the bounded text.
 */
export function boundText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return text.slice(0, Math.max(0, maxChars - 1)) + '…'
}

/** Rebuild the cached view for a changed fold. */
function withView(
  base: Omit<NotifyState, 'view'>,
): NotifyState {
  return {
    ...base,
    view: {
      turn: base.last?.turn ?? 0,
      reason: base.last?.reason ?? '',
      body: base.last?.body ?? '',
      pending: base.pending,
      updatedAt: base.updatedAt,
    },
  }
}

/** The initial fold; `inheritedEventCount` comes from the session's fork cut. */
export function initialState(inheritedEventCount: number): NotifyState {
  return withView({ inheritedEventCount, open: null, last: null, pending: [], updatedAt: 0 })
}

/** Remove one pending interaction by id; returns the same array when absent. */
function withoutPending(
  pending: readonly PendingInteraction[],
  requestId: string,
): readonly PendingInteraction[] {
  const at = pending.findIndex(entry => entry.requestId === requestId)
  if (at === -1) return pending
  return [...pending.slice(0, at), ...pending.slice(at + 1)]
}

/** Append one pending interaction, replacing an equal-id entry in place. */
function withPending(
  pending: readonly PendingInteraction[],
  entry: PendingInteraction,
): readonly PendingInteraction[] {
  if (pending.some(current => current.requestId === entry.requestId)) return pending
  return [...pending, entry]
}

/**
 * The programmatic-tool-calling events, declared here because 0.2.0-rc.2 ships
 * no type entry for them in the published packages (their runtime shape was
 * read from a real session log: an `ask_user_question` invoked from inside
 * `run_code` appears only as these two events, never as `tool/call`).
 */
declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'tool/ptc-dispatch-start': {
      rootCallId: string
      parentCallId: string
      subCallId: string
      name: string
      arguments?: unknown
    }
    'tool/ptc-dispatch': {
      rootCallId: string
      parentCallId: string
      subCallId: string
      name: string
      arguments?: unknown
      isError?: boolean
      content?: unknown
    }
  }
}

/** The event data of one session event, typed loosely for tolerant reads. */
type EventData = Record<string, unknown>

/** Read a string field off an unknown record. */
function str(source: unknown, key: string): string | undefined {
  if (typeof source !== 'object' || source === null) return undefined
  const value = (source as EventData)[key]
  return typeof value === 'string' ? value : undefined
}

/** Read an object field off an unknown record. */
function obj(source: unknown, key: string): EventData | undefined {
  if (typeof source !== 'object' || source === null) return undefined
  const value = (source as EventData)[key]
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as EventData) : undefined
}

/**
 * Read the blocking question out of an `ask_user_question` call's arguments.
 *
 * Two shapes reach this function: a plain `tool/call` carries the arguments as
 * a JSON string, while a `tool/ptc-dispatch-start` (programmatic tool calling)
 * carries them already parsed. Measured in the session log of 0.2.0-rc.2.
 * @param args - the raw argument string or the parsed argument object.
 * @returns the kind, summary, or undefined when this is not a question call.
 */
export function questionOf(args: unknown): { kind: PendingKind; summary: string } | undefined {
  let parsed: unknown = args
  if (typeof args === 'string') {
    try {
      parsed = JSON.parse(args)
    } catch {
      return { kind: 'question', summary: '' }
    }
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const list = (parsed as EventData | null)?.['questions']
  if (!Array.isArray(list)) return { kind: 'question', summary: '' }
  const first: unknown = list[0]
  if (first === undefined) return { kind: 'question', summary: '' }
  const intentKind = str(obj(first, 'intent'), 'kind')
  const summary = str(first, 'header') ?? str(first, 'question') ?? str(first, 'id') ?? ''
  return { kind: intentKind === 'plan-review' ? 'plan-review' : 'question', summary }
}

/**
 * Whether a tool result carries the user's answers (as opposed to a "still
 * waiting" outcome). The answer batch travels as JSON text inside the tool
 * result's content blocks.
 * @param content - the tool result content.
 * @returns true when at least one content block parses to an answers batch.
 */
export function carriesAnswers(content: unknown): boolean {
  if (!Array.isArray(content)) return false
  for (const block of content) {
    const text = str(block, 'text')
    if (text === undefined) continue
    try {
      const parsed: unknown = JSON.parse(text)
      if (typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as EventData)['answers'])) return true
    } catch {
      // Not a JSON block; keep looking.
    }
  }
  return false
}

/** Text contributed by one assistant message. */
function assistantText(message: unknown): string {
  const content = (message as EventData | undefined)?.['content']
  if (!Array.isArray(content)) return ''
  let text = ''
  for (const block of content) {
    if (str(block, 'type') === 'text') text += str(block, 'text') ?? ''
  }
  return text
}

/**
 * Apply one committed event to the fold.
 * @param state - the state covering all prior events.
 * @param event - the next committed event.
 * @param maxChars - the reply-text budget.
 * @returns the next state, or the same reference when nothing changed.
 */
export function applyNotifyEvent(
  state: NotifyState,
  event: SessionEvent,
  maxChars: number = MAX_BODY_CHARS,
): NotifyState {
  if (typeof event.seq === 'number' && event.seq < state.inheritedEventCount) return state
  const data = event.data as EventData
  switch (event.type) {
    case 'turn/start': {
      const turn = Number(data['turn'])
      return withView({ ...state, open: { turn, text: '' }, updatedAt: event.time ?? state.updatedAt })
    }
    case 'assistant/message': {
      const open = state.open
      if (open === null || Number(data['turn']) !== open.turn) return state
      const appended = assistantText(data['message'])
      if (appended === '') return state
      return withView({
        ...state,
        open: { turn: open.turn, text: boundText(open.text + appended, maxChars) },
        updatedAt: event.time ?? state.updatedAt,
      })
    }
    case 'turn/end': {
      const open = state.open
      if (open === null || Number(data['turn']) !== open.turn) return state
      const reason = str(obj(data, 'reason'), 'kind') ?? ''
      return withView({
        ...state,
        open: null,
        last: { turn: open.turn, reason, body: open.text.trim() },
        updatedAt: event.time ?? state.updatedAt,
      })
    }
    case 'approval/asked': {
      const requestId = str(data, 'id')
      if (requestId === undefined) return state
      const summary = str(data, 'reason')?.trim() || str(data, 'toolName') || ''
      const next = withPending(state.pending, { kind: 'approval', requestId, summary })
      if (next === state.pending) return state
      return withView({ ...state, pending: next, updatedAt: event.time ?? state.updatedAt })
    }
    case 'approval/decided': {
      const requestId = str(data, 'id')
      if (requestId === undefined) return state
      const next = withoutPending(state.pending, requestId)
      if (next === state.pending) return state
      return withView({ ...state, pending: next, updatedAt: event.time ?? state.updatedAt })
    }
    case 'tool/call': {
      if (str(data, 'name') !== 'ask_user_question') return state
      const callId = str(data, 'callId')
      if (callId === undefined) return state
      const question = questionOf(str(data, 'arguments') ?? '')
      if (question === undefined) return state
      const next = withPending(state.pending, {
        kind: question.kind,
        requestId: callId,
        summary: question.summary,
      })
      if (next === state.pending) return state
      return withView({ ...state, pending: next, updatedAt: event.time ?? state.updatedAt })
    }
    case 'tool/ptc-dispatch-start': {
      // Programmatic tool calling (a tool invoked from inside run_code) never
      // produces tool/call — measured in the 0.2.0-rc.2 session log, where an
      // ask_user_question appears only as tool/ptc-dispatch-start/-dispatch.
      if (str(data, 'name') !== 'ask_user_question') return state
      const subCallId = str(data, 'subCallId')
      if (subCallId === undefined) return state
      const question = questionOf(data['arguments'])
      if (question === undefined) return state
      const next = withPending(state.pending, {
        kind: question.kind,
        requestId: subCallId,
        summary: question.summary,
      })
      if (next === state.pending) return state
      return withView({ ...state, pending: next, updatedAt: event.time ?? state.updatedAt })
    }
    case 'tool/ptc-dispatch': {
      if (str(data, 'name') !== 'ask_user_question') return state
      const subCallId = str(data, 'subCallId')
      if (subCallId === undefined) return state
      // A timed question keeps waiting after its dispatch returns, so a plain
      // result must not drop the pending. Two outcomes do end it: the answer
      // batch itself, and an error result — an aborted question
      // ("ask_user_question was aborted before the user answered", measured)
      // carries no answers, and leaving it pending would fire a reminder for a
      // question nobody can answer any more.
      if (!carriesAnswers(data['content']) && data['isError'] !== true) return state
      const next = withoutPending(state.pending, subCallId)
      if (next === state.pending) return state
      return withView({ ...state, pending: next, updatedAt: event.time ?? state.updatedAt })
    }
    case 'tool/result': {
      const callId = str(data['message'], 'toolCallId')
      if (callId === undefined) return state
      const next = withoutPending(state.pending, callId)
      if (next === state.pending) return state
      return withView({ ...state, pending: next, updatedAt: event.time ?? state.updatedAt })
    }
    case 'user/message': {
      const source = obj(data, 'source')
      if (str(source, 'kind') !== 'user-question-reply') return state
      const callId = str(source, 'callId')
      if (callId === undefined) return state
      const next = withoutPending(state.pending, callId)
      if (next === state.pending) return state
      return withView({ ...state, pending: next, updatedAt: event.time ?? state.updatedAt })
    }
    default:
      return state
  }
}

const pendingSchema = z.object({
  kind: z.enum(['approval', 'question', 'plan-review']),
  requestId: z.string(),
  summary: z.string(),
}).strict()

const viewSchema = z.object({
  turn: z.number().int().nonnegative(),
  reason: z.string(),
  body: z.string(),
  pending: z.array(pendingSchema),
  updatedAt: z.number(),
}).strict()

/** The persisted fold state; the registry validates checkpoint rows with it. */
const stateSchema = z.object({
  inheritedEventCount: z.number().int().nonnegative(),
  open: z.object({ turn: z.number(), text: z.string() }).strict().nullable(),
  last: z.object({ turn: z.number(), reason: z.string(), body: z.string() }).strict().nullable(),
  pending: z.array(pendingSchema),
  updatedAt: z.number(),
  view: viewSchema,
}).strict()

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    notify: NotifyState
  }
}

/**
 * The `notify` unit as registered: the registry's overload for a client-visible
 * key demands the wire block be present, not merely optional.
 */
export type NotifyProjectionDefinition = ProjectionDefinition<typeof NOTIFY_KEY, NotifyState> & {
  wire: {
    viewSchema: ZodType<NotifyProjectionValue>
    view(state: NotifyState): NotifyProjectionValue
  }
}

/**
 * Build the `notify` projection unit.
 * @param maxChars - the reply-text budget folded host-side.
 * @returns the projection definition registered on the projection seam.
 */
export function notifyProjection(
  maxChars: number = MAX_BODY_CHARS,
): NotifyProjectionDefinition {
  return {
    key: NOTIFY_KEY,
    stateSchema,
    stateVersion: 1,
    init: (_header, inheritedEventCount) => initialState(inheritedEventCount),
    apply: (state, event) => applyNotifyEvent(state, event, maxChars),
    wire: {
      viewSchema,
      view: state => state.view,
    },
  }
}
