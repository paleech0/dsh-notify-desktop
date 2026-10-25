import { describe, expect, it } from 'vitest'
import { SUMMARY_LIMIT, plainSummary, workspaceName } from '../src/client/summary.ts'

describe('toast copy', () => {
  it('flattens markdown into one readable line', () => {
    const markdown = [
      '# 标题',
      '',
      '**加粗** 与 *斜体* 与 `内联代码`',
      '',
      '- 列表项一',
      '- 列表项二',
      '',
      '> 引用',
      '',
      '| a | b |',
      '| - | - |',
      '| 1 | 2 |',
      '',
      '```ts',
      'const hidden = true',
      '```',
      '',
      '[链接](https://example.com) 和 <b>html</b>',
    ].join('\n')
    const flat = plainSummary(markdown)
    expect(flat).not.toContain('*')
    expect(flat).not.toContain('|')
    expect(flat).not.toContain('#')
    expect(flat).not.toContain('`')
    expect(flat).not.toContain('hidden')
    expect(flat).toContain('加粗')
    expect(flat).toContain('列表项一')
    expect(flat).toContain('链接')
    expect(flat).toContain('html')
    expect(flat.split('\n')).toHaveLength(1)
  })

  it('collapses whitespace and bounds the length', () => {
    expect(plainSummary('  a\n\n   b  ')).toBe('a b')
    const bounded = plainSummary('甲'.repeat(500))
    expect(bounded.length).toBe(SUMMARY_LIMIT - 1)
    expect(bounded.endsWith('…')).toBe(true)
  })

  it('keeps short text untouched, without an ellipsis', () => {
    expect(plainSummary('这一轮已经完成')).toBe('这一轮已经完成')
    expect(plainSummary('')).toBe('')
  })

  it('fills the three lines and puts the ellipsis where the last two characters would be', () => {
    const body = plainSummary('甲'.repeat(200))
    expect(body).toBe('甲'.repeat(SUMMARY_LIMIT - 2) + '…')
    expect(body.length).toBe(SUMMARY_LIMIT - 1)
  })

  it('never slices an ASCII word in half', () => {
    const text = '甲'.repeat(70) + 'Windows 直接截断'
    const body = plainSummary(text)
    expect(body.endsWith('…')).toBe(true)
    expect(body).not.toMatch(/[A-Za-z]…$/)
    expect(body.length).toBeLessThanOrEqual(SUMMARY_LIMIT)
  })

  it('names the workspace from the session directory', () => {
    expect(workspaceName('D:\\projects\\notification plugin')).toBe('notification plugin')
    expect(workspaceName('C:/work/my-tool/')).toBe('my-tool')
    expect(workspaceName(undefined)).toBe('')
  })
})
