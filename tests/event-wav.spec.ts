import { describe, expect, it } from 'vitest'
import { parseEventWavs } from '../src/event-wav.ts'

/** A real `reg query HKCU\AppEvents\Schemes\Apps\.Default /s /ve` excerpt. */
const OUTPUT = [
  '',
  'HKEY_CURRENT_USER\\AppEvents\\Schemes\\Apps\\.Default\\Notification.Default\\.Current',
  '    (Default)    REG_SZ    C:\\Windows\\media\\Windows Notify System Generic.wav',
  '',
  'HKEY_CURRENT_USER\\AppEvents\\Schemes\\Apps\\.Default\\Notification.IM\\.Current',
  '    (Default)    REG_SZ    C:\\Windows\\media\\Windows Notify Messaging.wav',
  '',
  'HKEY_CURRENT_USER\\AppEvents\\Schemes\\Apps\\.Default\\Notification.Reminder\\.Current',
  '    (默认)    REG_SZ    C:\\Windows\\media\\Windows Notify Calendar.wav',
  '',
  'HKEY_CURRENT_USER\\AppEvents\\Schemes\\Apps\\.Default\\Notification.Mail\\.Current',
  '    (Default)    REG_SZ',
  '',
  'HKEY_CURRENT_USER\\AppEvents\\Schemes\\Apps\\.Default\\Notification.SMS\\.Current',
  '    (Default)    REG_SZ    C:\\Windows\\media\\missing.wav',
  '',
  'HKEY_CURRENT_USER\\AppEvents\\Schemes\\Apps\\.Default\\WindowsLogon\\.Current',
  '    (Default)    REG_SZ    C:\\Windows\\media\\Windows Logon.wav',
  '',
].join('\r\n')

const present = (path: string): boolean => path !== 'C:\\Windows\\media\\missing.wav'

describe('sound-scheme parsing', () => {
  it('keys each event by its notification name, not by the registry path', () => {
    const hits = parseEventWavs(OUTPUT, present)
    expect(hits.map(hit => hit.event)).toEqual([
      'Notification.Default',
      'Notification.IM',
      'Notification.Reminder',
    ])
    expect(hits[0]?.wav).toBe('C:\\Windows\\media\\Windows Notify System Generic.wav')
  })

  it('accepts both the English and the Chinese default-value label', () => {
    const hits = parseEventWavs(OUTPUT, present)
    expect(hits.some(hit => hit.event === 'Notification.Reminder')).toBe(true)
  })

  it('skips an empty value, a missing file and a non-notification key', () => {
    const hits = parseEventWavs(OUTPUT, present)
    expect(hits.some(hit => hit.event === 'Notification.Mail')).toBe(false)
    expect(hits.some(hit => hit.event === 'Notification.SMS')).toBe(false)
    expect(hits.some(hit => hit.event === 'WindowsLogon')).toBe(false)
  })

  it('returns nothing for an empty query result', () => {
    expect(parseEventWavs('', present)).toEqual([])
  })
})
