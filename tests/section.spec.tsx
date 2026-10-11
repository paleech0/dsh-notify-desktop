// @vitest-environment jsdom
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { NotifySettings, SoundId } from '../src/types.ts'
import { NotifySettingsSection, type NotifySectionProps } from '../src/client/SettingsSection.tsx'
import { zh } from '../src/client/locales.ts'
import { createSettingsStore } from '../src/client/settings.ts'

/** The section props a slot would inject, with the runtime share stubbed. */
function props(overrides: Partial<NotifySectionProps> = {}): NotifySectionProps {
  const store = createSettingsStore(undefined)
  return {
    store,
    set: (patch: Partial<NotifySettings>) => {
      store.update(patch)
    },
    sendTest: () => {},
    loadLibrary: () => Promise.resolve({ author: [], custom: [] }),
    importSound: () => Promise.resolve('mine'),
    deleteSound: () => Promise.resolve(true),
    cacheInfo: () => Promise.resolve({ files: 0, bytes: 0 }),
    clearCache: () => Promise.resolve({ files: 0, bytes: 0 }),
    t: (key: string) => (zh as Record<string, string>)[key] ?? key,
    ...overrides,
  } as unknown as NotifySectionProps
}

// Tell React this suite drives updates through act().
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let cleanup: (() => void) | undefined

afterEach(() => {
  cleanup?.()
  cleanup = undefined
  // The helper builds its store from the ambient storage, and jsdom keeps one
  // localStorage for the whole file: without this, a path one test writes leaks
  // into the next test's defaults.
  localStorage.clear()
})

/** Render the section into a fresh container. */
async function render(overrides: Partial<NotifySectionProps> = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  cleanup = () => {
    act(() => {
      root.unmount()
    })
    container.remove()
  }
  const all = props(overrides)
  await act(async () => {
    root.render(<NotifySettingsSection {...all} />)
  })
  return { container, all }
}

