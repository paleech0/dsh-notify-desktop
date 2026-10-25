import { afterEach, describe, expect, it } from 'vitest'
import { TEXT_TEMPLATES_ROUTE } from '../src/protocol.ts'
import { SCENARIO_IDS, emptyTextLibrary } from '../src/scenarios.ts'
import { createTextStore, sanitizeTextLibrary } from '../src/client/texts.ts'

/** Install a fetch stub that records requests. */
function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = []
  const original = (globalThis as { fetch?: unknown }).fetch
  ;(globalThis as { fetch?: unknown }).fetch = ((url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return Promise.resolve(handler(String(url), init))
  }) as unknown as typeof fetch
  return {
    calls,
    restore: () => {
      ;(globalThis as { fetch?: unknown }).fetch = original
    },
  }
}

afterEach(() => {
  // Every test restores its own stub.
})

describe('saved-text wire payloads', () => {
  it('sanitizes an arbitrary payload into a complete, capped library', () => {
    const valid = (id: string, name = 'n') => ({ id, name, title: 't', body: 'b', updatedAt: 1 })
    const library = sanitizeTextLibrary({
      completed: [valid('t_aaaaaa'), valid('t_bbbbbb'), 'nope', valid('t_cccccc'), valid('t_dddddd')],
      error: [{ id: 'bogus', name: 'x', title: 't', body: 'b' }, valid('t_eeeeee')],
    })
    for (const scenario of SCENARIO_IDS) expect(Array.isArray(library[scenario])).toBe(true)
    expect(library['completed']).toHaveLength(3)
    expect(library['error']).toHaveLength(1)
    expect(library['reminder']).toEqual([])
  })

  it('loads the library from the host route', async () => {
    const library = { ...emptyTextLibrary(), completed: [{ id: 't_aaaaaa', name: 'A', title: 't', body: 'b', updatedAt: 1 }] }
    const stub = stubFetch(() => new Response(JSON.stringify({ library }), { status: 200 }))
    try {
      const store = createTextStore()
      let notified = 0
      store.subscribe(() => {
        notified += 1
      })
      const loaded = await store.load()
      expect(stub.calls[0]?.url).toBe(TEXT_TEMPLATES_ROUTE)
      expect(loaded['completed']).toHaveLength(1)
      expect(store.getSnapshot()['completed'][0]?.name).toBe('A')
      expect(notified).toBe(1)
    } finally {
      stub.restore()
    }
  })

  it('posts a save and applies the host\'s answer', async () => {
    const saved = { id: 't_111111', name: 'A', title: 't', body: 'b', updatedAt: 2 }
    const stub = stubFetch((url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { action: string; scenario: string }
      expect(body.action).toBe('save')
      expect(body.scenario).toBe('completed')
      return new Response(JSON.stringify({
        ok: true,
        template: saved,
        library: { ...emptyTextLibrary(), completed: [saved] },
      }), { status: 200 })
    })
    try {
      const store = createTextStore()
      const outcome = await store.save('completed', { name: 'A', title: 't', body: 'b' })
      expect(outcome.ok).toBe(true)
      if (outcome.ok) expect(outcome.template.id).toBe('t_111111')
      expect(store.getSnapshot()['completed']).toHaveLength(1)
    } finally {
      stub.restore()
    }
  })

  it('posts a delete and surfaces a host refusal', async () => {
    const stub = stubFetch(() => new Response(JSON.stringify({ ok: false, problem: 'missing' }), { status: 200 }))
    try {
      const store = createTextStore()
      const result = await store.remove('completed', 't_111111')
      expect(result).toEqual({ ok: false, problem: 'missing' })
    } finally {
      stub.restore()
    }
  })

  it('reports an unreachable host instead of throwing', async () => {
    const original = (globalThis as { fetch?: unknown }).fetch
    ;(globalThis as { fetch?: unknown }).fetch = undefined
    try {
      const store = createTextStore()
      expect(await store.save('completed', { name: 'n', title: 't', body: 'b' })).toEqual({ ok: false, problem: 'unreachable' })
      expect(await store.load()).toEqual(emptyTextLibrary())
    } finally {
      ;(globalThis as { fetch?: unknown }).fetch = original
    }
  })
})
