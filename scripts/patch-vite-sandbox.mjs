/**
 * Make vite survive a shell that denies process spawning.
 *
 * Vite probes Windows network drives once per process with
 * `exec("net use")` (inside `optimizeSafeRealPathSync`). Under DSH's confined
 * shell the child_process spawn is denied with a SYNCHRONOUS EPERM, which aborts
 * the whole config load — and with it every vitest run. The patch adds two
 * guards: an env opt-out and a try/catch around that one probe. An unconfined
 * machine keeps the exact upstream behaviour.
 *
 * Idempotent; runs from `postinstall` so a reinstall reapplies it.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const target = join(process.cwd(), 'node_modules', 'vite', 'dist', 'node', 'chunks', 'node.js')
if (!existsSync(target)) process.exit(0)

const before = `function optimizeSafeRealPathSync() {
	try {
		fs.realpathSync.native(path.resolve("./"));
	} catch (error) {
		if (error.message.includes("EISDIR: illegal operation on a directory")) {
			safeRealpathSync = fs.realpathSync;
			return;
		}
	}
	exec("net use", { windowsHide: true }, (error, stdout) => {
		if (error) return;
		const lines = stdout.split("\\n");
		for (const line of lines) {
			const m = parseNetUseRE.exec(line);
			if (m) windowsNetworkMap.set(m[2], m[1]);
		}
		if (windowsNetworkMap.size === 0) safeRealpathSync = fs.realpathSync.native;
		else safeRealpathSync = windowsMappedRealpathSync;
	});
}`

const after = `function optimizeSafeRealPathSync() {
	if (process.env.DSH_VITE_NO_NET_USE === "1") {
		safeRealpathSync = fs.realpathSync;
		return;
	}
	try {
		fs.realpathSync.native(path.resolve("./"));
	} catch (error) {
		if (error.message.includes("EISDIR: illegal operation on a directory")) {
			safeRealpathSync = fs.realpathSync;
			return;
		}
	}
	try {
		exec("net use", { windowsHide: true }, (error, stdout) => {
			if (error) return;
			const lines = stdout.split("\\n");
			for (const line of lines) {
				const m = parseNetUseRE.exec(line);
				if (m) windowsNetworkMap.set(m[2], m[1]);
			}
			if (windowsNetworkMap.size === 0) safeRealpathSync = fs.realpathSync.native;
			else safeRealpathSync = windowsMappedRealpathSync;
		});
	} catch {
		safeRealpathSync = fs.realpathSync;
	}
}`

const source = readFileSync(target, 'utf8')
if (source.includes('DSH_VITE_NO_NET_USE')) console.log('patch-vite-sandbox: already applied')
else if (!source.includes(before)) console.log('patch-vite-sandbox: upstream shape changed, nothing patched')
else {
  writeFileSync(target, source.replace(before, after))
  console.log('patch-vite-sandbox: applied')
}
