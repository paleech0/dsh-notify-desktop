/**
 * The client-persisted notification preferences: a tiny observable store over
 * localStorage. The host knows nothing of these preferences — the client owns
 * them, and every read is tolerant of a missing or unwritable storage.
 *
 * The stored shape grew twice: an old `soundEnabled` boolean became the
 * delivery `mode`, and the first template iteration's single title/body pair
 * became per-situation text choices. Both migrations happen here, at read time,
 * so no version bump or separate migration step is needed.
 */
import {
  DEFAULT_SETTINGS,
  DEFAULT_TEXT_CHOICE,
  DEFAULT_BODY_TEMPLATE,
  DEFAULT_TITLE_TEMPLATE,
  NOTIFY_MODES,
  SOUND_IDS,
  type LegacyTextTemplates,
  type NotifyMode,
  type NotifySettings,
  type NotifySounds,
  type NotifyTexts,
  type SoundId,
} from '../types.ts'
import {
  SCENARIO_IDS,
  isTemplateId,
  type NotifyScenario,
} from '../scenarios.ts'

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

/** One delivery mode, or the default for anything the catalog does not name. */
function clampMode(value: unknown): NotifyMode {
  return (NOTIFY_MODES as readonly string[]).includes(value as string) ? value as NotifyMode : DEFAULT_SETTINGS.mode
}

/** A library id: what a folder listing produced, and the only ids not in SOUND_IDS. */
const LIBRARY_ID = /^(?:custom|author):[^\\/:*?"<>|]+$/

/**
 * One sound id, or the default for that situation when the stored value is
 * unknown. Library ids (`custom:` / `author:`) are accepted even though they
 * are not in the static catalog: the host's folder listing decides what exists,
 * and rejecting them here silently reset every custom choice back to the
 * default.
 */
function clampSound(scenario: NotifyScenario, value: unknown): SoundId {
  if (typeof value !== 'string') return DEFAULT_SETTINGS.sounds[scenario]
  if ((SOUND_IDS as readonly string[]).includes(value)) return value
  return LIBRARY_ID.test(value) ? value : DEFAULT_SETTINGS.sounds[scenario]
}

/** Which pre-per-situation group used to feed a situation's sound. */
const LEGACY_SOUND_GROUP: Readonly<Record<NotifyScenario, string>> = {
  completed: 'finished',
  error: 'error',
  aborted: 'finished',
  blocked: 'finished',
  'max-tokens': 'finished',
  approval: 'attention',
  question: 'attention',
  'plan-review': 'attention',
  reminder: 'reminder',
}

/**
 * Clamp the stored sound map back into the settings domain, situation by
 * situation. A stored value under the new shape wins; otherwise the old
 * four-group value is inherited, which is how a pre-upgrade sound choice
 * survives.
 * @param value - whatever was persisted.
 * @returns a complete map, defaulted per situation.
 */
export function clampSounds(value: unknown): NotifySounds {
  const saved = (value ?? {}) as Record<string, unknown>
  const out = {} as Record<NotifyScenario, SoundId>
  for (const scenario of SCENARIO_IDS) {
    const direct = saved[scenario]
    const inherited = direct === undefined ? saved[LEGACY_SOUND_GROUP[scenario]] : undefined
    out[scenario] = clampSound(scenario, direct === undefined ? inherited : direct)
  }
  return out
}

/**
 * Clamp the stored text choices: `default` or a template id. Unknown values
 * (including a template deleted while the settings survived) read as the
 * default text; the runner falls back the same way if a chosen id is missing.
 * @param value - whatever was persisted.
 * @returns a complete choice map.
 */
export function clampTexts(value: unknown): NotifyTexts {
  const saved = (value ?? {}) as Record<string, unknown>
  const out = {} as Record<NotifyScenario, string>
  for (const scenario of SCENARIO_IDS) {
    const choice = saved[scenario]
    out[scenario] = choice === DEFAULT_TEXT_CHOICE || isTemplateId(choice)
      ? choice as string
      : DEFAULT_TEXT_CHOICE
  }
  return out
}

/**
 * Recover the first template iteration's global pair, when it was customized.
 *
 * That shape stored one title/body pair for every real notification. It is
 * carried in the settings only until the client has written it into each
 * enabled situation's library on disk (the store cannot do that itself: it is
 * synchronous and host-free).
 * @param saved - the parsed persisted payload.
 * @returns the pair to migrate, or null when nothing was customized.
 */
function readLegacyTemplates(saved: Record<string, unknown>): LegacyTextTemplates | null {
  const title = typeof saved['titleTemplate'] === 'string' ? saved['titleTemplate'].trim() : ''
  const body = typeof saved['bodyTemplate'] === 'string' ? saved['bodyTemplate'].trim() : ''
  const normalizedTitle = title === '' ? DEFAULT_TITLE_TEMPLATE : title
  const normalizedBody = body === '' ? DEFAULT_BODY_TEMPLATE : body
  if (normalizedTitle === DEFAULT_TITLE_TEMPLATE && normalizedBody === DEFAULT_BODY_TEMPLATE) return null
  return { title: normalizedTitle, body: normalizedBody }
}

/** One boolean field, defaulted when the stored value is not a boolean. */
function clampBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
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
    const saved = JSON.parse(raw) as Record<string, unknown>
    // Migration: sounds switched off under the pre-mode shape meant "no sound
    // at all", which is today's notify-only mode; everything else reads as
    // `both`. A payload that already carries `mode` wins.
    const mode = saved['mode'] === undefined && saved['soundEnabled'] === false
      ? 'notify' as NotifyMode
      : clampMode(saved['mode'])
    const legacyText = readLegacyTemplates(saved)
    return {
      enabled: clampBoolean(saved['enabled'], DEFAULT_SETTINGS.enabled),
      mode,
      sounds: clampSounds(saved['sounds']),
      texts: clampTexts(saved['texts']),
      legacyText,
      notifyCompleted: clampBoolean(saved['notifyCompleted'], DEFAULT_SETTINGS.notifyCompleted),
      notifyError: clampBoolean(saved['notifyError'], DEFAULT_SETTINGS.notifyError),
      notifyAborted: clampBoolean(saved['notifyAborted'], DEFAULT_SETTINGS.notifyAborted),
      notifyBlocked: clampBoolean(saved['notifyBlocked'], DEFAULT_SETTINGS.notifyBlocked),
      notifyMaxTokens: clampBoolean(saved['notifyMaxTokens'], DEFAULT_SETTINGS.notifyMaxTokens),
      notifyApproval: clampBoolean(saved['notifyApproval'], DEFAULT_SETTINGS.notifyApproval),
      notifyQuestion: clampBoolean(saved['notifyQuestion'], DEFAULT_SETTINGS.notifyQuestion),
      notifyPlanReview: clampBoolean(saved['notifyPlanReview'], DEFAULT_SETTINGS.notifyPlanReview),
      remindAfterMinutes: clampMinutes(saved['remindAfterMinutes']),
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
        mode: patch.mode === undefined ? snapshot.mode : clampMode(patch.mode),
        remindAfterMinutes: clampMinutes(patch.remindAfterMinutes ?? snapshot.remindAfterMinutes),
        sounds: clampSounds(patch.sounds ?? snapshot.sounds),
        texts: clampTexts(patch.texts ?? snapshot.texts),
        legacyText: patch.legacyText === undefined ? snapshot.legacyText : patch.legacyText,
      }
      snapshot = next
      writeSettings(next, storage)
      for (const listener of [...listeners]) listener()
    },
  }
}
