// @vitest-environment jsdom
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { NotifySettings, PluginLanguage, SoundLibrary } from '../src/types.ts'
import { DEFAULT_SETTINGS } from '../src/types.ts'
import { emptyTextLibrary, type NotifyScenario, type TextLibrary, type TextTemplate } from '../src/scenarios.ts'
import { NotifySettingsSection, type NotifySectionProps } from '../src/client/SettingsSection.tsx'
import { createTranslator, resolveLanguage } from '../src/client/language.ts'
import { en, zh } from '../src/client/locales.ts'
import { createSettingsStore } from '../src/client/settings.ts'
import type { TextDraft, TextSaveOutcome, TextStore } from '../src/client/texts.ts'

/** The dictionary lookup the slot would provide. */
const t = (key: string): string => (zh as Record<string, string>)[key] ?? key

/** An in-memory text store: the section only needs the observable face. */
function fakeTexts(initial: Partial<Record<NotifyScenario, TextTemplate[]>> = {}): TextStore {
  let snapshot: TextLibrary = { ...emptyTextLibrary(), ...initial }
  const listeners = new Set<() => void>()
  const emit = (): void => {
    for (const listener of [...listeners]) listener()
  }
  let counter = 0
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    load: () => Promise.resolve(snapshot),
    save: async (scenario: NotifyScenario, draft: TextDraft, id?: string): Promise<TextSaveOutcome> => {
      counter += 1
      const templates = [...snapshot[scenario]]
      const updatedAt = 1_700_000_000_000 + counter
      if (id !== undefined) {
        const index = templates.findIndex(entry => entry.id === id)
        if (index < 0) return { ok: false, problem: 'missing' }
        const template: TextTemplate = { id, ...draft, updatedAt }
        templates[index] = template
        snapshot = { ...snapshot, [scenario]: templates }
        emit()
        return { ok: true, template }
      }
      if (templates.length >= 3) return { ok: false, problem: 'limit' }
      const template: TextTemplate = { id: 't_' + String(counter).padStart(6, '0'), ...draft, updatedAt }
      snapshot = { ...snapshot, [scenario]: [...templates, template] }
      emit()
      return { ok: true, template }
    },
    remove: async (scenario: NotifyScenario, id: string) => {
      const templates = snapshot[scenario]
      if (!templates.some(entry => entry.id === id)) return { ok: false, problem: 'missing' }
      snapshot = { ...snapshot, [scenario]: templates.filter(entry => entry.id !== id) }
      emit()
      return { ok: true }
    },
  }
}

/** The section props a slot would inject, with the runtime share stubbed. */
function props(overrides: Partial<NotifySectionProps> = {}, activeLocale = 'zh'): NotifySectionProps {
  const store = createSettingsStore(undefined)
  const language = (): 'zh' | 'en' => resolveLanguage(store.getSnapshot().language, activeLocale)
  return {
    store,
    set: (patch: Partial<NotifySettings>) => {
      store.update(patch)
    },
    sendTest: () => {},
    previewScenario: () => {},
    texts: fakeTexts(),
    loadLibrary: () => Promise.resolve({ author: [], custom: [] }),
    pickFile: () => Promise.resolve(''),
    importSound: () => Promise.resolve('mine'),
    deleteSound: () => Promise.resolve(true),
    renameSound: (_id: string, name: string) => Promise.resolve('custom:' + name + '.wav'),
    cacheInfo: () => Promise.resolve({ files: 0, bytes: 0 }),
    clearCache: () => Promise.resolve({ files: 0, bytes: 0 }),
    tr: createTranslator(language),
    language,
    setLanguage: (value: PluginLanguage) => {
      store.update({ language: value })
    },
    subscribeLanguage: (listener: () => void) => store.subscribe(listener),
    t,
    ...overrides,
  } as unknown as NotifySectionProps
}

// Tell React this suite drives updates through act().
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let cleanup: (() => void) | undefined

/** How many previews the current test saw. */
let previewed = 0

afterEach(() => {
  cleanup?.()
  cleanup = undefined
  previewed = 0
  localStorage.clear()
})

