/**
 * dsh-notify-desktop host half.
 *
 * Two effects, both additive:
 *  1. the `notify` session projection (the seam delivers it to every browser
 *     client for every session — no harness change);
 *  2. one tiny same-origin route the client calls when the user clicks a toast:
 *     it re-focuses the DSH window through the app's own `dsh://open` protocol
 *     handler (the renderer has no API to raise its own window).
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { basename, dirname, extname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  FOCUS_HEADER,
  FOCUS_ROUTE,
  FOREGROUND_ROUTE,
  HOST_TOAST_ROUTE,
  DELETE_SOUND_ROUTE,
  IMPORT_SOUND_ROUTE,
  PICK_FILE_ROUTE,
  QUESTIONS_ROUTE,
  SOUND_LIBRARY_ROUTE,
  SOUND_CACHE_ROUTE,
  SOUND_ROUTE,
  REPORT_LIMIT,
  REPORT_ROUTE,
  SILENCE_ROUTE,
  TEXT_TEMPLATES_ROUTE,
} from './protocol.ts'
import { questionRecordOf, trimQuestions, type QuestionRecord } from './questions.ts'
import { parseEventWavs } from './event-wav.ts'
import { deleteTextTemplate, readTextLibrary, saveTextTemplate } from './text-store.ts'
// Type-only: brings the ctx.webServer Context merge into this program.
import type {} from '@deepseek-ai/dsh-host-webserver'
import { notifyProjection } from './projection.ts'

/** Cordis plugin name (the Loader entry and the client bundle id). */
export const name = 'dsh-notify-desktop'

/** Services required before load: the projection registry. */
export const inject = ['sessionProjections']

// The wire vocabulary shared with the client half (re-exported for host-side
// consumers and tests).
export { FOCUS_HEADER, FOCUS_ROUTE } from './protocol.ts'

/**
 * Raise the DSH window. The desktop shell owns the window, and its second
 * instance path (`dsh://open` -> single-instance -> restore/show/focus) is the
 * only supported way to bring it back from the tray; the renderer cannot.
 */
export function focusDesktopWindow(): void {
  try {
    const child = spawn('cmd.exe', ['/c', 'start', '', 'dsh://open'], {
      windowsHide: true,
      detached: true,
      stdio: 'ignore',
    })
    child.on('error', () => {})
    child.unref()
  } catch {
    // A failing focus never breaks the notification itself.
  }
}

/**
 * Answer the focus route: POST only, same-origin header required.
 * @param req - the raw request.
 * @param res - the raw response.
 */
function handleFocus(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'POST' || req.headers[FOCUS_HEADER] === undefined) {
    res.writeHead(405)
    res.end()
    return
  }
  focusDesktopWindow()
  res.writeHead(204)
  res.end()
}

/** The diagnostics route (GET) used while bringing the projection seam up. */
export const DEBUG_ROUTE = '/dsh-notify/debug'

/** Client report lines this process has received, oldest first. */
const clientReports: string[] = []

/**
 * Every question this host observed, oldest first, bounded. The client polls
 * this list because no projection carries a service-level ask.
 */
const questionRecords: QuestionRecord[] = []

/** How many question records the host keeps for the client to poll. */
const QUESTION_LIMIT = 20

/** Serial number of the newest question record (0 = none yet). */
let questionSeq = 0

/** One log line for the diagnostics ring. */
function note(line: string): void {
  clientReports.push(new Date().toISOString().slice(11, 19) + ' ' + line)
  while (clientReports.length > REPORT_LIMIT) clientReports.shift()
}

/**
 * How long a file sound may play.
 *
 * A toast lives about five seconds; a sound used to run to the end of its file,
 * so a long custom sound kept playing with nothing on screen. Killing the
 * player child is the one reliable stop this machine offers (`PlaySync` ends
 * with the process), and it works for wav too, without ffmpeg.
 */
const SOUND_CAP_MS = 8000

/**
 * Children currently playing a notification sound.
 *
 * A file sound is played by a child PowerShell process, which outlives the
 * switch that asked for it; this registry is what `/dsh-notify/silence` kills
 * so that turning the sound off stops it immediately.
 */
const soundPlayers = new Set<ChildProcess>()

/** Cached "is our window the foreground window?" answer and its timestamp. */
let foregroundAnswer: { at: number; focused: boolean } | undefined

/** How long one foreground answer is reused (the client polls every two seconds). */
const FOREGROUND_TTL_MS = 1500

/**
 * Whether this application's own window is the OS foreground window.
 *
 * The renderer's `document.hasFocus()` is not enough: measured, it reported
 * false while the user was looking straight at the window — the question view
 * takes document focus — and produced toasts the user was already staring at.
 * The OS answer is authoritative; it costs one short PowerShell child per
 * uncached call, and failures fall back to "not focused" so the renderer's own
 * signal keeps deciding.
 * @returns true when the foreground window belongs to this application.
 */
