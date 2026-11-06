# Acceptance: plugin language switch on DSH 0.2.2-rc.1

- **Date**: 2026-11-06
- **Runtime**: DSH desktop 0.2.2-rc.1, Windows 11 Home China 25H2 (build 26200)
- **Plugin under test**: local link `E:/dsh-plugins/dsh-notify-desktop`, version 0.2.2

## Checks

| Check | How | Result |
|---|---|---|
| Host half loads | `GET /dsh-notify/debug` | `registryPresent=true`, the session reports `notifyState=present` |
| Client half loads | debug ring | `client bundle loaded`, `notification permission=granted` |
| Host toast | `POST /dsh-notify/toast`, then the debug ring | `host-toast aumid=electron.app.DeepSeek Harness candidates=electron.app.DeepSeek Harness|com.deepseek.dsh`; the toast displayed |
| Text templates | `GET /dsh-notify/text-templates` | 200, nine situations |
| Sound library | `GET /dsh-notify/sound-library` | 200, four author sounds |
| Language switch | settings page: switch to English, then back to Auto | copy changes with the control; `Auto` follows the DSH language (verified by the user) |
| Screenshots | the three settings cards in both languages plus the test toast | `docs/images/settings-zh.png`, `settings-situations-zh.png`, `settings-customize-zh.png`, `toast-zh.png`, and the `-en` set |
| Automated suite | `node scripts/vitest.mjs`; `tsc --noEmit`; `node build.mjs` | 19 files / 128 tests pass; typecheck and build pass |

## Notes

- The host half is unchanged in 0.2.2; only the client bundle carries the language switch.
- Runtime seams checked against the 0.2.2-rc.1 image: the projection registry still accepts the
  synchronous `register(definition)` form (the legacy compatibility path) and `stateOf(session, key)`
  still answers, though both are documented as deprecated in favour of an awaited registration handle.
  Nothing this plugin uses was removed.
