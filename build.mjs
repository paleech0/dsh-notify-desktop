/**
 * Build for dsh-notify-desktop.
 *
 * Host half (lib/index.js): plain ESM for the Node host. It is bundled
 * self-contained — no @deepseek-ai/* import survives into the output — so the
 * plugin never depends on a resolvable node_modules next to it (the profile
 * installs it as a link, and a missing dependency there fails the whole plugin
 * tree at boot).
 *
 * Client half (lib/client.js): one CJS bundle wrapped in the browser module
 * loader factory handshake, with react and the @deepseek-ai/* baseline modules
 * left external for the loader to provide.
 *
 * Bundling runs through rolldown, whose native binding loads in-process: the
 * esbuild CLI spawns a helper binary with piped stdio, which a confined shell
 * denies outright.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { rolldown } from 'rolldown'

mkdirSync('lib', { recursive: true })

const clientExternal = [
  '@deepseek-ai/*',
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'scheduler',
]

/**
 * Bundle one entry into one file.
 * @param input - entry module path.
 * @param options - rolldown input options (resolution happens here).
 * @param output - rolldown output options (format, banner, file).
 */
async function bundle(input, options, output) {
  const build = await rolldown({ input, ...options })
  try {
    await build.write({ sourcemap: true, ...output })
  } finally {
    await build.close()
  }
}

await bundle('src/index.ts', { platform: 'node' }, { file: 'lib/index.js', format: 'esm' })

await bundle('src/client/index.ts', { platform: 'browser', external: clientExternal }, {
  file: 'lib/client.js',
  format: 'cjs',
  banner: "window.__ModuleLoader__.load({ id: 'dsh-notify-desktop', factory: (require) => { var module = { exports: {} }; var exports = module.exports;",
  footer: 'return module.exports; } });',
})

execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.types.json'], { stdio: 'inherit' })
