/**
 * Sound-scheme parsing for the sound-only route.
 *
 * `reg.exe query HKCU\AppEvents\Schemes\Apps\.Default /s /ve` prints one key
 * line followed by that key's default value. A notification event lives at
 * `...\Notification.<Event>\.Current`, and the event name (not the full key)
 * is what the wire sound id resolves to.
 *
 * The value label is locale-dependent (`(Default)` on an English shell,
 * `(默认)` on a Chinese one) and the child's output is decoded as UTF-8, so a
 * non-ASCII label may arrive mangled. Only the ASCII `REG_SZ` and the path are
 * read here; every notification event points at a `C:\Windows\Media\*.wav`.
 */
import { isAbsolute } from 'node:path'

/** One resolved sound: the event name and the wav the scheme points at. */
export interface EventWav {
  /** The event name the sound id names, e.g. `Notification.IM`. */
  readonly event: string
  /** The absolute wav path the scheme maps it to. */
  readonly wav: string
}

/** A `.Current` key for one notification event, capturing the event name. */
const EVENT_KEY = /\\Notification\.([A-Za-z]+)\\.Current$/

/** A default-value line: a localized label, the `REG_SZ` type, then the path. */
const DEFAULT_VALUE = /REG_SZ\s+(.+)$/

/**
 * Resolve the notification events in one `reg query` output.
 * @param output - the child's stdout, decoded as text.
 * @param exists - file-existence probe (injected so this stays a pure function).
 * @returns one entry per notification event whose wav exists, in output order.
 */
export function parseEventWavs(output: string, exists: (path: string) => boolean): EventWav[] {
  const hits: EventWav[] = []
  let key = ''
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith('HKEY_')) {
      key = trimmed
      continue
    }
    const event = EVENT_KEY.exec(key)?.[1]
    if (event === undefined) continue
    const wav = DEFAULT_VALUE.exec(trimmed)?.[1]?.trim() ?? ''
    if (wav === '' || !isAbsolute(wav) || !exists(wav)) continue
    hits.push({ event: 'Notification.' + event, wav })
  }
  return hits
}
