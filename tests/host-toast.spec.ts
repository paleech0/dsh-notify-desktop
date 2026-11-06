import { describe, expect, it } from 'vitest'
import { AUMID_RESOLVE_LINES, MEDIA_SCRIPT_LINES, TOAST_SCRIPT_LINES } from '../src/index.ts'

describe('host toast identity resolution', () => {
  it('probes the candidate identities before showing the toast', () => {
    const script = TOAST_SCRIPT_LINES.join('; ')
    const probe = script.indexOf('$env:DSH_NOTIFY_AUMIDS')
    const show = script.indexOf('CreateToastNotifier($aumid).Show($toast)')
    expect(probe).toBeGreaterThanOrEqual(0)
    expect(show).toBeGreaterThan(probe)
  })

  it('transcodes into a .part file and only promotes a finished one', () => {
    const script = MEDIA_SCRIPT_LINES.join('; ')
    const write = script.indexOf('-acodec pcm_s16le $partial')
    const promote = script.indexOf('Move-Item -LiteralPath $partial')
    // A transcode killed by the eight-second cap must not become the cache.
    expect(write).toBeGreaterThanOrEqual(0)
    expect(promote).toBeGreaterThan(write)
    expect(script).not.toContain('-acodec pcm_s16le $cached')
  })

  it('keeps the identity list out of the script and never hard-codes one id', () => {
    const script = TOAST_SCRIPT_LINES.join('; ')
    expect(AUMID_RESOLVE_LINES.length).toBeGreaterThan(0)
    expect(script).not.toContain('electron.app.DeepSeek Harness')
    expect(script).not.toContain('com.deepseek.dsh')
  })
})
