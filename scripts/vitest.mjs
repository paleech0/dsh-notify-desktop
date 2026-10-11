/**
 * Test runner shim.
 *
 * Two environment facts shape it:
 *  1. vite's Windows network-drive probe (`exec("net use")`) cannot spawn under
 *     the confined shell, so the probe is disabled before vite loads;
 *  2. vitest's default worker pool forks child processes with piped stdio, also
 *     denied there, so the config selects the thread pool.
 *
 * Both are inert on an unconfined machine: the probe only ever falls back, and
 * the thread pool runs the same tests.
 */
process.env.DSH_VITE_NO_NET_USE = '1'
// A fresh install restores vite's upstream file, so re-apply the guard here
// (idempotent) instead of relying on a postinstall hook the shell cannot run.
await import('./patch-vite-sandbox.mjs')
const { startVitest } = await import('vitest/node')

const vitest = await startVitest('test', process.argv.slice(2), { watch: false })
if (vitest === undefined) process.exit(1)
await vitest.close()
process.exit(vitest.state.getCountOfFailedTests() > 0 ? 1 : 0)
