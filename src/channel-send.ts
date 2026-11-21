/**
 * The host-side channel dispatcher: turns one {@link PushMessage} into a request
 * per configured channel and delivers them concurrently.
 *
 * This runs in the host, not the renderer, because the renderer cannot POST to
 * Bark / Telegram / DingTalk — those endpoints send no CORS headers, so a page
 * `fetch` fails at the preflight. The host has plain Node networking and no
 * CORS, so it is the only place these deliveries can happen.
 *
 * The module is pure where it can be: {@link buildHttpCall} and
 * {@link buildSmtpPlan} compute the request without touching the network, so
 * every channel's shape is unit-tested; {@link sendToChannel} performs the I/O
 * with an injected `fetchImpl` / `smtpDeliver`, so the tests never hit a real
 * endpoint. One channel failing never affects the others.
 */
import { createHmac } from 'node:crypto'
import { connect as netConnect, type Socket } from 'node:net'
import { connect as tlsConnect } from 'node:tls'
import {
  channelTypeKey,
  detectChannelValue,
  fieldValue,
  type ChannelConfig,
  type ChannelReceipt,
  type PushMessage,
} from './channels.ts'

/** A structural subset of `fetch` so this file needs no DOM lib types. */
export interface FetchResponseLike {
  readonly status: number
  text(): Promise<string>
}

/** The fetch shape the dispatcher uses (injectable for tests). */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<FetchResponseLike>

/** Options for one dispatch run. */
export interface DispatchOptions {
  /** Override the HTTP client (tests inject a mock). */
  readonly fetchImpl?: FetchLike
  /** Per-request timeout in milliseconds (default 15000). */
  readonly timeoutMs?: number
  /** The clock used for HMAC timestamps (default Date.now()). */
  readonly now?: number
  /** Test seam: replace the real SMTP delivery. */
  readonly smtpDeliver?: (channel: ChannelConfig, message: PushMessage) => Promise<void>
}

/** One prepared HTTP request plus its business-code check. */
export interface HttpCall {
  readonly url: string
  readonly method: string
  readonly headers: Readonly<Record<string, string>>
  readonly body: string | undefined
  /** Return whether the response means success (beyond a 2xx status). */
  readonly check: ((status: number, json: unknown) => { ok: boolean; error?: string }) | undefined
}

/** A channel that could not even be built into a request (bad config). */
export class ChannelBuildError extends Error {}

const enc = encodeURIComponent

/** Strip a trailing slash so `server + '/path'` never doubles it. */
function base(server: string, fallback: string): string {
  return (server.trim() === '' ? fallback : server.trim()).replace(/\/+$/, '')
}

/** Parse an optional JSON object of string header values. */
function parseHeaderMap(raw: string): Record<string, string> {
  if (raw.trim() === '') return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ChannelBuildError('headers is not valid JSON')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ChannelBuildError('headers must be a JSON object')
  }
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}

/** The `\n`-joined body every plain-text channel shows. */
function joinedText(message: PushMessage): string {
  return message.body.trim() === '' ? message.title : message.title + '\n' + message.body
}

/** Escape a value for safe substitution inside a JSON string literal. */
function jsonEscape(value: string): string {
  return JSON.stringify(value).slice(1, -1)
}

/**
 * Fill a template's `{token}` placeholders. An unknown token is left untouched.
 * @param template - the template text.
 * @param vars - token → value.
 * @param escape - JSON-escape each value (for the webhook jsonBody template).
 * @returns the rendered text.
 */
function renderTemplate(template: string, vars: Readonly<Record<string, string>>, escape = false): string {
  return template.replace(/\{([^{}]+)\}/g, (whole, key: string) => {
    const value = vars[key]
    if (value === undefined) return whole
    return escape ? jsonEscape(value) : value
  })
}

/** Build the placeholder values one message exposes to a channel template. */
function renderVars(message: PushMessage, title: string, body: string): Record<string, string> {
  const vars = message.vars
  return {
    ...vars,
    title,
    body,
    level: message.level,
    scenario: message.scenario,
    source: message.source,
    timestamp: new Date(message.timestamp).toISOString(),
    workspace: vars['工作区'] ?? message.source,
    status: vars['状态'] ?? '',
    content: vars['内容'] ?? body,
    minutes: vars['分钟'] ?? '',
  }
}

