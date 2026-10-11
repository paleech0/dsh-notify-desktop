/**
 * The toast layer: title/body selection (pure, unit-tested) and the thin
 * `Notification` wrapper. The sound switch only ever flips Electron's
 * `silent` flag, so the OS notification sound is what you hear (decision D4).
 */
import type { SoundId } from '../types.ts'
import type { SoundLibrary } from '../types.ts'
import {
  DELETE_SOUND_ROUTE,
  FOCUS_HEADER,
  FOREGROUND_ROUTE,
  IMPORT_SOUND_ROUTE,
  SOUND_LIBRARY_ROUTE,
  HOST_TOAST_ROUTE,
  PICK_FILE_ROUTE,
  REPORT_ROUTE,
  SILENCE_ROUTE,
  SOUND_CACHE_ROUTE,
} from '../protocol.ts'
import type { NotifyReason, PendingKind } from '../types.ts'

/**
 * Send one diagnostics line to the host's report route. The desktop shell
 * cannot show a plugin's renderer console to anyone without DevTools open, so
 * every interesting step is mirrored to the host, where the debug route serves
 * it over plain HTTP.
 * @param line - the line to report.
 */
export function report(line: string): void {
  console.info('[dsh-notify] ' + line)
  try {
    const fetchImpl = globalThis.fetch
    if (fetchImpl === undefined) return
    void fetchImpl(REPORT_ROUTE, {
      method: 'POST',
      headers: { [FOCUS_HEADER]: '1' },
      body: line,
    }).catch(() => undefined)
  } catch {
    // Diagnostics never break the feature they observe.
  }
}

/**
 * The dictionary keys this feature can render as a status.
 *
 * Only the short form exists: the toast title is composed from the workspace
 * name plus one of these, so the older "DSH 任务完成"-style full titles are gone.
 */
export type TitleKey =
  | 'notify.shortCompleted'
  | 'notify.shortError'
  | 'notify.shortAborted'
  | 'notify.shortBlocked'
  | 'notify.shortMaxTokens'
  | 'notify.shortApproval'
  | 'notify.shortQuestion'
  | 'notify.shortPlanReview'
  | 'notify.shortReminder'

/** The short status key for one turn-end reason (composed into the title). */
export function shortReasonKey(reason: NotifyReason): TitleKey {
  switch (reason) {
    case 'completed': return 'notify.shortCompleted'
    case 'error': return 'notify.shortError'
    case 'aborted': return 'notify.shortAborted'
    case 'blocked': return 'notify.shortBlocked'
    case 'max-tokens': return 'notify.shortMaxTokens'
  }
}

/** The short status key for one blocking interaction. */
export function shortPendingKey(kind: PendingKind): TitleKey {
  switch (kind) {
    case 'approval': return 'notify.shortApproval'
    case 'question': return 'notify.shortQuestion'
    case 'plan-review': return 'notify.shortPlanReview'
  }
}

/** The notification body: the projected reply snippet, or the fallback line. */
export function bodyText(body: string, fallback: string): string {
  const trimmed = body.trim()
  return trimmed === '' ? fallback : trimmed
}

/**
 * The grouping tag. Turn- and request-scoped rather than session-scoped: the
 * OS replaces same-tag toasts, and a stale same-tag entry left in the action
 * center silently swallows every later toast carrying it.
 */
export function notificationTag(sessionId: string, turn: number): string {
  return `dsh-notify-${sessionId}-t${turn}`
}

/** The tag for one blocking interaction's toast. */
export function pendingTag(sessionId: string, requestId: string): string {
  return `dsh-notify-${sessionId}-r-${requestId}`
}

/** The tag for one reminder toast. */
export function reminderTag(sessionId: string, requestId: string): string {
  return `dsh-notify-${sessionId}-m-${requestId}`
}

/** The notification surface this code may use (absent outside a browser). */
export function notificationsApi(): typeof Notification | undefined {
  return typeof Notification === 'undefined' ? undefined : Notification
}

/**
 * Ask the shell for notification permission when it has not decided yet.
 *
 * Load-bearing: Electron reports `permission === 'default'` for a freshly
 * started app, and Chromium then refuses to present the toast — a plugin that
 * only checks `permission === 'granted'` silently shows nothing until some
 * other page happens to request permission first. The desktop shell's own
 * permission handler answers `true` for every non-media permission, so this
 * resolves to `granted` on the first call.
 * @returns the effective permission after the request.
 */
export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  const api = notificationsApi()
  if (api === undefined) return 'denied'
  if (api.permission !== 'default') return api.permission
  try {
    return await api.requestPermission()
  } catch {
    return api.permission
  }
}

/** One toast to show. */
export interface ToastRequest {
  readonly title: string
  readonly body: string
  readonly tag: string
  /** Which sound to play; 'silent' mutes this toast. */
  readonly sound: SoundId
  readonly onClick: () => void
}

