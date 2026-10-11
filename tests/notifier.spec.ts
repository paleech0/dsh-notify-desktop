import { afterEach, describe, expect, it } from 'vitest'
import { bodyText, notificationTag, pendingTag, reminderTag, shortPendingKey, shortReasonKey, showToast } from '../src/client/notifier.ts'

/** What the fake platform saw. */
interface FakePlatform {
  titles: string[]
  options: NotificationOptions[]
  /** Fire the click handler the toast registered, if any. */
  click(index: number): void
}

/** Install a fake Notification constructor for one test. */
function installFake(permission: NotificationPermission = 'granted'): FakePlatform {
  const titles: string[] = []
  const options: NotificationOptions[] = []
  const handlers: Array<(() => void) | null> = []
  class Fake {
    static permission: NotificationPermission = permission
    static requestPermission = (): Promise<NotificationPermission> => Promise.resolve(permission)
    onclick: (() => void) | null = null
    constructor(title: string, settings?: NotificationOptions) {
      titles.push(title)
      options.push(settings ?? {})
      handlers.push(null)
      const index = titles.length - 1
      Object.defineProperty(this, 'onclick', {
        get: () => handlers[index] ?? null,
        set: (value: (() => void) | null) => {
          handlers[index] = value
        },
      })
    }
  }
  ;(globalThis as { Notification?: unknown }).Notification = Fake
  return {
    titles,
    options,
    click(index) {
      handlers[index]?.()
    },
  }
}

afterEach(() => {
  delete (globalThis as { Notification?: unknown }).Notification
})

describe('toast rendering', () => {
  it('maps every reason to its short status and every body fallback', () => {
    expect(shortReasonKey('completed')).toBe('notify.shortCompleted')
    expect(shortReasonKey('error')).toBe('notify.shortError')
    expect(shortReasonKey('aborted')).toBe('notify.shortAborted')
    expect(shortReasonKey('blocked')).toBe('notify.shortBlocked')
    expect(shortReasonKey('max-tokens')).toBe('notify.shortMaxTokens')
    expect(shortPendingKey('approval')).toBe('notify.shortApproval')
    expect(shortPendingKey('question')).toBe('notify.shortQuestion')
    expect(shortPendingKey('plan-review')).toBe('notify.shortPlanReview')
    expect(bodyText('  ', 'fallback')).toBe('fallback')
    expect(bodyText(' hi ', 'fallback')).toBe('hi')
  })

  it('keeps tags unique per turn, per request, and per reminder', () => {
    expect(notificationTag('s', 1)).not.toBe(notificationTag('s', 2))
    expect(pendingTag('s', 'r1')).not.toBe(pendingTag('s', 'r2'))
    expect(reminderTag('s', 'r1')).not.toBe(pendingTag('s', 'r1'))
  })

  it('silences the system sound only when the sound switch is off', () => {
    const platform = installFake()
    expect(showToast({ title: 't', body: 'b', tag: 'g', sound: 'default', onClick: () => {} })).toBe(true)
    expect(showToast({ title: 't', body: 'b', tag: 'g2', sound: 'silent', onClick: () => {} })).toBe(true)
    expect(platform.options[0]?.silent).toBe(false)
    expect(platform.options[1]?.silent).toBe(true)
  })

  it('carries title, body and tag onto the toast', () => {
    const platform = installFake()
    showToast({ title: 'DSH 完成', body: 'hello', tag: 'tag-1', sound: 'default', onClick: () => {} })
    expect(platform.titles).toEqual(['DSH 完成'])
    expect(platform.options[0]?.body).toBe('hello')
    expect(platform.options[0]?.tag).toBe('tag-1')
  })

  it('routes the click to the caller', () => {
    const platform = installFake()
    let clicks = 0
    showToast({ title: 't', body: 'b', tag: 'g', sound: 'default', onClick: () => { clicks += 1 } })
    expect(clicks).toBe(0)
    platform.click(0)
    expect(clicks).toBe(1)
  })

  it('still attempts the toast when the permission string is not granted', () => {
    // Electron reports 'default' for a freshly started app; gating on the
    // string silently swallowed the first toast of every run, so the plugin
    // constructs anyway and lets onshow/onerror answer.
    const platform = installFake('denied')
    expect(showToast({ title: 't', body: 'b', tag: 'g', sound: 'default', onClick: () => {} })).toBe(true)
    expect(platform.titles).toHaveLength(1)
  })

  it('never throws without a platform', () => {
    delete (globalThis as { Notification?: unknown }).Notification
    expect(showToast({ title: 't', body: 'b', tag: 'g', sound: 'default', onClick: () => {} })).toBe(false)
  })
})