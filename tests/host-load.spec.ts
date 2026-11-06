import { describe, expect, it } from 'vitest'
import { apply } from '../src/index.ts'

/**
 * A registration value shaped like the 0.2.2 registry's return: a callable
 * thenable whose awaited value is the handle. Awaiting it must work without the
 * host plugin treating it as a plain disposer.
 */
function fakeRegistration(): { thenable: unknown; stateOf: () => unknown } {
  const handle = { stateOf: () => ({ turn: 1 }) }
  const promise = Promise.resolve(handle)
  const thenable = Object.assign(() => undefined, {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  })
  return { thenable, stateOf: handle.stateOf }
}

describe('host plugin load', () => {
  it('awaits the projection registration and registers every route', async () => {
    const routes: string[] = []
    let registeredKey = ''
    const { thenable } = fakeRegistration()
    const ctx = {
      sessionProjections: {
        register(definition: { key: string }) {
          registeredKey = definition.key
          return thenable
        },
      },
      effect(fn: () => unknown) {
        fn()
      },
      inject(_deps: readonly string[], callback: (scoped: unknown) => void) {
        callback({
          effect(fn: () => unknown) {
            fn()
          },
          webServer: {
            register(route: { path: string }) {
              routes.push(route.path)
              return () => undefined
            },
          },
        })
      },
      on() {
        return () => undefined
      },
      get() {
        return undefined
      },
    }
    await apply(ctx as never)
    expect(registeredKey).toBe('notify')
    expect(routes).toContain('/dsh-notify/toast')
    expect(routes).toContain('/dsh-notify/debug')
    expect(routes).toContain('/dsh-notify/foreground')
    expect(routes.length).toBeGreaterThanOrEqual(13)
  })
})
