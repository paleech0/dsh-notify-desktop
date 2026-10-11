import { describe, expect, it } from 'vitest'
import { ASK_TWIN_MS, askKey, recentlyKeyed } from '../src/client/runner.ts'

describe('cross-source ask dedupe', () => {
  it('keys an ask by its summary prefix alone', () => {
    expect(askKey('依赖安装许可')).toBe('ask:依赖安装许可')
    expect(askKey('甲'.repeat(100))).toHaveLength('ask:'.length + 40)
  })

  it('treats a twin inside the window as recent', () => {
    const recent = new Map<string, number>([[askKey('q'), 1_000]])
    expect(recentlyKeyed(recent, askKey('q'), 1_000 + ASK_TWIN_MS - 1, ASK_TWIN_MS)).toBe(true)
    expect(recentlyKeyed(recent, askKey('q'), 1_000 + ASK_TWIN_MS, ASK_TWIN_MS)).toBe(false)
    expect(recentlyKeyed(recent, askKey('other'), 1_100, ASK_TWIN_MS)).toBe(false)
  })
})