function appWindowFocused(): Promise<boolean> {
  const cached = foregroundAnswer
  if (cached !== undefined && Date.now() - cached.at < FOREGROUND_TTL_MS) return Promise.resolve(cached.focused)
  // The C# definition sits inside a single-quoted PowerShell string: it holds
  // only double quotes, so neither side needs escaping.
  const definition = '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); '
    + '[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);'
  const script = [
    `Add-Type -Namespace DshNotify -Name Win -MemberDefinition '${definition}' | Out-Null`,
    '$handle = [DshNotify.Win]::GetForegroundWindow()',
    '$owner = 0',
    '[DshNotify.Win]::GetWindowThreadProcessId($handle, [ref]$owner) | Out-Null',
    '(Get-Process -Id $owner -ErrorAction SilentlyContinue).ProcessName',
  ].join('; ')
  return new Promise<boolean>(resolve => {
    let out = ''
    try {
      const child = spawn(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true })
      child.stdout?.on('data', chunk => {
        out += String(chunk)
      })
      child.stderr?.resume()
      child.on('error', () => {
        resolve(false)
      })
      child.on('close', () => {
        const name = out.trim()
        const focused = name !== '' && name === basename(process.execPath, '.exe')
        foregroundAnswer = { at: Date.now(), focused }
        resolve(focused)
      })
    } catch {
      resolve(false)
    }
  })
}

/**
 * Answer the foreground route with the OS-level focus answer.
 * @param req - the raw request.
 * @param res - the raw response.
 */
function handleForeground(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'GET' || req.headers[FOCUS_HEADER] === undefined) {
    res.writeHead(405)
    res.end()
    return
  }
  void appWindowFocused().then(focused => {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ focused }))
  }, () => {
    res.writeHead(500)
    res.end()
  })
}

/**
 * Answer the silence route: stop every notification sound playing right now.
 * @param req - the raw request.
 * @param res - the raw response.
 */
function handleSilence(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'POST' || req.headers[FOCUS_HEADER] === undefined) {
    res.writeHead(405)
    res.end()
    return
  }
  let stopped = 0
  for (const child of [...soundPlayers]) {
    try {
      child.kill()
      stopped += 1
    } catch {
      // Already gone; nothing to stop.
    }
  }
  soundPlayers.clear()
  note('silence: stopped ' + String(stopped) + ' sound(s)')
  res.writeHead(204)
  res.end()
}

/**
 * Answer the file-picker route by asking Windows for a wav path.
 *
 * The picker runs in its own PowerShell child (WinForms needs a single-threaded
 * apartment); the chosen path comes back over stdout as UTF-8.
 * @param req - the raw request.
 * @param res - the raw response.
 */
function handlePickFile(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'POST' || req.headers[FOCUS_HEADER] === undefined) {
    res.writeHead(405)
    res.end()
    return
  }
  const script = [
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    'Add-Type -AssemblyName System.Windows.Forms | Out-Null',
    '$dialog = New-Object System.Windows.Forms.OpenFileDialog',
    "$dialog.Filter = 'Sound files|*.wav;*.mp3;*.m4a;*.aac;*.wma|Wave (*.wav)|*.wav|All files|*.*'",
    "$dialog.Title = '选择一个 .wav 音效文件'",
    'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.FileName) }',
  ].join('; ')
  let picked = ''
  try {
    const child = spawn(POWERSHELL, ['-NoProfile', '-NonInteractive', '-STA', '-Command', script], {
      windowsHide: true,
    })
    child.stdout?.on('data', chunk => {
      picked += String(chunk)
    })
    child.stderr?.resume()
    child.on('error', error => {
      note('file picker failed: ' + String(error))
    })
    child.on('close', () => {
      const path = picked.trim()
      note('file picker returned ' + (path === '' ? '(cancelled)' : path))
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ path }))
    })
  } catch (error) {
    note('file picker threw: ' + String(error))
    res.writeHead(500)
    res.end()
  }
}

/**
 * Answer the question-poll route with everything the client has not seen yet.
 * @param req - the raw request.
 * @param res - the raw response.
 */
function handleQuestions(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'GET') {
    res.writeHead(405)
    res.end()
    return
  }
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ seq: questionSeq, items: questionRecords }))
}

/**
 * Observe one forwarded ask and hand it to the client through the poll route.
 *
 * Registered as a `{ global: true }` waterfall listener: the ask itself is
 * dispatched in the asking agent's scope, and only a global listener sees it.
 * The chain must stay untouched — this never returns a value and never throws.
 * @param request - the forwarded request.
 * @param next - the waterfall continuation.
 * @returns whatever the rest of the chain returns.
 */
function observeQuestion<T>(request: unknown, next: () => Promise<T>): Promise<T> {
  let record: QuestionRecord | undefined
  try {
    questionSeq += 1
    record = questionRecordOf(request, questionSeq, Date.now())
    if (record !== undefined) {
      questionRecords.push(record)
      trimQuestions(questionRecords, QUESTION_LIMIT)
      note('question observed ' + record.kind + ' session=' + record.sessionId.slice(0, 12))
    } else {
      questionSeq -= 1
    }
  } catch (error) {
    note('question observe failed: ' + String(error))
  }
  const downstream = next()
  if (record === undefined) return downstream
  const tracked = record
  const settle = (): void => {
    tracked.open = false
  }
  return Promise.resolve(downstream).then(
    value => {
      settle()
      return value
    },
    error => {
      settle()
      throw error
    },
  )
}

/**
 * The AppUserModelID Windows shows as the toast's source. This is the one
 * Electron's own renderer notifications use on this app (verified: the toast
 * reads "DeepSeek Harness" with its icon), so the host-raised toast is
 * indistinguishable from a renderer one.
 */
const TOAST_AUMID = 'electron.app.DeepSeek Harness'

/**
 * The sound catalog, mirroring `SOUND_CHOICES` in `src/types.ts`.
 *
 * The two halves ship as separate bundles and cannot share a value import, so
 * the list is duplicated deliberately. The client sends an id only — never a
 * path — so a compromised renderer cannot make the host play an arbitrary file:
 * the file name always comes from this table.
 */