/**
 * Show one toast when the platform allows it.
 * @param request - the toast to show.
 * @returns true when a notification object was constructed.
 */
/**
 * Ask the host to raise the toast through the shell's Windows channel.
 * @param request - the toast to show.
 * @returns true when the request was dispatched.
 */
export function requestHostToast(request: ToastRequest): boolean {
  try {
    const fetchImpl = globalThis.fetch
    if (fetchImpl === undefined) return false
    void fetchImpl(HOST_TOAST_ROUTE, {
      method: 'POST',
      headers: { [FOCUS_HEADER]: '1', 'content-type': 'application/json' },
      body: JSON.stringify({ title: request.title, body: request.body, sound: request.sound }),
    }).catch(() => undefined)
    return true
  } catch {
    return false
  }
}

/**
 * Stop whatever notification sound is playing right now.
 *
 * The host plays file sounds in its own child process; this is the client half
 * of "switching the sound off also stops the sound that is already playing".
 * @returns a promise that settles when the host answered (failures are silent).
 */
export function silenceSounds(): Promise<void> {
  const fetchImpl = globalThis.fetch
  if (fetchImpl === undefined) return Promise.resolve()
  return fetchImpl(SILENCE_ROUTE, { method: 'POST', headers: { [FOCUS_HEADER]: '1' } })
    .then(() => undefined, () => undefined)
}

/**
 * Ask the host to open the Windows file picker for a wav.
 * @returns the chosen absolute path, or '' when the user cancelled.
 */
export function pickSoundFile(): Promise<string> {
  const fetchImpl = globalThis.fetch
  if (fetchImpl === undefined) return Promise.resolve('')
  return fetchImpl(PICK_FILE_ROUTE, { method: 'POST', headers: { [FOCUS_HEADER]: '1' } })
    .then(response => (response.ok ? response.json() : undefined))
    .then((payload: unknown) => {
      const path = (payload as { path?: unknown } | undefined)?.path
      return typeof path === 'string' ? path : ''
    }, () => '')
}

/**
 * Ask the host whether this app's window is the OS foreground window.
 *
 * `document.hasFocus()` is not trustworthy on its own: measured, it returned
 * false while the user was looking straight at the window (the question view
 * takes document focus), which produced toasts aimed at someone already there.
 * The host answers from the OS, and any failure falls back to false so the
 * renderer's own signal keeps deciding.
 * @returns true when the foreground window belongs to this app.
 */
export function appWindowFocused(): Promise<boolean> {
  const fetchImpl = globalThis.fetch
  if (fetchImpl === undefined) return Promise.resolve(false)
  return fetchImpl(FOREGROUND_ROUTE, { headers: { [FOCUS_HEADER]: '1' } })
    .then(response => (response.ok ? response.json() : null))
    .then((payload: unknown) => (payload as { focused?: unknown } | null)?.focused === true, () => false)
}

/**
 * Read the sound library: what the plugin ships and what the user imported.
 * @returns both lists, or an empty library when the host is unreachable.
 */
export function soundLibrary(): Promise<SoundLibrary> {
  const empty: SoundLibrary = { author: [], custom: [] }
  const fetchImpl = globalThis.fetch
  if (fetchImpl === undefined) return Promise.resolve(empty)
  return fetchImpl(SOUND_LIBRARY_ROUTE, { headers: { [FOCUS_HEADER]: '1' } })
    .then(response => (response.ok ? response.json() : null))
    .then((payload: unknown) => {
      const value = payload as Partial<SoundLibrary> | null
      return {
        author: Array.isArray(value?.author) ? value.author : [],
        custom: Array.isArray(value?.custom) ? value.custom : [],
      }
    }, () => empty)
}

/**
 * Copy one picked file into the user's custom-sound folder.
 * @param file - the absolute path the picker returned.
 * @returns the imported name, or null when the host refused it.
 */
export function importSound(file: string): Promise<string | null> {
  const fetchImpl = globalThis.fetch
  if (fetchImpl === undefined) return Promise.resolve(null)
  return fetchImpl(IMPORT_SOUND_ROUTE, {
    method: 'POST',
    headers: { [FOCUS_HEADER]: '1', 'content-type': 'application/json' },
    body: JSON.stringify({ file }),
  })
    .then(response => (response.ok ? response.json() : null))
    .then((payload: unknown) => {
      const name = (payload as { name?: unknown } | null)?.name
      return typeof name === 'string' ? name : null
    }, () => null)
}

/**
 * Delete one imported custom sound.
 * @param id - the 'custom:<file>' id.
 * @returns true when the host removed it.
 */
