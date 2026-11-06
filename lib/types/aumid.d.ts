/**
 * Which identity the host uses when it raises a Windows toast.
 *
 * Windows attributes a toast to an AppUserModelID, and shows the application's
 * display name and icon only for an identity it can resolve: a Start-menu
 * shortcut carrying the id, or a registry entry under `AppUserModelId` — which
 * is what this host itself writes at startup (see identity.ts, always the
 * manifest id). The manifest id (`com.deepseek.dsh`) therefore leads the
 * candidate list: this plugin registers it on every machine, and current
 * installers put it on the Start-menu shortcut. The historical Electron id
 * (`electron.app.DeepSeek Harness`) stays as a fallback for installs that
 * still carry the old shortcut. Measured on 2026-11-06 (DSH desktop
 * 0.2.2-rc.1, Windows 11 25H2): the installer had moved the shortcut to the
 * manifest id and nothing resolved the legacy id anymore, so the previous
 * legacy-first order degraded toasts to a raw-id label with no icon.
 */
/** The identity this host registers (identity.ts) and the probe prefers. */
export declare const REGISTERED_IDENTITY_ID = "com.deepseek.dsh";
/** Candidate identities: the registered manifest id first, the legacy fallback. */
export declare const AUMID_CANDIDATES: readonly string[];
/**
 * Environment variable that overrides the candidate list.
 *
 * Semicolon-separated ids, tried in the written order. Empty or missing means
 * {@link AUMID_CANDIDATES}; it exists so a future identity can be adopted (or a
 * machine diagnosis forced) without rebuilding the plugin.
 */
export declare const AUMID_OVERRIDE_ENV = "DSH_NOTIFY_AUMID";
/**
 * Resolve the candidate identities to try, in candidate order.
 * @param override - the raw override environment value, when set.
 * @returns a non-empty list: the override ids in order, else the built-in ones.
 */
export declare function aumidCandidates(override: string | undefined): readonly string[];
/**
 * Read the identity the toast child printed.
 *
 * The child writes one `DSH_NOTIFY_AUMID=<id>` line before showing the toast;
 * the host mirrors it into the diagnostics ring, which is the only way to see
 * which identity an installed app actually used.
 * @param stdout - everything the toast child wrote to stdout.
 * @returns the chosen id, or undefined when the line is absent or empty.
 */
export declare function parseAumidLine(stdout: string): string | undefined;