const SOUND_CHOICES: ReadonlyArray<{ readonly id: string; readonly event?: string; readonly file?: string }> =
  Object.freeze([
    { id: 'system:default', event: 'ms-winsoundevent:Notification.Default' },
    { id: 'system:im', event: 'ms-winsoundevent:Notification.IM' },
    { id: 'system:mail', event: 'ms-winsoundevent:Notification.Mail' },
    { id: 'system:calendar', event: 'ms-winsoundevent:Notification.Reminder' },
    { id: 'file:ding', file: 'ding.wav' },
    { id: 'file:chimes', file: 'chimes.wav' },
    { id: 'file:notify', file: 'Windows Notify.wav' },
    { id: 'file:notify-legacy', file: 'notify.wav' },
    { id: 'file:message-nudge', file: 'Windows Message Nudge.wav' },
    { id: 'file:tada', file: 'tada.wav' },
    { id: 'file:exclamation', file: 'Windows Exclamation.wav' },
    { id: 'file:error', file: 'Windows Error.wav' },
    { id: 'file:critical-stop', file: 'Windows Critical Stop.wav' },
    { id: 'file:alarm-1', file: 'Alarm01.wav' },
    { id: 'file:alarm-2', file: 'Alarm02.wav' },
    { id: 'file:alarm-3', file: 'Alarm03.wav' },
    { id: 'file:ring-1', file: 'Ring01.wav' },
    { id: 'file:ring-2', file: 'Ring02.wav' },
    { id: 'file:ring-3', file: 'Ring03.wav' },
    { id: 'silent' },
  ])

/** The default event, used for an unknown id. */
const DEFAULT_EVENT = 'ms-winsoundevent:Notification.Default'

/** Resolved once: the ffmpeg on PATH, or '' when this machine has none. */
let ffmpegPath: string | undefined

/**
 * Find ffmpeg on PATH.
 * @returns the absolute executable path, or '' when there is none.
 */
function findFfmpeg(): string {
  if (ffmpegPath !== undefined) return ffmpegPath
  ffmpegPath = ''
  for (const entry of (process.env['PATH'] ?? '').split(';')) {
    const directory = entry.trim()
    if (directory === '') continue
    const candidate = join(directory, 'ffmpeg.exe')
    if (existsSync(candidate)) {
      ffmpegPath = candidate
      break
    }
  }
  return ffmpegPath
}

/** The folder holding transcoded wavs, one per source path. */
function soundCacheDir(): string {
  const root = process.env['LOCALAPPDATA'] ?? process.env['TEMP'] ?? '.'
  return join(root, 'dsh-notify', 'sounds')
}

/** Where transcoded wavs live: one per source path, reused on every later play. */
function wavCachePath(source: string): string {
  const key = createHash('sha1').update(source).digest('hex').slice(0, 16)
  return join(soundCacheDir(), key + '.wav')
}

/** A sound file name must be a plain name: no separators, no traversal. */
const SAFE_SOUND_NAME = /^[^\\/:*?"<>|]+$/

/** Where the user's imported sounds live: one playable file per sound. */
function customSoundDir(): string {
  const root = process.env['LOCALAPPDATA'] ?? process.env['TEMP'] ?? '.'
  return join(root, 'dsh-notify', 'custom')
}

/** The sounds shipped with the plugin, beside the built bundle. */
function authorSoundDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'sounds')
}

/** One sound in a library folder. */
interface LibraryItem {
  /** The id the settings store, e.g. 'custom:chime.mp3'. */
  readonly id: string
  /** The display name: the file name without its extension. */
  readonly name: string
  /** The file name on disk. */
  readonly file: string
  /** Size in bytes. */
  readonly bytes: number
}

/**
 * List one sound folder.
 * @param dir - the folder to read.
 * @param prefix - the id prefix for its sounds ('custom' | 'author').
 * @returns the playable files it holds, sorted by name.
 */
function listSoundFolder(dir: string, prefix: string): LibraryItem[] {
  let names: string[] = []
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  const items: LibraryItem[] = []
  for (const file of names) {
    if (!SAFE_SOUND_NAME.test(file)) continue
    if (!CUSTOM_EXTENSIONS.some(extension => file.toLowerCase().endsWith(extension))) continue
    try {
      items.push({
        id: prefix + ':' + file,
        name: file.replace(/\.[^.]+$/, ''),
        file,
        bytes: statSync(join(dir, file)).size,
      })
    } catch {
      // Vanished between listing and measuring.
    }
  }
  return items.sort((left, right) => left.name.localeCompare(right.name))
}

/**
 * Copy one picked file into the user's custom-sound folder.
 * @param source - the absolute path the picker returned.
 * @returns the imported file's name, or an error string.
 */
function importSound(source: string): { name: string } | { error: string } {
  if (!isAbsolute(source) || !existsSync(source)) return { error: 'file not found' }
  const lower = source.toLowerCase()
  if (!CUSTOM_EXTENSIONS.some(extension => lower.endsWith(extension))) return { error: 'unsupported format' }
  const extension = extname(source)
  const base = basename(source, extension).replace(/[^A-Za-z0-9 ._-]/g, '_').trim() || 'sound'
  const dir = customSoundDir()
  mkdirSync(dir, { recursive: true })
  let name = base + extension
  for (let index = 2; existsSync(join(dir, name)); index += 1) name = base + ' ' + String(index) + extension
  copyFileSync(source, join(dir, name))
  return { name }
}

