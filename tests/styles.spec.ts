import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { cssText } from '../src/client/styles.ts'

const here = dirname(fileURLToPath(import.meta.url))
const sources = ['SettingsSection.tsx', 'SoundPicker.tsx', 'TextPicker.tsx', 'TextManager.tsx']

/**
 * Every `dsh_notify_*` class the components can put on an element.
 *
 * A class that only exists in the markup renders with no styles at all, which is
 * invisible in review and obvious on screen — this is the cheap guard for it.
 */
function usedClasses(): Set<string> {
  const found = new Set<string>()
  for (const file of sources) {
    const text = readFileSync(join(here, '..', 'src', 'client', file), 'utf8')
    for (const match of text.matchAll(/dsh_notify_[A-Za-z0-9_]+/g)) found.add(match[0])
  }
  return found
}

describe('settings stylesheet', () => {
  /**
   * Markers that only exist so a test or a query can find the node; the element
   * also carries a styled class next to them.
   */
  const MARKERS = new Set(['dsh_notify_customRow', 'dsh_notify_textPicker', 'dsh_notify_pickerSection'])

  it('styles every class the section puts on an element', () => {
    const missing = [...usedClasses()].filter(name => !cssText.includes('.' + name) && !MARKERS.has(name))
    expect(missing).toEqual([])
  })

  it('keeps one shared box style for the numeric fields and the style select', () => {
    // The delay box and the reminder-style select sit in one column and must
    // look like the same kind of control.
    expect(cssText).toMatch(/\.dsh_notify_number,\s*\.dsh_notify_select\s*\{/)
    expect(cssText).toContain('.dsh_notify_remindRow')
    expect(cssText).toContain('grid-template-columns: 64px minmax(0, 1fr)')
  })

  it('gives an imported sound a name line and an actions line', () => {
    expect(cssText).toContain('.dsh_notify_soundItemMain')
    expect(cssText).toContain('.dsh_notify_soundItemActions')
  })
})
