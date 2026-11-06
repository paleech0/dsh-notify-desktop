import { describe, expect, it } from 'vitest'
import { createTranslator, resolveLanguage } from '../src/client/language.ts'
import { en, zh } from '../src/client/locales.ts'

describe('plugin language resolution', () => {
  it('follows the DSH locale when the choice is auto', () => {
    expect(resolveLanguage('auto', 'zh')).toBe('zh')
    expect(resolveLanguage('auto', 'zh-CN')).toBe('zh')
    expect(resolveLanguage('auto', 'en')).toBe('en')
    // Only two dictionaries ship, so every other DSH locale reads English.
    expect(resolveLanguage('auto', 'ja')).toBe('en')
  })

  it('honours a pinned choice over the DSH locale', () => {
    expect(resolveLanguage('en', 'zh')).toBe('en')
    expect(resolveLanguage('zh', 'en')).toBe('zh')
  })
})

describe('plugin translator', () => {
  it('reads the dictionary of the resolved language', () => {
    let language: 'zh' | 'en' = 'zh'
    const t = createTranslator(() => language)
    expect(t('settings.title')).toBe(zh['settings.title'])
    language = 'en'
    expect(t('settings.title')).toBe(en['settings.title'])
  })

  it('fills named placeholders', () => {
    const t = createTranslator(() => 'en')
    expect(t('settings.soundLibrary.count', { count: '2' })).toBe(
      en['settings.soundLibrary.count'].replace('{count}', '2'),
    )
  })
})
