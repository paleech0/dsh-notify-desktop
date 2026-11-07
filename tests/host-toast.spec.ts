import { describe, expect, it } from 'vitest'
import { AUMID_RESOLVE_LINES, MEDIA_SCRIPT_LINES, TOAST_SCRIPT_LINES, buildToastXml } from '../src/index.ts'

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
    const write = script.indexOf('-acodec pcm_s16le -f wav $partial')
    const promote = script.indexOf('Move-Item -LiteralPath $partial')
    // A transcode killed by the eight-second cap must not become the cache.
    expect(write).toBeGreaterThanOrEqual(0)
    expect(promote).toBeGreaterThan(write)
    expect(script).not.toContain('-acodec pcm_s16le $cached')
    // ffmpeg picks the container from the extension, and ".wav.part" has none:
    // without "-f wav" every non-wav sound silently stops working (0.2.3 bug).
    expect(script).toContain('-f wav $partial')
  })

  it('builds an ordinary toast without a scenario or a button', () => {
    const xml = buildToastXml('任务完成', '正文', '<audio silent="true"/>')
    expect(xml).toContain('launch="dsh://open"')
    expect(xml).not.toContain('scenario=')
    expect(xml).not.toContain('<actions>')
  })

  it('makes a sticky toast a reminder-scenario toast with a dismiss button', () => {
    const xml = buildToastXml('超时催办', '正文', '<audio silent="true"/>', { dismissLabel: '知道了' })
    // Measured: without scenario + a background/system action Windows shows an
    // ordinary five-second toast and silently drops the stickiness.
    expect(xml).toContain('scenario="reminder"')
    expect(xml).toContain('<action content="知道了"')
    expect(xml).toContain('activationType="system"')
    expect(xml).toContain('arguments="dismiss"')
  })

  it('escapes the title, the body and the button label', () => {
    const xml = buildToastXml('a<b>&"c"', 'x<y', '<audio silent="true"/>', { dismissLabel: 'a&b' })
    expect(xml).toContain('a&lt;b&gt;&amp;&quot;c&quot;')
    expect(xml).toContain('content="a&amp;b"')
  })

  it('keeps the identity list out of the script and never hard-codes one id', () => {
    const script = TOAST_SCRIPT_LINES.join('; ')
    expect(AUMID_RESOLVE_LINES.length).toBeGreaterThan(0)
    expect(script).not.toContain('electron.app.DeepSeek Harness')
    expect(script).not.toContain('com.deepseek.dsh')
  })
})
