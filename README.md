# dsh-notify-desktop

[中文文档](README.zh.md) · English

Windows toast notifications for the DSH desktop app. A session finishes, fails, or stops to ask you
something — you get a native notification with a sound chosen for that situation, and clicking it brings
the DSH window back to the front.

<img src="docs/images/settings.png" width="460" alt="Notification settings">

## What you get

- **Told when it matters** — turn ends (completed, error, aborted, blocked, max-tokens), approval
  requests, questions, plan reviews, and one nudge for a wait that drags on.
- **Quiet when you are there** — nothing pops while the DSH window has focus, and each event notifies
  once (three-second de-duplication).
- **A sound per situation** — four groups (finished, error, waiting on you, still waiting), each picked
  from the Windows sounds, the author sounds shipped in [`sounds/`](sounds/), or your own files.
- **Your own sounds** — *Add sound…* copies the file you pick into the plugin's folder, so several can
  coexist and each can be removed later.
- **Never a long ring** — a file sound stops after eight seconds, and stops at once when you mute
  notifications or come back to the window.
- **Click to come back** — the toast raises the DSH window; it deliberately does not jump to the session.

Requirements: Windows and the DSH desktop app (profile `desktop`), runtime 0.2.x. `ffmpeg` on `PATH` is
optional and only used to transcode custom sounds that are not `.wav`.

## Install

1. Clone this repository somewhere permanent — the profile links to that folder.
2. Register it with the desktop app's own CLI:

   ```powershell
   & "<DSH desktop install>\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "link:<path-to-this-repo>"
   ```

3. Restart the DSH desktop app, then open **Settings → Notifications** (`Ctrl+,` while focused).

## Settings

Every switch lives in one section of the settings page. Preferences are stored in the renderer's
`localStorage` and apply immediately.

| Control | What it does |
|---|---|
| Enable notifications | Master switch; nothing else fires while it is off |
| Sound | Mutes every situation group at once |
| Sounds | One picker per group, each with a preview button |
| Custom sounds | Add, list and remove your own files |
| Transcode cache | Shows what transcoded wavs occupy, and clears them |
| When to notify | One switch per turn-end reason |
| Waiting on you | One switch per interaction kind |
| Reminder | Minutes before the single nudge, plus a test button |

## Sounds

**Three sections.** Every picker opens a two-level list: the source first, that source's sounds second.

- *Windows sounds* — twenty built-in choices: the five toast events plus the media library
  (`chimes`, `ding`, `tada`, `Windows Error`, `Critical Stop`, `Alarm0x`, `Ring0x`, …).
- *Author sounds* — the four `.wav` files in [`sounds/`](sounds/). Drop another file in that folder and
  it appears; no code change is involved.
- *Custom sounds* — your own imports.

**Your own files.** *Add sound…* copies the file into `%LOCALAPPDATA%\dsh-notify\custom`, so the
original can move or be deleted afterwards. Accepted formats are `.wav`, `.mp3`, `.m4a`, `.aac`,
`.wma`, `.flac`, `.ogg` and `.opus`.

**When a sound stops.** A `.wav` plays directly. Anything else is transcoded once with the `ffmpeg` on
your `PATH` and lands in the transcode cache below the list, which reports its size and can clear it. File
sounds are capped at eight seconds, and a sound already playing stops immediately when you switch sound
off or when the DSH window regains focus. Without ffmpeg, wav files and the two shipped libraries still
work; the diagnostics route reports `media.ffmpeg: null`.

**Why custom sounds exist.** A toast can only reference five `ms-winsoundevent` values, and on Windows 11
those resolve to four very similar chimes — `Notification.IM` and `Notification.SMS` are literally the
same file. Playing the audio from the host is the only way to get sounds that are actually distinguishable.

## Compatibility

| | |
|---|---|
| Verified on | DSH desktop **0.2.0-rc.2**, every scenario end to end ([evidence](docs/acceptance/2026-10-10-desktop-e2e.md)) |
| Declared range | `>=0.2.0-rc.2 <0.3.0-0` — the whole 0.2 line, prereleases included |
| Platform | Windows desktop profile only; the web profile has no toast channel and is untested |
| 0.2.1-alpha.2 | Not run; its published type declarations were diffed against rc.2 and match for every seam used here |

The profile loader reads the `peerDependencies` entries named `@deepseek-ai/dsh` or `@deepseek-ai/dsh-*`
and checks them with `semver.satisfies(runtime, range, { includePrerelease: true })`. A mismatch makes it
skip the plugin rather than load it. On another runtime, grant an exemption:

```powershell
dsh.cmd plugin --profile desktop allow-version dsh-notify-desktop@0.1.0 --dsh-version <your-version> --accept-risk
```

## How it works

Two halves, and no harness code is modified.

- The **host half** registers one session projection (`notify`) and a few same-origin routes.
- The **client half** reads that projection from the session list, decides whether a notification is
  warranted, and sends it: a host PowerShell toast while the window is unfocused, the renderer's own
  notification as the fallback.

Questions arrive from two places on purpose, and neither can be dropped. Questions asked as tool calls
reach the projection; service-level asks such as the plan review never enter the session log, so the host
observes the `user-questions/request` waterfall with `{ global: true }` and hands them to the client over
a bounded queue. A cross-source key keeps the two copies from double-toasting.

| Route | Purpose |
|---|---|
| `GET /dsh-notify/debug` | Projection state, recent client reports, ffmpeg and player status |
| `POST /dsh-notify/toast` | Raise one toast (title, body, sound id) |
| `POST /dsh-notify/focus` | Raise the window through `dsh://open` |
| `POST /dsh-notify/silence` | Stop the sound that is playing |
| `GET/POST /dsh-notify/sound-library` | List the two library folders |
| `POST /dsh-notify/import-sound`, `/delete-sound` | Add or remove a custom sound |
| `GET/POST /dsh-notify/sound-cache` | Report or clear the transcode cache |
| `POST /dsh-notify/pick-file`, `GET /dsh-notify/foreground` | Windows file picker; OS-level focus answer |
| `GET /dsh-notify/questions` | Poll the host-side question queue |

## Troubleshooting

Windows toasts never reach the Action Center, so the diagnostics route is the only evidence channel:

```powershell
Invoke-WebRequest http://127.0.0.1:19387/dsh-notify/debug
```

It returns the projection registration state, the last 40 client reports (every decision, channel choice
and platform result), and the sound plumbing (`media.ffmpeg`, `media.soundPlayers`).

## Development

```powershell
pnpm install
pnpm run check      # typecheck + vitest + build
```

`lib/` is committed on purpose: the profile links to this folder, so the built bundles ship with the
source. [AGENTS.md](AGENTS.md) holds the repository rules and the measured constraints that must not be
"optimised" away — the host bundle stays self-contained, the toast spawn keeps piped stdio, and audio goes
through `System.Media.SoundPlayer` only.

## Known limits

- No tray badge, taskbar badge or window flashing; those need main-process APIs a plugin cannot reach.
- Clicking a toast raises the window, it does not navigate to the session.
- The `error` and `max-tokens` turn ends are covered by unit tests only; they were never reproduced live.
- A toast cannot be observed being dismissed, so file sounds are capped rather than tied to the toast.
- Windows desktop profile only.

## License

[MIT](LICENSE) · third-party notices in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Unofficial plugin: not affiliated with, endorsed by, or sponsored by DeepSeek. "DeepSeek", "DSH" and
"DeepSeek Harness" are used descriptively, to say what this plugin plugs into.
