import { describe, expect, it } from 'vitest'
import type { NotifyProjectionValue } from '../src/types.ts'
import { FRESH_EVENT_MS, isFresh, liveRequestIds, newPending, turnAdvance } from '../src/client/runner.ts'

/** A projection value with overrides. */
function projection(patch: Partial<NotifyProjectionValue> = {}): NotifyProjectionValue {
  return { turn: 0, reason: '', body: '', pending: [], updatedAt: 0, ...patch }
}

describe('session list edges', () => {
  it('seeds the baseline on the first observation', () => {
    expect(turnAdvance(undefined, projection({ turn: 4 }))).toEqual({ nextTurn: 4, fresh: false })
    expect(turnAdvance(undefined, undefined)).toEqual({ nextTurn: 0, fresh: false })
  })

  it('treats only a recent event as news', () => {
    const now = 1_000_000
    expect(isFresh(now - 5_000, now)).toBe(true)
    expect(isFresh(now - FRESH_EVENT_MS, now)).toBe(true)
    expect(isFresh(now - FRESH_EVENT_MS - 1, now)).toBe(false)
    // The fold has not produced anything yet, and a historical replay is hours
    // old: both must stay silent (measured: a session finished yesterday
    // re-notified on startup because the fold caught up after the client seeded).
    expect(isFresh(0, now)).toBe(false)
    expect(isFresh(now - 24 * 60 * 60 * 1000, now)).toBe(false)
  })

  it('reports a fresh turn only when the projected turn advances', () => {
    expect(turnAdvance(4, projection({ turn: 4 })).fresh).toBe(false)
    expect(turnAdvance(4, projection({ turn: 5 }))).toEqual({ nextTurn: 5, fresh: true })
    expect(turnAdvance(4, undefined).fresh).toBe(false)
  })

  it('reports only interactions not seen before', () => {
    const seen = new Set(['r1'])
    expect(newPending(seen, [
      { kind: 'approval', requestId: 'r1', summary: '' },
      { kind: 'question', requestId: 'r2', summary: '' },
    ])).toEqual([{ kind: 'question', requestId: 'r2', summary: '' }])
  })

  it('lists the live request ids for pruning', () => {
    expect([...liveRequestIds([
      { kind: 'approval', requestId: 'r1', summary: '' },
      { kind: 'question', requestId: 'r2', summary: '' },
    ])]).toEqual(['r1', 'r2'])
  })
})
