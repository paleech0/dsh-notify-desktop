/**
 * The toast identity the host registers on this machine.
 *
 * Windows labels a toast with the application's name and icon only when it can
 * resolve the toast's AppUserModelID: a Start-menu shortcut carrying that id,
 * or a registry entry under `HKCU\SOFTWARE\Classes\AppUserModelId` with
 * `DisplayName` and `IconUri` values — the documented registration for
 * unpackaged Win32 apps, and the same table ToastNotificationManagerCompat and
 * BurntToast write. Measured on 2026-11-06 against DSH desktop 0.2.2-rc.1
 * (Windows 11 25H2): the installer now puts the manifest id on the Start-menu
 * shortcut, the legacy id has nothing left to resolve through, and
 * `CreateToastNotifier(...).Setting` reports `Enabled` for *both* — so the
 * old probe picks the legacy id and Windows falls back to labelling the toast
 * with the raw id string, no icon. This module closes that gap without
 * trusting the next installer: the host registers the manifest id itself,
 * with the app's display name and a shipped copy of the app icon, so the
 * identity resolves no matter which shortcut the last install left behind.
 *
 * Every machine touch goes through `reg.exe` with static argv arrays — the
 * same shape the sound-scheme reader already uses, and deliberately not a new
 * PowerShell spawn site (spawn sites are the resource a security hook watches).
 * Nothing here can fail the plugin: a machine that refuses the write still
 * toasts, just with the name resolved through whatever the shortcut carries.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** The registry tool, absolute like the PowerShell path in `index.ts`. */
export const REG_EXE = 'C:\\Windows\\System32\\reg.exe'

/**
 * The registry prefix of the per-user toast identity table. reg.exe takes the
 * root hive as part of the key path, so this is one string, not two args.
 */
export const APP_USER_MODEL_ID_KEY_PREFIX = 'HKCU\\SOFTWARE\\Classes\\AppUserModelId\\'

/**
 * The display name a toast shows under our identity: the desktop app's own
 * name, unchanged since the first release, so the popup reads as the app's.
 */
export const IDENTITY_DISPLAY_NAME = 'DeepSeek Harness'

/** The shipped copy of the app icon, under the package root. */
export const IDENTITY_ICON_FILE = join('assets', 'dsh-icon.png')

/**
 * Full reg.exe key path for one AppUserModelID.
 * @param id - the identity to register or read.
 * @returns the absolute registry path reg.exe accepts.
 */
export function identityKeyPath(id: string): string {
  return APP_USER_MODEL_ID_KEY_PREFIX + id
}

/**
 * Absolute path of the shipped icon asset inside one package root.
 * @param packageRoot - the directory that contains `assets/` (the repo at
 * dev time, the linked install at runtime — both resolve the same way).
 * @returns the absolute png path.
 */
export function identityIconPath(packageRoot: string): string {
  return join(packageRoot, IDENTITY_ICON_FILE)
}

/** The identity values a registry entry carries, as far as we read them. */
export interface IdentityValues {
  /** The value of `DisplayName`, when the entry has one. */
  displayName?: string
  /** The value of `IconUri`, when the entry has one. */
  iconUri?: string
}

/**
 * Parse one `reg.exe query` answer.
 *
 * reg.exe prints one line per value as `Name<whitespace>REG_SZ<whitespace>Data`
 * under the key header; the data itself may contain spaces (an icon path
 * always does), so everything after the `REG_SZ` marker is kept.
 * @param stdout - everything the query child wrote.
 * @returns the values the entry carries (empty when the key is absent).
 */
export function parseRegQuery(stdout: string): IdentityValues {
  const displayName = /^\s*DisplayName\s+REG_SZ\s+(.+)$/im.exec(stdout)?.[1]?.trim()
  const iconUri = /^\s*IconUri\s+REG_SZ\s+(.+)$/im.exec(stdout)?.[1]?.trim()
  return {
    ...(displayName !== undefined ? { displayName } : {}),
    ...(iconUri !== undefined ? { iconUri } : {}),
  }
}

/** One registry value the identity entry is missing or has drifted from. */
export interface IdentityWrite {
  /** The registry value name (`DisplayName` or `IconUri`). */
  name: string
  /** The full data to write. */
  data: string
}

/**
 * Decide which values need writing.
 *
 * `DisplayName` is always wanted. `IconUri` is wanted only when the shipped
 * icon asset exists — an install without the asset still fixes the name and
 * keeps whatever `IconUri` the entry already had (writing is additive; the
 * module never deletes another program's values).
 * @param current - what the entry carries now.
 * @param displayName - the display name the toast should show.
 * @param iconPath - the shipped icon path, or undefined when absent.
 * @returns the missing or drifted values, in write order.
 */
export function identityValueWrites(
  current: IdentityValues,
  displayName: string,
  iconPath: string | undefined,
): IdentityWrite[] {
  const writes: IdentityWrite[] = []
  if (current.displayName !== displayName) writes.push({ name: 'DisplayName', data: displayName })
  if (iconPath !== undefined && current.iconUri !== iconPath) {
    writes.push({ name: 'IconUri', data: iconPath })
  }
  return writes
}

