import { describe, expect, it } from 'vitest'
import {
  AUMID_CANDIDATES,
  REGISTERED_IDENTITY_ID,
  aumidCandidates,
  parseAumidLine,
} from '../src/aumid.ts'

describe('toast identity candidates', () => {
  it('prefers the registered manifest id and keeps the legacy id as fallback', () => {
    expect([...AUMID_CANDIDATES]).toEqual([
      'com.deepseek.dsh',
      'electron.app.DeepSeek Harness',
    ])
  })

  it('registers exactly the id the candidate list prefers', () => {
    expect(REGISTERED_IDENTITY_ID).toBe(AUMID_CANDIDATES[0])
  })

  it('uses an override list in the order it was written', () => {
    expect(aumidCandidates('first.id;second.id')).toEqual(['first.id', 'second.id'])
  })

  it('ignores blank override entries and falls back to the built-in list', () => {
    expect(aumidCandidates(' ;  ; ')).toEqual([...AUMID_CANDIDATES])
    expect(aumidCandidates(undefined)).toEqual([...AUMID_CANDIDATES])
  })
})

describe('toast child output parsing', () => {
  it('reads the identity the child chose', () => {
    expect(parseAumidLine('\nDSH_NOTIFY_AUMID=com.deepseek.dsh\r\n')).toBe(
      'com.deepseek.dsh',
    )
  })

  it('returns undefined when the child printed no identity', () => {
    expect(parseAumidLine('nothing here')).toBeUndefined()
    expect(parseAumidLine('DSH_NOTIFY_AUMID=\r\n')).toBeUndefined()
  })
})
