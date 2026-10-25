import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, NOTIFY_REASONS } from '../src/types.ts'
import { SCENARIO_IDS } from '../src/scenarios.ts'

describe('notification contract', () => {
  it('ships every switch on by default except the noisy outcomes', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      enabled: true,
      mode: 'both',
      sounds: {
        completed: 'file:chimes',
        error: 'file:error',
        aborted: 'file:chimes',
        blocked: 'file:chimes',
        'max-tokens': 'file:chimes',
        approval: 'file:ding',
        question: 'file:ding',
        'plan-review': 'file:ding',
        reminder: 'file:exclamation',
      },
      texts: {
        completed: 'default',
        error: 'default',
        aborted: 'default',
        blocked: 'default',
        'max-tokens': 'default',
        approval: 'default',
        question: 'default',
        'plan-review': 'default',
        reminder: 'default',
      },
      legacyText: null,
      notifyCompleted: true,
      notifyError: true,
      notifyAborted: false,
      notifyBlocked: true,
      notifyMaxTokens: true,
      notifyApproval: true,
      notifyQuestion: true,
      notifyPlanReview: true,
      remindAfterMinutes: 10,
    })
  })

  it('keys both per-situation maps by every scenario', () => {
    expect(Object.keys(DEFAULT_SETTINGS.sounds)).toEqual([...SCENARIO_IDS])
    expect(Object.keys(DEFAULT_SETTINGS.texts)).toEqual([...SCENARIO_IDS])
  })

  it('accepts exactly the five notifiable turn-end reasons', () => {
    expect([...NOTIFY_REASONS]).toEqual(['completed', 'error', 'aborted', 'blocked', 'max-tokens'])
  })
})
