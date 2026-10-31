/**
 * Which identity the host uses when it raises a Windows toast.
 *
 * Windows attributes a toast to an AppUserModelID. The desktop app used to be
 * registered under Electron's default id (`electron.app.DeepSeek Harness`);
 * newer builds register the manifest's `dshDesktopAppId`
 * (`com.deepseek.dsh`). The plugin cannot know which one a given install has,
 * so the toast child probes the candidates and uses the first registered id,
 * keeping the legacy one as the fallback. That keeps toasts working across the
 * identity change without a per-machine setting.
 */

/** Candidate identities, newest first. */
export const AUMID_CANDIDATES: readonly string[] = Object.freeze([
  'com.deepseek.dsh',
  'electron.app.DeepSeek Harness',
])

/**
 * Environment variable that overrides the candidate list.
 *
 * Semicolon-separated ids, tried in the written order. Empty or missing means
 * {@link AUMID_CANDIDATES}; it exists so a future identity can be adopted (or a
 * machine diagnosis forced) without rebuilding the plugin.
 */
export const AUMID_OVERRIDE_ENV = 'DSH_NOTIFY_AUMID'

/**
 * Resolve the candidate identities to try, newest first.
 * @param override - the raw override environment value, when set.
 * @returns a non-empty list: the override ids in order, else the built-in ones.
 */
export function aumidCandidates(override: string | undefined): readonly string[] {
  const ids = (override ?? '')
    .split(';')
    .map(id => id.trim())
    .filter(id => id !== '')
  return ids.length > 0 ? ids : AUMID_CANDIDATES
}

/**
 * Read the identity the toast child printed.
 *
 * The child writes one `DSH_NOTIFY_AUMID=<id>` line before showing the toast;
 * the host mirrors it into the diagnostics ring, which is the only way to see
 * which identity an installed app actually used.
 * @param stdout - everything the toast child wrote to stdout.
 * @returns the chosen id, or undefined when the line is absent or empty.
 */
export function parseAumidLine(stdout: string): string | undefined {
  const match = /^DSH_NOTIFY_AUMID=(.+)$/m.exec(stdout)
  const value = match?.[1]?.trim()
  return value === undefined || value === '' ? undefined : value
}
