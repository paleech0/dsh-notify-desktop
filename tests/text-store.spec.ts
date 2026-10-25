import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SCENARIO_IDS } from '../src/scenarios.ts'
import {
  deleteTextTemplate,
  readTextLibrary,
  saveTextTemplate,
  textTemplateDir,
  textTemplateFile,
  writeTextLibrary,
} from '../src/text-store.ts'

let roots: string[] = []

/** A throwaway app-data root. */
function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-notify-test-'))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
  roots = []
})

describe('host text-template store', () => {
  it('reads a missing file as an empty library with every situation present', () => {
    const root = tempRoot()
    const library = readTextLibrary(root)
    for (const scenario of SCENARIO_IDS) expect(library[scenario]).toEqual([])
  })

  it('saves a template to disk and reads it back', () => {
    const root = tempRoot()
    const saved = saveTextTemplate(root, 'completed', { name: '简洁版', title: '{工作区}', body: '好了：{内容}' }, undefined)
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.template.id).toMatch(/^t_[a-z0-9]+$/i)
    const file = JSON.parse(readFileSync(textTemplateFile(root), 'utf8')) as { version: number }
    expect(file.version).toBe(1)
    const library = readTextLibrary(root)
    expect(library['completed']).toHaveLength(1)
    expect(library['completed'][0]?.name).toBe('简洁版')
    // Every other situation is untouched.
    expect(library['error']).toEqual([])
  })

  it('caps one situation at three templates', () => {
    const root = tempRoot()
    for (let index = 1; index <= 3; index += 1) {
      const saved = saveTextTemplate(root, 'error', { name: 'T' + String(index), title: 't', body: 'b' }, undefined)
      expect(saved.ok).toBe(true)
    }
    const fourth = saveTextTemplate(root, 'error', { name: 'T4', title: 't', body: 'b' }, undefined)
    expect(fourth.ok).toBe(false)
    if (!fourth.ok) expect(fourth.problem).toBe('limit')
    expect(readTextLibrary(root)['error']).toHaveLength(3)
  })

  it('updates an existing template in place', () => {
    const root = tempRoot()
    const saved = saveTextTemplate(root, 'question', { name: 'A', title: 't', body: 'b' }, undefined)
    if (!saved.ok) throw new Error('save failed')
    const updated = saveTextTemplate(root, 'question', { name: 'B', title: 't2', body: 'b2' }, saved.template.id)
    expect(updated.ok).toBe(true)
    if (!updated.ok) return
    expect(updated.template.id).toBe(saved.template.id)
    expect(updated.template.name).toBe('B')
    expect(readTextLibrary(root)['question']).toHaveLength(1)
  })

  it('validates the scenario, the draft and the id', () => {
    const root = tempRoot()
    expect(saveTextTemplate(root, 'nope', { name: 'n', title: 't', body: 'b' }, undefined)).toMatchObject({ ok: false, problem: 'scenario' })
    expect(saveTextTemplate(root, 'completed', { name: ' ', title: 't', body: 'b' }, undefined)).toMatchObject({ ok: false, problem: 'name' })
    expect(saveTextTemplate(root, 'completed', { name: 'n', title: '', body: 'b' }, undefined)).toMatchObject({ ok: false, problem: 'title' })
    expect(saveTextTemplate(root, 'completed', { name: 'n', title: 't', body: ' ' }, undefined)).toMatchObject({ ok: false, problem: 'body' })
    expect(saveTextTemplate(root, 'completed', { name: 'n', title: 't', body: 'b' }, 'bogus')).toMatchObject({ ok: false, problem: 'missing' })
    expect(deleteTextTemplate(root, 'completed', 'bogus')).toMatchObject({ ok: false, problem: 'missing' })
  })

  it('deletes a template and answers with the new library', () => {
    const root = tempRoot()
    const saved = saveTextTemplate(root, 'reminder', { name: '催办A', title: '{状态}', body: '{内容}' }, undefined)
    if (!saved.ok) throw new Error('save failed')
    const removed = deleteTextTemplate(root, 'reminder', saved.template.id)
    expect(removed.ok).toBe(true)
    expect(readTextLibrary(root)['reminder']).toEqual([])
  })

  it('reads a corrupt file as empty and recovers on the next write', () => {
    const root = tempRoot()
    mkdirSync(textTemplateDir(root), { recursive: true })
    writeFileSync(textTemplateFile(root), '{not json', 'utf8')
    expect(readTextLibrary(root)['completed']).toEqual([])
    const saved = saveTextTemplate(root, 'completed', { name: 'n', title: 't', body: 'b' }, undefined)
    expect(saved.ok).toBe(true)
    expect(readTextLibrary(root)['completed']).toHaveLength(1)
  })

  it('drops malformed entries and caps an over-long stored list', () => {
    const root = tempRoot()
    mkdirSync(textTemplateDir(root), { recursive: true })
    const entry = (index: number) => ({ id: 't_' + String(index).padStart(6, '0'), name: 'N' + String(index), title: 't', body: 'b', updatedAt: 1 })
    writeFileSync(textTemplateFile(root), JSON.stringify({
      version: 1,
      scenarios: {
        completed: [entry(1), entry(2), 'nope', { id: 'bogus' }, entry(3), entry(4)],
      },
    }), 'utf8')
    const library = readTextLibrary(root)
    expect(library['completed']).toHaveLength(3)
    expect(library['completed'].map(template => template.name)).toEqual(['N1', 'N2', 'N3'])
  })

  it('writes valid JSON through the direct writer too', () => {
    const root = tempRoot()
    const library = {
      ...readTextLibrary(root),
      approval: [{ id: 't_abcdef', name: 'n', title: 't', body: 'b', updatedAt: 5 }],
    }
    expect(writeTextLibrary(root, library)).toBe(true)
    expect(readTextLibrary(root)['approval']).toHaveLength(1)
  })
})