/**
 * Apply a channel's own title/body templates over the situation's text.
 * @param channel - the channel whose overrides apply.
 * @param message - the base message.
 * @returns the message with its title/body re-rendered (or the same object when
 *          the channel sets no override).
 */
function effectiveMessage(channel: ChannelConfig, message: PushMessage): PushMessage {
  const titleTpl = channel.titleTemplate
  const bodyTpl = channel.bodyTemplate
  if (titleTpl === '' && bodyTpl === '') return message
  const vars = renderVars(message, message.title, message.body)
  return {
    ...message,
    title: titleTpl === '' ? message.title : renderTemplate(titleTpl, vars),
    body: bodyTpl === '' ? message.body : renderTemplate(bodyTpl, vars),
  }
}

/** Gotify priority number for a level. */
function gotifyPriority(level: PushMessage['level'], raw: string): number {
  const custom = Number(raw)
  if (raw.trim() !== '' && Number.isFinite(custom)) return Math.max(0, Math.min(10, Math.round(custom)))
  return level === 'error' ? 8 : level === 'warning' ? 5 : 3
}

/** ntfy priority word for a level. */
function ntfyPriority(level: PushMessage['level']): string {
  return level === 'error' ? 'urgent' : level === 'warning' ? 'high' : 'default'
}

/** base64 HMAC-SHA256 over `text` with `key`. */
function hmacBase64(key: string, text: string): string {
  return createHmac('sha256', key).update(text, 'utf8').digest('base64')
}

/** Require a field or fail the build with a readable reason. */
function need(channel: ChannelConfig, key: string, human: string): string {
  const value = fieldValue(channel, key)
  if (value === '') throw new ChannelBuildError('missing ' + human)
  return value
}

/**
 * Resolve a Server酱 SendKey into its API URL.
 *
 * The web console `https://sct.ftqq.com` is where you copy the key from — it is
 * not a key and cannot be used here. Server酱Turbo keys start with `SCT` and
 * post to `sctapi.ftqq.com`; Server酱³ keys start with `sctp<uid>t…` and post to
 * `<uid>.push.ft07.com`, which is why the prefix decides the endpoint.
 * @param sendKey - the SendKey the user pasted.
 * @returns the API URL to POST to.
 * @throws {ChannelBuildError} when an sctp key does not carry a uid.
 */
function serverchanUrl(sendKey: string): string {
  if (sendKey.toLowerCase().startsWith('sctp')) {
    const match = /^sctp(\d+)t/i.exec(sendKey)
    if (match === null) throw new ChannelBuildError('Server酱³ SendKey should look like sctp<uid>t…')
    return 'https://' + match[1] + '.push.ft07.com/send/' + enc(sendKey) + '.send'
  }
  return 'https://sctapi.ftqq.com/' + enc(sendKey) + '.send'
}

/**
 * Build the HTTP request for one channel.
 * @param channel - the configured channel.
 * @param message - the message to deliver.
 * @param now - the clock (ms) used for HMAC timestamps.
 * @returns the request to send.
 * @throws {ChannelBuildError} when the config is unusable.
 */
