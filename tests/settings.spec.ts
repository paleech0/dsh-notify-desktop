import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/types.ts'
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

  it('layers a partial payload over the defaults', () => {
    const storage = memory({ [PERSIST_KEY]: JSON.stringify({ soundEnabled: false }) })
    const settings = readSettings(storage)
    expect(settings.soundEnabled).toBe(false)
    expect(settings.enabled).toBe(true)
  })

  it('clamps the reminder delay into range', () => {
    expect(readSettings(memory({ [PERSIST_KEY]: JSON.stringify({ remindAfterMinutes: 0 }) })).remindAfterMinutes).toBe(1)
    expect(readSettings(memory({ [PERSIST_KEY]: JSON.stringify({ remindAfterMinutes: 9999 }) })).remindAfterMinutes).toBe(240)
    expect(readSettings(memory({ [PERSIST_KEY]: JSON.stringify({ remindAfterMinutes: 'x' }) })).remindAfterMinutes).toBe(10)
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