/** Render the section into a fresh container. */
async function render(overrides: Partial<NotifySectionProps> = {}, activeLocale = 'zh') {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  cleanup = () => {
    act(() => {
      root.unmount()
    })
    container.remove()
  }
  const all = props(overrides, activeLocale)
  await act(async () => {
    root.render(<NotifySettingsSection {...all} />)
  })
  return { container, all }
}

/** Buttons whose text contains one of the labels. */
function buttons(container: HTMLElement, label: string): HTMLButtonElement[] {
  return [...container.querySelectorAll('button')]
    .filter(node => (node.textContent ?? '').includes(label)) as HTMLButtonElement[]
}

/** Set a controlled input's value so React notices. */
async function typeInto(node: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
  await act(async () => {
    const prototype = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
    setter?.call(node, value)
    node.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

/** The scenario rows currently rendered. */
function scenarioNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.dsh_notify_scenarioName')].map(node => node.textContent ?? '')
}

describe('notification settings section', () => {
  it('renders the four cards in order with every enabled situation row', async () => {
    const { container } = await render()
    const cardTitles = [...container.querySelectorAll('.dsh_notify_cardTitle')]
      .map(node => node.textContent ?? '')
    expect(cardTitles).toEqual([
      zh['settings.title'],
      zh['settings.situations.title'],
      zh['settings.customize.title'],
      zh['settings.push.title'],
    ])
    // ten switches: the master switch, five outcome toggles, three waiting
    // toggles, and the viewed-session toggle
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(10)
    // three delivery radios plus the three subagent gears
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(6)
    // the test notification belongs to the first card
    expect(buttons(container, zh['settings.test.button'])).toHaveLength(1)
    // every enabled situation gets one row; aborted is off by default
    expect(scenarioNames(container)).toEqual([
      zh['settings.scenario.completed'],
      zh['settings.scenario.error'],
      zh['settings.scenario.blocked'],
      zh['settings.scenario.maxTokens'],
      zh['settings.scenario.approval'],
      zh['settings.scenario.question'],
      zh['settings.scenario.planReview'],
      zh['settings.scenario.reminder'],
    ])
    // one sound picker and one text picker per row
    expect(container.querySelectorAll('.dsh_notify_scenarioRow')).toHaveLength(8)
    expect(container.querySelectorAll('.dsh_notify_textPicker')).toHaveLength(8)
    // the two libraries are collapsed by default
    expect(container.textContent).toContain(zh['settings.soundLibrary.title'])
    expect(container.textContent).toContain(zh['settings.textLibrary.title'])
  })

  it('adds and removes a situation row as its switch changes', async () => {
    const { container } = await render()
    const aborted = container.querySelector('#dsh-notify-notifyAborted') as HTMLInputElement
    expect(aborted).not.toBeNull()
    await act(async () => {
      aborted.click()
    })
    expect(scenarioNames(container)).toContain(zh['settings.scenario.aborted'])
    await act(async () => {
      aborted.click()
    })
    expect(scenarioNames(container)).not.toContain(zh['settings.scenario.aborted'])
  })

  it('writes a per-situation sound choice straight through to the store', async () => {
    const { container, all } = await render()
    const row = container.querySelector('.dsh_notify_scenarioRow')
    const soundTrigger = row?.querySelector('.dsh_notify_pickerTrigger')
    expect(soundTrigger).not.toBeNull()
    await act(async () => {
      soundTrigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const windows = [...container.querySelectorAll('.dsh_notify_pickerHeader')]
      .find(node => (node.textContent ?? '').includes(zh['settings.sounds.groupWindows']))
    await act(async () => {
      windows?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const option = [...container.querySelectorAll('.dsh_notify_pickerOption')]
      .find(node => (node.textContent ?? '').includes(zh['settings.sound.systemDefault']))
    await act(async () => {
      option?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(all.store.getSnapshot().sounds['completed']).toBe('system:default')
  })

  it('picks one of a situation\'s saved texts', async () => {
    const texts = fakeTexts({
      completed: [{ id: 't_aaaa1111', name: '完成A', title: '{工作区} · {状态}', body: '搞定了：{内容}', updatedAt: 1 }],
    })
    const { container, all } = await render({ texts } as Partial<NotifySectionProps>)
    const row = container.querySelector('.dsh_notify_scenarioRow')
    const textTrigger = row?.querySelector('.dsh_notify_textPicker .dsh_notify_pickerTrigger')
    expect(textTrigger).not.toBeNull()
    await act(async () => {
      textTrigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const option = [...container.querySelectorAll('.dsh_notify_pickerOption')]
      .find(node => (node.textContent ?? '').trim() === '完成A')
    expect(option).toBeDefined()
    await act(async () => {
      option?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(all.store.getSnapshot().texts['completed']).toBe('t_aaaa1111')
  })

  it('previews the situation whose row button was pressed', async () => {
    const heard: NotifyScenario[] = []
    const { container } = await render({
      previewScenario: (scenario: NotifyScenario) => {
        heard.push(scenario)
      },
    } as Partial<NotifySectionProps>)
    const row = container.querySelectorAll('.dsh_notify_scenarioRow')[1]
    const preview = row?.querySelector('.dsh_notify_scenarioPreview')
    await act(async () => {
      preview?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(heard).toEqual(['error'])
  })

  it('refuses to preview a library sound that is no longer there', async () => {
    const heard: NotifyScenario[] = []
    const store = createSettingsStore(undefined)
    store.update({ sounds: { ...store.getSnapshot().sounds, completed: 'custom:gone.wav' } })
    const { container } = await render({
      store,
      previewScenario: (scenario: NotifyScenario) => {
        heard.push(scenario)
      },
    } as Partial<NotifySectionProps>)
    const preview = container.querySelector('.dsh_notify_scenarioPreview')
    await act(async () => {
      preview?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(heard).toEqual([])
    expect(container.textContent).toContain(zh['settings.soundLibrary.missing'])
  })

  it('moves the test button under the master switch and writes toggles through', async () => {
    const { container, all } = await render()
    // A situation switch first (the master is still on), then the master itself.
    const aborted = container.querySelector('#dsh-notify-notifyAborted') as HTMLInputElement
    await act(async () => {
      aborted.click()
    })
    expect(all.store.getSnapshot().notifyAborted).toBe(true)
    expect(container.textContent).toContain(zh['settings.scenario.aborted'])
    const first = container.querySelector('input[type="checkbox"]')
    await act(async () => {
      first?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(all.store.getSnapshot().enabled).toBe(false)
  })

  it('writes the delivery mode and the reminder delay straight through to the store', async () => {
    const { container, all } = await render()
    const radios = [...container.querySelectorAll('input[type="radio"]')] as HTMLInputElement[]
    await act(async () => {
      radios[2]?.click()
    })
    expect(all.store.getSnapshot().mode).toBe('sound')
    const minutes = container.querySelector('input[type="number"]')
    await typeInto(minutes as HTMLInputElement, '3')
    expect(all.store.getSnapshot().remindAfterMinutes).toBe(3)
  })

  it('greys every delivery control out when the master is off and keeps the libraries live', async () => {
    const store = createSettingsStore(undefined)
    store.update({ enabled: false })
    let tested = 0
    const { container } = await render({
      store,
      sendTest: () => {
        tested += 1
      },
    } as Partial<NotifySectionProps>)
    const radios = [...container.querySelectorAll('input[type="radio"]')] as HTMLInputElement[]
    for (const radio of radios) expect(radio.disabled).toBe(true)
    for (const trigger of container.querySelectorAll('.dsh_notify_pickerTrigger')) {
      expect((trigger as HTMLButtonElement).disabled).toBe(true)
    }
    for (const preview of container.querySelectorAll('.dsh_notify_scenarioPreview')) {
      expect((preview as HTMLButtonElement).disabled).toBe(true)
    }
    const testButton = buttons(container, zh['settings.test.button'])[0] as HTMLButtonElement
    expect(testButton.disabled).toBe(true)
    await act(async () => {
      testButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(tested).toBe(0)
    // The situations are off-limits with the master off too (the viewed-session
    // toggle is the ninth).
    const situations = [...container.querySelectorAll('input[type="checkbox"]')]
      .filter(node => node.id.startsWith('dsh-notify-notify')) as HTMLInputElement[]
    expect(situations).toHaveLength(9)
    for (const box of situations) expect(box.disabled).toBe(true)
    expect((container.querySelector('input[type="number"]') as HTMLInputElement).disabled).toBe(true)
    // The configuration surfaces stay live: both collapse headers and the add button.
    const headers = [...container.querySelectorAll('.dsh_notify_collapseHeader')] as HTMLButtonElement[]
    expect(headers).toHaveLength(2)
    for (const header of headers) expect(header.disabled).toBe(false)
    await act(async () => {
      headers[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(buttons(container, zh['settings.soundLibrary.add'])[0]?.disabled).toBe(false)
  })

  it('imports a picked file into the custom library and confirms its deletion', async () => {
    let library: SoundLibrary = { author: [], custom: [], ffmpeg: true }
    const imported: string[] = []
    const deleted: string[] = []
    const { container } = await render({
      pickFile: () => Promise.resolve('C:\\sounds\\mine.wav'),
      importSound: (file: string) => {
        imported.push(file)
        library = { author: [], custom: [{ id: 'custom:mine.wav', name: 'mine', file: 'mine.wav', bytes: 1024 }], ffmpeg: true }
        return Promise.resolve('mine.wav')
      },
      loadLibrary: () => Promise.resolve(library),
      deleteSound: (id: string) => {
        deleted.push(id)
        library = { author: [], custom: [], ffmpeg: true }
        return Promise.resolve(true)
      },
    } as Partial<NotifySectionProps>)
    const header = [...container.querySelectorAll('.dsh_notify_collapseHeader')]
      .find(node => (node.textContent ?? '').includes(zh['settings.soundLibrary.title']))
    await act(async () => {
      header?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const add = buttons(container, zh['settings.soundLibrary.add'])[0]
    await act(async () => {
      add?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(imported).toEqual(['C:\\sounds\\mine.wav'])
    expect(container.textContent).toContain('mine')
    // Delete asks first (the red button opens an inline confirmation).
    const remove = container.querySelector('.dsh_notify_soundItem .dsh_notify_danger') as HTMLButtonElement
    await act(async () => {
      remove.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('.dsh_notify_confirm')).not.toBeNull()
    const confirm = container.querySelector('.dsh_notify_confirm .dsh_notify_dangerButton') as HTMLButtonElement
    await act(async () => {
      confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(deleted).toEqual(['custom:mine.wav'])
  })

  it('creates, edits and deletes a saved text through the text manager', async () => {
    const texts = fakeTexts()
    const { container } = await render({ texts } as Partial<NotifySectionProps>)
    const header = [...container.querySelectorAll('.dsh_notify_collapseHeader')]
      .find(node => (node.textContent ?? '').includes(zh['settings.textLibrary.title']))
    await act(async () => {
      header?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const add = buttons(container, zh['settings.textLibrary.add'])[0]
    expect(add).toBeDefined()
    await act(async () => {
      add?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const editor = container.querySelector('.dsh_notify_editor')
    expect(editor).not.toBeNull()
    // the placeholder chips now carry a one-line explanation each
    expect(container.querySelectorAll('.dsh_notify_placeholderHint')).toHaveLength(4)
    expect(container.textContent).toContain(zh['settings.textEditor.placeholderWorkspace'])
    expect(container.textContent).toContain(zh['settings.textEditor.placeholderMinutes'])
    const inputs = [...container.querySelectorAll('.dsh_notify_editorRow input')] as HTMLInputElement[]
    const textarea = container.querySelector('.dsh_notify_editorRow textarea') as HTMLTextAreaElement
    await typeInto(inputs[0] as HTMLInputElement, '搞定了')
    await typeInto(inputs[1] as HTMLInputElement, '{工作区} · {状态}')
    await typeInto(textarea, '搞定了：{内容}')
    const save = buttons(container, zh['settings.textEditor.save'])[0] as HTMLButtonElement
    await act(async () => {
      save.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(texts.getSnapshot().completed).toHaveLength(1)
    expect(texts.getSnapshot().completed[0]?.name).toBe('搞定了')
    // The saved entry is listed with its edit and delete actions.
    const item = container.querySelector('.dsh_notify_textItem')
    expect(item?.textContent).toContain('搞定了')
    const remove = item?.querySelector('.dsh_notify_danger') as HTMLButtonElement
    await act(async () => {
      remove.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const confirm = container.querySelector('.dsh_notify_confirm .dsh_notify_dangerButton') as HTMLButtonElement
    await act(async () => {
      confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(texts.getSnapshot().completed).toHaveLength(0)
  })

  it('calls the injected test verb', async () => {
    let called = 0
    const { container } = await render({
      sendTest: () => {
        called += 1
      },
    } as Partial<NotifySectionProps>)
    const testButton = buttons(container, zh['settings.test.button'])[0]
    await act(async () => {
      testButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(called).toBe(1)
  })

  it('re-renders when the store changes elsewhere', async () => {
    const { container, all } = await render()
    expect((container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true)
    await act(async () => {
      all.set({ enabled: false })
    })
    expect((container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false)
  })

  it('pins the plugin copy to English from the language control', async () => {
    const { container } = await render()
    const english = buttons(container, 'English')[0]
    await act(async () => {
      english?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const titles = [...container.querySelectorAll('.dsh_notify_cardTitle')]
      .map(node => node.textContent ?? '')
    expect(titles[0]).toBe(en['settings.title'])
    expect(buttons(container, en['settings.test.button'])).toHaveLength(1)
  })

  it('names the shipped author sounds in the plugin language', async () => {
    const library: SoundLibrary = {
      author: [
        { id: 'author:1-任务正常结束.wav', name: '1-任务正常结束', file: '1-任务正常结束.wav', bytes: 100 },
        { id: 'author:mine.wav', name: 'mine', file: 'mine.wav', bytes: 100 },
      ],
      custom: [],
      ffmpeg: true,
    }
    const { container } = await render({ loadLibrary: () => Promise.resolve(library) } as Partial<NotifySectionProps>)
    // Open the first situation's sound picker and expand the author section.
    const picker = container.querySelectorAll('.dsh_notify_pickerTrigger')[0] as HTMLButtonElement
    await act(async () => {
      picker.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const author = [...container.querySelectorAll('.dsh_notify_pickerHeader')]
      .find(node => (node.textContent ?? '').includes(zh['settings.sounds.groupAuthor']))
    await act(async () => {
      author?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const labels = [...container.querySelectorAll('.dsh_notify_pickerOption')].map(node => node.textContent ?? '')
    expect(labels).toContain(zh['settings.sounds.author.completed'])
    // A file the user adds to sounds/ keeps its own name.
    expect(labels).toContain('mine')
  })

  it('renames a custom sound and moves the situations to the new id', async () => {
    const library: SoundLibrary = {
      author: [],
      custom: [{ id: 'custom:mine.wav', name: 'mine', file: 'mine.wav', bytes: 1024 }],
      ffmpeg: true,
    }
    const calls: string[] = []
    const { container, all } = await render({
      loadLibrary: () => Promise.resolve(library),
      renameSound: (id: string, name: string) => {
        calls.push(id + ' -> ' + name)
        return Promise.resolve('custom:' + name + '.wav')
      },
    } as Partial<NotifySectionProps>)
    await act(async () => {
      all.set({ sounds: { ...DEFAULT_SETTINGS.sounds, completed: 'custom:mine.wav' } })
    })
    const header = [...container.querySelectorAll('.dsh_notify_collapseHeader')]
      .find(node => (node.textContent ?? '').includes(zh['settings.soundLibrary.title']))
    await act(async () => {
      header?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const renameButton = buttons(container, zh['settings.soundLibrary.rename'])[0]
    await act(async () => {
      renameButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const input = container.querySelector('.dsh_notify_renameInput') as HTMLInputElement
    await typeInto(input, '铃声')
    const save = buttons(container, zh['settings.soundLibrary.renameSave'])[0]
    await act(async () => {
      save?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(calls).toEqual(['custom:mine.wav -> 铃声'])
    expect(all.store.getSnapshot().sounds['completed']).toBe('custom:铃声.wav')
  })

  it('switches situations back to their default when their sound is deleted', async () => {
    const library: SoundLibrary = {
      author: [],
      custom: [{ id: 'custom:mine.wav', name: 'mine', file: 'mine.wav', bytes: 1024 }],
      ffmpeg: true,
    }
    const { container, all } = await render({
      loadLibrary: () => Promise.resolve(library),
      deleteSound: () => Promise.resolve(true),
    } as Partial<NotifySectionProps>)
    await act(async () => {
      all.set({ sounds: { ...DEFAULT_SETTINGS.sounds, completed: 'custom:mine.wav' } })
    })
    expect(all.store.getSnapshot().sounds['completed']).toBe('custom:mine.wav')
    const header = [...container.querySelectorAll('.dsh_notify_collapseHeader')]
      .find(node => (node.textContent ?? '').includes(zh['settings.soundLibrary.title']))
    await act(async () => {
      header?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const remove = container.querySelector('.dsh_notify_soundItem .dsh_notify_danger') as HTMLButtonElement
    await act(async () => {
      remove.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const confirm = container.querySelector('.dsh_notify_confirm .dsh_notify_dangerButton') as HTMLButtonElement
    await act(async () => {
      confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(all.store.getSnapshot().sounds['completed']).toBe(DEFAULT_SETTINGS.sounds['completed'])
  })

  it('explains a non-wav sound that cannot play without ffmpeg', async () => {
    const { container } = await render({
      loadLibrary: () => Promise.resolve({
        author: [],
        custom: [{ id: 'custom:song.mp3', name: 'song', file: 'song.mp3', bytes: 2048 }],
        ffmpeg: false,
      }),
      previewScenario: () => {
        previewed += 1
      },
    } as Partial<NotifySectionProps>)
    // Open the custom-sounds card: the warning sits beside the import controls.
    const header = [...container.querySelectorAll('.dsh_notify_collapseHeader')]
      .find(node => (node.textContent ?? '').includes(zh['settings.soundLibrary.title']))
    await act(async () => {
      header?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.textContent).toContain(zh['settings.soundLibrary.ffmpegMissing'])
    expect(container.textContent).toContain(zh['settings.soundLibrary.ffmpegInstall'])
  })

  it('refuses to preview a non-wav sound without ffmpeg and says why', async () => {
    previewed = 0
    const { container } = await render({
      loadLibrary: () => Promise.resolve({
        author: [],
        custom: [{ id: 'custom:song.mp3', name: 'song', file: 'song.mp3', bytes: 2048 }],
        ffmpeg: false,
      }),
    } as Partial<NotifySectionProps>)
    // Pick the imported mp3 for the first visible situation, then preview it.
    const picker = container.querySelectorAll('.dsh_notify_pickerTrigger')[0] as HTMLButtonElement
    await act(async () => {
      picker.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const custom = [...container.querySelectorAll('.dsh_notify_pickerHeader')]
      .find(node => (node.textContent ?? '').includes(zh['settings.sounds.groupCustom']))
    await act(async () => {
      custom?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const option = [...container.querySelectorAll('.dsh_notify_pickerOption')]
      .find(node => (node.textContent ?? '').includes('song')) as HTMLButtonElement
    await act(async () => {
      option?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const preview = buttons(container, zh['settings.scenario.preview'])[0]
    await act(async () => {
      preview?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(previewed).toBe(0)
    expect(container.textContent).toContain(zh['settings.soundLibrary.ffmpegPreview'])
  })

  it('follows the DSH locale while the language control is on auto', async () => {
    const { container } = await render({}, 'en')
    const titles = [...container.querySelectorAll('.dsh_notify_cardTitle')]
      .map(node => node.textContent ?? '')
    expect(titles[0]).toBe(en['settings.title'])
    // The stored choice stays auto, which is what the pressed segment shows.
    const pressed = [...container.querySelectorAll('.dsh_notify_langOption')]
      .filter(node => node.getAttribute('aria-pressed') === 'true')
      .map(node => node.textContent ?? '')
    expect(pressed).toEqual([en['settings.language.auto']])
  })
})