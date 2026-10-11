import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, NOTIFY_REASONS } from '../src/types.ts'

describe('notification contract', () => {
  it('ships every switch on by default except the noisy outcomes', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      enabled: true,
      soundEnabled: true,
      sounds: { finished: 'file:chimes', error: 'file:error', attention: 'file:ding', reminder: 'file:exclamation' },
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

  it('accepts exactly the five notifiable turn-end reasons', () => {
    expect([...NOTIFY_REASONS]).toEqual(['completed', 'error', 'aborted', 'blocked', 'max-tokens'])
  })
})
