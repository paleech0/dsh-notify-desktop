import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  APP_USER_MODEL_ID_KEY_PREFIX,
  IDENTITY_DISPLAY_NAME,
  IDENTITY_ICON_FILE,
  REG_EXE,
  ensureToastIdentity,
  identityAddArgs,
  identityIconPath,
  identityKeyPath,
  identityValueWrites,
  parseRegQuery,
  type IdentityDeps,
  type IdentityState,
} from '../src/identity.ts'

/** One spawn call the fake recorded, so tests can pin argv shapes. */
interface FakeSpawnCall {
  file: string
  args: string[]
}

/** What one fake reg.exe child answers: its stdout and its exit code. */
interface SpawnAnswer {
  out: string
  code: number
}

/**
 * A spawn stand-in: every child answers with the next canned stdout and exit
 * code (the last one repeats), emitting `data` before `close` like the real
 * child does. Only `close` ever fires — these tests exercise the success and
 * the nonzero-exit paths, never a spawn error. Records every call for argv
 * assertions.
 */
function fakeSpawn(answers: SpawnAnswer[], calls: FakeSpawnCall[]): IdentityDeps['spawn'] {
  let index = 0
  const spawn = ((file: string, args: string[]) => {
    calls.push({ file, args })
    const answer = answers[Math.min(index, answers.length - 1)] ?? { out: '', code: 0 }
    index += 1
    const child = {
      stdout: { on: (_event: string, cb: (chunk: string) => void) => setImmediate(() => cb(answer.out)), resume: () => {} },
      stderr: { resume: () => {} },
      on: (event: string, cb: (code: number, error?: Error) => void) => {
        if (event !== 'close') return
        setImmediate(() => cb(answer.code))
      },
    }
    return child
  }) as unknown as IdentityDeps['spawn']
  return spawn
}

describe('identity constants', () => {
  it('registers under the per-user AppUserModelId table with reg.exe', () => {
    expect(REG_EXE).toMatch(/reg\.exe$/)
    expect(APP_USER_MODEL_ID_KEY_PREFIX).toContain('AppUserModelId')
    expect(identityKeyPath('com.deepseek.dsh')).toBe(
      APP_USER_MODEL_ID_KEY_PREFIX + 'com.deepseek.dsh',
    )
  })

  it('carries the display name and icon path the toast should show', () => {
    expect(IDENTITY_DISPLAY_NAME).toBe('DeepSeek Harness')
    expect(identityIconPath('C:\\pkg')).toBe('C:\\pkg\\assets\\dsh-icon.png')
    expect(IDENTITY_ICON_FILE).toContain('assets')
  })
})

describe('reg query parsing', () => {
  it('reads both values from a populated entry', () => {
    const out = [
      '',
      'HKEY_CURRENT_USER\\SOFTWARE\\Classes\\AppUserModelId\\com.deepseek.dsh',
      '    DisplayName    REG_SZ    DeepSeek Harness',
      '    IconUri    REG_SZ    C:\\Users\\me\\AppData\\Local\\Programs\\dsh-notify-desktop\\assets\\dsh-icon.png',
      '',
      '',
    ].join('\r\n')
    expect(parseRegQuery(out)).toEqual({
      displayName: 'DeepSeek Harness',
      iconUri: 'C:\\Users\\me\\AppData\\Local\\Programs\\dsh-notify-desktop\\assets\\dsh-icon.png',
    })
  })

  it('answers empty for an absent or empty entry', () => {
    expect(parseRegQuery('')).toEqual({})
    expect(parseRegQuery('ERROR: The system was unable to find the specified registry key or value.')).toEqual({})
    expect(parseRegQuery('    IconUri    REG_SZ    C:\\icon.png')).toEqual({
      displayName: undefined,
      iconUri: 'C:\\icon.png',
    })
  })
})

