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
import { spawn } from 'node:child_process';
/** The registry tool, absolute like the PowerShell path in `index.ts`. */
export declare const REG_EXE = "C:\\Windows\\System32\\reg.exe";
/**
 * The registry prefix of the per-user toast identity table. reg.exe takes the
 * root hive as part of the key path, so this is one string, not two args.
 */
export declare const APP_USER_MODEL_ID_KEY_PREFIX = "HKCU\\SOFTWARE\\Classes\\AppUserModelId\\";
/**
 * The display name a toast shows under our identity: the desktop app's own
 * name, unchanged since the first release, so the popup reads as the app's.
 */
export declare const IDENTITY_DISPLAY_NAME = "DeepSeek Harness";
/** The shipped copy of the app icon, under the package root. */
export declare const IDENTITY_ICON_FILE: string;
/**
 * Full reg.exe key path for one AppUserModelID.
 * @param id - the identity to register or read.
 * @returns the absolute registry path reg.exe accepts.
 */
export declare function identityKeyPath(id: string): string;
/**
 * Absolute path of the shipped icon asset inside one package root.
 * @param packageRoot - the directory that contains `assets/` (the repo at
 * dev time, the linked install at runtime — both resolve the same way).
 * @returns the absolute png path.
 */
export declare function identityIconPath(packageRoot: string): string;
/** The identity values a registry entry carries, as far as we read them. */
export interface IdentityValues {
    /** The value of `DisplayName`, when the entry has one. */
    displayName?: string;
    /** The value of `IconUri`, when the entry has one. */
    iconUri?: string;
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
export declare function parseRegQuery(stdout: string): IdentityValues;
/** One registry value the identity entry is missing or has drifted from. */
export interface IdentityWrite {
    /** The registry value name (`DisplayName` or `IconUri`). */
    name: string;
    /** The full data to write. */
    data: string;
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
export declare function identityValueWrites(current: IdentityValues, displayName: string, iconPath: string | undefined): IdentityWrite[];
/**
 * reg.exe argv that writes one value, creating the key when it is absent.
 * @param keyPath - the full registry key path.
 * @param write - the value to write.
 * @returns a static argv array; the data travels as one argument, never
 * through a shell.
 */
export declare function identityAddArgs(keyPath: string, write: IdentityWrite): string[];
/** What the last boot's identity pass did, for the diagnostics route. */
export interface IdentityState {
    /** The identity this pass ensured. */
    id: string;
    /** The display name the toast should show. */
    displayName: string;
    /** The shipped icon path, or undefined when the asset is absent. */
    iconPath: string | undefined;
    /** The value names this pass actually wrote (empty = already current). */
    writes: string[];
    /** Whether every needed write succeeded (or none was needed). */
    registered: boolean;
    /** The first failure message, when the pass did not complete. */
    error?: string;
}
/** Injected collaborators of {@link ensureToastIdentity}, for tests. */
export interface IdentityDeps {
    /** The AppUserModelID to register (the manifest id, candidates[0]). */
    identityId: string;
    /** The package root that contains `assets/`. */
    packageRoot: string;
    /** One diagnostics-ring line. */
    note: (line: string) => void;
    /** Receives the final state, on success and on failure. */
    onState: (state: IdentityState) => void;
    /** The spawn used for every reg.exe child. */
    spawn: typeof spawn;
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
export declare function ensureToastIdentity(deps: IdentityDeps): Promise<void>;