/**
 * Delete one imported custom sound.
 * @param id - the 'custom:<file>' id.
 * @returns true when the file is gone afterwards.
 */
function deleteSound(id: unknown): boolean {
  if (typeof id !== 'string' || !id.startsWith('custom:')) return false
  const file = id.slice(7)
  if (!SAFE_SOUND_NAME.test(file)) return false
  try {
    rmSync(join(customSoundDir(), file), { force: true })
    return true
  } catch {
    return false
  }
}
/**
 * Read a request body as UTF-8 text.
 * @param req - the raw request.
 * @param done - called once with the whole body ('' when it could not be read).
 */
function readBody(req: IncomingMessage, done: (body: string) => void): void {
  let body = ''
  req.setEncoding('utf8')
  req.on('data', chunk => {
    body += String(chunk)
  })
  req.on('end', () => {
    done(body)
  })
  req.on('error', () => {
    done('')
  })
}

/**
 * Answer the sound-library route: what the plugin ships and what the user added.
 * @param req - the raw request.
 * @param res - the raw response.
 */
function handleSoundLibrary(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'GET') {
    res.writeHead(405)
    res.end()
    return
  }
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({
    author: listSoundFolder(authorSoundDir(), 'author'),
    custom: listSoundFolder(customSoundDir(), 'custom'),
  }))
}

/**
 * Answer the import route: copy one picked file into the custom folder.
 * @param req - the raw request (JSON body: { file }).
 * @param res - the raw response.
 */
function handleImportSound(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'POST' || req.headers[FOCUS_HEADER] === undefined) {
    res.writeHead(405)
    res.end()
    return
  }
  readBody(req, body => {
    let file = ''
    try {
      const parsed = JSON.parse(body) as { file?: unknown }
      if (typeof parsed.file === 'string') file = parsed.file
    } catch {
      // Treated as a missing path below.
    }
    const result = importSound(file)
    note('import sound: ' + ('name' in result ? result.name : result.error))
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(result))
  })
}

/**
 * Answer the delete route: drop one imported custom sound.
 * @param req - the raw request (JSON body: { id }).
 * @param res - the raw response.
 */
function handleDeleteSound(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'POST' || req.headers[FOCUS_HEADER] === undefined) {
    res.writeHead(405)
    res.end()
    return
  }
  readBody(req, body => {
    let id: unknown = ''
    try {
      id = (JSON.parse(body) as { id?: unknown }).id
    } catch {
      // A malformed body simply fails the delete.
    }
    const ok = deleteSound(id)
    note('delete sound: ' + String(id) + ' -> ' + String(ok))
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok }))
  })
}
/**
 * Answer the sound-cache route: GET reports what the cache costs, POST empties
 * it. These files are the plugin's own transcoding output, rebuildable on the
 * next play of the same file.
 * @param req - the raw request.
 * @param res - the raw response.
 */
function handleSoundCache(req: IncomingMessage, res: ServerResponse): void {
  const directory = soundCacheDir()
  let files: string[] = []
  try {
    files = readdirSync(directory).filter(name => name.endsWith('.wav'))
  } catch {
    // No cache folder yet.
  }
  let bytes = 0
  for (const name of files) {
    try {
      bytes += statSync(join(directory, name)).size
    } catch {
      // Vanished between listing and measuring.
    }
  }
  if (req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ files: files.length, bytes }))
    return
  }
  if (req.method !== 'POST' || req.headers[FOCUS_HEADER] === undefined) {
    res.writeHead(405)
    res.end()
    return
  }
  let removed = 0
  for (const name of files) {
    try {
      rmSync(join(directory, name), { force: true })
      removed += 1
    } catch {
      // A file another process holds stays; the next clear gets it.
    }
  }
  note('sound cache cleared: ' + String(removed) + ' file(s), ' + String(bytes) + ' bytes')
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ removed, bytes }))
}

/** The app-data root every persisted file lives under (`%LOCALAPPDATA%`). */
function appDataRoot(): string {
  return process.env['LOCALAPPDATA'] ?? process.env['TEMP'] ?? '.'
}

/**
 * Answer the text-template route: GET returns every situation's library, POST
 * saves or deletes one entry and answers with the whole library.
 *
 * The body is validated and bounded here, next to the folder listing rules: the
 * renderer can only store templates the host accepted, and the per-situation
 * limit holds even if the renderer is out of date.
 * @param req - the raw request.
 * @param res - the raw response.
 */
function handleTextTemplates(req: IncomingMessage, res: ServerResponse): void {
  const root = appDataRoot()
  if (req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ library: readTextLibrary(root) }))
    return
  }
  if (req.method !== 'POST' || req.headers[FOCUS_HEADER] === undefined) {
    res.writeHead(405)
    res.end()
    return
  }
  readBody(req, body => {
    let parsed: { action?: unknown; scenario?: unknown; id?: unknown; template?: unknown } = {}
    try {
      parsed = JSON.parse(body) as typeof parsed
    } catch {
      // A malformed body is answered as a missing template below.
    }
    if (parsed.action === 'delete') {
      const result = deleteTextTemplate(root, parsed.scenario, parsed.id)
      note('delete text: ' + String(parsed.scenario) + ' ' + String(parsed.id) + ' -> ' + String(result.ok))
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(result.ok
        ? { ok: true, library: result.library }
        : { ok: false, problem: result.problem }))
      return
    }
    const result = saveTextTemplate(root, parsed.scenario, parsed.template, parsed.id)
    note('save text: ' + String(parsed.scenario) + ' -> ' + (result.ok ? result.template.id : result.problem))
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(result.ok
      ? { ok: true, library: result.library, template: result.template }
      : { ok: false, problem: result.problem }))
  })
}

