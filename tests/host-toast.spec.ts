import { describe, expect, it } from 'vitest'
import { AUMID_RESOLVE_LINES, TOAST_SCRIPT_LINES } from '../src/index.ts'

describe('host toast identity resolution', () => {
  it('probes the candidate identities before showing the toast', () => {
    const script = TOAST_SCRIPT_LINES.join('; ')
    const probe = script.indexOf('$env:DSH_NOTIFY_AUMIDS')
    const show = script.indexOf('CreateToastNotifier($aumid).Show($toast)')
    expect(probe).toBeGreaterThanOrEqual(0)
    expect(show).toBeGreaterThan(probe)
  })

  it('keeps the identity list out of the script and never hard-codes one id', () => {
    const script = TOAST_SCRIPT_LINES.join('; ')
    expect(AUMID_RESOLVE_LINES.length).toBeGreaterThan(0)
    expect(script).not.toContain('electron.app.DeepSeek Harness')
    expect(script).not.toContain('com.deepseek.dsh')
  })
})
