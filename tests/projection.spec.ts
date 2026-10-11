import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { applyNotifyEvent, initialState, notifyProjection, questionOf } from '../src/projection.ts'

/** Build one synthetic session event. */
function ev(type: string, data: unknown, seq = 1, time = 1000): SessionEvent {
  return { type, seq, time, data } as unknown as SessionEvent
}

describe('projection fold', () => {
  it('folds a whole turn into turn/reason/body', () => {
    let state = initialState(0)
    state = applyNotifyEvent(state, ev('turn/start', { turn: 3 }, 1, 100))
    state = applyNotifyEvent(state, ev('assistant/message', { turn: 3, message: { content: [{ type: 'text', text: 'hello ' }] } }, 2, 200))
    state = applyNotifyEvent(state, ev('assistant/message', { turn: 3, message: { content: [{ type: 'text', text: 'world' }] } }, 3, 300))
    state = applyNotifyEvent(state, ev('turn/end', { turn: 3, reason: { kind: 'completed' } }, 4, 400))
    expect(state.view).toMatchObject({ turn: 3, reason: 'completed', body: 'hello world', updatedAt: 400 })
    expect(state.view.pending).toEqual([])
  })

  it('returns the same state for events it does not care about', () => {
    const state = initialState(0)
    expect(applyNotifyEvent(state, ev('tool/call', { turn: 1, name: 'bash', callId: 'c1', arguments: '{}' }, 1))).toBe(state)
    expect(applyNotifyEvent(state, ev('session/title', { title: 'x' }, 2))).toBe(state)
  })

  it('bounds the reply body to the budget', () => {
    let state = initialState(0)
    state = applyNotifyEvent(state, ev('turn/start', { turn: 1 }, 1), 10)
    state = applyNotifyEvent(state, ev('assistant/message', { turn: 1, message: { content: [{ type: 'text', text: 'abcdefghij' }] } }, 2), 10)
    expect(state.view.turn).toBe(0) // no end yet
    expect(state.open?.text.length).toBe(10)
  })

  it('tracks an approval request until it is decided', () => {
    let state = initialState(0)
    state = applyNotifyEvent(state, ev('approval/asked', { id: 'req-1', toolName: 'pwsh', reason: 'run a command' }, 1, 50))
    expect(state.view.pending).toEqual([{ kind: 'approval', requestId: 'req-1', summary: 'run a command' }])
    state = applyNotifyEvent(state, ev('approval/decided', { id: 'req-1', outcome: 'allowed' }, 2, 60))
    expect(state.view.pending).toEqual([])
  })

  it('tracks a question and a plan review from tool calls', () => {
    let state = initialState(0)
    const args = JSON.stringify({ questions: [{ id: 'q1', header: 'Pick one', question: 'which?' }] })
    state = applyNotifyEvent(state, ev('tool/call', { turn: 1, name: 'ask_user_question', callId: 'call-1', arguments: args }, 1, 10))
    expect(state.view.pending).toEqual([{ kind: 'question', requestId: 'call-1', summary: 'Pick one' }])
    state = applyNotifyEvent(state, ev('tool/result', { message: { toolCallId: 'call-1', content: [] } }, 2, 20))
    expect(state.view.pending).toEqual([])

    const planArgs = JSON.stringify({ questions: [{ id: 'q2', question: 'approve?', intent: { kind: 'plan-review' } }] })
    state = applyNotifyEvent(state, ev('tool/call', { turn: 1, name: 'ask_user_question', callId: 'call-2', arguments: planArgs }, 3, 30))
    expect(state.view.pending).toEqual([{ kind: 'plan-review', requestId: 'call-2', summary: 'approve?' }])
    state = applyNotifyEvent(state, ev('user/message', { source: { kind: 'user-question-reply', callId: 'call-2' }, content: [] }, 4, 40))
    expect(state.view.pending).toEqual([])
  })

  it('tracks a question dispatched through programmatic tool calling', () => {
    // Measured: run_code tool calls arrive as tool/ptc-dispatch* with parsed
    // arguments, never as tool/call.
    let state = initialState(0)
    state = applyNotifyEvent(state, ev('tool/ptc-dispatch-start', {
      rootCallId: 'root-1',
      parentCallId: 'root-1',
      subCallId: 'root-1:ptc:1',
      name: 'ask_user_question',
      arguments: { questions: [{ id: 'q1', header: '选一个', question: '哪一个？' }] },
    }, 1, 10))
    expect(state.view.pending).toEqual([{ kind: 'question', requestId: 'root-1:ptc:1', summary: '选一个' }])

    // A dispatch that returns without answers (the timed path) keeps the wait.
    state = applyNotifyEvent(state, ev('tool/ptc-dispatch', {
      subCallId: 'root-1:ptc:1',
      name: 'ask_user_question',
      isError: false,
      content: [{ type: 'text', text: 'still waiting' }],
    }, 2, 20))
    expect(state.view.pending).toHaveLength(1)

    // A dispatch carrying the answer batch ends the wait.
    state = applyNotifyEvent(state, ev('tool/ptc-dispatch', {
      subCallId: 'root-1:ptc:1',
      name: 'ask_user_question',
      isError: false,
      content: [{ type: 'text', text: JSON.stringify({ answers: [{ id: 'q1', selected: ['A'] }] }) }],
    }, 3, 30))
    expect(state.view.pending).toEqual([])
  })

  it('ends the wait when the question is aborted', () => {
    let state = initialState(0)
    state = applyNotifyEvent(state, ev('tool/ptc-dispatch-start', {
      subCallId: 'root-2:ptc:1',
      name: 'ask_user_question',
      arguments: { questions: [{ id: 'q1', question: '在吗' }] },
    }, 1, 10))
    expect(state.view.pending).toHaveLength(1)
    state = applyNotifyEvent(state, ev('tool/ptc-dispatch', {
      subCallId: 'root-2:ptc:1',
      name: 'ask_user_question',
      isError: true,
      content: [{ type: 'text', text: 'Error: ask_user_question was aborted before the user answered' }],
    }, 2, 20))
    expect(state.view.pending).toEqual([])
  })

  it('skips fork-inherited events', () => {
    const state = initialState(5)
    expect(applyNotifyEvent(state, ev('turn/start', { turn: 1 }, 4))).toBe(state)
    expect(applyNotifyEvent(state, ev('turn/start', { turn: 1 }, 6))).not.toBe(state)
  })

  it('parses question arguments tolerantly', () => {
    expect(questionOf('not json')).toEqual({ kind: 'question', summary: '' })
    expect(questionOf('{}')).toEqual({ kind: 'question', summary: '' })
    expect(questionOf(JSON.stringify({ questions: [{ id: 'a', question: 'q' }] }))).toEqual({ kind: 'question', summary: 'q' })
  })

  it('exposes the registry definition shape the 0.2.0 seam expects', () => {
    const unit = notifyProjection()
    expect(unit.key).toBe('notify')
    expect(unit.stateVersion).toBe(1)
    expect(typeof unit.stateSchema).toBe('object')
    expect(unit.wire?.viewSchema).toBeDefined()
    const state = unit.init({} as never, 0 as never)
    expect(unit.wire?.view(state)).toEqual({ turn: 0, reason: '', body: '', pending: [], updatedAt: 0 })
  })
})
