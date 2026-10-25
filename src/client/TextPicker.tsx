/**
 * The popup-text picker for one situation.
 *
 * Same shape as {@link SoundPicker}: a trigger that shows the current choice and
 * a floating panel with two level-one groups — the built-in default wording and
 * the situation's own saved texts (at most {@link TEXT_LIMIT_PER_SCENARIO}).
 * The panel is flat (no second click to expand a group): with two short lists
 * the extra fold only costs a click.
 */
import { useEffect, useRef, useState } from 'react'
import { DEFAULT_TEXT_CHOICE } from '../types.ts'
import { TEXT_LIMIT_PER_SCENARIO, type TextTemplate } from '../scenarios.ts'
import type { NotifyKey } from './locales.ts'

/** Props of {@link TextPicker}. */
export interface TextPickerProps {
  /** The stored choice: 'default' or a template id. */
  readonly value: string
  /** The situation's saved templates. */
  readonly options: readonly TextTemplate[]
  /** Locale lookup. */
  readonly t: (key: NotifyKey) => string
  /** Grey the trigger out (the master switch is off); the value stays. */
  readonly disabled?: boolean
  /** Called with the newly chosen choice id. */
  readonly onPick: (choice: string) => void
}

/**
 * Render the picker.
 * @param props - see {@link TextPickerProps}.
 * @returns the trigger and, while open, the two-section panel.
 */
export function TextPicker(props: TextPickerProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement | null>(null)
  const chosen = props.value === DEFAULT_TEXT_CHOICE
    ? undefined
    : props.options.find(entry => entry.id === props.value)
  const label = props.value === DEFAULT_TEXT_CHOICE
    ? props.t('settings.text.default')
    : chosen === undefined
      ? props.t('settings.text.missing')
      : chosen.name

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event: MouseEvent): void => {
      const node = root.current
      if (node !== null && event.target instanceof Node && !node.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="dsh_notify_picker dsh_notify_textPicker" ref={root}>
      <button
        type="button"
        className="dsh_notify_pickerTrigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={props.disabled}
        title={label}
        onClick={() => {
          setOpen(!open)
        }}
      >
        <span className="dsh_notify_pickerValue">{label}</span>
        <span className="dsh_notify_pickerCaret" aria-hidden="true" />
      </button>
      {!open ? null : (
        <div className="dsh_notify_pickerPanel dsh_notify_textPanel" role="listbox" aria-label={props.t('settings.text.pickerLabel')}>
          <div className="dsh_notify_pickerSection">
            <div className="dsh_notify_pickerHeader dsh_notify_pickerHeaderStatic">
              <span className="dsh_notify_pickerHeaderLabel">{props.t('settings.text.default')}</span>
            </div>
            <ul className="dsh_notify_pickerList">
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={props.value === DEFAULT_TEXT_CHOICE}
                  className={'dsh_notify_pickerOption' + (props.value === DEFAULT_TEXT_CHOICE ? ' is-selected' : '')}
                  onClick={() => {
                    props.onPick(DEFAULT_TEXT_CHOICE)
                    setOpen(false)
                  }}
                >
                  {props.t('settings.text.default')}
                </button>
              </li>
            </ul>
          </div>
          <div className="dsh_notify_pickerSection">
            <div className="dsh_notify_pickerHeader dsh_notify_pickerHeaderStatic">
              <span className="dsh_notify_pickerHeaderLabel">{props.t('settings.text.custom')}</span>
              <span className="dsh_notify_pickerCount">{props.options.length + '/' + TEXT_LIMIT_PER_SCENARIO}</span>
            </div>
            {props.options.length === 0 ? (
              <div className="dsh_notify_pickerEmpty">{props.t('settings.text.empty')}</div>
            ) : (
              <ul className="dsh_notify_pickerList">
                {props.options.map(option => (
                  <li key={option.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={option.id === props.value}
                      className={'dsh_notify_pickerOption' + (option.id === props.value ? ' is-selected' : '')}
                      title={option.title}
                      onClick={() => {
                        props.onPick(option.id)
                        setOpen(false)
                      }}
                    >
                      {option.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