/**
 * reg.exe argv that writes one value, creating the key when it is absent.
 * @param keyPath - the full registry key path.
 * @param write - the value to write.
 * @returns a static argv array; the data travels as one argument, never
 * through a shell.
 */
export function identityAddArgs(keyPath: string, write: IdentityWrite): string[] {
  return ['add', keyPath, '/v', write.name, '/t', 'REG_SZ', '/d', write.data, '/f']
}

/** What the last boot's identity pass did, for the diagnostics route. */
export interface IdentityState {
  /** The identity this pass ensured. */
  id: string
  /** The display name the toast should show. */
  displayName: string
  /** The shipped icon path, or undefined when the asset is absent. */
  iconPath: string | undefined
  /** The value names this pass actually wrote (empty = already current). */
  writes: string[]
  /** Whether every needed write succeeded (or none was needed). */
  registered: boolean
  /** The first failure message, when the pass did not complete. */
  error?: string
}

/** Injected collaborators of {@link ensureToastIdentity}, for tests. */
export interface IdentityDeps {
  /** The AppUserModelID to register (the manifest id, candidates[0]). */
  identityId: string
  /** The package root that contains `assets/`. */
  packageRoot: string
  /** One diagnostics-ring line. */
  note: (line: string) => void
  /** Receives the final state, on success and on failure. */
  onState: (state: IdentityState) => void
  /** The spawn used for every reg.exe child. */
  spawn: typeof spawn
}

/**
 * Read the identity entry's current values.
 * @param keyPath - the full registry key path.
 * @param spawnFn - the spawn used for the reg.exe child.
 * @returns the current values; an entry that does not exist reads as empty
 * (reg.exe answers "unable to find" with a nonzero exit, which is a valid
 * answer here, not an error).
 */
function readIdentityValues(keyPath: string, spawnFn: typeof spawn): Promise<IdentityValues> {
  return new Promise(resolve => {
    let out = ''
    try {
      const child = spawnFn(REG_EXE, ['query', keyPath], { windowsHide: true })
      child.stdout?.on('data', chunk => {
        out += String(chunk)
      })
      child.stderr?.resume()
      child.on('error', () => resolve({}))
      child.on('close', () => resolve(parseRegQuery(out)))
    } catch {
      resolve({})
    }
  })
}

/**
 * Write one value, resolving to whether the child succeeded.
 * @param keyPath - the full registry key path.
 * @param write - the value to write.
 * @param spawnFn - the spawn used for the reg.exe child.
 */
function writeIdentityValue(keyPath: string, write: IdentityWrite, spawnFn: typeof spawn): Promise<boolean> {
  return new Promise(resolve => {
    try {
      const child = spawnFn(REG_EXE, identityAddArgs(keyPath, write), { windowsHide: true })
      child.stdout?.resume()
      child.stderr?.resume()
      child.on('error', () => resolve(false))
      child.on('close', code => resolve(code === 0))
    } catch {
      resolve(false)
    }
  })
}

/**
 * Ensure the toast identity is registered, fire-and-forget.
 *
 * Runs once at plugin start, before the first toast: read the entry, write
 * what is missing or drifted, report both to the diagnostics ring. Every step
 * survives failure — a refused write only demotes the toast to whatever the
 * Start-menu shortcut resolves, which is exactly the pre-registration state.
 * @param deps - the identity to register and the collaborators to use.
 */
export async function ensureToastIdentity(deps: IdentityDeps): Promise<void> {
  if (process.platform !== 'win32') return
  const keyPath = identityKeyPath(deps.identityId)
  const iconPath = identityIconPath(deps.packageRoot)
  const icon = existsSync(iconPath) ? iconPath : undefined
  const state: IdentityState = {
    id: deps.identityId,
    displayName: IDENTITY_DISPLAY_NAME,
    iconPath: icon,
    writes: [],
    registered: true,
  }
  try {
    const current = await readIdentityValues(keyPath, deps.spawn)
    const writes = identityValueWrites(current, IDENTITY_DISPLAY_NAME, icon)
    for (const write of writes) {
      const ok = await writeIdentityValue(keyPath, write, deps.spawn)
      if (ok) {
        state.writes.push(write.name)
        continue
      }
      state.registered = false
      state.error = 'reg add ' + write.name + ' failed'
      break
    }
  } catch (error) {
    state.registered = false
    state.error = String(error)
  }
  if (state.registered) {
    deps.note(
      'identity ' + (state.writes.length === 0 ? 'current' : 'registered')
      + ' id=' + deps.identityId
      + ' writes=' + (state.writes.length === 0 ? 'none' : state.writes.join('|'))
      + ' icon=' + (icon ?? 'absent'),
    )
  } else {
    deps.note('identity failed id=' + deps.identityId + ' error=' + (state.error ?? 'unknown'))
  }
  deps.onState(state)
}
