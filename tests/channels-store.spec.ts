import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { channelsFile, deleteChannel, readChannels, saveChannel } from '../src/channels-store.ts'

let root = ''

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'dsh-channels-'))
})

afterEach(() => {
  try {
    rmSync(root, { recursive: true, force: true })
  } catch {
    // best effort
  }
})

describe('channels store', () => {
  it('reads an absent file as an empty list', () => {
    expect(readChannels(root)).toEqual([])
  })

  it('saves a valid channel, generating an id, and persists it', () => {
    const result = saveChannel(root, { type: 'webhook', enabled: true, label: 'mine', fields: { url: 'https://x' } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.channel.id.startsWith('ch_')).toBe(true)
    expect(result.channel.label).toBe('mine')
    const reread = readChannels(root)
    expect(reread).toHaveLength(1)
    expect(reread[0]?.fields['url']).toBe('https://x')
    expect(channelsFile(root).endsWith('channels.json')).toBe(true)
  })

  it('refuses a channel missing a required field', () => {
    const result = saveChannel(root, { type: 'webhook', enabled: true, fields: {} })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problem).toBe('fields')
    expect(result.missing).toContain('url')
  })

  it('refuses an unknown channel type', () => {
    const result = saveChannel(root, { type: 'carrier-pigeon', fields: {} })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problem).toBe('type')
  })

  it('updates an existing channel by id', () => {
    const first = saveChannel(root, { type: 'bark', enabled: true, label: 'a', fields: { deviceKey: 'K' } })
    if (!first.ok) throw new Error('seed failed')
    const updated = saveChannel(root, { id: first.channel.id, type: 'bark', enabled: false, label: 'b', fields: { deviceKey: 'K2' } })
    expect(updated.ok).toBe(true)
    const list = readChannels(root)
    expect(list).toHaveLength(1)
    expect(list[0]?.label).toBe('b')
    expect(list[0]?.enabled).toBe(false)
  })

  it('deletes by id and reports a missing one', () => {
    const first = saveChannel(root, { type: 'slack', enabled: true, fields: { url: 'https://x' } })
    if (!first.ok) throw new Error('seed failed')
    const removed = deleteChannel(root, first.channel.id)
    expect(removed.ok).toBe(true)
    expect(readChannels(root)).toHaveLength(0)
    expect(deleteChannel(root, 'ch_doesnotexist').ok).toBe(false)
  })

  it('drops unknown fields and keeps known ones', () => {
    const result = saveChannel(root, { type: 'bark', enabled: true, fields: { deviceKey: 'K', bogus: 'x' } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.channel.fields['deviceKey']).toBe('K')
    expect('bogus' in result.channel.fields).toBe(false)
  })

  it('tolerates a UTF-8 BOM written by an external editor', () => {
    const seeded = saveChannel(root, { type: 'bark', enabled: true, fields: { deviceKey: 'K' } })
    if (!seeded.ok) throw new Error('seed failed')
    const file = channelsFile(root)
    writeFileSync(file, '\uFEFF' + readFileSync(file, 'utf8'), 'utf8')
    expect(readChannels(root).map(channel => channel.id)).toEqual([seeded.channel.id])
  })
})