/** A media file name may only be a plain wav name, whatever the table says. */
const SAFE_WAV = /^[A-Za-z0-9 ._-]+\.wav$/

/**
 * Extensions a custom sound may use.
 *
 * Everything except wav is transcoded to wav first (see {@link ffmpegPath}):
 * this machine's WinRT/WPF/WMP media stacks never open a file from a spawned
 * child (measured: MediaPlayer stays at state=None/open=False even in an STA
 * Windows PowerShell with a dispatcher pump), while `SoundPlayer` always works.
 */
const CUSTOM_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.aac', '.wma', '.flac', '.ogg', '.opus']

/** One sound, resolved for the toast. */
interface HostSound {
  /** The event for the toast XML ('' when the toast stays silent). */
  readonly event: string
  /** The absolute media path for the host to play, when the sound is a file. */
  readonly wav: string | undefined
}

/**
 * Resolve a client sound id into the toast event and the file to play.
 * @param sound - the id the client sent (a legacy boolean is still accepted).
 * @returns the event for the XML and the wav to play afterwards, if any.
 */
function hostSoundOf(sound: unknown, customFile?: unknown): HostSound {
  if (sound === false || sound === 'silent') return { event: '', wav: undefined }
  // The library ids: the file name always comes from the folder listing, so a
  // compromised renderer can only name a file inside those two folders.
  if (typeof sound === 'string' && (sound.startsWith('custom:') || sound.startsWith('author:'))) {
    const author = sound.startsWith('author:')
    const file = sound.slice(author ? 7 : 7)
    if (!SAFE_SOUND_NAME.test(file)) return { event: DEFAULT_EVENT, wav: undefined }
    const path = join(author ? authorSoundDir() : customSoundDir(), file)
    if (!existsSync(path)) {
      note('sound missing: ' + sound)
      return { event: DEFAULT_EVENT, wav: undefined }
    }
    return { event: '', wav: path }
  }
  if (sound === 'custom') {
    const file = typeof customFile === 'string' ? customFile.trim() : ''
    // The user picked this path, so it may live anywhere; it still has to be an
    // absolute .wav that exists, and it reaches PowerShell through an
    // environment variable rather than the command text.
    const lower = file.toLowerCase()
    if (file === '' || !isAbsolute(file) || !CUSTOM_EXTENSIONS.some(extension => lower.endsWith(extension))) {
      return { event: DEFAULT_EVENT, wav: undefined }
    }
    if (!existsSync(file)) {
      note('custom sound missing: ' + file)
      return { event: DEFAULT_EVENT, wav: undefined }
    }
    return { event: '', wav: file }
  }
  if (sound === true || sound === undefined) return { event: DEFAULT_EVENT, wav: undefined }
  const choice = typeof sound === 'string' ? SOUND_CHOICES.find(entry => entry.id === sound) : undefined
  if (choice === undefined) return { event: DEFAULT_EVENT, wav: undefined }
  if (choice.file !== undefined && SAFE_WAV.test(choice.file)) {
    const root = process.env['SystemRoot'] ?? 'C:\\Windows'
    return { event: '', wav: join(root, 'Media', choice.file) }
  }
  return { event: choice.event ?? DEFAULT_EVENT, wav: undefined }
}

/** The Windows PowerShell 5.1 host this machine has (pwsh may be absent). */
const POWERSHELL = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'

/** The registry query tool, fixed the same way {@link POWERSHELL} is. */
const REG_EXE = 'C:\\Windows\\System32\\reg.exe'

