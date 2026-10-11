/**
 * The settings-page section: master switch, sound switch, per-outcome and
 * waiting-on-you switches, the reminder delay, and a test button. Every control
 * writes straight through to the persisted store.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  SOUND_CHOICES,
  type NotifySettings,
  type SoundGroup,
  type SoundId,
  type SoundLibrary,
} from '../types.ts'
import { fmt, type NotifyKey } from './locales.ts'
import type { SoundCacheInfo } from './notifier.ts'
import { SoundPicker } from './SoundPicker.tsx'
import type { SettingsStore } from './settings.ts'

/** Human-readable byte size for the cache row. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return String(bytes) + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

/** Injected business face of the section. */
export interface NotifySectionInjected {
  /** The live settings store. */
  store: SettingsStore
  /** Persist one patch. */
  set: (patch: Partial<NotifySettings>) => void
  /** Show one test toast, optionally playing a specific sound. */
  sendTest: (sound?: SoundId) => void
  /** Open the Windows file picker and return the chosen wav path ('' = cancelled). */
  pickFile: () => Promise<string>
  /** Read the sound library: the plugin's sounds and the user's imports. */
  loadLibrary: () => Promise<SoundLibrary>
  /** Copy one picked file into the custom-sound folder; its name, or null. */
  importSound: (file: string) => Promise<string | null>
  /** Delete one imported custom sound. */
  deleteSound: (id: string) => Promise<boolean>
  /** Read the transcoded-wav cache size (null when the host is unreachable). */
  cacheInfo: () => Promise<SoundCacheInfo | null>
  /** Empty the transcoded-wav cache. */
  clearCache: () => Promise<SoundCacheInfo | null>
}

/** Full section props: runtime share + injected face + the locale seat. */
export type NotifySectionProps =
  & PropsRuntime<'settings.section'>
  & InjectFace<NotifySectionInjected>
  & PropsLocale<'notify'>

/**
 * One native-checkbox preference row.
 *
 * The hit area is deliberately small: only the checkbox itself and the title
 * text toggle it. Wrapping the whole row in a label made a stray click anywhere
 * on the card flip a setting (user feedback: the target was too large).
 */
function Toggle(props: {
  id: string
  checked: boolean
  label: string
  desc?: string
  onChange: (checked: boolean) => void
}): JSX.Element {
  return (
    <div className="dsh_notify_row">
      <input
        id={props.id}
        type="checkbox"
        checked={props.checked}
        onChange={event => {
          props.onChange(event.target.checked)
        }}
      />
      <div className="dsh_notify_rowText">
        <label className="dsh_notify_rowLabel" htmlFor={props.id}>{props.label}</label>
        {props.desc === undefined ? null : <span className="dsh_notify_rowDesc">{props.desc}</span>}
      </div>
    </div>
  )
}

/** The switch-valued settings keys (everything but the reminder delay). */
type BooleanField = {
  [K in keyof NotifySettings]: NotifySettings[K] extends boolean ? K : never
}[keyof NotifySettings]

/** The turn-outcome switches, in presentation order. */
const OUTCOMES: ReadonlyArray<{ field: BooleanField; key: NotifyKey }> = [
  { field: 'notifyCompleted', key: 'settings.when.completed' },
  { field: 'notifyError', key: 'settings.when.error' },
  { field: 'notifyAborted', key: 'settings.when.aborted' },
  { field: 'notifyBlocked', key: 'settings.when.blocked' },
  { field: 'notifyMaxTokens', key: 'settings.when.maxTokens' },
]

/** The four situations whose sound is configurable, in presentation order. */
const SOUND_ROWS: ReadonlyArray<{ group: SoundGroup; key: NotifyKey }> = [
  { group: 'finished', key: 'settings.sounds.finished' },
  { group: 'error', key: 'settings.sounds.error' },
  { group: 'attention', key: 'settings.sounds.attention' },
  { group: 'reminder', key: 'settings.sounds.reminder' },
]

