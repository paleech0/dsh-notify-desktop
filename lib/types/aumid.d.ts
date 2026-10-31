/**
 * Which identity the host uses when it raises a Windows toast.
 *
 * Windows attributes a toast to an AppUserModelID, and shows the application's
 * display name and icon only for an identity it can resolve to the app (a
 * registered shortcut). Upgraded installs resolve the historical id
 * (`electron.app.DeepSeek Harness`); installs that only registered the
 * manifest's `dshDesktopAppId` (`com.deepseek.dsh`) resolve the newer one.
 * The toast child probes the candidates, prefers the historical id because it
 * carries the proper display name, and falls back to the manifest id, so
 * toasts keep working across the identity change without a per-machine
 * setting.
 */
/** Candidate identities: the named legacy id first, the manifest id fallback. */
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