/** Escape one string for the toast XML. */
function xmlEscape(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

/**
 * The toast half of the child script: build the XML from the environment
 * variable and show it through the shell's own AUMID.
 */
const TOAST_SCRIPT_LINES: readonly string[] = [
  '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null',
  '[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null',
  '$xml = New-Object Windows.Data.Xml.Dom.XmlDocument',
  '$xml.LoadXml($env:DSH_NOTIFY_XML)',
  '$toast = New-Object Windows.UI.Notifications.ToastNotification $xml',
  "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('" + TOAST_AUMID + "').Show($toast)",
]

/**
 * The media half of the child script: the toast is muted and the host plays the
 * sound itself, in this same child, always through .NET's SoundPlayer — the
 * only player that works here (the WinRT/WPF/WMP stacks never open a file from
 * a spawned child; measured with a dispatcher pump too). A non-wav source is
 * transcoded to a cached wav first, so the audio path never touches the media
 * stack. PlaySync keeps the process alive until the sound ends, and every path
 * arrives through an environment variable, never in the command.
 *
 * Exported so the sound-only spawn's encoded copy can be pinned to it by a test.
 */
export const MEDIA_SCRIPT_LINES: readonly string[] = [
  'if ($env:DSH_NOTIFY_MEDIA) {',
  '  try {',
  '    $media = $env:DSH_NOTIFY_MEDIA',
  '    if (-not $media.ToLower().EndsWith(".wav")) {',
  '      $cached = $env:DSH_NOTIFY_WAVCACHE',
  '      if ($cached -and -not (Test-Path -LiteralPath $cached) -and $env:DSH_NOTIFY_FFMPEG) {',
  '        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $cached) | Out-Null',
  '        & $env:DSH_NOTIFY_FFMPEG -y -loglevel error -i $media -ac 2 -ar 44100 -acodec pcm_s16le $cached | Out-Null',
  '      }',
  '      if ($cached -and (Test-Path -LiteralPath $cached)) { $media = $cached }',
  '    }',
  '    if ($media.ToLower().EndsWith(".wav") -and (Test-Path -LiteralPath $media)) {',
  '      (New-Object System.Media.SoundPlayer $media).PlaySync()',
  '    }',
  '  } catch { }',
  '}',
]

/**
 * Track one child that is playing a notification sound so "sound off" and the
 * window regaining focus can stop it mid-file, and cap it so a long file never
 * outlives its toast.
 */
function trackSoundPlayer(child: ChildProcess): void {
  soundPlayers.add(child)
  const cap = setTimeout(() => {
    try {
      child.kill()
    } catch {
      // Already gone; nothing to stop.
    }
  }, SOUND_CAP_MS)
  const forget = (): void => {
    clearTimeout(cap)
    soundPlayers.delete(child)
  }
  child.on('close', forget)
  child.on('error', forget)
}

/**
 * Raise a Windows toast from the host process.
 *
 * The shell hands the click back through the app's own protocol handler
 * (`dsh://open`), which restores and focuses the window — the same path the
 * tray icon uses. The XML travels in an environment variable so no quoting
 * ever reaches PowerShell's parser.
 * @param title - toast headline.
 * @param body - toast body (single line).
 * @param sound - the sound id the client chose, or a legacy boolean.
 */
function showHostToast(title: string, body: string, sound: unknown, customFile?: unknown): void {
  const chosen = hostSoundOf(sound, customFile)
  const audio = chosen.event === '' ? '<audio silent="true"/>' : '<audio src="' + chosen.event + '"/>'
  // Only a file sound needs these; resolving them lazily keeps the common
  // event-sound path free of any filesystem work.
  const ffmpeg = chosen.wav === undefined ? '' : findFfmpeg()
  const wavCache = chosen.wav === undefined || chosen.wav.toLowerCase().endsWith('.wav')
    ? ''
    : wavCachePath(chosen.wav)
  const xml = '<toast activationType="protocol" launch="dsh://open"><visual><binding template="ToastGeneric">'
    + '<text>' + xmlEscape(title.slice(0, 120)) + '</text>'
    + '<text>' + xmlEscape(body.replaceAll(/\s+/g, ' ').slice(0, 300)) + '</text>'
    + '</binding></visual>' + audio + '</toast>'
  const script = [...TOAST_SCRIPT_LINES, ...MEDIA_SCRIPT_LINES].join('; ')
  try {
    // Absolute path first: the desktop host process does not necessarily carry
    // System32 on PATH, and a bare-name spawn fails with an error event that
    // nothing would show. Not detached: a DETACHED_PROCESS without a console
    // association is what made the first implementation report success while
    // Windows never displayed anything (measured).
    const child = spawn(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
      env: {
        ...process.env,
        DSH_NOTIFY_XML: xml,
        DSH_NOTIFY_MEDIA: chosen.wav ?? '',
        DSH_NOTIFY_WAVCACHE: wavCache,
        DSH_NOTIFY_FFMPEG: ffmpeg,
      },
    })
    // Piped stdio, drained rather than ignored: with `stdio: 'ignore'` the
    // child starts and exits cleanly but Windows never shows its toast
    // (measured on this machine, three variants, one toast).
    child.stdout?.resume()
    child.stderr?.resume()
    child.on('error', error => {
      clientReports.push(new Date().toISOString().slice(11, 19) + ' host-toast spawn failed: ' + String(error))
      while (clientReports.length > REPORT_LIMIT) clientReports.shift()
    })
    if (chosen.wav !== undefined) trackSoundPlayer(child)
    child.unref()
  } catch (error) {
    clientReports.push(new Date().toISOString().slice(11, 19) + ' host-toast threw: ' + String(error))
  }
}

/**
 * Answer the host-toast route: read one JSON toast request and raise it.
 * @param req - the raw request.
 * @param res - the raw response.
 */
function handleHostToast(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'POST' || req.headers[FOCUS_HEADER] === undefined) {
    res.writeHead(405)
    res.end()
    return
  }
  let body = ''
  req.on('data', chunk => {
    if (body.length < 8192) body += String(chunk)
  })
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body) as { title?: unknown; body?: unknown; sound?: unknown }
      const title = typeof parsed.title === 'string' ? parsed.title : 'DeepSeek Harness'
      const text = typeof parsed.body === 'string' ? parsed.body : ''
      showHostToast(title, text, parsed.sound, (parsed as { file?: unknown }).file)
      res.writeHead(204)
      res.end()
    } catch {
      res.writeHead(400)
      res.end()
    }
  })
}

/** Resolved wav per event name (e.g. 'Notification.IM'), present only when a wav exists. */
const eventWavs = new Map<string, string>()

/** Whether the sound scheme has been read successfully this process. */
let eventWavsRead = false

/**
 * The sound scheme's wav per notification event.
 *
 * A sound-only notification has no toast to carry the `<audio>` element, so the
 * scheme's own wav files are what the SoundPlayer plays (spike S3: all five
 * notification events resolve and exist). The whole branch is read in one go
 * with a fixed executable and a fully static argument list — no part of the
 * command is ever built from data; the parsing happens here — so the scheme
 * costs one `reg.exe` child per process, not one per play. A read that yields
 * no notification events is not cached, so a machine that fixes its scheme
 * recovers on the next play without an app restart.
 * @returns the event-name → wav map (empty when the query never succeeded).
 */
