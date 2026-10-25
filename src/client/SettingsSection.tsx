/**
 * The settings-page section, three cards.
 *
 *  1. "Desktop notifications": the master switch, the test button tucked right
 *     under it, and the delivery mode.
 *  2. "Notification setup": one row per enabled situation with its sound, its
 *     popup text and a live preview, then the two collapsible libraries (custom
 *     sounds with the transcode cache inside, custom texts with their editor).
 *  3. "Notify me in which situations": the two groups of situation switches,
 *     each row carrying an example sentence.
 *
 * Every control writes straight through to the persisted store, except the
 * sound and text libraries, which live in the host (a folder and a JSON file).
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { NotifyMode, NotifySettings, SoundId, SoundLibrary } from '../types.ts'
import {
  SCENARIO_IDS,
  type NotifyScenario,
} from '../scenarios.ts'
import { fmt, type NotifyKey } from './locales.ts'
import type { TemplateParts } from './template.ts'
import type { SoundCacheInfo } from './notifier.ts'
import { shortScenarioKey } from './notifier.ts'
import { SoundPicker } from './SoundPicker.tsx'
import { TextPicker } from './TextPicker.tsx'
import { TextManager } from './TextManager.tsx'
import { scenarioEnabled } from './decision.ts'
import type { SettingsStore } from './settings.ts'
import type { TextStore } from './texts.ts'

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
  /** Show the test notification: fixed copy, fixed default sound. */
  sendTest: () => void
  /** Audition one situation the way the current delivery mode would. */
  previewScenario: (scenario: NotifyScenario) => void
  /** The saved popup texts, loaded from the host. */
  texts: TextStore
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
  disabled?: boolean
  onChange: (checked: boolean) => void
}): JSX.Element {
  return (
    <div className={props.disabled === true ? 'dsh_notify_row dsh_notify_rowDisabled' : 'dsh_notify_row'}>
      <input
        id={props.id}
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled === true}
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

/** A collapsed/expanded block inside the customization card. */
function Collapse(props: {
  id: string
  title: string
  count: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}): JSX.Element {
  return (
    <div className="dsh_notify_customRow dsh_notify_collapse">
      <button
        type="button"
        className="dsh_notify_collapseHeader"
        id={props.id}
        aria-expanded={props.open}
        onClick={props.onToggle}
      >
        <span className="dsh_notify_pickerCaretSmall" data-open={props.open} aria-hidden="true" />
        <span className="dsh_notify_collapseLabel">{props.title}</span>
        <span className="dsh_notify_collapseCount">{props.count}</span>
      </button>
      {props.open ? <div className="dsh_notify_collapseBody">{props.children}</div> : null}
    </div>
  )
}

/** The switch-valued settings keys (everything but the reminder delay). */
type BooleanField = {
  [K in keyof NotifySettings]: NotifySettings[K] extends boolean ? K : never
}[keyof NotifySettings]

/** The turn-outcome switches, in presentation order. */
const OUTCOMES: ReadonlyArray<{ field: BooleanField; scenario: NotifyScenario }> = [
  { field: 'notifyCompleted', scenario: 'completed' },
  { field: 'notifyError', scenario: 'error' },
  { field: 'notifyAborted', scenario: 'aborted' },
  { field: 'notifyBlocked', scenario: 'blocked' },
  { field: 'notifyMaxTokens', scenario: 'max-tokens' },
]

/** The waiting-on-you switches, in presentation order. */
const PENDING: ReadonlyArray<{ field: BooleanField; scenario: NotifyScenario }> = [
  { field: 'notifyApproval', scenario: 'approval' },
  { field: 'notifyQuestion', scenario: 'question' },
  { field: 'notifyPlanReview', scenario: 'plan-review' },
]

/** The delivery modes, in presentation order. */
const MODES: ReadonlyArray<{ value: NotifyMode; labelKey: NotifyKey; descKey: NotifyKey }> = [
  { value: 'both', labelKey: 'settings.mode.both', descKey: 'settings.mode.bothDesc' },
  { value: 'notify', labelKey: 'settings.mode.notify', descKey: 'settings.mode.notifyDesc' },
  { value: 'sound', labelKey: 'settings.mode.sound', descKey: 'settings.mode.soundDesc' },
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

/** The display name of each situation. */
const SCENARIO_LABEL_KEYS: Readonly<Record<NotifyScenario, NotifyKey>> = {
  completed: 'settings.scenario.completed',
  error: 'settings.scenario.error',
  aborted: 'settings.scenario.aborted',
  blocked: 'settings.scenario.blocked',
  'max-tokens': 'settings.scenario.maxTokens',
  approval: 'settings.scenario.approval',
  question: 'settings.scenario.question',
  'plan-review': 'settings.scenario.planReview',
  reminder: 'settings.scenario.reminder',
}

/** The example sentence shown beside each switch in the situations card. */
const SCENARIO_EXAMPLE_KEYS: Readonly<Record<NotifyScenario, NotifyKey>> = {
  completed: 'settings.scenario.completedExample',
  error: 'settings.scenario.errorExample',
  aborted: 'settings.scenario.abortedExample',
  blocked: 'settings.scenario.blockedExample',
  'max-tokens': 'settings.scenario.maxTokensExample',
  approval: 'settings.scenario.approvalExample',
  question: 'settings.scenario.questionExample',
  'plan-review': 'settings.scenario.planReviewExample',
  reminder: 'settings.scenario.reminder',
}

/**
 * The notification settings section.
 * @param props - section props supplied by the settings slot.
 * @returns the rendered section.
 */
export function NotifySettingsSection(props: NotifySectionProps): JSX.Element {
  const settings = useSyncExternalStore(props.store.subscribe, props.store.getSnapshot)
  const texts = useSyncExternalStore(props.texts.subscribe, props.texts.getSnapshot)
  const [error, setError] = useState<string | null>(null)
  const [cache, setCache] = useState<SoundCacheInfo | null>(null)
  const [cacheNote, setCacheNote] = useState<string | null>(null)
  const [library, setLibrary] = useState<SoundLibrary>({ author: [], custom: [] })
  const [libraryNote, setLibraryNote] = useState<string | null>(null)
  const [soundConfirm, setSoundConfirm] = useState<string | null>(null)
  const [soundsOpen, setSoundsOpen] = useState(false)
  const [textsOpen, setTextsOpen] = useState(false)
  const t = props.t
  const readCache = props.cacheInfo
  const wipeCache = props.clearCache
  const readLibrary = props.loadLibrary
  // With the master switch off every delivery control is inert — the mode, the
  // per-situation sound and text pickers, the previews, the test, the reminder
  // delay and the situation switches. Only the configuration surfaces stay live:
  // the custom-sound library (with its cache) and the custom texts.
  const formEnabled = settings.enabled

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
      setError(t('settings.soundLibrary.addFailed'))
      return
    }
    setError(null)
    setLibraryNote(fmt(t('settings.soundLibrary.added'), { name }))
    await refreshLibrary()
  }

  /** Remove one imported sound after the inline confirmation. */
  const removeCustomSound = async (id: string): Promise<void> => {
    const removed = await props.deleteSound(id)
    setSoundConfirm(null)
    setLibraryNote(removed ? t('settings.soundLibrary.removed') : t('settings.soundLibrary.addFailed'))
    if (removed) await refreshLibrary()
  }

  /**
   * Audition one situation.
   *
   * A library sound that is no longer in the folder (deleted, or the settings
   * outlived the file) must not silently preview the system chime instead.
   */
  const preview = (scenario: NotifyScenario): void => {
    const sound = settings.sounds[scenario]
    const fromLibrary = sound.startsWith('custom:') || sound.startsWith('author:')
    const known = library.custom.some(item => item.id === sound)
      || library.author.some(item => item.id === sound)
    if (fromLibrary && !known) {
      setError(t('settings.soundLibrary.missing'))
      return
    }
    setError(null)
    props.previewScenario(scenario)
  }

  /** The label of one situation. */
  const scenarioLabel = (scenario: NotifyScenario): string => t(SCENARIO_LABEL_KEYS[scenario])

  /** The placeholder values one editor preview renders with. */
  const previewParts = (scenario: NotifyScenario): TemplateParts => ({
    workspace: t('notify.previewWorkspace'),
    status: t(shortScenarioKey(scenario)),
    body: t('notify.previewSampleBody'),
    minutes: String(settings.remindAfterMinutes),
  })

  /** The body fallback of one situation's built-in wording. */
  const previewFallback = (scenario: NotifyScenario): string => {
    switch (scenario) {
      case 'approval':
      case 'question':
      case 'plan-review':
        return t('notify.pendingBody')
      case 'reminder':
        return fmt(t('notify.reminderBody'), { minutes: String(settings.remindAfterMinutes) })
      default:
        return t('notify.emptyBody')
    }
  }

  // Only situations the user switched on get a row and a text group; the
  // reminder has no switch and rides along with the waiting situations.
  const visibleScenarios = SCENARIO_IDS.filter(scenario => scenarioEnabled(settings, scenario))
  const textCount = SCENARIO_IDS.reduce((sum, scenario) => sum + texts[scenario].length, 0)

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
        <div className="dsh_notify_testBlock">
          <button
            type="button"
            className="dsh_notify_button"
            disabled={!formEnabled}
            onClick={() => {
              props.sendTest()
            }}
          >
            {t('settings.test.button')}
          </button>
          <div className="dsh_notify_rowDesc">{t('settings.test.desc')}</div>
        </div>
        <div className="dsh_notify_modeBlock">
          <div className="dsh_notify_modeLabel">{t('settings.mode.label')}</div>
          {MODES.map(mode => (
            <label key={mode.value} className={formEnabled ? 'dsh_notify_modeRow' : 'dsh_notify_modeRow dsh_notify_modeRowDisabled'}>
              <input
                type="radio"
                name="dsh-notify-mode"
                disabled={!formEnabled}
                checked={settings.mode === mode.value}
                onChange={() => {
                  props.set({ mode: mode.value })
                }}
              />
              <span className="dsh_notify_modeText">
                <span className="dsh_notify_rowLabel">{t(mode.labelKey)}</span>
                <span className="dsh_notify_rowDesc">{t(mode.descKey)}</span>
              </span>
            </label>
          ))}
          <div className="dsh_notify_rowDesc">{t('settings.mode.desc')}</div>
        </div>
      </div>

      <div className="dsh_notify_card">
        <div className="dsh_notify_cardTitle">{t('settings.situations.title')}</div>
        <div className="dsh_notify_cardDesc">{t('settings.situations.desc')}</div>
        <div className="dsh_notify_subcard">
          <div className="dsh_notify_subcardTitle">{t('settings.situations.turnTitle')}</div>
          <div className="dsh_notify_rowDesc">{t('settings.situations.turnDesc')}</div>
          {OUTCOMES.map(entry => (
            <Toggle
              key={entry.field}
              id={'dsh-notify-' + entry.field}
              checked={settings[entry.field]}
              disabled={!formEnabled}
              label={scenarioLabel(entry.scenario)}
              desc={t(SCENARIO_EXAMPLE_KEYS[entry.scenario])}
              onChange={checked => {
                props.set({ [entry.field]: checked } as Partial<NotifySettings>)
              }}
            />
          ))}
        </div>
        <div className="dsh_notify_subcard">
          <div className="dsh_notify_subcardTitle">{t('settings.situations.pendingTitle')}</div>
          <div className="dsh_notify_rowDesc">{t('settings.situations.pendingDesc')}</div>
          {PENDING.map(entry => (
            <Toggle
              key={entry.field}
              id={'dsh-notify-' + entry.field}
              checked={settings[entry.field]}
              disabled={!formEnabled}
              label={scenarioLabel(entry.scenario)}
              desc={t(SCENARIO_EXAMPLE_KEYS[entry.scenario])}
              onChange={checked => {
                props.set({ [entry.field]: checked } as Partial<NotifySettings>)
              }}
            />
          ))}
        </div>
      </div>

      <div className="dsh_notify_card">
        <div className="dsh_notify_cardTitle">{t('settings.customize.title')}</div>
        <div className="dsh_notify_cardDesc">{t('settings.customize.desc')}</div>
        {error === null ? null : <div className="dsh_notify_error">{error}</div>}
        <div className="dsh_notify_scenarios">
          {visibleScenarios.map(scenario => (
            <div className="dsh_notify_scenarioRow" key={scenario}>
              <span className="dsh_notify_scenarioName">{scenarioLabel(scenario)}</span>
              <span className="dsh_notify_rowPrefix">{t('settings.scenario.sound')}</span>
              <SoundPicker
                value={settings.sounds[scenario]}
                library={library}
                labelOf={soundLabel}
                t={t}
                disabled={!formEnabled}
                onPick={chosen => {
                  const nextSounds: Record<NotifyScenario, SoundId> = { ...settings.sounds, [scenario]: chosen }
                  props.set({ sounds: nextSounds })
                }}
              />
              <span className="dsh_notify_rowPrefix">{t('settings.scenario.text')}</span>
              <TextPicker
                value={settings.texts[scenario]}
                options={texts[scenario]}
                t={t}
                disabled={!formEnabled}
                onPick={chosen => {
                  const nextTexts: Record<NotifyScenario, string> = { ...settings.texts, [scenario]: chosen }
                  props.set({ texts: nextTexts })
                }}
              />
              <button
                type="button"
                className="dsh_notify_button dsh_notify_scenarioPreview"
                disabled={!formEnabled}
                onClick={() => {
                  preview(scenario)
                }}
              >
                {t('settings.scenario.preview')}
              </button>
            </div>
          ))}
        </div>
        {visibleScenarios.includes('reminder') ? (
          <div className="dsh_notify_remindLine">
            <span>{t('settings.remind.prefix')}</span>
            <label className="dsh_notify_minutes">
              <input
                type="number"
                min={1}
                max={240}
                disabled={!formEnabled}
                value={settings.remindAfterMinutes}
                onChange={event => {
                  const next = Number(event.target.value)
                  if (Number.isFinite(next)) props.set({ remindAfterMinutes: next })
                }}
              />
            </label>
            <span>{t('settings.remind.suffix')}</span>
          </div>
        ) : null}

        <Collapse
          id="dsh-notify-sounds"
          title={t('settings.soundLibrary.title')}
          count={fmt(t('settings.soundLibrary.count'), { count: String(library.custom.length) })}
          open={soundsOpen}
          onToggle={() => {
            setSoundsOpen(!soundsOpen)
          }}
        >
          <div className="dsh_notify_customControls">
            <span className="dsh_notify_cacheText">
              {library.custom.length === 0
                ? t('settings.soundLibrary.empty')
                : fmt(t('settings.soundLibrary.count'), { count: String(library.custom.length) })}
            </span>
            <button
              type="button"
              className="dsh_notify_button"
              onClick={() => {
                void addCustomSound()
              }}
            >
              {t('settings.soundLibrary.add')}
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
                    className="dsh_notify_iconButton dsh_notify_danger"
                    onClick={() => {
                      setLibraryNote(null)
                      setSoundConfirm(item.id)
                    }}
                  >
                    {t('settings.soundLibrary.remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {soundConfirm === null ? null : (
            <div className="dsh_notify_confirm">
              <span>
                {fmt(t('settings.soundLibrary.removeConfirm'), {
                  name: library.custom.find(item => item.id === soundConfirm)?.name ?? soundConfirm,
                })}
              </span>
              <button
                type="button"
                className="dsh_notify_button dsh_notify_dangerButton"
                onClick={() => {
                  if (soundConfirm !== null) void removeCustomSound(soundConfirm)
                }}
              >
                {t('settings.textLibrary.delete')}
              </button>
              <button
                type="button"
                className="dsh_notify_button"
                onClick={() => {
                  setSoundConfirm(null)
                }}
              >
                {t('settings.textEditor.cancel')}
              </button>
            </div>
          )}
          <div className="dsh_notify_rowDesc">
            {fmt(t('settings.soundLibrary.desc'), { path: '%LOCALAPPDATA%\\dsh-notify\\custom' })}
          </div>
          {libraryNote === null ? null : <div className="dsh_notify_note">{libraryNote}</div>}

          <div className="dsh_notify_cacheBlock">
            <div className="dsh_notify_customControls">
              <span className="dsh_notify_soundLabel">{t('settings.cache.label')}</span>
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
        </Collapse>

        <Collapse
          id="dsh-notify-texts"
          title={t('settings.textLibrary.title')}
          count={fmt(t('settings.textLibrary.count'), { count: String(textCount) })}
          open={textsOpen}
          onToggle={() => {
            setTextsOpen(!textsOpen)
          }}
        >
          <TextManager
            scenarios={visibleScenarios}
            library={texts}
            t={t}
            labelOf={scenarioLabel}
            partsOf={previewParts}
            fallbackOf={previewFallback}
            onSave={(scenario, draft, id) => props.texts.save(scenario, draft, id)}
            onDelete={(scenario, id) => props.texts.remove(scenario, id)}
          />
        </Collapse>
      </div>

    </section>
  )
}
