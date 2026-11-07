import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renameSound } from '../src/index.ts'

describe('renaming an imported sound', () => {
  let root = ''
  let custom = ''

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'dsh-notify-rename-'))
    process.env['LOCALAPPDATA'] = root
    custom = join(root, 'dsh-notify', 'custom')
    mkdirSync(custom, { recursive: true })
    writeFileSync(join(custom, 'ding.mp3'), 'x')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('keeps the extension and a Chinese name', () => {
    expect(renameSound('custom:ding.mp3', '我的 铃声')).toEqual({ name: '我的 铃声.mp3' })
  })

  it('replaces only the characters Windows refuses', () => {
    expect(renameSound('custom:ding.mp3', 'a/b:c*?"<>|d')).toEqual({ name: 'a_b_c______d.mp3' })
  })

  it('adds the original extension when the user types one', () => {
    expect(renameSound('custom:ding.mp3', 'bell.MP3')).toEqual({ name: 'bell.mp3' })
  })

  it('refuses an empty name', () => {
    expect(renameSound('custom:ding.mp3', '   ')).toEqual({ problem: 'bad name' })
    expect(renameSound('custom:ding.mp3', '///')).toEqual({ problem: 'bad name' })
  })

  it('picks a free name when the target already exists', () => {
    writeFileSync(join(custom, 'bell.mp3'), 'x')
    expect(renameSound('custom:ding.mp3', 'bell')).toEqual({ name: 'bell 2.mp3' })
  })

  it('is a no-op when the name does not change', () => {
    expect(renameSound('custom:ding.mp3', 'ding')).toEqual({ name: 'ding.mp3' })
  })

  it('rejects an unknown or missing sound', () => {
    expect(renameSound('author:ding.mp3', 'x')).toEqual({ problem: 'unknown sound' })
    expect(renameSound('custom:gone.mp3', 'x')).toEqual({ problem: 'missing' })
  })
})