export function buildHttpCall(channel: ChannelConfig, message: PushMessage, now: number): HttpCall {
  const f = (key: string): string => fieldValue(channel, key)
  const text = joinedText(message)
  switch (channel.type) {
    case 'auto': {
      const raw = need(channel, 'value', 'content')
      const detected = detectChannelValue(raw)
      if (detected === null) {
        throw new ChannelBuildError('无法识别：请粘贴群机器人 URL、Server酱 key、Bark key、ntfy 主题，或任意 https 链接')
      }
      if (detected.missing.length > 0) {
        throw new ChannelBuildError('识别为 ' + detected.type + '，但缺少：' + detected.missing.join(', '))
      }
      return buildHttpCall({ ...channel, type: detected.type, fields: detected.fields }, message, now)
    }
    case 'webhook': {
      const url = need(channel, 'url', 'url')
      const headers = { 'content-type': 'application/json; charset=utf-8', ...parseHeaderMap(f('headers')) }
      const jsonBody = f('jsonBody')
      let body: string
      if (jsonBody === '') {
        body = JSON.stringify({
          title: message.title,
          message: message.body,
          level: message.level,
          scenario: message.scenario,
          source: message.source,
          timestamp: new Date(message.timestamp).toISOString(),
        })
      } else {
        body = renderTemplate(jsonBody, renderVars(message, message.title, message.body), true)
        try {
          JSON.parse(body)
        } catch {
          throw new ChannelBuildError('webhook jsonBody does not render to valid JSON')
        }
      }
      return { url, method: 'POST', headers, body, check: statusOk }
    }
    case 'bark': {
      const deviceKey = need(channel, 'deviceKey', 'device key')
      const server = base(f('server'), 'https://api.day.app')
      const payload: Record<string, string> = { title: message.title, body: joinedText(message) }
      if (f('sound') !== '') payload['sound'] = f('sound')
      if (f('group') !== '') payload['group'] = f('group')
      return {
        url: server + '/' + enc(deviceKey),
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
        check: (status, json) => checkCode(status, json, 'code', 200),
      }
    }
    case 'serverchan': {
      const sendKey = need(channel, 'sendKey', 'SendKey')
      return {
        url: serverchanUrl(sendKey),
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
        body: 'title=' + enc(message.title) + '&desp=' + enc(joinedText(message)),
        check: (status, json) => checkCode(status, json, 'code', 0),
      }
    }
    case 'pushplus': {
      const token = need(channel, 'token', 'token')
      const payload: Record<string, unknown> = { token, title: message.title, content: joinedText(message), template: 'txt' }
      if (f('topic') !== '') payload['topic'] = f('topic')
      return {
        url: 'https://www.pushplus.plus/send',
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
        check: (status, json) => checkCode(status, json, 'code', 200),
      }
    }
    case 'wecom': {
      const key = need(channel, 'key', 'webhook key')
      const payload = channel.markdown
        ? { msgtype: 'markdown', markdown: { content: text } }
        : { msgtype: 'text', text: { content: text } }
      return {
        url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=' + enc(key),
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
        check: (status, json) => checkCode(status, json, 'errcode', 0),
      }
    }
    case 'dingtalk': {
      let url = need(channel, 'url', 'webhook url')
      const secret = f('secret')
      if (secret !== '') {
        const timestamp = String(now)
        const sign = enc(hmacBase64(secret, timestamp + '\n' + secret))
        url += (url.includes('?') ? '&' : '?') + 'timestamp=' + timestamp + '&sign=' + sign
      }
      return {
        url,
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(channel.markdown
          ? { msgtype: 'markdown', markdown: { title: message.title, text } }
          : { msgtype: 'text', text: { content: text } }),
        check: (status, json) => checkCode(status, json, 'errcode', 0),
      }
    }
    case 'feishu': {
      const url = need(channel, 'url', 'webhook url')
      const secret = f('secret')
      const payload: Record<string, unknown> = channel.markdown
        ? {
          msg_type: 'interactive',
          card: {
            header: { title: { tag: 'plain_text', content: message.title } },
            elements: [{ tag: 'markdown', content: text }],
          },
        }
        : { msg_type: 'text', content: { text } }
      if (secret !== '') {
        const timestamp = String(Math.floor(now / 1000))
        payload['timestamp'] = timestamp
        payload['sign'] = hmacBase64(timestamp + '\n' + secret, '')
      }
      return {
        url,
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
        check: (status, json) => {
          const code = readCode(json, 'code')
          if (code !== undefined) return { ok: code === 0, ...(code === 0 ? {} : { error: 'code=' + String(code) }) }
          const legacy = readCode(json, 'StatusCode')
          if (legacy !== undefined) return { ok: legacy === 0, ...(legacy === 0 ? {} : { error: 'StatusCode=' + String(legacy) }) }
          return statusOk(status)
        },
      }
    }
    case 'telegram': {
      const botToken = need(channel, 'botToken', 'bot token')
      const chatId = need(channel, 'chatId', 'chat id')
      const server = base(f('apiBase'), 'https://api.telegram.org')
      return {
        url: server + '/bot' + botToken + '/sendMessage',
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
        check: (status, json) => {
          const ok = readField(json, 'ok')
          if (ok === true) return { ok: true }
          if (ok === false) return { ok: false, error: readDescription(json) }
          return statusOk(status)
        },
      }
    }
    case 'ntfy': {
      const topic = need(channel, 'topic', 'topic')
      const server = base(f('server'), 'https://ntfy.sh')
      const headers: Record<string, string> = {
        'content-type': 'text/plain; charset=utf-8',
        Priority: ntfyPriority(message.level),
      }
      // HTTP header values are latin-1; a non-ASCII title makes fetch throw
      // before the request leaves, so only an ASCII title rides the header and
      // a Chinese one stays in the body (which already starts with the title).
      if (/^[\x20-\x7E]*$/.test(message.title)) headers['Title'] = message.title
      const token = f('token')
      if (token !== '') headers['Authorization'] = 'Bearer ' + token
      return { url: server + '/' + enc(topic), method: 'POST', headers, body: text, check: statusOk }
    }
    case 'gotify': {
      const server = base(need(channel, 'server', 'server'), '')
      const token = need(channel, 'token', 'token')
      return {
        url: server + '/message?token=' + enc(token),
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ title: message.title, message: joinedText(message), priority: gotifyPriority(message.level, f('priority')) }),
        check: statusOk,
      }
    }
    case 'slack': {
      const url = need(channel, 'url', 'webhook url')
      return {
        url,
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ text: '*' + message.title + '*\n' + message.body }),
        check: statusOk,
      }
    }
    case 'discord': {
      const url = need(channel, 'url', 'webhook url')
      return {
        url,
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ content: '**' + message.title + '**\n' + message.body }),
        check: statusOk,
      }
    }
    case 'wxpusher': {
      const appToken = need(channel, 'appToken', 'appToken')
      const uid = f('uid')
      const topicIds = f('topicIds')
        .split(',')
        .map(part => Number(part.trim()))
        .filter(value => Number.isFinite(value) && value > 0)
      const payload: Record<string, unknown> = {
        appToken,
        content: joinedText(message),
        summary: message.title.slice(0, 100),
        contentType: 1,
        uids: uid === '' ? [] : [uid],
        topicIds,
      }
      return {
        url: 'https://wxpusher.zjiecode.com/api/send/message',
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
        check: (status, json) => checkCode(status, json, 'code', 1000),
      }
    }
    case 'pushdeer': {
      const pushKey = need(channel, 'pushKey', 'push key')
      const server = base(f('server'), 'https://api2.pushdeer.com')
      return {
        url: server + '/message/push',
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
        body: 'pushkey=' + enc(pushKey) + '&text=' + enc(message.title) + '&desp=' + enc(joinedText(message)) + '&type=text',
        check: (status, json) => checkCode(status, json, 'code', 0),
      }
    }
    case 'qmsg': {
      const key = need(channel, 'key', 'Qmsg key')
      let body = 'msg=' + enc(joinedText(message))
      if (f('qq') !== '') body += '&qq=' + enc(f('qq'))
      return {
        url: 'https://qmsg.zendee.cn/send/' + enc(key),
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
        body,
        check: (status, json) => checkCode(status, json, 'code', 0),
      }
    }
    case 'meow': {
      const nickname = need(channel, 'nickname', 'nickname')
      const server = base(f('server'), 'https://api.chuckfang.com')
      return {
        url: server + '/' + enc(nickname),
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ title: message.title, msg: joinedText(message) }),
        check: statusOk,
      }
    }
    case 'kook': {
      const token = need(channel, 'token', 'bot token')
      const targetId = need(channel, 'targetId', 'target id')
      return {
        url: 'https://www.kookapp.cn/api/v3/message/create',
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8', Authorization: 'Bot ' + token },
        body: JSON.stringify({ target_id: targetId, content: text }),
        check: (status, json) => checkCode(status, json, 'code', 0),
      }
    }
    case 'onebot': {
      const server = base(need(channel, 'server', 'server'), '')
      const messageType = f('messageType') === 'group' ? 'group' : 'private'
      const target = need(channel, 'target', 'target id')
      const numeric = Number(target)
      const idValue = Number.isFinite(numeric) ? numeric : target
      const payload: Record<string, unknown> = { message_type: messageType, message: text, auto_escape: false }
      payload[messageType === 'group' ? 'group_id' : 'user_id'] = idValue
      return {
        url: server + '/send_msg',
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
        check: (status, json) => checkCode(status, json, 'retcode', 0),
      }
    }
    case 'matrix': {
      const server = base(need(channel, 'server', 'server'), '')
      const roomId = need(channel, 'roomId', 'room id')
      const token = need(channel, 'token', 'access token')
      const txnId = 'dsh' + String(now) + String(Math.floor(Math.random() * 1_000_000))
      return {
        url: server + '/_matrix/client/v3/rooms/' + enc(roomId) + '/send/m.room.message/' + txnId,
        method: 'PUT',
        headers: { 'content-type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ msgtype: 'm.text', body: text }),
        check: statusOk,
      }
    }
    case 'pushover': {
      const token = need(channel, 'token', 'application token')
      const user = need(channel, 'user', 'user key')
      return {
        url: 'https://api.pushover.net/1/messages.json',
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
        body: 'token=' + enc(token) + '&user=' + enc(user) + '&title=' + enc(message.title) + '&message=' + enc(joinedText(message)),
        check: (status, json) => checkCode(status, json, 'status', 1),
      }
    }
    case 'smtp':
      throw new ChannelBuildError('smtp is delivered without an HTTP call')
  }
}

