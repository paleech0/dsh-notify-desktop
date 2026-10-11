/**
 * The two-level sound picker.
 *
 * A native select cannot nest: its optgroups are one flat level, so the twenty
 * Windows sounds sat in the same list as everything else and made the control
 * unwieldy. This is a small popover instead - level one is the source (Windows /
 * author / custom), level two is that source's sounds - which keeps each row one
 * line tall and the list scannable.
 */
import { useEffect, useRef, useState } from 'react'
import { SOUND_CHOICES, type SoundId, type SoundLibrary } from '../types.ts'
import type { NotifyKey } from './locales.ts'

/** One sound offered by the picker. */
interface PickerItem {
  readonly id: SoundId
  readonly label: string
}

/** One collapsible group of sounds. */
interface PickerSection {
  readonly id: 'windows' | 'author' | 'custom'
  readonly label: string
  readonly items: readonly PickerItem[]
  /** Shown instead of the list when the group is empty. */
  readonly empty: string
}

/** Which group an id belongs to. */
function sectionOf(id: SoundId): PickerSection['id'] {
  if (id.startsWith('author:')) return 'author'
  if (id.startsWith('custom:')) return 'custom'
  return 'windows'
}

/** Props of {@link SoundPicker}. */
export interface SoundPickerProps {
  /** The chosen sound. */
  readonly value: SoundId
  /** The library folders' current contents. */
  readonly library: SoundLibrary
  /** Resolve a sound id to its display label. */
  readonly labelOf: (id: SoundId) => string
  /** Locale lookup. */
  readonly t: (key: NotifyKey) => string
  /** Called with the newly chosen sound. */
  readonly onPick: (id: SoundId) => void
}

/**
 * Render the picker.
 * @param props - see {@link SoundPickerProps}.
 * @returns the trigger and, while open, the grouped panel.
 */
export function SoundPicker(props: SoundPickerProps): JSX.Element {
  const [open, setOpen] = useState(false)
  // Collapsed by default: the Windows section alone holds twenty entries, and
  // an expanded one would push the other two sections out of the panel.
  const [expanded, setExpanded] = useState<PickerSection['id'] | null>(null)
  const root = useRef<HTMLDivElement | null>(null)

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

  const sections: readonly PickerSection[] = [
    {
      id: 'windows',
      label: props.t('settings.sounds.groupWindows'),
      items: SOUND_CHOICES.map(choice => ({ id: choice.id, label: props.labelOf(choice.id) })),
      empty: '',
    },
    {
      id: 'author',
      label: props.t('settings.sounds.groupAuthor'),
      items: props.library.author.map(item => ({ id: item.id, label: item.name })),
      empty: props.t('settings.sounds.authorEmpty'),
    },
    {
      id: 'custom',
      label: props.t('settings.sounds.groupCustom'),
      items: props.library.custom.map(item => ({ id: item.id, label: item.name })),
      empty: props.t('settings.sounds.customEmpty'),
    },
  ]

  return (
    <div className="dsh_notify_picker" ref={root}>
      <button
        type="button"
        className="dsh_notify_pickerTrigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!open) setExpanded(null)
          setOpen(!open)
        }}
      >
        <span className="dsh_notify_pickerValue">{props.labelOf(props.value)}</span>
        <span className="dsh_notify_pickerCaret" aria-hidden="true" />
      </button>
      {!open ? null : (
        <div className="dsh_notify_pickerPanel" role="listbox" aria-label={props.t('settings.sounds.title')}>
          {sections.map(section => (
            <div className="dsh_notify_pickerSection" key={section.id}>
              <button
                type="button"
                className="dsh_notify_pickerHeader"
                aria-expanded={expanded === section.id}
                onClick={() => {
                  setExpanded(expanded === section.id ? null : section.id)
                }}
              >
                <span className="dsh_notify_pickerCaretSmall" data-open={expanded === section.id} aria-hidden="true" />
                <span className="dsh_notify_pickerHeaderLabel">{section.label}</span>
                <span className="dsh_notify_pickerCount">{section.items.length}</span>
              </button>
              {expanded !== section.id ? null : section.items.length === 0 ? (
                <div className="dsh_notify_pickerEmpty">{section.empty}</div>
              ) : (
                <ul className="dsh_notify_pickerList">
                  {section.items.map(item => (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={item.id === props.value}
                        className={'dsh_notify_pickerOption' + (item.id === props.value ? ' is-selected' : '')}
                        onClick={() => {
                          props.onPick(item.id)
                          setOpen(false)
                        }}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