/** The locale key of each selectable sound; an unknown id falls back to the first. */
const SOUND_LABEL_KEYS: Readonly<Record<string, NotifyKey>> = {
  'system:default': 'settings.sound.systemDefault',
  'system:im': 'settings.sound.systemIm',
  'system:mail': 'settings.sound.systemMail',
  'system:calendar': 'settings.sound.systemCalendar',
  'file:ding': 'settings.sound.fileDing',
  'file:chimes': 'settings.sound.fileChimes',
  'file:notify': 'settings.sound.fileNotify',
  'file:notify-legacy': 'settings.sound.fileNotifyLegacy',
  'file:message-nudge': 'settings.sound.fileMessageNudge',
  'file:tada': 'settings.sound.fileTada',
  'file:exclamation': 'settings.sound.fileExclamation',
  'file:error': 'settings.sound.fileError',
  'file:critical-stop': 'settings.sound.fileCriticalStop',
  'file:alarm-1': 'settings.sound.fileAlarm1',
  'file:alarm-2': 'settings.sound.fileAlarm2',
  'file:alarm-3': 'settings.sound.fileAlarm3',
  'file:ring-1': 'settings.sound.fileRing1',
  'file:ring-2': 'settings.sound.fileRing2',
  'file:ring-3': 'settings.sound.fileRing3',
  silent: 'settings.sound.silent',
}

/** The waiting-on-you switches, in presentation order. */
const PENDING: ReadonlyArray<{ field: BooleanField; key: NotifyKey }> = [
  { field: 'notifyApproval', key: 'settings.pending.approval' },
  { field: 'notifyQuestion', key: 'settings.pending.question' },
  { field: 'notifyPlanReview', key: 'settings.pending.planReview' },
]

/**
 * The notification settings section.
 * @param props - section props supplied by the settings slot.
 * @returns the rendered section.
 */