/** Accept any 2xx as success. */
function statusOk(status: number): { ok: boolean; error?: string } {
  return status >= 200 && status < 300 ? { ok: true } : { ok: false, error: 'HTTP ' + String(status) }
}

/** Read a numeric field off a parsed JSON object (undefined when absent). */
function readCode(json: unknown, key: string): number | undefined {
  if (json === null || typeof json !== 'object') return undefined
  const value = (json as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : undefined
}

/** Read any field off a parsed JSON object. */
function readField(json: unknown, key: string): unknown {
  return json !== null && typeof json === 'object' ? (json as Record<string, unknown>)[key] : undefined
}

/** A telegram-style `description` string. */
function readDescription(json: unknown): string {
  const value = readField(json, 'description')
  return typeof value === 'string' ? value : 'telegram refused the message'
}

/** Success when the JSON `key` equals `expected`. */
function checkCode(status: number, json: unknown, key: string, expected: number): { ok: boolean; error?: string } {
  const code = readCode(json, key)
  if (code === undefined) return statusOk(status)
  if (code === expected) return { ok: true }
  const msg = readField(json, 'message') ?? readField(json, 'msg') ?? readField(json, 'errmsg')
  return { ok: false, error: key + '=' + String(code) + (typeof msg === 'string' ? ' (' + msg + ')' : '') }
}

/** The connection plan and raw RFC822 message for one SMTP channel. */
export interface SmtpPlan {
  readonly host: string
  readonly port: number
  readonly secure: 'ssl' | 'starttls' | 'none'
  readonly user: string
  readonly pass: string
  readonly from: string
  readonly to: readonly string[]
  readonly data: string
}

/** base64 one UTF-8 string, wrapped at 76 chars for the body. */
function wrapBase64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n')
}

