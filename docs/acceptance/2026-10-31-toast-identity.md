# Acceptance: toast identity fallback (0.2.1)

- **Date**: 2026-10-31
- **Runtime**: DSH desktop 0.2.1-rc.5 (`dsh.cmd --version`), Windows 11 Home China 25H2 (build 26200)
- **Plugin under test**: local link `E:/dsh-plugins/dsh-notify-desktop`, version 0.2.1 (commit `aa090cd`)

## Checks

| Check | How | Result |
|---|---|---|
| Host half loads | `GET /dsh-notify/debug` | `registryPresent=true`, the session reports `notifyState=present` |
| Client half loads | debug ring | `client bundle loaded`, `notification permission=granted` |
| Host toast identity | `POST /dsh-notify/toast` with a title/body/sound, then `GET /dsh-notify/debug` | `host-toast aumid=com.deepseek.dsh candidates=com.deepseek.dsh|electron.app.DeepSeek Harness`; the toast displayed |
| Text templates | `GET /dsh-notify/text-templates` | 200, nine situations |
| Probe helper | Windows PowerShell 5.1 running `AUMID_RESOLVE_LINES` with three candidate orders | new-first → `com.deepseek.dsh`; old-first → `electron.app.DeepSeek Harness`; unknown-only → the fallback id |
| Automated suite | `node scripts/vitest.mjs`; `tsc --noEmit`; `node build.mjs` | 18 files / 121 tests pass; typecheck and build pass |

## Notes

- The legacy identity (`electron.app.DeepSeek Harness`) is still registered on this machine, so the
  fallback branch was exercised by ordering the candidates rather than by deleting a shortcut.
- The settings page is unchanged in 0.2.1; its last end-to-end acceptance run is
  [2026-10-25-notification-customization](2026-10-25-notification-customization.md).
