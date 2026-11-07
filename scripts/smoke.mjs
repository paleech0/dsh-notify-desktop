/**
 * Bundle smoke test: the built artefacts still carry every feature this release
 * claims, and the host half imports nothing outside Node's builtin set.
 *
 * Run after `node build.mjs`; exits non-zero on the first failure so it can sit
 * in a release checklist.
 */
import { readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'

const client = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const host = readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')

/** What the release notes promise, as a fact about the shipped bytes. */
const checks = [
  ['client: empty custom-sound copy', client.includes('展开下方的 自定义音效 以添加音效')],
  ['client: author sounds in English', client.includes('Task completed') && client.includes('Task failed')],
  ['client: author sounds in Chinese', client.includes('任务正常结束')],
  ['client: three reminder styles', client.includes('只提醒一次') && client.includes('反复提醒') && client.includes('常驻提醒')],
  ['client: rename action', client.includes('重命名')],
  ['client: two-line sound row', client.includes('dsh_notify_soundItemActions')],
  ['client: shared control box', client.includes('dsh_notify_number') && client.includes('dsh_notify_select')],
  ['client: sticky reminder copy', client.includes('一直留在屏幕上')],
  // The bundle keeps the quotes escaped inside its string literals.
  ['host: reminder-scenario toast', host.includes('scenario=\\"reminder\\"') && host.includes('<actions><action content=')],
  ['host: transcode names its format', host.includes('pcm_s16le -f wav $partial')],
  ['host: rename route', host.includes('rename-sound')],
  ['host: ffmpeg reported to the client', host.includes('ffmpeg:')],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name)
  if (!ok) failed += 1
}

// Rule 6: the host bundle may import node builtins only. Anything else cannot
// resolve from a profile that links the plugin instead of installing it.
const allowed = new Set(builtinModules.flatMap(entry => [entry, 'node:' + entry]))
const specifiers = [...host.matchAll(/(?:require\("([^"]+)"\)|from\s+"([^"]+)")/g)]
  .map(match => match[1] ?? match[2])
  .filter(specifier => specifier !== undefined)
const external = [...new Set(specifiers)].filter(specifier => !allowed.has(specifier))
console.log(external.length === 0 ? 'PASS  host imports node builtins only' : 'FAIL  host imports: ' + external.join(', '))
if (external.length > 0) failed += 1

console.log('\n' + (failed === 0 ? 'smoke: all checks passed' : 'smoke: ' + String(failed) + ' failed'))
process.exitCode = failed === 0 ? 0 : 1
