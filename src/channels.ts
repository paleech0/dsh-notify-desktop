/**
 * The external-push channel catalogue, shared by both halves.
 *
 * DSH's own notification surface (a Windows toast) only reaches the desktop;
 * these channels carry the same signals out to a phone / chat app / mailbox the
 * way 青龙 / MAA / 三月七小助手 do. The data model is deliberately plain: every
 * channel is a `{ id, type, enabled, label, fields }` record, and each type
 * declares which string fields its form shows. The host validates and stores
 * them; the settings UI renders the form from {@link CHANNEL_FIELDS}.
 *
 * The secrets live only in the host-side file (`%LOCALAPPDATA%\dsh-notify\
 * channels.json`), never in the browser's localStorage.
 */

import { SCENARIO_IDS } from './scenarios.ts'

/** Every channel kind this build can deliver to, in catalogue order. */
export const CHANNEL_TYPES = Object.freeze([
  'auto',
  'webhook',
  'bark',
  'serverchan',
  'pushplus',
  'wecom',
  'dingtalk',
  'feishu',
  'telegram',
  'ntfy',
  'gotify',
  'slack',
  'discord',
  'wxpusher',
  'pushdeer',
  'qmsg',
  'meow',
  'kook',
  'onebot',
  'matrix',
  'pushover',
  'smtp',
] as const)

/** One channel kind. */
export type ChannelType = (typeof CHANNEL_TYPES)[number]

/** Whether a value names a known channel type. */
export function isChannelType(value: unknown): value is ChannelType {
  return typeof value === 'string' && (CHANNEL_TYPES as readonly string[]).includes(value)
}

/** One editable field in a channel's form. */
export interface ChannelField {
  /** The key inside {@link ChannelConfig.fields}. */
  readonly key: string
  /** The locale key for the field label. */
  readonly labelKey: string
  /** Whether the field must be non-empty before the channel can be saved. */
  readonly required: boolean
  /** Render the input as a password box (tokens, passwords). */
  readonly secret?: boolean
  /** Input kind; `text` when omitted. */
  readonly kind?: 'text' | 'password' | 'number' | 'select'
  /** Allowed values for a `select` field. */
  readonly options?: readonly string[]
  /** Placeholder text. */
  readonly placeholder?: string
}

/**
 * The form schema per channel type: which string fields the channel carries,
 * in display order. The host validates the same keys, so a field the UI never
 * shows can never sneak into the store.
 */
/** Freeze a field list while typing each entry as a {@link ChannelField}. */
function fields(list: ChannelField[]): readonly ChannelField[] {
  return Object.freeze(list)
}