/**
 * Build the SMTP connection plan and the raw RFC822 message.
 * @param channel - the configured smtp channel.
 * @param message - the message to send.
 * @returns everything {@link defaultSmtpDeliver} needs.
 * @throws {ChannelBuildError} when the config is unusable.
 */
export function buildSmtpPlan(channel: ChannelConfig, message: PushMessage): SmtpPlan {
  const f = (key: string): string => fieldValue(channel, key)
  const host = need(channel, 'host', 'smtp host')
  const port = Number(need(channel, 'port', 'smtp port'))
  if (!Number.isFinite(port) || port < 1 || port > 65535) throw new ChannelBuildError('bad smtp port')
  const secure = f('secure') === 'starttls' ? 'starttls' : f('secure') === 'none' ? 'none' : 'ssl'
  const from = need(channel, 'from', 'from address')
  const to = need(channel, 'to', 'to address')
    .split(/[,;]/)
    .map(part => part.trim())
    .filter(part => part !== '')
  if (to.length === 0) throw new ChannelBuildError('no recipient')
  const user = f('user')
  const pass = f('pass')
  const headers = [
    'From: ' + from,
    'To: ' + to.join(', '),
    'Subject: =?UTF-8?B?' + Buffer.from(message.title, 'utf8').toString('base64') + '?=',
    'Date: ' + new Date(message.timestamp).toUTCString(),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ]
  const body = wrapBase64(joinedText(message))
  const data = headers.join('\r\n') + '\r\n\r\n' + body + '\r\n'
  return { host, port, secure, user, pass, from, to, data }
}

