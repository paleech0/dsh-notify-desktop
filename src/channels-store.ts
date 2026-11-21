/**
 * The host-side store for the external-push channels.
 *
 * One JSON file under `%LOCALAPPDATA%\dsh-notify\channels.json` holds every
 * configured channel, secrets included. It lives on the host — never in the
 * renderer's localStorage — so a token is not readable by page script and the
 * renderer only ever learns the fields it needs. Writes go through a temp file
 * plus a rename, so a crash mid-write never leaves a half-written file.
 *
 * Everything takes `root` explicitly: the tests point it at a temp folder, the
 * routes pass `LOCALAPPDATA`.
 */
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CHANNEL_ID_PREFIX,
  CHANNEL_LIMIT,
  isChannelId,
  isChannelType,
  missingRequiredFields,
  normalizeChannel,
  type ChannelConfig,
} from './channels.ts'

/** The folder the channels file lives in. */
export function channelsDir(root: string): string {
  return join(root, 'dsh-notify')
}

/** The channels file itself. */
export function channelsFile(root: string): string {
  return join(channelsDir(root), 'channels.json')
}

/** The version this build writes. */
export const CHANNELS_STORE_VERSION = 1

/** The stored file's shape. */
interface StoredFile {
  readonly version: number
  readonly channels: readonly unknown[]
}

/**
 * Read every channel. A missing, unreadable or malformed file reads as an empty
 * list rather than an error: the caller always has something usable. Each entry
 * is normalized by {@link normalizeChannel}, which keeps a half-filled draft
 * (it only drops an entry that is structurally unusable, never one that is
 * merely missing a required field).
 * @param root - the app-data root.
 * @returns the configured channels, capped and validated.
 */
export function readChannels(root: string): ChannelConfig[] {
  let raw = ''
  try {
    raw = readFileSync(channelsFile(root), 'utf8')
  } catch {
    return []
  }
  // A file re-saved by Notepad may carry a UTF-8 BOM; JSON.parse would throw
  // and the whole list would read as empty, so strip it first.
  raw = raw.replace(/^\uFEFF/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  const channels = (parsed as Partial<StoredFile> | null)?.channels
  if (!Array.isArray(channels)) return []
  const kept: ChannelConfig[] = []
  for (const entry of channels) {
    const channel = normalizeChannel(entry)
    if (channel === null) continue
    kept.push(channel)
    if (kept.length >= CHANNEL_LIMIT) break
  }
  return kept
}

/**
 * Write every channel back, atomically.
 * @param root - the app-data root.
 * @param channels - the complete list to store.
 * @returns true when the file was replaced.
 */
export function writeChannels(root: string, channels: readonly ChannelConfig[]): boolean {
  const directory = channelsDir(root)
  const target = channelsFile(root)
  const temporary = target + '.' + randomUUID().slice(0, 8) + '.tmp'
  const payload: StoredFile = { version: CHANNELS_STORE_VERSION, channels }
  try {
    mkdirSync(directory, { recursive: true })
    writeFileSync(temporary, JSON.stringify(payload, null, 2), 'utf8')
    renameSync(temporary, target)
    return true
  } catch {
    try {
      if (existsSync(temporary)) writeFileSync(temporary, '', 'utf8')
    } catch {
      // Nothing left to clean up.
    }
    return false
  }
}

/** Why a save was refused. */
export type ChannelStoreProblem = 'type' | 'fields' | 'limit' | 'missing' | 'io'

/** The outcome of one save. */
export type ChannelSaveResult =
  | { readonly ok: true; readonly channels: readonly ChannelConfig[]; readonly channel: ChannelConfig }
  | { readonly ok: false; readonly problem: ChannelStoreProblem; readonly missing?: readonly string[] }

/** The outcome of one delete. */
export type ChannelDeleteResult =
  | { readonly ok: true; readonly channels: readonly ChannelConfig[] }
  | { readonly ok: false; readonly problem: ChannelStoreProblem }

/** Build a normalized candidate (generating an id for a new channel). */
function candidateOf(raw: unknown): ChannelConfig | { problem: ChannelStoreProblem; missing?: string[] } {
  if (raw === null || typeof raw !== 'object') return { problem: 'type' }
  const record = raw as Record<string, unknown>
  if (!isChannelType(record['type'])) return { problem: 'type' }
  const id = isChannelId(record['id']) ? record['id'] : CHANNEL_ID_PREFIX + randomUUID().replace(/-/g, '').slice(0, 12)
  const channel = normalizeChannel({ ...record, id })
  if (channel === null) return { problem: 'type' }
  const missing = missingRequiredFields(channel)
  if (missing.length > 0) return { problem: 'fields', missing }
  return channel
}

/**
 * Save one channel: replace an existing entry by id, or add a new one while the
 * list still has room. Required fields are enforced here, at the host, so an
 * out-of-date renderer cannot store an unusable channel.
 * @param root - the app-data root.
 * @param raw - the channel the renderer posted.
 * @returns the new list, or the reason it was refused.
 */
export function saveChannel(root: string, raw: unknown): ChannelSaveResult {
  const candidate = candidateOf(raw)
  if ('problem' in candidate) {
    return candidate.missing === undefined
      ? { ok: false, problem: candidate.problem }
      : { ok: false, problem: candidate.problem, missing: candidate.missing }
  }
  const channel = candidate
  const channels = readChannels(root)
  const index = channels.findIndex(entry => entry.id === channel.id)
  let next: ChannelConfig[]
  if (index >= 0) {
    next = [...channels]
    next[index] = channel
  } else {
    if (channels.length >= CHANNEL_LIMIT) return { ok: false, problem: 'limit' }
    next = [...channels, channel]
  }
  if (!writeChannels(root, next)) return { ok: false, problem: 'io' }
  return { ok: true, channels: next, channel }
}

/**
 * Delete one channel.
 * @param root - the app-data root.
 * @param id - the channel id.
 * @returns the new list, or the reason it was refused.
 */
export function deleteChannel(root: string, id: unknown): ChannelDeleteResult {
  if (!isChannelId(id)) return { ok: false, problem: 'missing' }
  const channels = readChannels(root)
  if (!channels.some(entry => entry.id === id)) return { ok: false, problem: 'missing' }
  const next = channels.filter(entry => entry.id !== id)
  if (!writeChannels(root, next)) return { ok: false, problem: 'io' }
  return { ok: true, channels: next }
}
