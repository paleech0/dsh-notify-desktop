import { describe, expect, it } from 'vitest'
import { questionRecordOf, trimQuestions, type QuestionRecord } from '../src/questions.ts'

describe('host question records', () => {
  it('describes a plan review with its agent session', () => {
    expect(questionRecordOf({
      questions: [{ id: 'plan-review', header: 'Plan review', question: 'Approve this plan?' , intent: { kind: 'plan-review' } }],
      agent: { session: 'session-1' },
    }, 7, 1000)).toEqual({
      seq: 7,
      key: 'q:plan-review',
      sessionId: 'session-1',
      kind: 'plan-review',
      summary: 'Plan review',
      at: 1000,
      open: true,
    })
  })

  it('keys a tool-call question by its wait call id', () => {
    const record = questionRecordOf({
      questions: [{ id: 'q1', header: '依赖安装许可' }],
      wait: { callId: 'call-9' },
      agent: { session: 'session-2' },
    }, 3, 5)
    expect(record?.key).toBe('call-9')
    expect(record?.kind).toBe('question')
    expect(record?.summary).toBe('依赖安装许可')
  })

  it('falls back from header to question to id, and leaves the session empty', () => {
    expect(questionRecordOf({ questions: [{ id: 'only', question: '只有问题' }] }, 1, 1)?.summary).toBe('只有问题')
    expect(questionRecordOf({ questions: [{ id: 'only' }] }, 1, 1)?.summary).toBe('only')
    expect(questionRecordOf({ questions: [{ id: 'only' }] }, 1, 1)?.sessionId).toBe('')
  })

  it('ignores requests it cannot describe', () => {
    expect(questionRecordOf(undefined, 1, 1)).toBeUndefined()
    expect(questionRecordOf({}, 1, 1)).toBeUndefined()
    expect(questionRecordOf({ questions: [] }, 1, 1)).toBeUndefined()
    expect(questionRecordOf({ questions: ['nope'] }, 1, 1)).toBeUndefined()
  })

  it('keeps the queue window bounded', () => {
    const records: QuestionRecord[] = []
    for (let at = 1; at <= 25; at++) {
      const record = questionRecordOf({ questions: [{ id: 'q' + String(at) }] }, at, at)
      if (record !== undefined) records.push(record)
    }
    trimQuestions(records, 20)
    expect(records).toHaveLength(20)
    expect(records[0]?.seq).toBe(6)
    expect(records.at(-1)?.seq).toBe(25)
  })
})