/**
 * A line-oriented SMTP session whose socket can be upgraded to TLS mid-talk.
 *
 * STARTTLS (port 587) and implicit TLS (port 465) differ only in when the
 * socket becomes encrypted: 465 starts encrypted, 587 starts plain then the
 * STARTTLS command upgrades the *same* connection. This class owns the reply
 * buffer so the upgrade can swap the socket without losing a queued reply.
 */
class SmtpSession {
  private socket: Socket
  private buffer = ''
  private replies: string[] = []
  private waiter: { resolve: (reply: string) => void; reject: (error: Error) => void } | null = null
  private failure: Error | null = null

  constructor(socket: Socket) {
    this.socket = socket
    this.attach(socket)
  }

  private attach(socket: Socket): void {
    socket.on('data', this.onData)
    socket.on('error', this.onError)
    socket.on('close', this.onClose)
  }

  private detach(socket: Socket): void {
    socket.removeListener('data', this.onData)
    socket.removeListener('error', this.onError)
    socket.removeListener('close', this.onClose)
  }

  private onData = (chunk: Buffer): void => {
    this.buffer += chunk.toString('utf8')
    // A reply ends on a line whose 4th char is a space ("250 OK", not
    // "250-STARTTLS"), so a multi-line reply is delivered as one block.
    let index = this.buffer.indexOf('\n')
    while (index >= 0) {
      const line = this.buffer.slice(0, index + 1)
      this.buffer = this.buffer.slice(index + 1)
      if (/^\d{3} /.test(line) || /^\d{3}\r?\n$/.test(line)) this.pushReply(line.replace(/\r?\n$/, ''))
      index = this.buffer.indexOf('\n')
    }
  }

  private pushReply(reply: string): void {
    if (this.waiter !== null) {
      const waiter = this.waiter
      this.waiter = null
      waiter.resolve(reply)
    } else {
      this.replies.push(reply)
    }
  }

  private onError = (error: Error): void => {
    this.fail(error)
  }

  private onClose = (): void => {
    this.fail(new Error('connection closed by server'))
  }

  private fail(error: Error): void {
    if (this.failure !== null) return
    this.failure = error
    if (this.waiter !== null) {
      const waiter = this.waiter
      this.waiter = null
      waiter.reject(error)
    }
  }

  readReply(): Promise<string> {
    if (this.failure !== null) return Promise.reject(this.failure)
    const queued = this.replies.shift()
    if (queued !== undefined) return Promise.resolve(queued)
    return new Promise((resolve, reject) => {
      this.waiter = { resolve, reject }
    })
  }

  write(line: string): void {
    this.socket.write(line + '\r\n')
  }

  async command(line: string, expect: string): Promise<void> {
    this.write(line)
    const reply = await this.readReply()
    if (!reply.startsWith(expect)) throw new Error('smtp: expected ' + expect + ', got ' + reply)
  }

  /** Upgrade the plain connection to TLS (the STARTTLS handshake). */
  async upgradeTls(host: string): Promise<void> {
    const plain = this.socket
    this.detach(plain)
    const secure = tlsConnect({ socket: plain, host, servername: host })
    this.socket = secure
    await new Promise<void>((resolve, reject) => {
      secure.once('secureConnect', () => resolve())
      secure.once('error', (error: Error) => reject(error))
    })
    this.attach(secure)
  }

  end(): void {
    this.socket.end()
  }
}

