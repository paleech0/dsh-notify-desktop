import { describe, expect, it } from 'vitest'
import { FOCUS_HEADER, FOCUS_ROUTE } from '../src/protocol.ts'
import { activateSession, focusWindowRequest } from '../src/client/navigate.ts'

describe('toast click activation', () => {
  it('raises the window before selecting the session', async () => {
    const calls: string[] = []
    await activateSession({
      focusWindow: () => {
        calls.push('focus')
      },
      openSession: id => {
        calls.push('open:' + id)
      },
    }, 's1')
    expect(calls).toEqual(['focus', 'open:s1'])
  })

  it('still opens the session when focusing fails', async () => {
    const calls: string[] = []
    await activateSession({
      focusWindow: () => {
        throw new Error('no route')
      },
      openSession: id => {
        calls.push('open:' + id)
      },
    }, 's2')
    expect(calls).toEqual(['open:s2'])
  })

  it('tolerates a missing workspace service', async () => {
    await expect(activateSession({ focusWindow: () => undefined }, 's3')).resolves.toBeUndefined()
  })

  it('posts to the focus route with the guard header', async () => {
    const seen: { url: string; init: RequestInit | undefined }[] = []
    const fake = ((url: string, init?: RequestInit) => {
      seen.push({ url, init })
      return Promise.resolve(new Response(null, { status: 204 }))
    }) as unknown as typeof fetch
    await focusWindowRequest(fake)
    expect(seen[0]?.url).toBe(FOCUS_ROUTE)
    expect(seen[0]?.init?.method).toBe('POST')
    expect((seen[0]?.init?.headers as Record<string, string>)[FOCUS_HEADER]).toBe('1')
  })

  it('swallows a failing focus request', async () => {
    const fake = (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch
    await expect(focusWindowRequest(fake)).resolves.toBeUndefined()
  })
})