export function deleteSound(id: string): Promise<boolean> {
  const fetchImpl = globalThis.fetch
  if (fetchImpl === undefined) return Promise.resolve(false)
  return fetchImpl(DELETE_SOUND_ROUTE, {
    method: 'POST',
    headers: { [FOCUS_HEADER]: '1', 'content-type': 'application/json' },
    body: JSON.stringify({ id }),
  })
    .then(response => (response.ok ? response.json() : null))
    .then((payload: unknown) => (payload as { ok?: unknown } | null)?.ok === true, () => false)
}

/** What the transcoded-wav cache currently costs. */
export interface SoundCacheInfo {
  /** How many cached wavs exist. */
  readonly files: number
  /** Their total size in bytes. */
  readonly bytes: number
}

/**
 * Read the sound-cache size from the host.
 * @returns the file count and total bytes, or null when the host is unreachable.
 */
export function soundCacheInfo(): Promise<SoundCacheInfo | null> {
  const fetchImpl = globalThis.fetch
  if (fetchImpl === undefined) return Promise.resolve(null)
  return fetchImpl(SOUND_CACHE_ROUTE, { headers: { [FOCUS_HEADER]: '1' } })
    .then(response => (response.ok ? response.json() : null))
    .then((payload: unknown) => {
      const info = payload as Partial<SoundCacheInfo> | null
      return typeof info?.files === 'number' && typeof info.bytes === 'number' ? info as SoundCacheInfo : null
    }, () => null)
}

/**
 * Empty the sound cache.
 * @returns how many files were removed and how many bytes they held, or null.
 */
export function clearSoundCache(): Promise<SoundCacheInfo | null> {
  const fetchImpl = globalThis.fetch
  if (fetchImpl === undefined) return Promise.resolve(null)
  return fetchImpl(SOUND_CACHE_ROUTE, { method: 'POST', headers: { [FOCUS_HEADER]: '1' } })
    .then(response => (response.ok ? response.json() : null))
    .then((payload: unknown) => {
      const info = payload as { removed?: unknown; bytes?: unknown } | null
      return typeof info?.removed === 'number' && typeof info.bytes === 'number'
        ? { files: info.removed, bytes: info.bytes }
        : null
    }, () => null)
}

/**
 * Show one toast through the host channel even when the window has focus.
 *
 * The settings section auditions sounds with this: the renderer path can only
 * mute or not (Chromium's Notification cannot name a Windows sound event), so a
 * preview must take the host path to play the exact sound the user picked.
 * @param request - the toast to show.
 * @returns true when the platform accepted a notification.
 */
export function previewToast(request: ToastRequest): boolean {
  if (requestHostToast(request)) {
    report('preview delegated to host: sound=' + request.sound)
    return true
  }
  return showToast(request)
}

export function showToast(request: ToastRequest): boolean {
  // Measured on 0.2.0-rc.2: whenever the app window is not the focused one, the
  // renderer constructs the Notification but the platform neither shows it nor
  // reports an error (hidden AND merely-unfocused windows both failed). Since
  // the plugin suppresses toasts while the window IS focused, every toast that
  // is allowed to fire is raised by the host instead; the renderer path stays
  // only as the fallback for an unreachable host route.
  const unfocused = typeof document !== 'undefined' && !document.hasFocus()
  if (unfocused && requestHostToast(request)) {
    report('toast delegated to host (window unfocused): ' + request.title)
    return true
  }
  const api = notificationsApi()
  if (api === undefined) {
    report('toast no-api ' + request.title)
    return false
  }
  // Never gate on the permission string alone: Electron reports 'default' for a
  // freshly started app, and a hard gate there silently swallows the first
  // toast of every app run (measured on 0.2.0-rc.2). Construct anyway and let
  // the platform's own answer show up as onshow/onerror.
  if (api.permission !== 'granted') {
    report('toast permission=' + api.permission + ' attempting anyway: ' + request.title)
    void api.requestPermission().then(next => {
      report('toast permission-after-request=' + next)
    }, () => undefined)
  }
  try {
    const notification = new api(request.title, {
      body: request.body,
      tag: request.tag,
      // The renderer can only mute or not: Chromium's Notification has no way
      // to name a Windows sound event, so the specific sounds belong to the
      // host path below (which every toast that is allowed to fire now takes).
      silent: request.sound === 'silent',
    })
    report('toast created perm=' + api.permission + ' tag=' + request.tag)
    notification.onshow = () => {
      report('toast shown: ' + request.title)
    }
    notification.onerror = () => {
      report('toast rejected by the platform: ' + request.title)
    }
    notification.onclick = () => {
      report('toast clicked: ' + request.title)
      request.onClick()
    }
    return true
  } catch (error) {
    // A failing toast must never break the session that triggered it.
    report('toast threw: ' + String(error))
    return false
  }
}