/** Connect and deliver one SMTP message. */
async function deliverSmtp(plan: SmtpPlan): Promise<void> {
  const socket = plan.secure === 'ssl'
    ? tlsConnect({ host: plan.host, port: plan.port })
    : netConnect({ host: plan.host, port: plan.port })
  await new Promise<void>((resolve, reject) => {
    socket.once(plan.secure === 'ssl' ? 'secureConnect' : 'connect', () => resolve())
    socket.once('error', (error: Error) => reject(error))
  })
  const session = new SmtpSession(socket)
  try {
    const greeting = await session.readReply()
    if (!greeting.startsWith('220')) throw new Error('smtp: bad greeting ' + greeting)
    await session.command('EHLO dsh-notify-desktop', '250')
    if (plan.secure === 'starttls') {
      await session.command('STARTTLS', '220')
      await session.upgradeTls(plan.host)
      await session.command('EHLO dsh-notify-desktop', '250')
    }
    if (plan.user !== '') {
      await session.command('AUTH LOGIN', '334')
      await session.command(Buffer.from(plan.user, 'utf8').toString('base64'), '334')
      await session.command(Buffer.from(plan.pass, 'utf8').toString('base64'), '235')
    }
    await session.command('MAIL FROM:<' + plan.from + '>', '250')
    for (const recipient of plan.to) await session.command('RCPT TO:<' + recipient + '>', '250')
    await session.command('DATA', '354')
    session.write(plan.data.replace(/\r\n\./g, '\r\n..') + '.')
    const done = await session.readReply()
    if (!done.startsWith('250')) throw new Error('smtp: DATA refused ' + done)
    session.write('QUIT')
  } finally {
    session.end()
  }
}

/** The default SMTP delivery (overridable by `options.smtpDeliver`). */
async function defaultSmtpDeliver(channel: ChannelConfig, message: PushMessage): Promise<void> {
  await deliverSmtp(buildSmtpPlan(channel, message))
}

/** Parse a response body as JSON (null when it is not JSON). */
async function readJson(response: FetchResponseLike): Promise<unknown> {
  try {
    const text = await response.text()
    if (text.trim() === '') return null
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** Race a promise against a timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout after ' + String(ms) + 'ms')), ms)
    promise.then(value => {
      clearTimeout(timer)
      resolve(value)
    }, (error: unknown) => {
      clearTimeout(timer)
      reject(error instanceof Error ? error : new Error(String(error)))
    })
  })
}

/** The label a receipt carries (the user label, or the bare type). */
function receiptLabel(channel: ChannelConfig): string {
  return channel.label !== '' ? channel.label : channelTypeKey(channel.type)
}

/**
 * Deliver one message to one channel, never throwing.
 * @param channel - the channel to use.
 * @param message - the message to deliver.
 * @param options - fetch/timeout/clock/smtp seams.
 * @returns the per-channel receipt.
 */
export async function sendToChannel(
  channel: ChannelConfig,
  message: PushMessage,
  options: DispatchOptions = {},
): Promise<ChannelReceipt> {
  const id = channel.id
  const type = channel.type
  const label = receiptLabel(channel)
  const timeoutMs = options.timeoutMs ?? 15000
  try {
    const effective = effectiveMessage(channel, message)
    if (channel.type === 'smtp') {
      const deliver = options.smtpDeliver ?? defaultSmtpDeliver
      await withTimeout(deliver(channel, effective), timeoutMs)
      return { id, type, label, ok: true }
    }
    const now = options.now ?? Date.now()
    const call = buildHttpCall(channel, effective, now)
    const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike | undefined)
    if (fetchImpl === undefined) return { id, type, label, ok: false, error: 'no fetch available' }
    const init: { method: string; headers: Record<string, string>; body?: string } = { method: call.method, headers: { ...call.headers } }
    if (call.body !== undefined) init.body = call.body
    const response = await withTimeout(fetchImpl(call.url, init), timeoutMs)
    const verdict = call.check === undefined ? statusOk(response.status) : call.check(response.status, await readJson(response))
    return { id, type, label, ok: verdict.ok, status: response.status, ...(verdict.error === undefined ? {} : { error: verdict.error }) }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { id, type, label, ok: false, error: reason }
  }
}

/**
 * Deliver one message to every channel, concurrently, isolating failures.
 * @param channels - the channels to use (disabled ones are skipped).
 * @param message - the message to deliver.
 * @param options - fetch/timeout/clock/smtp seams.
 * @returns one receipt per enabled channel.
 */
export async function dispatchChannels(
  channels: readonly ChannelConfig[],
  message: PushMessage,
  options: DispatchOptions = {},
): Promise<ChannelReceipt[]> {
  const enabled = channels.filter(channel =>
    channel.enabled && (channel.scenarios.length === 0 || channel.scenarios.includes(message.scenario)))
  return Promise.all(enabled.map(channel => sendToChannel(channel, message, options)))
}
