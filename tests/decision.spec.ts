import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type NotifySettings } from '../src/types.ts'
import { DEDUPE_MS, decideNotification, groupSound } from '../src/client/decision.ts'

/** Settings with overrides. */
function settings(patch: Partial<NotifySettings> = {}): NotifySettings {
  return { ...DEFAULT_SETTINGS, ...patch }
}

/** One decision input with defaults. */
function input(patch: Partial<Parameters<typeof decideNotification>[0]> = {}) {
  return {
    settings: settings(),
    trigger: { kind: 'turn', reason: 'completed' } as const,
    sessionId: 's1',
    focused: false,
    dedupeKey: 's1:turn:1',
    now: 10_000,
    recent: new Map<string, number>(),
    ...patch,
  }
}

describe('notification decision', () => {
  it('notifies for an enabled outcome', () => {
    expect(decideNotification(input())).not.toBeNull()
  })

  it('stays silent when the master switch is off', () => {
    expect(decideNotification(input({ settings: settings({ enabled: false }) }))).toBeNull()
  })

  it('stays silent when the per-outcome switch is off', () => {
    expect(decideNotification(input({ settings: settings({ notifyError: false }), trigger: { kind: 'turn', reason: 'error' } }))).toBeNull()
  })

  it('honours each per-outcome switch', () => {
    expect(decideNotification(input({ trigger: { kind: 'turn', reason: 'aborted' } }))).toBeNull()
    expect(decideNotification(input({ trigger: { kind: 'turn', reason: 'aborted' }, settings: settings({ notifyAborted: true }) }))).not.toBeNull()
    expect(decideNotification(input({ trigger: { kind: 'turn', reason: 'blocked' } }))).not.toBeNull()
    expect(decideNotification(input({ trigger: { kind: 'turn', reason: 'max-tokens' } }))).not.toBeNull()
  })

  it('honours each blocking-interaction switch', () => {
    const approval = input({ trigger: { kind: 'pending', pending: 'approval' } })
    expect(decideNotification(approval)).not.toBeNull()
    expect(decideNotification({ ...approval, settings: settings({ notifyApproval: false }) })).toBeNull()
    expect(decideNotification(input({ trigger: { kind: 'pending', pending: 'question' } }))).not.toBeNull()
    expect(decideNotification(input({ trigger: { kind: 'pending', pending: 'plan-review' } }))).not.toBeNull()
  })

  it('suppresses whenever the window has focus', () => {
    // 0.2.0-rc.2 exposes no "currently open session", so focus is the whole input.
    expect(decideNotification(input({ focused: true }))).toBeNull()
    expect(decideNotification(input({ focused: false }))).not.toBeNull()
  })

  it('drops a repeat of the same key inside the dedupe window but not after it', () => {
    const recent = new Map<string, number>([['s1:turn:1', 9_000]])
    expect(decideNotification(input({ recent, now: 9_000 + DEDUPE_MS - 1 }))).toBeNull()
    expect(decideNotification(input({ recent, now: 9_000 + DEDUPE_MS }))).not.toBeNull()
  })

  it('keeps two different requests apart even in the same millisecond', () => {
    const recent = new Map<string, number>([['s1:request:r1', 5_000]])
    const second = decideNotification(input({
      recent,
      now: 5_000,
      dedupeKey: 's1:request:r2',
      trigger: { kind: 'pending', pending: 'approval' },
    }))
    expect(second).not.toBeNull()
  })

  it('carries the group sound into the decision without changing the outcome', () => {
    expect(decideNotification(input({ settings: settings({ soundEnabled: false }) }))).not.toBeNull()
    expect(decideNotification(input({ settings: settings({ soundEnabled: false }) }))?.sound).toBe('silent')
    expect(decideNotification(input())?.sound).toBe('file:chimes')
  })

  it('maps each trigger to its sound group', () => {
    expect(decideNotification(input())?.sound).toBe('file:chimes')
    expect(decideNotification(input({ trigger: { kind: 'turn', reason: 'error' } }))?.sound).toBe('file:error')
    // 'aborted' is off by default, so it needs its own switch to be decided.
    expect(decideNotification(input({
      settings: settings({ notifyAborted: true }),
      trigger: { kind: 'turn', reason: 'aborted' },
    }))?.sound).toBe('file:chimes')
    for (const pending of ['approval', 'question', 'plan-review'] as const) {
      expect(decideNotification(input({ trigger: { kind: 'pending', pending } }))?.sound).toBe('file:ding')
    }
  })

  it('lets each group be silenced or reconfigured on its own', () => {
    const custom = settings({ sounds: { ...DEFAULT_SETTINGS.sounds, error: 'file:tada', attention: 'silent' } })
    expect(decideNotification(input({ settings: custom, trigger: { kind: 'turn', reason: 'error' } }))?.sound).toBe('file:tada')
    expect(decideNotification(input({ settings: custom, trigger: { kind: 'pending', pending: 'approval' } }))?.sound).toBe('silent')
  })

  it('silences every group when sounds are switched off', () => {
    const off = settings({ soundEnabled: false })
    expect(groupSound(off, 'finished')).toBe('silent')
    expect(groupSound(off, 'reminder')).toBe('silent')
    expect(groupSound(settings(), 'reminder')).toBe('file:exclamation')
  })
})
