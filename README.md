# dsh-notify-desktop

<img src="docs/images/settings.png" width="520" alt="Notification settings">

Windows toast notifications for the **DSH desktop app**: a session finishes, fails, or stops to ask
you something and you get a native notification, with a sound you choose per situation. Clicking the
toast raises the DSH window.

[中文文档](README.zh.md)

> **Unofficial plugin.** Not affiliated with, endorsed by, or sponsored by DeepSeek. See
> [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for the licences of everything it uses.

## Compatibility

| | |
|---|---|
| **Verified on** | DSH desktop **0.2.0-rc.2** (the current stable runtime). Every scenario below was exercised end to end; the evidence is in [docs/acceptance](docs/acceptance/2026-10-10-desktop-e2e.md). |
| **Declared range** | `>=0.2.0-rc.2 <0.3.0-0` — "the 0.2 line", prereleases included. |
| **Platform** | **Windows desktop profile only.** The web profile is untested: it has no Windows toast channel to fall back on. |
| **0.2.1-alpha.2** | Not runtime-tested. Its published type declarations were diffed against rc.2 for every seam used here and are identical apart from additive changes. |

How DSH decides: the profile loader reads the `peerDependencies` entries named `@deepseek-ai/dsh` or
`@deepseek-ai/dsh-*` and checks each with
`semver.satisfies(runtimeVersion, range, { includePrerelease: true })`; a mismatch makes it **skip the
plugin** rather than load it. On a runtime outside the range you can either wait for an updated plugin or
grant an exemption:

```powershell
dsh.cmd plugin --profile desktop allow-version dsh-notify-desktop@0.1.0 --dsh-version <your-version> --accept-risk
```

(`dsh.engines.dsh` in `package.json` is kept as metadata but is not what the loader reads.)

## What notifies

| Situation | Detail |
|---|---|
| Turn finished | `completed`, `blocked` and `max-tokens` (switchable), plus `error` and `aborted` which are off/on by their own switches |
| Approval waiting | `approval/asked` → `approval/decided` |
| Question waiting | `ask_user_question`, including questions asked from `run_code` (PTC dispatch) |
| Plan review | The plan-mode `interaction.ask()` |
| Still waiting | One reminder for a blocking interaction that stays unanswered (10 minutes by default) |

**Behaviour.** Notifications are edge-triggered, de-duplicated for 3 seconds per turn or request id, and
suppressed entirely while the DSH window has focus — a toast you would not see is noise. Clicking a toast
raises the window through the app's own `dsh://open` handler; it deliberately **does not jump to the
session**, because that is the more predictable action.

## Sounds

Four situations can sound different — *finished*, *error*, *waiting on you*, *still waiting* — each with
its own picker and a preview button. Every picker is split into three sections:

- **Windows sounds** — twenty built-in choices (the five toast events plus the media library: `chimes`,
  `ding`, `tada`, `Windows Error`, `Critical Stop`, `Alarm0x`, `Ring0x`, …).
- **Author sounds** — the four `.wav` files in this repository's [`sounds/`](sounds/) folder, one per
  situation. Dropping another file there is enough to add one; no code change is involved.
- **Custom sounds** — your own imports, described below.

**Custom sounds.** *Add sound…* copies the file you pick into
`%LOCALAPPDATA%\dsh-notify\custom` — so the original can move or be deleted, several can coexist, and
each one can be removed from the list. `.wav` / `.mp3` / `.m4a` / `.aac` / `.wma` / `.flac` /
`.ogg` / `.opus` are accepted. A `.wav` plays directly; anything else is transcoded **once** with the
`ffmpeg` on your PATH and lands in the **transcode cache** below the list, which reports its size and can
clear it (the next play rebuilds it). Without ffmpeg, wav files and the two shipped libraries still work;
the diagnostics route reports `media.ffmpeg: null`.

**When a sound stops.** File sounds are capped at eight seconds, and a sound that is still playing stops
immediately when you switch the sound off or when the DSH window regains focus (which is also what clicking
a toast produces).

Why custom files exist at all: a toast can only reference five `ms-winsoundevent` values, and on Windows 11
those resolve to four very similar chimes — `Notification.IM` and `Notification.SMS` are literally the same
file. Playing the audio from the host instead is the only way to get sounds that are actually distinguishable.

## Install

1. Clone this repository somewhere permanent (the profile links to it, so do not move it afterwards).
2. Register it with the desktop app's own CLI — a `link:` install, so the code stays where you cloned it:

   ```powershell
   & "<DSH desktop install>\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "link:<path-to-this-repo>"
   ```

3. Restart the DSH desktop app (the host half loads at startup).
4. Open **Settings → Notifications** (`Ctrl+,` while the window is focused) and check that the section appears.

## Settings

- **Enable notifications** — master switch; nothing else fires while it is off.
- **Sound** — mutes every situation group at once.
- **Sounds** — one picker plus a preview button per group.
- **Custom sound file** — type or paste a path, or press *Browse* for the Windows picker.
- **Transcode cache** — how much the transcoded wavs occupy, and a button to clear them.
- **When to notify** — one switch per turn-end reason.
- **Waiting on you** — one switch per interaction kind.
- **Reminder** — minutes before the single nudge; **Test notification** raises one on demand.

Preferences live in the renderer's `localStorage` under `dsh-notify-desktop.v1`, and changes apply immediately.

## Architecture

The plugin is two halves and touches no harness code.

- **Host half** (`src/index.ts`, `src/projection.ts`, `src/questions.ts`) registers one session projection
  (`notify`) and a handful of same-origin routes.
- **Client half** (`src/client/**`) reads that projection off the session list, decides whether a
  notification is warranted, and shows it: a host PowerShell toast when the window is unfocused, the
  renderer's own `Notification` as the fallback.

Questions have **two** sources on purpose, and neither may be removed: questions asked as tool calls reach
the projection, while service-level asks (plan review) never enter the session log — the host observes the
`user-questions/request` waterfall with `{ global: true }` and hands them to the client through a bounded
queue. A cross-source de-duplication key keeps that from double-toasting.

| Route | Purpose |
|---|---|
| `GET /dsh-notify/debug` | Projection state, recent client reports, ffmpeg/player status |
| `POST /dsh-notify/toast` | Raise one toast (title, body, sound id) |
| `POST /dsh-notify/focus` | Raise the window via `dsh://open` |
| `POST /dsh-notify/silence` | Stop the sound that is playing |
| `POST /dsh-notify/pick-file` | Windows wav picker |
| `GET/POST /dsh-notify/sound-cache` | Report / clear the transcode cache |
| `GET /dsh-notify/questions` | Poll the host-side question queue |

## Diagnostics

```powershell
Invoke-WebRequest http://127.0.0.1:19387/dsh-notify/debug
```

Windows toasts never reach the Action Center, so this is the only evidence channel: it returns the
projection registration state plus the last 40 client reports (every decision, channel choice and platform
result).

## Development

```powershell
pnpm install
pnpm run check      # typecheck + vitest + build
```

`lib/` is committed on purpose: the profile links to this folder, so the built bundles ship with the source.
See [AGENTS.md](AGENTS.md) for the repository rules and for the measured constraints that must not be
"optimised" away (the host bundle must stay self-contained, the toast spawn needs piped stdio, and the audio
path must stay on `System.Media.SoundPlayer`).

## Known limits

- No tray badge, taskbar badge or window flashing — those need main-process APIs a plugin cannot reach.
- Clicking a toast raises the window; it does not navigate to the session.
- The `error` and `max-tokens` turn ends are covered by unit tests only; they were never reproduced live.
- The plugin cannot observe a toast being dismissed, so a file sound is capped rather than tied to the toast.
- Windows desktop profile only.

## License

[MIT](LICENSE)