export const CHANNEL_FIELDS: Readonly<Record<ChannelType, readonly ChannelField[]>> = Object.freeze({
  auto: fields([
    { key: 'value', labelKey: 'settings.push.field.value', required: true, placeholder: '粘贴 URL / key / token' },
  ]),
  webhook: fields([
    { key: 'url', labelKey: 'settings.push.field.url', required: true, placeholder: 'https://example.com/hook' },
    { key: 'headers', labelKey: 'settings.push.field.headers', required: false, placeholder: '{"Authorization":"Bearer ..."}' },
    { key: 'jsonBody', labelKey: 'settings.push.field.jsonBody', required: false, placeholder: '{"text":"{title}\\n{body}"}' },
  ]),
  bark: fields([
    { key: 'deviceKey', labelKey: 'settings.push.field.barkKey', required: true, secret: true, kind: 'password' },
    { key: 'server', labelKey: 'settings.push.field.server', required: false, placeholder: 'https://api.day.app' },
    { key: 'sound', labelKey: 'settings.push.field.barkSound', required: false },
    { key: 'group', labelKey: 'settings.push.field.barkGroup', required: false },
  ]),
  serverchan: fields([
    { key: 'sendKey', labelKey: 'settings.push.field.sendKey', required: true, secret: true, kind: 'password', placeholder: 'SCT… 或 sctp…' },
  ]),
  pushplus: fields([
    { key: 'token', labelKey: 'settings.push.field.token', required: true, secret: true, kind: 'password' },
    { key: 'topic', labelKey: 'settings.push.field.topic', required: false },
  ]),
  wecom: fields([
    { key: 'key', labelKey: 'settings.push.field.wecomKey', required: true, secret: true, kind: 'password' },
  ]),
  dingtalk: fields([
    { key: 'url', labelKey: 'settings.push.field.url', required: true, placeholder: 'https://oapi.dingtalk.com/robot/send?access_token=...' },
    { key: 'secret', labelKey: 'settings.push.field.secret', required: false, secret: true, kind: 'password' },
  ]),
  feishu: fields([
    { key: 'url', labelKey: 'settings.push.field.url', required: true, placeholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/...' },
    { key: 'secret', labelKey: 'settings.push.field.secret', required: false, secret: true, kind: 'password' },
  ]),
  telegram: fields([
    { key: 'botToken', labelKey: 'settings.push.field.botToken', required: true, secret: true, kind: 'password' },
    { key: 'chatId', labelKey: 'settings.push.field.chatId', required: true },
    { key: 'apiBase', labelKey: 'settings.push.field.apiBase', required: false, placeholder: 'https://api.telegram.org' },
  ]),
  ntfy: fields([
    { key: 'topic', labelKey: 'settings.push.field.topic', required: true },
    { key: 'server', labelKey: 'settings.push.field.server', required: false, placeholder: 'https://ntfy.sh' },
    { key: 'token', labelKey: 'settings.push.field.token', required: false, secret: true, kind: 'password' },
  ]),
  gotify: fields([
    { key: 'server', labelKey: 'settings.push.field.server', required: true, placeholder: 'https://gotify.example.com' },
    { key: 'token', labelKey: 'settings.push.field.token', required: true, secret: true, kind: 'password' },
    { key: 'priority', labelKey: 'settings.push.field.priority', required: false, kind: 'number', placeholder: '5' },
  ]),
  slack: fields([
    { key: 'url', labelKey: 'settings.push.field.url', required: true, placeholder: 'https://hooks.slack.com/services/...' },
  ]),
  discord: fields([
    { key: 'url', labelKey: 'settings.push.field.url', required: true, placeholder: 'https://discord.com/api/webhooks/...' },
  ]),
  wxpusher: fields([
    { key: 'appToken', labelKey: 'settings.push.field.appToken', required: true, secret: true, kind: 'password', placeholder: 'AT_...' },
    { key: 'uid', labelKey: 'settings.push.field.uid', required: false, placeholder: 'UID_...' },
    { key: 'topicIds', labelKey: 'settings.push.field.topicIds', required: false, placeholder: '123,456' },
  ]),
  pushdeer: fields([
    { key: 'pushKey', labelKey: 'settings.push.field.pushKey', required: true, secret: true, kind: 'password' },
    { key: 'server', labelKey: 'settings.push.field.server', required: false, placeholder: 'https://api2.pushdeer.com' },
  ]),
  qmsg: fields([
    { key: 'key', labelKey: 'settings.push.field.qmsgKey', required: true, secret: true, kind: 'password' },
    { key: 'qq', labelKey: 'settings.push.field.qq', required: false, placeholder: '收件 QQ（可选）' },
  ]),
  meow: fields([
    { key: 'nickname', labelKey: 'settings.push.field.nickname', required: true },
    { key: 'server', labelKey: 'settings.push.field.server', required: false, placeholder: 'https://api.chuckfang.com' },
  ]),
  kook: fields([
    { key: 'token', labelKey: 'settings.push.field.token', required: true, secret: true, kind: 'password' },
    { key: 'targetId', labelKey: 'settings.push.field.targetId', required: true, placeholder: '频道/用户 id' },
  ]),
  onebot: fields([
    { key: 'server', labelKey: 'settings.push.field.server', required: true, placeholder: 'http://127.0.0.1:5700' },
    { key: 'messageType', labelKey: 'settings.push.field.messageType', required: false, kind: 'select', options: ['private', 'group'] },
    { key: 'target', labelKey: 'settings.push.field.target', required: true, placeholder: 'QQ 号 / 群号' },
  ]),
  matrix: fields([
    { key: 'server', labelKey: 'settings.push.field.server', required: true, placeholder: 'https://matrix.example.com' },
    { key: 'roomId', labelKey: 'settings.push.field.roomId', required: true, placeholder: '!abc:example.com' },
    { key: 'token', labelKey: 'settings.push.field.token', required: true, secret: true, kind: 'password' },
  ]),
  pushover: fields([
    { key: 'token', labelKey: 'settings.push.field.token', required: true, secret: true, kind: 'password' },
    { key: 'user', labelKey: 'settings.push.field.userKey', required: true, secret: true, kind: 'password' },
  ]),
  smtp: fields([
    { key: 'host', labelKey: 'settings.push.field.smtpHost', required: true, placeholder: 'smtp.example.com' },
    { key: 'port', labelKey: 'settings.push.field.smtpPort', required: true, kind: 'number', placeholder: '465' },
    { key: 'secure', labelKey: 'settings.push.field.smtpSecure', required: false, kind: 'select', options: ['ssl', 'starttls', 'none'] },
    { key: 'user', labelKey: 'settings.push.field.smtpUser', required: false },
    { key: 'pass', labelKey: 'settings.push.field.smtpPass', required: false, secret: true, kind: 'password' },
    { key: 'from', labelKey: 'settings.push.field.smtpFrom', required: true, placeholder: 'dsh@example.com' },
    { key: 'to', labelKey: 'settings.push.field.smtpTo', required: true, placeholder: 'me@example.com, other@example.com' },
  ]),
})

/** The locale key for one channel type's display name. */
export function channelTypeKey(type: ChannelType): string {
  return 'settings.push.type.' + type
}

/** One configured channel. */
export interface ChannelConfig {
  /** Stable id (`ch_...`), used to edit/delete/test one channel. */
  readonly id: string
  /** Which kind of channel. */
  readonly type: ChannelType
  /** Whether this channel currently receives pushes. */
  readonly enabled: boolean
  /** A user label; empty means "show the type name". */
  readonly label: string
  /** Every field value, keyed by {@link ChannelField.key}. */
  readonly fields: Readonly<Record<string, string>>
  /**
   * Which situations this channel receives (the scenario ids). Empty means all
   * of them; a non-empty list narrows it, so e.g. an errors-only channel only
   * gets errors.
   */
  readonly scenarios: readonly string[]
  /** Title template override for this channel; empty inherits the situation text. */
  readonly titleTemplate: string
  /** Body template override for this channel; empty inherits the situation text. */
  readonly bodyTemplate: string
  /** Send markdown where the channel supports it (企业微信 / 钉钉 / 飞书). */
  readonly markdown: boolean
}

/** One message to push out through the channels. */
export interface PushMessage {
  /** Short title (the toast title). */
  readonly title: string
  /** Body text (the toast body / turn summary). */
  readonly body: string
  /** Rough severity, used for channel priorities. */
  readonly level: 'info' | 'warning' | 'error'
  /** The situation that raised it (completed / approval / reminder / ...). */
  readonly scenario: string
  /** The workspace/session label for the source line. */
  readonly source: string
  /** When the signal fired (ms). */
  readonly timestamp: number
  /**
   * Raw placeholder values a per-channel template can use: `工作区`, `状态`,
   * `内容`, `分钟`. The host renders a channel's title/body override against
   * these, so one message can be re-worded per channel.
   */
  readonly vars: Readonly<Record<string, string>>
}

/** The outcome of delivering one message to one channel. */
export interface ChannelReceipt {
  readonly id: string
  readonly type: string
  readonly label: string
  readonly ok: boolean
  /** HTTP status when the channel is HTTP-based. */
  readonly status?: number
  /** Human-readable failure reason when `ok` is false. */
  readonly error?: string
}

/** Prefix every channel id carries. */
export const CHANNEL_ID_PREFIX = 'ch_'

/** The most channels a profile may hold. */
export const CHANNEL_LIMIT = 50

/** Whether a value is a well-formed channel id. */
export function isChannelId(value: unknown): value is string {
  return typeof value === 'string' && /^ch_[a-z0-9]{6,}$/.test(value)
}

/** The trimmed string value of one field ('' when absent). */
export function fieldValue(channel: ChannelConfig, key: string): string {
  const value = channel.fields[key]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Which required fields a channel is still missing, by key.
 * @param channel - the candidate channel.
 * @returns the keys whose required field is blank (empty when complete).
 */
export function missingRequiredFields(channel: ChannelConfig): string[] {
  const missing: string[] = []
  for (const field of CHANNEL_FIELDS[channel.type]) {
    if (field.required && fieldValue(channel, field.key) === '') missing.push(field.key)
  }
  return missing
}

/** Keep only the known scenario ids, de-duplicated, in the stored order. */
function knownScenarios(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const entry of value) {
    if (typeof entry === 'string' && (SCENARIO_IDS as readonly string[]).includes(entry) && !out.includes(entry)) {
      out.push(entry)
    }
  }
  return out
}

/**
 * Validate and normalize one channel value (from disk or the renderer). Unknown
 * fields are dropped, non-string fields become '', and a structurally invalid
 * record reads as null. Required fields are NOT enforced here — the store's
 * save path enforces them so an in-progress draft can round-trip.
 * @param value - whatever was stored or posted.
 * @returns the clean channel, or null when it is not usable.
 */
export function normalizeChannel(value: unknown): ChannelConfig | null {
  if (value === null || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (!isChannelId(record['id'])) return null
  if (!isChannelType(record['type'])) return null
  const type = record['type']
  const enabled = record['enabled'] === true
  const rawLabel = typeof record['label'] === 'string' ? record['label'].trim() : ''
  const label = rawLabel.slice(0, 60)
  const rawFields = record['fields']
  const source = rawFields !== null && typeof rawFields === 'object' ? rawFields as Record<string, unknown> : {}
  const fields: Record<string, string> = {}
  for (const field of CHANNEL_FIELDS[type]) {
    const raw = source[field.key]
    fields[field.key] = typeof raw === 'string' ? raw.trim().slice(0, 4096) : ''
  }
  return {
    id: record['id'],
    type,
    enabled,
    label,
    fields,
    scenarios: knownScenarios(record['scenarios']),
    titleTemplate: typeof record['titleTemplate'] === 'string' ? record['titleTemplate'].slice(0, 400) : '',
    bodyTemplate: typeof record['bodyTemplate'] === 'string' ? record['bodyTemplate'].slice(0, 1000) : '',
    markdown: record['markdown'] === true,
  }
}

/** One auto-detection result: the channel type a pasted value looks like. */
export interface ChannelDetection {
  readonly type: ChannelType
  readonly fields: Record<string, string>
  /** Required fields the pasted value does not provide (empty = usable as-is). */
  readonly missing: string[]
}

/** Build a detection, computing which required fields are still blank. */
function detected(type: ChannelType, fields: Record<string, string>): ChannelDetection {
  const missing: string[] = []
  for (const field of CHANNEL_FIELDS[type]) {
    if (field.required && (fields[field.key] ?? '').trim() === '') missing.push(field.key)
  }
  return { type, fields, missing }
}

/** Decode one URL path segment, falling back to the raw text. */
function segment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Guess which channel a pasted value belongs to.
 *
 * The "auto" channel lets the user paste one string — a group-bot webhook, a
 * Server酱 key, a Bark device key, an ntfy topic URL, or any https URL — and
 * this decides the concrete channel. URLs are matched by host; bare values only
 * by an unmistakable prefix (`SCT…` / `sctp…` / `AT_…` / a Telegram bot token).
 * A non-empty `missing` means the type was recognized but the paste cannot
 * supply every required field (for example a Telegram bot token with no chat
 * id). The console URLs (`sct.ftqq.com`, `sc3.ft07.com`) are not endpoints and
 * read as unrecognized.
 * @param raw - whatever the user pasted.
 * @returns the detection, or null when nothing matches.
 */
export function detectChannelValue(raw: string): ChannelDetection | null {
  const value = raw.trim()
  if (value === '') return null
  let url: URL | null = null
  try {
    url = new URL(value)
  } catch {
    url = null
  }
  if (url !== null) {
    const host = url.hostname.toLowerCase()
    const path = url.pathname
    if (host === 'sct.ftqq.com' || host === 'sc3.ft07.com') return null
    if (host === 'qyapi.weixin.qq.com' && url.searchParams.get('key') !== null) {
      return detected('wecom', { key: url.searchParams.get('key') ?? '' })
    }
    if (host === 'oapi.dingtalk.com' && path.includes('/robot/send')) {
      return detected('dingtalk', { url: value })
    }
    if ((host === 'open.feishu.cn' || host === 'open.larksuite.com' || host.endsWith('.feishu.cn') || host.endsWith('.larksuite.com')) && path.includes('/bot/v2/hook')) {
      return detected('feishu', { url: value })
    }
    if (host === 'hooks.slack.com') return detected('slack', { url: value })
    if ((host === 'discord.com' || host === 'discordapp.com') && path.includes('/api/webhooks/')) {
      return detected('discord', { url: value })
    }
    if (host === 'sctapi.ftqq.com') {
      const match = /^\/(.+)\.send$/.exec(path)
      if (match !== null) return detected('serverchan', { sendKey: segment(match[1] ?? '') })
      return detected('serverchan', {})
    }
    if (host.endsWith('.push.ft07.com') && path.startsWith('/send/')) {
      const match = /^\/send\/(.+)\.send$/.exec(path)
      if (match !== null) return detected('serverchan', { sendKey: segment(match[1] ?? '') })
      return detected('serverchan', {})
    }
    if (host === 'api.day.app') {
      const first = path.replace(/^\/+/, '').split('/')[0] ?? ''
      if (first !== '') return detected('bark', { deviceKey: segment(first) })
      return detected('bark', {})
    }
    if (host === 'ntfy.sh') {
      const topic = path.replace(/^\/+/, '').split('/')[0] ?? ''
      if (topic !== '') return detected('ntfy', { topic: segment(topic), server: 'https://ntfy.sh' })
      return detected('ntfy', {})
    }
    if (host === 'qmsg.zendee.cn') {
      const match = /^\/send\/(.+)$/.exec(path)
      if (match !== null) return detected('qmsg', { key: segment(match[1] ?? '') })
      return detected('qmsg', {})
    }
    if (path.includes('/message') && url.searchParams.get('token') !== null) {
      return detected('gotify', { server: url.origin, token: url.searchParams.get('token') ?? '' })
    }
    // Any other http(s) URL is a generic webhook.
    return detected('webhook', { url: value })
  }
  if (/^SCT/i.test(value) || /^sctp\d+t/i.test(value)) return detected('serverchan', { sendKey: value })
  if (/^AT_[A-Za-z0-9]+$/.test(value)) return detected('wxpusher', { appToken: value })
  if (/^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(value)) return detected('telegram', { botToken: value })
  return null
}