describe('identity value writes', () => {
  it('writes the display name whenever it is missing or drifted', () => {
    expect(identityValueWrites({}, IDENTITY_DISPLAY_NAME, undefined)).toEqual([
      { name: 'DisplayName', data: 'DeepSeek Harness' },
    ])
    expect(
      identityValueWrites({ displayName: 'com.deepseek.dsh' }, IDENTITY_DISPLAY_NAME, undefined),
    ).toEqual([{ name: 'DisplayName', data: 'DeepSeek Harness' }])
    expect(identityValueWrites({ displayName: IDENTITY_DISPLAY_NAME }, IDENTITY_DISPLAY_NAME, undefined)).toEqual([])
  })

  it('writes the icon only when the shipped asset exists and differs', () => {
    const icon = 'C:\\pkg\\assets\\dsh-icon.png'
    expect(identityValueWrites({}, IDENTITY_DISPLAY_NAME, icon)).toEqual([
      { name: 'DisplayName', data: 'DeepSeek Harness' },
      { name: 'IconUri', data: icon },
    ])
    expect(identityValueWrites({ displayName: IDENTITY_DISPLAY_NAME, iconUri: icon }, IDENTITY_DISPLAY_NAME, icon)).toEqual([])
    // No asset: never touch IconUri (the module deletes nothing).
    expect(identityValueWrites({}, IDENTITY_DISPLAY_NAME, undefined)).toEqual([
      { name: 'DisplayName', data: 'DeepSeek Harness' },
    ])
  })

  it('builds a static argv array for reg.exe', () => {
    expect(identityAddArgs('HKCU\\SOFTWARE\\x', { name: 'DisplayName', data: 'DeepSeek Harness' })).toEqual([
      'add',
      'HKCU\\SOFTWARE\\x',
      '/v',
      'DisplayName',
      '/t',
      'REG_SZ',
      '/d',
      'DeepSeek Harness',
      '/f',
    ])
  })
})

describe('ensureToastIdentity', () => {
  const run = async (answers: SpawnAnswer[], packageRoot = 'C:\\pkg'): Promise<{
    calls: FakeSpawnCall[]
    notes: string[]
    state: IdentityState | undefined
  }> => {
    const calls: FakeSpawnCall[] = []
    const notes: string[] = []
    let state: IdentityState | undefined
    await ensureToastIdentity({
      identityId: 'com.deepseek.dsh',
      packageRoot,
      note: line => notes.push(line),
      onState: reported => {
        state = reported
      },
      spawn: fakeSpawn(answers, calls),
    })
    return { calls, notes, state }
  }

  it.skipIf(process.platform !== 'win32')(
    'queries first and writes what the entry is missing, icon included when the asset ships',
    async () => {
      const root = mkdtempSync(join(tmpdir(), 'dsh-identity-'))
      try {
        mkdirSync(join(root, 'assets'), { recursive: true })
        writeFileSync(join(root, 'assets', 'dsh-icon.png'), 'png')
        const { calls, notes, state } = await run([
          { out: 'ERROR: The system was unable to find the specified registry key or value.\r\n', code: 1 },
          { out: '', code: 0 },
          { out: '', code: 0 },
        ], root)
        const keyPath = 'HKCU\\SOFTWARE\\Classes\\AppUserModelId\\com.deepseek.dsh'
        expect(calls[0]?.file).toBe(REG_EXE)
        expect(calls[0]?.args).toEqual(['query', keyPath])
        expect(calls.slice(1).map(call => call.args)).toEqual([
          ['add', keyPath, '/v', 'DisplayName', '/t', 'REG_SZ', '/d', 'DeepSeek Harness', '/f'],
          ['add', keyPath, '/v', 'IconUri', '/t', 'REG_SZ', '/d', join(root, 'assets', 'dsh-icon.png'), '/f'],
        ])
        expect(state?.registered).toBe(true)
        expect(state?.writes).toEqual(['DisplayName', 'IconUri'])
        expect(state?.iconPath).toBe(join(root, 'assets', 'dsh-icon.png'))
        expect(notes.join('\n')).toContain('identity registered')
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    },
  )

  it.skipIf(process.platform !== 'win32')(
    'writes the name alone when the icon asset is absent',
    async () => {
      const { calls, state } = await run([
        { out: '', code: 1 },
        { out: '', code: 0 },
      ])
      expect(calls).toHaveLength(2)
      expect(calls[1]?.args).toContain('DisplayName')
      expect(calls[1]?.args).not.toContain('IconUri')
      expect(state?.iconPath).toBeUndefined()
      expect(state?.writes).toEqual(['DisplayName'])
    },
  )

  it.skipIf(process.platform !== 'win32')(
    'writes nothing and reports current when the entry already matches',
    async () => {
      const { calls, notes, state } = await run([
        {
          out: '    DisplayName    REG_SZ    DeepSeek Harness\r\n    IconUri    REG_SZ    C:\\pkg\\assets\\dsh-icon.png\r\n',
          code: 0,
        },
      ])
      expect(calls).toHaveLength(1)
      expect(state?.registered).toBe(true)
      expect(state?.writes).toEqual([])
      expect(notes.join('\n')).toContain('identity current')
    },
  )

  it.skipIf(process.platform !== 'win32')(
    'stops at the first failed write and reports the failure',
    async () => {
      const { calls, notes, state } = await run([
        { out: '', code: 1 },
        { out: 'ACCESS IS DENIED.', code: 1 },
      ])
      expect(calls).toHaveLength(2)
      expect(state?.registered).toBe(false)
      expect(state?.error).toContain('DisplayName')
      expect(state?.writes).toEqual([])
      expect(notes.join('\n')).toContain('identity failed')
    },
  )
})
