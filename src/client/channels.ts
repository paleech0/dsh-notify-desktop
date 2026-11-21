/**
 * The renderer half of the external-push channels: thin `fetch` wrappers over
 * the host routes. The host owns the channels and secrets; this module only
 * lists, saves, deletes, tests and pushes. Nothing here blocks the notification
 * that triggered it — {@link pushNotification} is fire-and-forget.
 */
import { CHANNELS_ROUTE, FOCUS_HEADER, PUSH_ROUTE, TEST_PUSH_ROUTE } from '../protocol.ts'
import type { ChannelConfig, ChannelReceipt, ChannelType, PushMessage } from '../channels.ts'

/** One channel being edited in the settings form (`id` is '' for a new one). */
export interface ChannelDraft {
  readonly id: string
  readonly type: ChannelType
  readonly enabled: boolean
  readonly label: string
  readonly fields: Record<string, string>
  /** Scenario ids this channel receives; empty = all. */
  readonly scenarios: readonly string[]
  /** Title override template; '' inherits the situation text. */
  readonly titleTemplate: string
  /** Body override template; '' inherits the situation text. */
  readonly bodyTemplate: string
  /** Send markdown where supported. */
  readonly markdown: boolean
}

/** The outcome of saving one channel. */
export type ChannelSaveOutcome =
  | { readonly ok: true; readonly channels: readonly ChannelConfig[]; readonly channel: ChannelConfig }
  | { readonly ok: false; readonly problem: string; readonly missing?: readonly string[] }

/** The outcome of deleting one channel. */
export type ChannelDeleteOutcome =
  | { readonly ok: true; readonly channels: readonly ChannelConfig[] }
  | { readonly ok: false; readonly problem: string }

/**
 * Read every configured channel from the host.
 * @returns the list, or [] when the host is unreachable.
 */
export async function listChannels(): Promise<ChannelConfig[]> {
  const fetchImpl = globalThis.fetch
  if (fetchImpl === undefined) return []
  try {
    const response = await fetchImpl(CHANNELS_ROUTE, { headers: { [FOCUS_HEADER]: '1' } })
    if (!response.ok) return []
    const payload = await response.json() as { channels?: unknown }
    return Array.isArray(payload.channels) ? payload.channels as ChannelConfig[] : []
  } catch {
    return []
  }
}

/**
 * Save one channel (upsert by id) on the host.
 * @param draft - the channel to save.
 * @returns the new list and saved channel, or the reason it was refused.
 */
export async function saveChannel(draft: ChannelDraft): Promise<ChannelSaveOutcome> {
  const fetchImpl = globalThis.fetch
  if (fetchImpl === undefined) return { ok: false, problem: 'no-host' }
  try {
    const response = await fetchImpl(CHANNELS_ROUTE, {
      method: 'POST',
      headers: { [FOCUS_HEADER]: '1', 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'save', channel: draft }),
    })
    const payload = await response.json() as {
      ok?: unknown
      channels?: unknown
      channel?: unknown
      problem?: unknown
      missing?: unknown
    }
    if (payload.ok === true && Array.isArray(payload.channels) && payload.channel !== undefined) {
      return { ok: true, channels: payload.channels as ChannelConfig[], channel: payload.channel as ChannelConfig }
    }
    const problem = typeof payload.problem === 'string' ? payload.problem : 'error'
    return Array.isArray(payload.missing)
      ? { ok: false, problem, missing: payload.missing as string[] }
      : { ok: false, problem }
  } catch {
    return { ok: false, problem: 'no-host' }
  }
}

/**
 * Delete one channel on the host.
 * @param id - the channel id.
 * @returns the new list, or the reason it was refused.
 */
export async function deleteChannel(id: string): Promise<ChannelDeleteOutcome> {
  const fetchImpl = globalThis.fetch
  if (fetchImpl === undefined) return { ok: false, problem: 'no-host' }
  try {
    const response = await fetchImpl(CHANNELS_ROUTE, {
      method: 'POST',
      headers: { [FOCUS_HEADER]: '1', 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    })
    const payload = await response.json() as { ok?: unknown; channels?: unknown; problem?: unknown }
    if (payload.ok === true && Array.isArray(payload.channels)) return { ok: true, channels: payload.channels as ChannelConfig[] }
    return { ok: false, problem: typeof payload.problem === 'string' ? payload.problem : 'error' }
  } catch {
    return { ok: false, problem: 'no-host' }
  }
}

/**
 * Fire-and-forget: deliver one notification to every enabled channel.
 * @param message - the message to push.
 */
export function pushNotification(message: PushMessage): void {
  const fetchImpl = globalThis.fetch
  if (fetchImpl === undefined) return
  try {
    void fetchImpl(PUSH_ROUTE, {
      method: 'POST',
      headers: { [FOCUS_HEADER]: '1', 'content-type': 'application/json' },
      body: JSON.stringify(message),
    }).catch(() => undefined)
  } catch {
    // A failing push never breaks the notification that triggered it.
  }
}

/**
 * Send a fixed test message to one channel (or every enabled one when id '').
 * @param id - the channel id, or '' for all enabled channels.
 * @returns the per-channel receipts.
 */
export async function testPush(id: string): Promise<ChannelReceipt[]> {
  const fetchImpl = globalThis.fetch
  if (fetchImpl === undefined) return []
  try {
    const response = await fetchImpl(TEST_PUSH_ROUTE, {
      method: 'POST',
      headers: { [FOCUS_HEADER]: '1', 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const payload = await response.json() as { receipts?: unknown }
    return Array.isArray(payload.receipts) ? payload.receipts as ChannelReceipt[] : []
  } catch {
    return []
  }
}
