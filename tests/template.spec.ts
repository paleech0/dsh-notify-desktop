import { describe, expect, it } from 'vitest'
import { renderBody, renderTitle } from '../src/client/template.ts'

/** The live values the tests render with. */
const parts = {
  workspace: 'dsh notify desktop',
  status: '任务完成',
  body: '通知重构完成，pnpm run check 全绿。',
}

describe('toast text templates', () => {
  it('renders the default templates exactly like the pre-template composition', () => {
    expect(renderTitle('{工作区} · {状态}', parts)).toBe('dsh notify desktop · 任务完成')
    expect(renderBody('{内容}', parts, 'fallback')).toBe('通知重构完成，pnpm run check 全绿。')
  })

  it('accepts the English token spellings too', () => {
    expect(renderTitle('{workspace} | {status}', parts)).toBe('dsh notify desktop | 任务完成')
    expect(renderBody('{body}', parts, 'fallback')).toBe('通知重构完成，pnpm run check 全绿。')
  })

  it('fills a user template in any order with any subset', () => {
    expect(renderTitle('【{状态}】{工作区}', parts)).toBe('【任务完成】dsh notify desktop')
    expect(renderBody('{工作区} 需要你：{内容}', parts, 'fallback')).toBe('dsh notify desktop 需要你：通知重构完成，pnpm run check 全绿。')
    expect(renderTitle('{状态}', parts)).toBe('任务完成')
  })

  it('fills the reminder minutes and drops the token outside reminders', () => {
    expect(renderBody('{内容}——已等 {分钟} 分钟', { ...parts, minutes: '10' }, 'fallback'))
      .toBe('通知重构完成，pnpm run check 全绿。——已等 10 分钟')
    // Outside reminders there is no minutes value: the token vanishes entirely.
    expect(renderBody('已等 {分钟} 分钟：{内容}', parts, 'fallback'))
      .toBe('已等  分钟：通知重构完成，pnpm run check 全绿。')
  })

  it('leaves unknown placeholders alone', () => {
    expect(renderTitle('{工作区} {不存在} {状态}', parts)).toBe('dsh notify desktop {不存在} 任务完成')
  })

  it('falls back to the status when a title template renders empty', () => {
    expect(renderTitle('{工作区}', { ...parts, workspace: '' })).toBe('任务完成')
  })

  it('falls back to the whole fallback line when the content is empty', () => {
    expect(renderBody('{工作区} 需要你：{内容}', { ...parts, body: '  ' }, '有一条待处理的确认。'))
      .toBe('有一条待处理的确认。')
    expect(renderBody('{内容}', { ...parts, body: '' }, 'fallback')).toBe('fallback')
  })

  it('collapses whitespace and bounds the workspace like the old title did', () => {
    const long = 'w'.repeat(60)
    const title = renderTitle('{工作区} · {状态}', { ...parts, workspace: long })
    expect(title.startsWith('w'.repeat(39) + '… · 任务完成')).toBe(true)
    expect(renderTitle('{工作区}', { ...parts, workspace: '  a   b  ' })).toBe('a b')
  })
})