describe('notification settings section', () => {
  it('renders the master, sound, outcome, waiting and reminder controls', async () => {
    const { container } = await render()
    const labels = [...container.querySelectorAll('label')].map(node => node.textContent ?? '')
    expect(labels.some(text => text.includes(zh['settings.enabled']))).toBe(true)
    expect(labels.some(text => text.includes(zh['settings.sound']))).toBe(true)
    for (const key of ['settings.when.completed', 'settings.when.error', 'settings.pending.approval', 'settings.pending.question']) {
      expect(labels.some(text => text.includes((zh as Record<string, string>)[key] ?? ''))).toBe(true)
    }
    // master + sound + five outcomes + three waiting-on-you switches
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(10)
    expect(container.querySelector('input[type="number"]')).not.toBeNull()
    // four two-level sound pickers, one preview button each, plus the test button
    expect(container.querySelectorAll('.dsh_notify_pickerTrigger')).toHaveLength(4)
    const buttons = [...container.querySelectorAll('button')].map(node => node.textContent ?? '')
    // one preview per situation group, plus the library's add button
    expect(buttons.filter(text => text.includes(zh['settings.sounds.preview']))).toHaveLength(4)
    expect(buttons.some(text => text.includes(zh['settings.library.add']))).toBe(true)
    expect(buttons.some(text => text.includes(zh['settings.test.button']))).toBe(true)
  })

  it('writes one sound choice straight through to the store', async () => {
    const { container, all } = await render()
    // open the first picker, expand the author section, choose its first sound
    const trigger = container.querySelector('.dsh_notify_pickerTrigger')
    expect(trigger).not.toBeNull()
    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const headers = [...container.querySelectorAll('.dsh_notify_pickerHeader')]
    expect(headers).toHaveLength(3)
    const author = headers.find(node => (node.textContent ?? '').includes(zh['settings.sounds.groupAuthor']))
    await act(async () => {
      author?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    // the group is empty in this render, so it explains that instead of listing
    expect(container.textContent).toContain(zh['settings.sounds.authorEmpty'])
    const windows = headers.find(node => (node.textContent ?? '').includes(zh['settings.sounds.groupWindows']))
    await act(async () => {
      windows?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const options = [...container.querySelectorAll('.dsh_notify_pickerOption')]
    expect(options.length).toBeGreaterThan(0)
    await act(async () => {
      options[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    // the first Windows option is the default chime
    expect(all.store.getSnapshot().sounds.finished).toBe('system:default')
  })

  it('previews the sound of the group whose button was pressed', async () => {
    const heard: Array<string | undefined> = []
    const { container } = await render({
      sendTest: (sound?: SoundId) => {
        heard.push(sound)
      },
    } as Partial<NotifySectionProps>)
    const previews = [...container.querySelectorAll('button')]
      .filter(node => (node.textContent ?? '').includes(zh['settings.sounds.preview']))
    await act(async () => {
      previews[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(heard).toEqual(['file:error'])
  })

  it('imports a picked file into the custom library', async () => {
    const imported: string[] = []
    let custom: Array<{ id: string; name: string; file: string; bytes: number }> = []
    const { container, all } = await render({
      pickFile: () => Promise.resolve('C:\\sounds\\mine.wav'),
      importSound: (file: string) => {
        imported.push(file)
        custom = [{ id: 'custom:mine.wav', name: 'mine', file: 'mine.wav', bytes: 1024 }]
        return Promise.resolve('mine.wav')
      },
      loadLibrary: () => Promise.resolve({ author: [], custom }),
    } as Partial<NotifySectionProps>)
    const add = [...container.querySelectorAll('button')]
      .find(node => (node.textContent ?? '').includes(zh['settings.library.add']))
    expect(add).toBeDefined()
    await act(async () => {
      add?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(imported).toEqual(['C:\\sounds\\mine.wav'])
    expect(container.textContent).toContain('mine')
    expect(all.store.getSnapshot().sounds.finished).toBe('file:chimes')
  })

  it('refuses to preview a library sound that is no longer there', async () => {
    const heard: Array<string | undefined> = []
    const store = createSettingsStore(undefined)
    store.update({ sounds: { ...store.getSnapshot().sounds, finished: 'custom:gone.wav' } })
    const { container } = await render({
      store,
      sendTest: (sound?: SoundId) => {
        heard.push(sound)
      },
    } as Partial<NotifySectionProps>)
    const previews = [...container.querySelectorAll('button')]
      .filter(node => (node.textContent ?? '').includes(zh['settings.sounds.preview']))
    await act(async () => {
      previews[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(heard).toEqual([])
    expect(container.textContent).toContain(zh['settings.library.missing'])
  })

  it('previews a library sound that exists', async () => {
    const heard: Array<string | undefined> = []
    const store = createSettingsStore(undefined)
    store.update({ sounds: { ...store.getSnapshot().sounds, finished: 'custom:mine.wav' } })
    const { container } = await render({
      store,
      loadLibrary: () => Promise.resolve({
        author: [],
        custom: [{ id: 'custom:mine.wav', name: 'mine', file: 'mine.wav', bytes: 1024 }],
      }),
      sendTest: (sound?: SoundId) => {
        heard.push(sound)
      },
    } as Partial<NotifySectionProps>)
    
    const previews = [...container.querySelectorAll('button')]
      .filter(node => (node.textContent ?? '').includes(zh['settings.sounds.preview']))
    await act(async () => {
      previews[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(heard).toEqual(['custom:mine.wav'])
  })
  it('writes a toggle straight through to the store', async () => {
    const { container, all } = await render()
    const first = container.querySelector('input[type="checkbox"]')
    expect(first).not.toBeNull()
    await act(async () => {
      first?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(all.store.getSnapshot().enabled).toBe(false)
  })

  it('writes the reminder delay through to the store', async () => {
    const { container, all } = await render()
    const minutes = container.querySelector('input[type="number"]')
    expect(minutes).not.toBeNull()
    await act(async () => {
      if (minutes !== null) {
        // React tracks the DOM value, so a plain assignment is invisible to it;
        // drive the native setter instead.
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        setter?.call(minutes, '3')
        minutes.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })
    expect(all.store.getSnapshot().remindAfterMinutes).toBe(3)
  })

  it('calls the injected test verb', async () => {
    let called = 0
    const { container } = await render({
      sendTest: () => {
        called += 1
      },
    } as Partial<NotifySectionProps>)
    const testButton = [...container.querySelectorAll('button')]
      .find(node => (node.textContent ?? '').includes(zh['settings.test.button']))
    await act(async () => {
      testButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(called).toBe(1)
  })

  it('re-renders when the store changes elsewhere', async () => {
    const { container, all } = await render()
    await act(async () => {
      all.set({ enabled: false })
    })
    expect((container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false)
  })
})
