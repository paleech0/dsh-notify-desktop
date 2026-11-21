import { describe, expect, it } from 'vitest'
import {
  buildHttpCall,
  buildSmtpPlan,
  ChannelBuildError,
  dispatchChannels,
  sendToChannel,
  type FetchLike,
} from '../src/channel-send.ts'
import { detectChannelValue, type ChannelConfig, type ChannelType, type PushMessage } from '../src/channels.ts'

/** A configured channel for the tests. */
function ch(type: ChannelType, fields: Record<string, string>, extra: Partial<ChannelConfig> = {}): ChannelConfig {
  return {
    id: 'ch_abcdef123456',
    type,
    enabled: true,
    label: '',
    fields,
    scenarios: [],
    titleTemplate: '',
    bodyTemplate: '',
    markdown: false,
    ...extra,
  }
}

/** One message. */
const message: PushMessage = {
  title: 'T',
  body: 'B',
  level: 'info',
  scenario: 'completed',
  source: 'proj',
  timestamp: 1_700_000_000_000,
  vars: { '工作区': 'proj', '状态': 'done', '内容': 'B', '分钟': '' },
}

/** A fetch stub returning a fixed status/text, optionally recording calls. */
function stubFetch(status: number, body: string, sink?: (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => void): FetchLike {
  return async (url, init) => {
    sink?.(url, init)
    return { status, text: async () => body }
  }
}

describe('channel dispatch — request shapes', () => {
  it('builds a generic webhook POST with a JSON envelope', () => {
    const call = buildHttpCall(ch('webhook', { url: 'https://example.com/hook' }), message, 0)
    expect(call.url).toBe('https://example.com/hook')
    expect(call.method).toBe('POST')
    const body = JSON.parse(call.body as string)
    expect(body.title).toBe('T')
    expect(body.message).toBe('B')
    expect(body.level).toBe('info')
  })

  it('merges custom webhook headers from JSON', () => {
    const call = buildHttpCall(ch('webhook', { url: 'https://x', headers: '{"Authorization":"Bearer k"}' }), message, 0)
    expect(call.headers['Authorization']).toBe('Bearer k')
  })

  it('refuses a channel missing a required field', () => {
    expect(() => buildHttpCall(ch('webhook', {}), message, 0)).toThrow(ChannelBuildError)
  })

  it('builds bark from the device key and default server', () => {
    expect(buildHttpCall(ch('bark', { deviceKey: 'KEY' }), message, 0).url).toBe('https://api.day.app/KEY')
    expect(buildHttpCall(ch('bark', { deviceKey: 'KEY', server: 'https://bark.local/' }), message, 0).url).toBe('https://bark.local/KEY')
  })

  it('builds serverchan Turbo with a form body', () => {
    const call = buildHttpCall(ch('serverchan', { sendKey: 'SCT123' }), message, 0)
    expect(call.url).toBe('https://sctapi.ftqq.com/SCT123.send')
    expect(call.body).toContain('title=T')
    expect(call.body).toContain('desp=')
  })

  it('routes a Server酱³ sctp key to push.ft07.com', () => {
    expect(buildHttpCall(ch('serverchan', { sendKey: 'sctp123tABC' }), message, 0).url).toBe('https://123.push.ft07.com/send/sctp123tABC.send')
    expect(() => buildHttpCall(ch('serverchan', { sendKey: 'sctpBAD' }), message, 0)).toThrow(ChannelBuildError)
  })

  it('builds pushplus and wecom payloads', () => {
    expect(buildHttpCall(ch('pushplus', { token: 'tk' }), message, 0).url).toBe('https://www.pushplus.plus/send')
    const wecom = buildHttpCall(ch('wecom', { key: 'k' }), message, 0)
    expect(wecom.url).toBe('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=k')
    expect(JSON.parse(wecom.body as string).msgtype).toBe('text')
  })

  it('signs dingtalk when a secret is present', () => {
    const call = buildHttpCall(ch('dingtalk', { url: 'https://oapi.dingtalk.com/robot/send?access_token=x', secret: 'SEC' }), message, 1_000_000)
    expect(call.url).toContain('timestamp=1000000')
    expect(call.url).toContain('&sign=')
  })

  it('signs feishu when a secret is present', () => {
    const payload = JSON.parse(buildHttpCall(ch('feishu', { url: 'https://open.feishu.cn/hook/x', secret: 'SEC' }), message, 1_000_000).body as string)
    expect(payload.msg_type).toBe('text')
    expect(typeof payload.sign).toBe('string')
    expect(payload.timestamp).toBe('1000')
  })

  it('builds telegram, ntfy, gotify, slack, discord', () => {
    expect(buildHttpCall(ch('telegram', { botToken: 'BOT', chatId: '42' }), message, 0).url).toBe('https://api.telegram.org/botBOT/sendMessage')
    const ntfy = buildHttpCall(ch('ntfy', { topic: 'topic' }), message, 0)
    expect(ntfy.url).toBe('https://ntfy.sh/topic')
    expect(ntfy.headers['Title']).toBe('T')
    const gotify = buildHttpCall(ch('gotify', { server: 'https://gotify.x', token: 'tk' }), message, 0)
    expect(gotify.url).toBe('https://gotify.x/message?token=tk')
    expect(JSON.parse(gotify.body as string).priority).toBe(3)
    expect(buildHttpCall(ch('slack', { url: 'https://hooks.slack/x' }), message, 0).url).toBe('https://hooks.slack/x')
    expect(JSON.parse(buildHttpCall(ch('discord', { url: 'https://discord/x' }), message, 0).body as string).content).toContain('T')
  })

  it('builds wxpusher and pushdeer', () => {
    const wx = buildHttpCall(ch('wxpusher', { appToken: 'AT_x', uid: 'UID_1' }), message, 0)
    expect(JSON.parse(wx.body as string).uids).toEqual(['UID_1'])
    const pd = buildHttpCall(ch('pushdeer', { pushKey: 'PK' }), message, 0)
    expect(pd.url).toBe('https://api2.pushdeer.com/message/push')
    expect(pd.body).toContain('pushkey=PK')
  })

  it('builds an SMTP plan with a base64 message', () => {
    const plan = buildSmtpPlan(ch('smtp', { host: 'smtp.x', port: '465', secure: 'ssl', from: 'a@x', to: 'b@x, c@x' }), message)
    expect(plan.port).toBe(465)
    expect(plan.secure).toBe('ssl')
    expect(plan.to).toEqual(['b@x', 'c@x'])
    expect(plan.data).toContain('Subject: =?UTF-8?B?')
    expect(plan.data).toContain('Content-Transfer-Encoding: base64')
  })
})

describe('channel dispatch — delivery and business codes', () => {
  it('treats wecom errcode 0 as success and non-zero as failure', async () => {
    const ok = await sendToChannel(ch('wecom', { key: 'k' }), message, { fetchImpl: stubFetch(200, '{"errcode":0}') })
    expect(ok.ok).toBe(true)
    const bad = await sendToChannel(ch('wecom', { key: 'k' }), message, { fetchImpl: stubFetch(200, '{"errcode":40000,"errmsg":"bad"}') })
    expect(bad.ok).toBe(false)
    expect(bad.error).toContain('errcode')
  })

  it('treats telegram ok:false as failure', async () => {
    const r = await sendToChannel(ch('telegram', { botToken: 'B', chatId: '1' }), message, { fetchImpl: stubFetch(200, '{"ok":false,"description":"chat not found"}') })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('chat not found')
  })

  it('skips disabled channels and isolates one failing channel', async () => {
    const channels = [
      ch('wecom', { key: 'k' }, { id: 'ch_aaaaaaaaaaaa' }),
      ch('slack', { url: 'https://hooks.slack/x' }, { id: 'ch_bbbbbbbbbbbb' }),
      ch('discord', { url: 'https://discord/x' }, { id: 'ch_cccccccccccc', enabled: false }),
    ]
    const fetchImpl: FetchLike = async url => {
      if (url.includes('qyapi')) return { status: 200, text: async () => '{"errcode":0}' }
      return { status: 500, text: async () => 'boom' }
    }
    const receipts = await dispatchChannels(channels, message, { fetchImpl })
    expect(receipts).toHaveLength(2)
    expect(receipts.find(r => r.id === 'ch_aaaaaaaaaaaa')?.ok).toBe(true)
    expect(receipts.find(r => r.id === 'ch_bbbbbbbbbbbb')?.ok).toBe(false)
  })

  it('times out a hung request', async () => {
    const slow: FetchLike = () => new Promise(resolve => setTimeout(() => resolve({ status: 200, text: async () => '{}' }), 300))
    const r = await sendToChannel(ch('slack', { url: 'https://x' }), message, { fetchImpl: slow, timeoutMs: 20 })
    expect(r.ok).toBe(false)
    expect(String(r.error)).toContain('timeout')
  })

  it('delivers SMTP through the injected seam', async () => {
    let called = 0
    const ok = await sendToChannel(ch('smtp', { host: 'smtp.x', port: '465', secure: 'ssl', from: 'a@x', to: 'b@x' }), message, {
      smtpDeliver: async () => { called += 1 },
    })
    expect(ok.ok).toBe(true)
    expect(called).toBe(1)
    const bad = await sendToChannel(ch('smtp', { host: 'smtp.x', port: '465', secure: 'ssl', from: 'a@x', to: 'b@x' }), message, {
      smtpDeliver: async () => { throw new Error('auth failed') },
    })
    expect(bad.ok).toBe(false)
    expect(bad.error).toContain('auth failed')
  })
})

describe('channel dispatch — additional channels', () => {
  it('builds qmsg with key and optional qq', () => {
    const call = buildHttpCall(ch('qmsg', { key: 'K' }), message, 0)
    expect(call.url).toBe('https://qmsg.zendee.cn/send/K')
    expect(call.body).toContain('msg=')
    expect(buildHttpCall(ch('qmsg', { key: 'K', qq: '10001' }), message, 0).body).toContain('qq=10001')
  })

  it('builds meow against the default server', () => {
    expect(buildHttpCall(ch('meow', { nickname: 'nick' }), message, 0).url).toBe('https://api.chuckfang.com/nick')
  })

  it('builds kook with a Bot authorization header', () => {
    const call = buildHttpCall(ch('kook', { token: 'TKN', targetId: 'chan1' }), message, 0)
    expect(call.url).toBe('https://www.kookapp.cn/api/v3/message/create')
    expect(call.headers['Authorization']).toBe('Bot TKN')
  })

  it('builds onebot send_msg for private and group', () => {
    const priv = JSON.parse(buildHttpCall(ch('onebot', { server: 'http://127.0.0.1:5700', target: '123' }), message, 0).body as string)
    expect(priv.message_type).toBe('private')
    expect(priv.user_id).toBe(123)
    const grp = JSON.parse(buildHttpCall(ch('onebot', { server: 'http://x', messageType: 'group', target: '9' }), message, 0).body as string)
    expect(grp.message_type).toBe('group')
    expect(grp.group_id).toBe(9)
  })

  it('builds matrix with a bearer token and room path', () => {
    const call = buildHttpCall(ch('matrix', { server: 'https://mx.x', roomId: '!r:mx.x', token: 'AT' }), message, 0)
    expect(call.url).toContain('/_matrix/client/v3/rooms/')
    expect(call.headers['Authorization']).toBe('Bearer AT')
    expect(call.method).toBe('PUT')
  })

  it('builds pushover with a form body', () => {
    const call = buildHttpCall(ch('pushover', { token: 'app', user: 'u' }), message, 0)
    expect(call.url).toBe('https://api.pushover.net/1/messages.json')
    expect(call.body).toContain('token=app')
    expect(call.body).toContain('user=u')
  })

  it('sends wxpusher topicIds alongside uids', () => {
    const payload = JSON.parse(buildHttpCall(ch('wxpusher', { appToken: 'AT_x', topicIds: '123, 456' }), message, 0).body as string)
    expect(payload.topicIds).toEqual([123, 456])
    expect(payload.uids).toEqual([])
  })

  it('plans SMTP over STARTTLS on 587', () => {
    const plan = buildSmtpPlan(ch('smtp', { host: 'smtp.x', port: '587', secure: 'starttls', from: 'a@x', to: 'b@x' }), message)
    expect(plan.secure).toBe('starttls')
    expect(plan.port).toBe(587)
  })

  it('defaults smtp encryption to ssl when the field is blank', () => {
    const plan = buildSmtpPlan(ch('smtp', { host: 'smtp.x', port: '465', from: 'a@x', to: 'b@x' }), message)
    expect(plan.secure).toBe('ssl')
  })
})

describe('channel dispatch — format & targeting', () => {
  it('applies a channel title/body template over the situation text', async () => {
    let captured = ''
    const channel = ch('wecom', { key: 'k' }, { titleTemplate: '{工作区} 通知', bodyTemplate: '{内容}（来自 {状态}）' })
    await sendToChannel(channel, message, {
      fetchImpl: async (_url, init) => {
        captured = init.body ?? ''
        return { status: 200, text: async () => '{"errcode":0}' }
      },
    })
    const content = JSON.parse(captured).text.content as string
    expect(content).toContain('proj 通知')
    expect(content).toContain('B（来自 done）')
  })

  it('webhook sends a custom JSON body template', () => {
    const call = buildHttpCall(ch('webhook', { url: 'https://x', jsonBody: '{"text":"{title} :: {body}","lvl":"{level}"}' }), message, 0)
    const parsed = JSON.parse(call.body as string)
    expect(parsed.text).toBe('T :: B')
    expect(parsed.lvl).toBe('info')
  })

  it('webhook rejects a jsonBody that does not render to valid JSON', () => {
    expect(() => buildHttpCall(ch('webhook', { url: 'https://x', jsonBody: '{not json' }), message, 0)).toThrow(ChannelBuildError)
  })

  it('sends markdown where the channel supports it', () => {
    expect(JSON.parse(buildHttpCall(ch('wecom', { key: 'k' }, { markdown: true }), message, 0).body as string).msgtype).toBe('markdown')
    expect(JSON.parse(buildHttpCall(ch('dingtalk', { url: 'https://d' }, { markdown: true }), message, 0).body as string).msgtype).toBe('markdown')
    expect(JSON.parse(buildHttpCall(ch('feishu', { url: 'https://f' }, { markdown: true }), message, 0).body as string).msg_type).toBe('interactive')
  })

  it('skips channels whose scenario list excludes this situation', async () => {
    const errorOnly = ch('wecom', { key: 'k' }, { id: 'ch_aaaaaaaaaaaa', scenarios: ['error'] })
    const allCh = ch('slack', { url: 'https://s' }, { id: 'ch_bbbbbbbbbbbb' })
    const fetchImpl: FetchLike = async () => ({ status: 200, text: async () => '{"errcode":0}' })
    const completed = await dispatchChannels([errorOnly, allCh], message, { fetchImpl })
    expect(completed.map(r => r.id)).toEqual(['ch_bbbbbbbbbbbb'])
    const errored = await dispatchChannels([errorOnly, allCh], { ...message, scenario: 'error' }, { fetchImpl })
    expect(errored).toHaveLength(2)
  })

  it('keeps a non-ASCII title out of the ntfy header', () => {
    const call = buildHttpCall(ch('ntfy', { topic: 't' }), { ...message, title: '工作区 · 任务完成' }, 0)
    expect(call.headers['Title']).toBeUndefined()
    expect(call.body).toContain('工作区 · 任务完成')
  })
})

describe('channel auto-detection', () => {
  it('recognizes group-bot webhooks by host', () => {
    expect(detectChannelValue('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=K')?.type).toBe('wecom')
    expect(detectChannelValue('https://oapi.dingtalk.com/robot/send?access_token=X')?.type).toBe('dingtalk')
    expect(detectChannelValue('https://open.feishu.cn/open-apis/bot/v2/hook/Y')?.type).toBe('feishu')
    expect(detectChannelValue('https://hooks.slack.com/services/T/B/X')?.type).toBe('slack')
    expect(detectChannelValue('https://discord.com/api/webhooks/1/2')?.type).toBe('discord')
  })

  it('recognizes Server酱 / Bark / ntfy / Qmsg / Gotify URLs', () => {
    expect(detectChannelValue('https://sctapi.ftqq.com/SCT123.send')?.fields['sendKey']).toBe('SCT123')
    expect(detectChannelValue('https://123.push.ft07.com/send/sctp123tABC.send')?.fields['sendKey']).toBe('sctp123tABC')
    expect(detectChannelValue('https://api.day.app/DEVKEY')?.fields['deviceKey']).toBe('DEVKEY')
    expect(detectChannelValue('https://ntfy.sh/mytopic')?.fields['topic']).toBe('mytopic')
    expect(detectChannelValue('https://qmsg.zendee.cn/send/K')?.fields['key']).toBe('K')
    expect(detectChannelValue('https://gotify.example.com/message?token=T')?.type).toBe('gotify')
  })

  it('recognizes bare prefixed keys and leaves console URLs unknown', () => {
    expect(detectChannelValue('SCT123')?.type).toBe('serverchan')
    expect(detectChannelValue('sctp123tABC')?.type).toBe('serverchan')
    expect(detectChannelValue('AT_abc123')?.type).toBe('wxpusher')
    expect(detectChannelValue('https://sct.ftqq.com/')).toBeNull()
    expect(detectChannelValue('随便什么')).toBeNull()
  })

  it('flags a telegram token that lacks a chat id', () => {
    const det = detectChannelValue('123456:AAbbCCddEEffGGhhIIjjKKllMMnnOOppQQ')
    expect(det?.type).toBe('telegram')
    expect(det?.missing).toContain('chatId')
  })

  it('falls back to webhook for any other URL and builds from auto', () => {
    expect(detectChannelValue('https://example.com/hook')?.type).toBe('webhook')
    const call = buildHttpCall(ch('auto', { value: 'https://oapi.dingtalk.com/robot/send?access_token=X' }), message, 0)
    expect(call.url).toBe('https://oapi.dingtalk.com/robot/send?access_token=X')
    expect(() => buildHttpCall(ch('auto', { value: '随便什么' }), message, 0)).toThrow(ChannelBuildError)
  })
})
