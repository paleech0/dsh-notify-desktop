import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type NotifySettings } from '../src/types.ts'
import { dueReminders, nextReminderAt, remindAfterMs, type PendingWait } from '../src/client/reminder.ts'

/** Settings with overrides. */
function settings(patch: Partial<NotifySettings> = {}): NotifySettings {
  return { ...DEFAULT_SETTINGS, ...patch }
}

/** One tracked wait. */
function wait(patch: Partial<PendingWait> = {}): PendingWait {
  return {
    key: 's1:r1',
    sessionId: 's1',
    requestId: 'r1',
    kind: 'approval',
    summary: '是否运行 pnpm run check？',
    firstSeenAt: 0,
    reminded: false,
    lastRemindedAt: 0,
    ...patch,
  }
}

describe('reminder modes', () => {
  it('fire once under the default mode', () => {
    const one = wait({ firstSeenAt: 0 })
    expect(dueReminders([one], settings(), 600_000)).toHaveLength(1)
    expect(dueReminders([wait({ firstSeenAt: 0, reminded: true })], settings(), 900_000)).toHaveLength(0)
  })

  it('keep firing on their own cadence under repeat', () => {
    const live = settings({ reminderMode: 'repeat', remindAfterMinutes: 10, remindEveryMinutes: 5 })
    expect(dueReminders([wait({ firstSeenAt: 0 })], live, 599_999)).toHaveLength(0)
    expect(dueReminders([wait({ firstSeenAt: 0 })], live, 600_000)).toHaveLength(1)
    // 5 minutes after the first reminder, not 10 after the wait started.
    const afterFirst = wait({ firstSeenAt: 0, reminded: true, lastRemindedAt: 600_000 })
    expect(dueReminders([afterFirst], live, 899_999)).toHaveLength(0)
    expect(dueReminders([afterFirst], live, 900_000)).toHaveLength(1)
  })

  it('treat sticky as a single reminder', () => {
    const sticky = settings({ reminderMode: 'sticky' })
    expect(dueReminders([wait({ firstSeenAt: 0 })], sticky, 600_000)).toHaveLength(1)
    expect(dueReminders([wait({ firstSeenAt: 0, reminded: true, lastRemindedAt: 600_000 })], sticky, 10_000_000)).toHaveLength(0)
  })

  it('schedule the first reminder from the wait and later ones from the last reminder', () => {
    const live = settings({ remindAfterMinutes: 10, remindEveryMinutes: 3 })
    expect(nextReminderAt(wait({ firstSeenAt: 1_000 }), live)).toBe(601_000)
    expect(nextReminderAt(wait({ firstSeenAt: 1_000, lastRemindedAt: 601_000 }), live)).toBe(781_000)
  })
})

describe('waiting-confirmation reminders', () => {
  it('uses ten minutes by default and never less than one', () => {
    expect(remindAfterMs(DEFAULT_SETTINGS.remindAfterMinutes)).toBe(600_000)
    expect(remindAfterMs(0)).toBe(60_000)
    expect(remindAfterMs(2.4)).toBe(120_000)
  })

  it('does not remind before the delay has elapsed', () => {
    expect(dueReminders([wait({ firstSeenAt: 0 })], settings(), 599_999)).toEqual([])
  })

  it('reminds once the delay has elapsed', () => {
    const due = dueReminders([wait({ firstSeenAt: 0 })], settings(), 600_000)
    expect(due.map(entry => entry.key)).toEqual(['s1:r1'])
  })

  it('never reminds the same wait twice', () => {
    expect(dueReminders([wait({ firstSeenAt: 0, reminded: true })], settings(), 10_000_000)).toEqual([])
  })

  it('honours a custom delay', () => {
    expect(dueReminders([wait({ firstSeenAt: 0 })], settings({ remindAfterMinutes: 1 }), 60_000)).toHaveLength(1)
  })

  it('stays silent when the master or the scenario switch is off', () => {
    expect(dueReminders([wait({ firstSeenAt: 0 })], settings({ enabled: false }), 10_000_000)).toEqual([])
    expect(dueReminders([wait({ firstSeenAt: 0 })], settings({ notifyApproval: false }), 10_000_000)).toEqual([])
    expect(dueReminders([wait({ firstSeenAt: 0, kind: 'question' })], settings({ notifyQuestion: false }), 10_000_000)).toEqual([])
  })

  it('is no longer reminded once the wait is gone from the tracked set', () => {
    expect(dueReminders([], settings(), 10_000_000)).toEqual([])
  })
})
