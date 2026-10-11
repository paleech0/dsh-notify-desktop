/**
 * The client-persisted notification preferences: a tiny observable store over
 * localStorage. The host knows nothing of these preferences — the client owns
 * them, and every read is tolerant of a missing or unwritable storage.
 */
import {
  DEFAULT_SETTINGS,
  SOUND_GROUPS,
  SOUND_IDS,
  type NotifySettings,
  type NotifySounds,
  type SoundId,
} from '../types.ts'

/** Persist key; the version suffix lets a shape change migrate instead of crash. */
export const PERSIST_KEY = 'dsh-notify-desktop.v1'

/** The slice of Web Storage this module needs (absent in some embeddings). */
export interface SettingsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** The observable settings face shared by the runner and the settings section. */
export interface SettingsStore {
  /** The current settings; the reference is stable until {@link update}. */
  getSnapshot(): NotifySettings
  subscribe(listener: () => void): () => void
  update(patch: Partial<NotifySettings>): void
}

/** The ambient storage, or undefined when the embedding has none. */
function ambientStorage(): SettingsStorage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

/** Clamp one stored value back into the settings domain. */
function clampMinutes(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SETTINGS.remindAfterMinutes
  return Math.min(240, Math.max(1, Math.round(value)))
}

/** A library id: what a folder listing produced, and the only ids not in SOUND_IDS. */
const LIBRARY_ID = /^(?:custom|author):[^\\/:*?"<>|]+$/

/**
 * One sound id, or the default for that group when the stored value is unknown.
 *
 * Library ids (`custom:` / `author:`) are accepted even though they are not in
 * the static catalog: the host's folder listing decides what exists, and
 * rejecting them here silently reset every custom choice back to the default.
 */
function clampSound(group: keyof NotifySounds, value: unknown): SoundId {
  if (typeof value !== 'string') return DEFAULT_SETTINGS.sounds[group]
  if ((SOUND_IDS as readonly string[]).includes(value)) return value
  return LIBRARY_ID.test(value) ? value : DEFAULT_SETTINGS.sounds[group]
}

/**
 * Clamp the stored sound map back into the settings domain, group by group.
 * @param value - whatever was persisted.
 * @returns a complete map, defaulted per group.
 */
export function clampSounds(value: unknown): NotifySounds {
  const saved = (value ?? {}) as Partial<Record<keyof NotifySounds, unknown>>
  const out = {} as Record<keyof NotifySounds, SoundId>
  for (const group of SOUND_GROUPS) out[group] = clampSound(group, saved[group])
  return out
}

/**
 * Read the persisted settings, layering them over the defaults so a partial or
 * older payload never yields a half-formed settings object.
 * @param storage - the storage to read (defaults to the ambient localStorage).
 * @returns the effective settings.
 */
export function readSettings(storage: SettingsStorage | undefined = ambientStorage()): NotifySettings {
  if (storage === undefined) return DEFAULT_SETTINGS
  try {
    const raw = storage.getItem(PERSIST_KEY)
    if (raw === null) return DEFAULT_SETTINGS
    const saved = JSON.parse(raw) as Partial<NotifySettings>
    const merged: NotifySettings = { ...DEFAULT_SETTINGS, ...saved }
    return {
      ...merged,
      remindAfterMinutes: clampMinutes(merged.remindAfterMinutes),
      sounds: clampSounds(merged.sounds),
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/**
 * Persist the settings; a storage failure is swallowed (preferences are a
 * convenience, never a correctness requirement).
 * @param settings - the settings to write.
 * @param storage - the storage to write to (defaults to the ambient localStorage).
 */
export function writeSettings(
  settings: NotifySettings,
  storage: SettingsStorage | undefined = ambientStorage(),
): void {
  if (storage === undefined) return
  try {
    storage.setItem(PERSIST_KEY, JSON.stringify(settings))
  } catch {
    // Quota or a read-only storage: preferences stay in memory for this session.
  }
}

/**
 * Create the settings store backing both the settings section and the
 * notification runner.
 * @param storage - the storage to persist into (defaults to the ambient localStorage).
 * @returns the observable store.
 */
export function createSettingsStore(storage: SettingsStorage | undefined = ambientStorage()): SettingsStore {
  let snapshot = readSettings(storage)
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    update(patch) {
      const next: NotifySettings = {
        ...snapshot,
        ...patch,
        remindAfterMinutes: clampMinutes(patch.remindAfterMinutes ?? snapshot.remindAfterMinutes),
        sounds: clampSounds(patch.sounds ?? snapshot.sounds),
      }
      snapshot = next
      writeSettings(next, storage)
      for (const listener of [...listeners]) listener()
    },
  }
}