export function NotifySettingsSection(props: NotifySectionProps): JSX.Element {
  const settings = useSyncExternalStore(props.store.subscribe, props.store.getSnapshot)
  const [error, setError] = useState<string | null>(null)
  const [cache, setCache] = useState<SoundCacheInfo | null>(null)
  const [cacheNote, setCacheNote] = useState<string | null>(null)
  const [library, setLibrary] = useState<SoundLibrary>({ author: [], custom: [] })
  const [libraryNote, setLibraryNote] = useState<string | null>(null)
  const t = props.t
  const readCache = props.cacheInfo
  const wipeCache = props.clearCache
  const readLibrary = props.loadLibrary

  useEffect(() => {
    void readCache().then(info => {
      setCache(info)
    }, () => undefined)
    void readLibrary().then(next => {
      setLibrary(next)
    }, () => undefined)
  }, [readCache, readLibrary])

  /**
   * The display label of one sound id.
   *
   * Built-ins come from the locale table; a library sound is shown by its file
   * name (without the extension), which is what the picker lists too.
   */
  const soundLabel = (id: SoundId): string => {
    if (id.startsWith('author:') || id.startsWith('custom:')) {
      const item = library.author.find(entry => entry.id === id)
        ?? library.custom.find(entry => entry.id === id)
      return item === undefined ? id : item.name
    }
    const key = SOUND_LABEL_KEYS[id]
    return t(key ?? 'settings.sound.systemDefault')
  }

  /** Reload the library after the folder changed. */
  const refreshLibrary = (): Promise<void> =>
    readLibrary().then(next => {
      setLibrary(next)
    }, () => undefined)

  /** Pick a file, copy it into the custom folder, and reload the list. */
  const addCustomSound = async (): Promise<void> => {
    const file = await props.pickFile()
    if (file === '') return
    const name = await props.importSound(file)
    if (name === null) {
      setError(t('settings.library.addFailed'))
      return
    }
    setError(null)
    setLibraryNote(fmt(t('settings.library.added'), { name }))
    await refreshLibrary()
  }

  /** Remove one imported sound and reload the list. */
  const removeCustomSound = async (id: string): Promise<void> => {
    const removed = await props.deleteSound(id)
    setLibraryNote(removed ? t('settings.library.removed') : t('settings.library.addFailed'))
    if (removed) await refreshLibrary()
  }

  /**
   * Preview one sound.
   *
   * A group set to the custom sound has nothing to play until a file is chosen,
   * so the click explains that instead of raising a toast with the system chime.
   */
  const preview = (sound: SoundId): void => {
    // A library sound that is no longer in the folder (deleted, or the settings
    // outlived the file) must not silently preview the system chime instead.
    const fromLibrary = sound.startsWith('custom:') || sound.startsWith('author:')
    const known = library.custom.some(item => item.id === sound)
      || library.author.some(item => item.id === sound)
    if (fromLibrary && !known) {
      setError(t('settings.library.missing'))
      return
    }
    setError(null)
    props.sendTest(sound)
  }

  return (
    <section className="dsh_notify_section">
      <div className="dsh_notify_card">
        <div className="dsh_notify_cardTitle">{t('settings.title')}</div>
        <div className="dsh_notify_cardDesc">{t('settings.subtitle')}</div>
        <Toggle
          id="dsh-notify-enabled"
          checked={settings.enabled}
          label={t('settings.enabled')}
          desc={t('settings.enabledDesc')}
          onChange={checked => {
            props.set({ enabled: checked })
          }}
        />
        <Toggle
          id="dsh-notify-sound"
          checked={settings.soundEnabled}
          label={t('settings.sound')}
          desc={t('settings.soundDesc')}
          onChange={checked => {
            props.set({ soundEnabled: checked })
          }}
        />
      </div>

      <div className="dsh_notify_card">
        <div className="dsh_notify_cardTitle">{t('settings.sounds.title')}</div>
        <div className="dsh_notify_cardDesc">{t('settings.sounds.desc')}</div>
        <div className="dsh_notify_sounds">
          {SOUND_ROWS.map(row => (
            <div className="dsh_notify_soundRow" key={row.group}>
              <span className="dsh_notify_soundLabel">{t(row.key)}</span>
              <SoundPicker
                value={settings.sounds[row.group]}
                library={library}
                labelOf={soundLabel}
                t={t}
                onPick={chosen => {
                  props.set({ sounds: { ...settings.sounds, [row.group]: chosen } })
                }}
              />
              <button
                type="button"
                className="dsh_notify_button dsh_notify_preview"
                style={{ width: '68px' }}
                onClick={() => {
                  preview(settings.sounds[row.group])
                }}
              >
                {t('settings.sounds.preview')}
              </button>
            </div>
          ))}
        </div>
        <div className="dsh_notify_customRow">
          <span className="dsh_notify_soundLabel">{t('settings.library.title')}</span>
          <div className="dsh_notify_customControls">
            <span className="dsh_notify_cacheText">
              {library.custom.length === 0
                ? t('settings.library.empty')
                : fmt(t('settings.library.count'), {
                  files: String(library.custom.length),
                  size: formatBytes(library.custom.reduce((sum, item) => sum + item.bytes, 0)),
                })}
            </span>
            <button
              type="button"
              className="dsh_notify_button"
              onClick={() => {
                void addCustomSound()
              }}
            >
              {t('settings.library.add')}
            </button>
          </div>
          {library.custom.length === 0 ? null : (
            <ul className="dsh_notify_soundList">
              {library.custom.map(item => (
                <li key={item.id} className="dsh_notify_soundItem">
                  <span className="dsh_notify_soundItemName">{item.name}</span>
                  <span className="dsh_notify_soundItemSize">{formatBytes(item.bytes)}</span>
                  <button
                    type="button"
                    className="dsh_notify_iconButton"
                    onClick={() => {
                      void removeCustomSound(item.id)
                    }}
                  >
                    {t('settings.library.remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="dsh_notify_rowDesc">
            {fmt(t('settings.library.desc'), { path: '%LOCALAPPDATA%\\dsh-notify\\custom' })}
          </div>
          {libraryNote === null ? null : <div className="dsh_notify_note">{libraryNote}</div>}
          {error === null ? null : <div className="dsh_notify_error">{error}</div>}
        </div>
        <div className="dsh_notify_customRow">
          <span className="dsh_notify_soundLabel">{t('settings.cache.label')}</span>
          <div className="dsh_notify_customControls">
            <span className="dsh_notify_cacheText">
              {cache === null || cache.files === 0
                ? t('settings.cache.empty')
                : fmt(t('settings.cache.inUse'), {
                  files: String(cache.files),
                  size: formatBytes(cache.bytes),
                })}
            </span>
            <button
              type="button"
              className="dsh_notify_button"
              onClick={() => {
                void wipeCache().then(result => {
                  if (result === null) {
                    setCacheNote(t('settings.cache.failed'))
                    return
                  }
                  setCache({ files: 0, bytes: 0 })
                  setCacheNote(fmt(t('settings.cache.cleared'), {
                    files: String(result.files),
                    size: formatBytes(result.bytes),
                  }))
                }, () => undefined)
              }}
            >
              {t('settings.cache.clear')}
            </button>
          </div>
          <div className="dsh_notify_rowDesc">{t('settings.cache.desc')}</div>
          {cacheNote === null ? null : <div className="dsh_notify_note">{cacheNote}</div>}
        </div>
      </div>

      <div className="dsh_notify_card">
        <div className="dsh_notify_cardTitle">{t('settings.when.title')}</div>
        <div className="dsh_notify_cardDesc">{t('settings.when.subtitle')}</div>
        {OUTCOMES.map(entry => (
          <Toggle
            key={entry.field}
            id={'dsh-notify-' + entry.field}
            checked={settings[entry.field]}
            label={t(entry.key)}
            onChange={checked => {
              props.set({ [entry.field]: checked } as Partial<NotifySettings>)
            }}
          />
        ))}
      </div>

      <div className="dsh_notify_card">
        <div className="dsh_notify_cardTitle">{t('settings.pending.title')}</div>
        <div className="dsh_notify_cardDesc">{t('settings.pending.subtitle')}</div>
        {PENDING.map(entry => (
          <Toggle
            key={entry.field}
            id={'dsh-notify-' + entry.field}
            checked={settings[entry.field]}
            label={t(entry.key)}
            onChange={checked => {
              props.set({ [entry.field]: checked } as Partial<NotifySettings>)
            }}
          />
        ))}
      </div>

      <div className="dsh_notify_card">
        <div className="dsh_notify_cardTitle">{t('settings.remind.title')}</div>
        <div className="dsh_notify_cardDesc">{t('settings.remind.desc')}</div>
        <label className="dsh_notify_minutes">
          <input
            type="number"
            min={1}
            max={240}
            value={settings.remindAfterMinutes}
            onChange={event => {
              const next = Number(event.target.value)
              if (Number.isFinite(next)) props.set({ remindAfterMinutes: next })
            }}
          />
          <span>{t('settings.remind.minutes')}</span>
        </label>
      </div>

      <div className="dsh_notify_card">
        <div className="dsh_notify_cardTitle">{t('settings.test.title')}</div>
        <div className="dsh_notify_cardDesc">{t('settings.test.desc')}</div>
        <button
          type="button"
          className="dsh_notify_button"
          onClick={() => {
            preview(settings.sounds.finished)
          }}
        >
          {t('settings.test.button')}
        </button>
        {error === null ? null : <div className="dsh_notify_error">{error}</div>}
      </div>
    </section>
  )
}