function eventWavMap(): Promise<Map<string, string>> {
  if (eventWavsRead) return Promise.resolve(eventWavs)
  return new Promise(resolve => {
    let out = ''
    try {
      const child = spawn(REG_EXE, ['query', 'HKCU\\AppEvents\\Schemes\\Apps\\.Default', '/s', '/ve'], {
        windowsHide: true,
      })
      child.stdout?.on('data', chunk => {
        out += String(chunk)
      })
      child.stderr?.resume()
      child.on('error', () => resolve(eventWavs))
      child.on('close', () => {
        for (const hit of parseEventWavs(out, existsSync)) eventWavs.set(hit.event, hit.wav)
        if (eventWavs.size > 0) eventWavsRead = true
        resolve(eventWavs)
      })
    } catch {
      resolve(eventWavs)
    }
  })
}

/**
 * The wav the sound scheme maps one toast event to, for the sound-only route.
 * @param event - the full event value, e.g. `ms-winsoundevent:Notification.IM`.
 * @returns the absolute wav path, or '' when it cannot be resolved.
 */
function resolveEventWav(event: string): Promise<string> {
  return eventWavMap().then(map => map.get(event.replace('ms-winsoundevent:', '')) ?? '')
}

/**
 * Play one resolved sound in its own child, without raising anything: the
 * sound-only path (notification mode `sound`, and the audition in that mode).
 * The exact media half of the toast child — same script, same env-var rule,
 * same transcode-then-PlaySync pipeline — tracked and capped the same way.
 * @param chosen - the sound the host catalog resolved; a sound without a wav
 * is a no-op here.
 */
function playHostSound(chosen: HostSound): void {
  if (chosen.wav === undefined) return
  // Same lazy resolution as the toast path: only a file sound looks for ffmpeg.
  const ffmpeg = chosen.wav === undefined ? '' : findFfmpeg()
  const wavCache = chosen.wav.toLowerCase().endsWith('.wav') ? '' : wavCachePath(chosen.wav)
  const script = MEDIA_SCRIPT_LINES.join('; ')
  try {
    // Same spawn shape as the toast child: absolute PowerShell path, not
    // detached, piped stdio drained — the measured constraints.
    const child = spawn(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
      env: {
        ...process.env,
        DSH_NOTIFY_MEDIA: chosen.wav ?? '',
        DSH_NOTIFY_WAVCACHE: wavCache,
        DSH_NOTIFY_FFMPEG: ffmpeg,
      },
    })
    child.stdout?.resume()
    child.stderr?.resume()
    child.on('error', error => {
      note('sound spawn failed: ' + String(error))
    })
    trackSoundPlayer(child)
    child.unref()
  } catch (error) {
    note('sound spawn threw: ' + String(error))
  }
}

/**
 * Answer the sound-only route: play one catalog sound without raising a toast.
 *
 * The id resolves exactly as it does for a toast — catalog id only, never a
 * path — so a compromised renderer can name nothing outside the catalog. A
 * `system:*` event has no wav of its own; the sound scheme resolves it (and a
 * failure stays silent, visible in the debug route).
 * @param req - the raw request.
 * @param res - the raw response.
 */
function handleSound(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'POST' || req.headers[FOCUS_HEADER] === undefined) {
    res.writeHead(405)
    res.end()
    return
  }
  readBody(req, body => {
    let sound: unknown = undefined
    try {
      sound = (JSON.parse(body) as { sound?: unknown }).sound
    } catch {
      // Treated as an unknown id below, which falls back to the default event.
    }
    const chosen = hostSoundOf(sound)
    if (chosen.wav !== undefined) {
      playHostSound(chosen)
      res.writeHead(204)
      res.end()
      return
    }
    if (chosen.event === '') {
      note('sound-only: silent, nothing to play')
      res.writeHead(204)
      res.end()
      return
    }
    void resolveEventWav(chosen.event).then(wav => {
      if (wav === '') {
        note('sound-only: event unresolved, staying silent: ' + chosen.event)
      } else {
        playHostSound({ event: '', wav })
      }
      res.writeHead(204)
      res.end()
    })
  })
}

/**
 * Answer the diagnostics-report route: the client posts one plain-text line per
 * decision or platform answer, and the debug route serves the tail. Nothing is
 * persisted and nothing leaves the machine.
 * @param req - the raw request.
 * @param res - the raw response.
 */
function handleReport(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'POST' || req.headers[FOCUS_HEADER] === undefined) {
    res.writeHead(405)
    res.end()
    return
  }
  let body = ''
  req.on('data', chunk => {
    if (body.length < 2048) body += String(chunk)
  })
  req.on('end', () => {
    const stamp = new Date().toISOString().slice(11, 19)
    clientReports.push(stamp + ' ' + body.slice(0, 300))
    while (clientReports.length > REPORT_LIMIT) clientReports.shift()
    res.writeHead(204)
    res.end()
  })
}

/** The loose face of the projection registry this probe reads. */
interface RegistryProbe {
  stateOf?(session: unknown, key: string): unknown
  snapshot?(session: unknown, values?: readonly string[]): { values?: Record<string, unknown> } | undefined
}

/** The loose face of the host session list this probe reads. */
interface SessionsProbe {
  list?(): readonly unknown[]
}

/**
 * Answer the diagnostics route: is the `notify` unit registered in the very
 * registry the session controller reads, and what keys does that registry
 * publish for the newest sessions?
 * @param ctx - host cordis context.
 * @param req - the raw request.
 * @param res - the raw response.
 */
