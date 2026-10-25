import { describe, expect, it } from 'vitest'
import { DEFAULT_BODY_TEMPLATE, DEFAULT_SETTINGS, DEFAULT_TITLE_TEMPLATE } from '../src/types.ts'
import { PERSIST_KEY, createSettingsStore, readSettings, writeSettings, type SettingsStorage } from '../src/client/settings.ts'

/** An in-memory storage stand-in. */
function memory(initial: Record<string, string> = {}): SettingsStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: key => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
  }
}

describe('notification settings store', () => {
  it('falls back to the defaults with no storage at all', () => {
    expect(readSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    const store = createSettingsStore(undefined)
    expect(store.getSnapshot()).toEqual(DEFAULT_SETTINGS)
    store.update({ enabled: false })
    expect(store.getSnapshot().enabled).toBe(false)
  })

  it('survives a corrupt payload', () => {
    const storage = memory({ [PERSIST_KEY]: '{not json' })
    expect(readSettings(storage)).toEqual(DEFAULT_SETTINGS)
  })

  it('migrates the pre-mode soundEnabled flag and layers a partial payload over the defaults', () => {
    // Old shape: sounds switched off meant "no sound at all" — today's notify-only.
    const soundsOff = memory({ [PERSIST_KEY]: JSON.stringify({ soundEnabled: false }) })
    const settings = readSettings(soundsOff)
    expect(settings.mode).toBe('notify')
    expect(settings.enabled).toBe(true)
    // Old shape with sounds on, and any payload without the flag, reads as `both`.
    const soundsOn = memory({ [PERSIST_KEY]: JSON.stringify({ soundEnabled: true }) })
    expect(readSettings(soundsOn).mode).toBe('both')
    expect(readSettings(memory({ [PERSIST_KEY]: '{}' })).mode).toBe('both')
    // A payload already carrying the mode passes through untouched.
    const migrated = memory({ [PERSIST_KEY]: JSON.stringify({ mode: 'sound' }) })
    expect(readSettings(migrated).mode).toBe('sound')
  })

  it('inherits the old four-group sounds into every situation', () => {
    const storage = memory({
      [PERSIST_KEY]: JSON.stringify({
        sounds: { finished: 'file:tada', error: 'file:error', attention: 'silent', reminder: 'file:exclamation' },
      }),
    })
    const { sounds } = readSettings(storage)
    for (const scenario of ['completed', 'aborted', 'blocked', 'max-tokens'] as const) {
      expect(sounds[scenario]).toBe('file:tada')
    }
    expect(sounds['error']).toBe('file:error')
    for (const scenario of ['approval', 'question', 'plan-review'] as const) {
      expect(sounds[scenario]).toBe('silent')
    }
    expect(sounds['reminder']).toBe('file:exclamation')
    // A new-shape value wins over the inherited group value.
    const mixed = memory({
      [PERSIST_KEY]: JSON.stringify({ sounds: { finished: 'file:tada', completed: 'system:im', 'approval': 'file:ding' } }),
    })
    expect(readSettings(mixed).sounds['completed']).toBe('system:im')
    expect(readSettings(mixed).sounds['aborted']).toBe('file:tada')
  })

  it('clamps unknown sound ids and text choices back to their defaults', () => {
    const storage = memory({
      [PERSIST_KEY]: JSON.stringify({
        sounds: { completed: 'bogus', error: 'custom:my.wav' },
        texts: { completed: 't_abc123', error: 'not-a-template', blocked: 'default' },
      }),
    })
    const settings = readSettings(storage)
    expect(settings.sounds['completed']).toBe('file:chimes')
    expect(settings.sounds['error']).toBe('custom:my.wav')
    expect(settings.texts['completed']).toBe('t_abc123')
    expect(settings.texts['error']).toBe('default')
    expect(settings.texts['blocked']).toBe('default')
    // Every other situation is complete even though the payload was partial.
    expect(Object.keys(settings.sounds)).toHaveLength(9)
    expect(Object.keys(settings.texts)).toHaveLength(9)
  })

  it('carries a customized global template pair into legacyText for the disk migration', () => {
    const customized = memory({
      [PERSIST_KEY]: JSON.stringify({ titleTemplate: '{状态} — {工作区}', bodyTemplate: '来信：{内容}' }),
    })
    expect(readSettings(customized).legacyText).toEqual({ title: '{状态} — {工作区}', body: '来信：{内容}' })
    // A default (or missing) pair has nothing to migrate.
    const plain = memory({ [PERSIST_KEY]: JSON.stringify({ titleTemplate: DEFAULT_TITLE_TEMPLATE, bodyTemplate: DEFAULT_BODY_TEMPLATE }) })
    expect(readSettings(plain).legacyText).toBeNull()
    expect(readSettings(memory({ [PERSIST_KEY]: '{}' })).legacyText).toBeNull()
  })

  it('clamps the reminder delay into range', () => {
    expect(readSettings(memory({ [PERSIST_KEY]: JSON.stringify({ remindAfterMinutes: 0 }) })).remindAfterMinutes).toBe(1)
    expect(readSettings(memory({ [PERSIST_KEY]: JSON.stringify({ remindAfterMinutes: 9999 }) })).remindAfterMinutes).toBe(240)
    expect(readSettings(memory({ [PERSIST_KEY]: JSON.stringify({ remindAfterMinutes: 'x' }) })).remindAfterMinutes).toBe(10)
  })

  it('clamps writes the same way reads do, and can clear legacyText', () => {
    const store = createSettingsStore(memory())
    store.update({ texts: { ...DEFAULT_SETTINGS.texts, error: 'not-a-template' } })
    expect(store.getSnapshot().texts['error']).toBe('default')
    store.update({ sounds: { ...DEFAULT_SETTINGS.sounds, 'error': 'bogus' } })
    expect(store.getSnapshot().sounds['error']).toBe('file:error')
    store.update({ legacyText: { title: '{状态}', body: '{内容}' } })
    expect(store.getSnapshot().legacyText).toEqual({ title: '{状态}', body: '{内容}' })
    store.update({ legacyText: null })
    expect(store.getSnapshot().legacyText).toBeNull()
  })

  it('persists and notifies subscribers with a stable snapshot reference', () => {
    const storage = memory()
    const store = createSettingsStore(storage)
    let calls = 0
    const before = store.getSnapshot()
    const off = store.subscribe(() => {
      calls += 1
    })
    store.update({ notifyError: false })
    expect(calls).toBe(1)
    expect(store.getSnapshot()).not.toBe(before)
    expect(store.getSnapshot().notifyError).toBe(false)
    expect(JSON.parse(storage.data[PERSIST_KEY] ?? '{}')).toMatchObject({ notifyError: false })
    writeSettings(DEFAULT_SETTINGS, storage)
    expect(JSON.parse(storage.data[PERSIST_KEY] ?? '{}')).toEqual(DEFAULT_SETTINGS)
    off()
    store.update({ notifyError: true })
    expect(calls).toBe(1)
  })
})
