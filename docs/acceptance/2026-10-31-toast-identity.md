# Acceptance: toast identity fallback (0.2.1)

- **Date**: 2026-10-31
- **Runtime**: DSH desktop 0.2.1-rc.5 (`dsh.cmd --version`), Windows 11 Home China 25H2 (build 26200)
- **Plugin under test**: local link `E:/dsh-plugins/dsh-notify-desktop`, version 0.2.1 (commit `40fc5e0`)

## Checks

| Check | How | Result |
|---|---|---|
| Host half loads | `GET /dsh-notify/debug` | `registryPresent=true`, the session reports `notifyState=present` |
| Client half loads | debug ring | `client bundle loaded`, `notification permission=granted` |
| Host toast identity | `POST /dsh-notify/toast` with a title/body/sound, then `GET /dsh-notify/debug` | After restart: `host-toast aumid=electron.app.DeepSeek Harness candidates=electron.app.DeepSeek Harness|com.deepseek.dsh`; the toast displayed with the app's name and icon |
| Text templates | `GET /dsh-notify/text-templates` | 200, nine situations |
| Probe helper | Windows PowerShell 5.1 running `AUMID_RESOLVE_LINES` with three candidate lists | legacy-first → `electron.app.DeepSeek Harness`; manifest-first (override) → `com.deepseek.dsh`; unknown-only → the fallback id |
| Automated suite | `node scripts/vitest.mjs`; `tsc --noEmit`; `node build.mjs` | 18 files / 121 tests pass; typecheck and build pass |

## Notes

- A Windows capture showed the manifest id alone labels the toast with the raw string
  `com.deepseek.dsh`, while the legacy id renders the app's name and icon. That is why the named legacy
  id is preferred and the manifest id kept as the fallback.
- The legacy identity is still registered on this machine, so the fallback branch was exercised by
  ordering the candidates rather than by deleting a shortcut.
- The settings page is unchanged in 0.2.1; its last end-to-end acceptance run is
  [2026-10-25-notification-customization](2026-10-25-notification-customization.md).