function handleDebug(ctx: Context, req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'GET') {
    res.writeHead(405)
    res.end()
    return
  }
  const report: Record<string, unknown> = {}
  try {
    const registry = ctx.get('sessionProjections') as RegistryProbe | undefined
    report['registryPresent'] = registry !== undefined
    const sessions = (ctx.get('sessions') as SessionsProbe | undefined)?.list?.() ?? []
    report['sessionCount'] = sessions.length
    const rows: Record<string, unknown>[] = []
    for (const session of sessions.slice(0, 3)) {
      const row: Record<string, unknown> = { id: String((session as { id?: unknown }).id) }
      try {
        row['notifyState'] = registry?.stateOf?.(session, 'notify') === undefined ? 'absent' : 'present'
        row['titleState'] = registry?.stateOf?.(session, 'title') === undefined ? 'absent' : 'present'
      } catch (error) {
        row['notifyState'] = 'error: ' + String(error)
      }
      try {
        row['snapshotKeys'] = Object.keys(registry?.snapshot?.(session)?.values ?? {})
      } catch (error) {
        row['snapshotKeys'] = 'error: ' + String(error)
      }
      rows.push(row)
    }
    report['sessions'] = rows
    report['client'] = [...clientReports]
    // Sound plumbing: without ffmpeg a non-wav custom sound has no way to play,
    // and this is the only place that fact is visible.
    report['media'] = {
      ffmpeg: findFfmpeg() === '' ? null : findFfmpeg(),
      soundPlayers: soundPlayers.size,
    }
  } catch (error) {
    report['error'] = String(error)
  }
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify(report))
}

/**
 * Register the projection and the focus route.
 * @param ctx - host cordis context.
 */
export function apply(ctx: Context): void {
  ctx.sessionProjections.register(notifyProjection())
  // Every question reaches this host-side global listener: the ask() service
  // fires the waterfall in the asking agent's scope, and only a global listener
  // sees scopes other than its own. Nothing here answers the question.
  // The registration is cast because the ambient event map types this
  // waterfall as answer-producing; this listener only observes and forwards.
  const onGlobal: (event: string, listener: unknown, options: { global: boolean }) => () => void =
    ctx.on.bind(ctx) as unknown as (event: string, listener: unknown, options: { global: boolean }) => () => void
  ctx.effect(
    () => onGlobal('user-questions/request', observeQuestion, { global: true }),
    'dsh-notify-desktop: question observer',
  )
  ctx.inject(['webServer'], scoped => {
    scoped.effect(
      () => scoped.webServer.register({ kind: 'exact', path: FOCUS_ROUTE, handler: handleFocus }),
      'dsh-notify-desktop: focus route',
    )
    scoped.effect(
      () => scoped.webServer.register({ kind: 'exact', path: HOST_TOAST_ROUTE, handler: handleHostToast }),
      'dsh-notify-desktop: host toast route',
    )
    scoped.effect(
      () => scoped.webServer.register({ kind: 'exact', path: REPORT_ROUTE, handler: handleReport }),
      'dsh-notify-desktop: client report route',
    )
    scoped.effect(
      () => scoped.webServer.register({ kind: 'exact', path: QUESTIONS_ROUTE, handler: handleQuestions }),
      'dsh-notify-desktop: question poll route',
    )
    scoped.effect(
      () => scoped.webServer.register({ kind: 'exact', path: FOREGROUND_ROUTE, handler: handleForeground }),
      'dsh-notify-desktop: foreground route',
    )
    scoped.effect(
      () => scoped.webServer.register({ kind: 'exact', path: SILENCE_ROUTE, handler: handleSilence }),
      'dsh-notify-desktop: silence route',
    )
    scoped.effect(
      () => scoped.webServer.register({ kind: 'exact', path: SOUND_ROUTE, handler: handleSound }),
      'dsh-notify-desktop: sound-only route',
    )
    scoped.effect(
      () => scoped.webServer.register({ kind: 'exact', path: PICK_FILE_ROUTE, handler: handlePickFile }),
      'dsh-notify-desktop: file picker route',
    )
    scoped.effect(
      () => scoped.webServer.register({ kind: 'exact', path: SOUND_LIBRARY_ROUTE, handler: handleSoundLibrary }),
      'dsh-notify-desktop: sound library route',
    )
    scoped.effect(
      () => scoped.webServer.register({ kind: 'exact', path: IMPORT_SOUND_ROUTE, handler: handleImportSound }),
      'dsh-notify-desktop: sound import route',
    )
    scoped.effect(
      () => scoped.webServer.register({ kind: 'exact', path: DELETE_SOUND_ROUTE, handler: handleDeleteSound }),
      'dsh-notify-desktop: sound delete route',
    )
    scoped.effect(
      () => scoped.webServer.register({ kind: 'exact', path: SOUND_CACHE_ROUTE, handler: handleSoundCache }),
      'dsh-notify-desktop: sound cache route',
    )
    scoped.effect(
      () => scoped.webServer.register({ kind: 'exact', path: TEXT_TEMPLATES_ROUTE, handler: handleTextTemplates }),
      'dsh-notify-desktop: text template route',
    )
    scoped.effect(
      () => scoped.webServer.register({
        kind: 'exact',
        path: DEBUG_ROUTE,
        handler: (req, res) => {
          handleDebug(ctx, req, res)
        },
      }),
      'dsh-notify-desktop: diagnostics route',
    )
  })
}
