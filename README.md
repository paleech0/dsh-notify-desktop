# dsh-notify-desktop

[![npm](https://img.shields.io/npm/v/dsh-notify-desktop.svg)](https://www.npmjs.com/package/dsh-notify-desktop) · [中文文档](README.zh.md) · English

Windows toast notifications for the DSH desktop app. A session finishes, fails, or stops to ask you
something — you get a native notification with a sound and a piece of text chosen for that situation, and
clicking it brings the DSH window back to the front.

<img src="https://raw.githubusercontent.com/paleech0/dsh-notify-desktop/main/docs/images/settings.png" width="460" alt="Desktop notifications and the situation list">

## What you get

- **Told when it matters** — turn ends (completed, error, aborted, blocked, max-tokens), approval
  requests, questions, plan reviews, and one nudge for a wait that drags on.
- **Quiet when you are there** — nothing pops while the DSH window has focus, and each event notifies
  once (three-second de-duplication).
- **A sound and a text per situation** — nine situations (five turn ends, three waits, one reminder),
  each with its own sound and its own popup text; each situation can store up to three custom texts, and
  every row has a Preview button that shows and plays exactly what it will do.
- **Three delivery modes** — toast + sound, toast only (silent), sound only (no toast).
- **Your own sounds and words** — sounds come from the Windows library, the author sounds shipped in
  [`sounds/`](sounds/), or files you import; texts have a name, a title, a body and placeholders, live in a
  local JSON file, and can be edited or deleted (with an inline confirmation).
- **Never a long ring** — a file sound stops after eight seconds, and stops at once when you mute
  notifications or come back to the window.
- **Click to come back** — the toast raises the DSH window; it deliberately does not jump to the session.

Requirements: Windows and the DSH desktop app (profile `desktop`), runtime 0.2.x. `ffmpeg` on `PATH` is
optional and only used to transcode custom sounds that are not `.wav`.

## Install

### From npm

```powershell
& "<DSH desktop install>\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add dsh-notify-desktop
```

Then restart the DSH desktop app and open **Settings → Notifications** (`Ctrl+,` while focused).

### From a local checkout

1. Clone this repository somewhere permanent — the profile links to that folder.
2. Register it with the desktop app's own CLI:

   ```powershell
   & "<DSH desktop install>\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "link:<path-to-this-repo>"
   ```

3. Restart the DSH desktop app, then open **Settings → Notifications** (`Ctrl+,` while focused).

## Settings

The section has three cards. Preferences live in the renderer's `localStorage`; sounds and texts live on
this machine; every change applies immediately.

**Card 1 — Desktop notifications: whether and how:**

| Control | What it does |
|---|---|
| Enable notifications | Master switch; nothing toasts or sounds while it is off. Every delivery control greys out (the chosen values stay): the mode, each situation's sound and text, the previews, the reminder minutes and the situation switches below. Only "Custom sounds" and "Custom texts" stay editable |
| Send a test notification | Right below the master switch; always the default Windows sound plus a fixed toast, unaffected by the mode and every setting below — use it to check that the configuration works |
| Delivery mode | Toast + sound (default) / Toast only (silent) / Sound only (no toast) |

**Card 2 — Notify me in which of these situations:**

| Group | Switches |
|---|---|
| A session ends | Completed / Error / Aborted / Blocked / Token limit reached (each row carries an example) |
| Waiting on you | Waiting for approval / an answer / a plan review (each row carries an example) |

**Card 3 — Notification setup: the sound and text of each situation:**

| Control | What it does |
|---|---|
| Situation row | Only the situations ticked in card 2 appear (rows follow the ticks live). Each row is: situation name + sound picker + text picker + Preview |
| Preview | Shows and plays that situation's current text (the default text is rendered with sample values) and sound, following the delivery mode |
| Sound picker | Two levels: the source first (Windows / author / custom), that source's sounds second |
| Text picker | Two levels: **Default** (built-in wording) or **Custom** (that situation's saved texts, listed by name) |
| Custom sounds (collapsible) | Add / list / remove your sound files; the transcode cache and its clear button live here too |
| Custom texts (collapsible) | Manage the saved texts per situation: at most three each, with a name, a title and a body, an Edit button and a red Delete button (deletion is confirmed inline) |

Ticking a situation makes its row appear in the "Notification setup" card below; unticking it only hides the
row and keeps its sound and text, so ticking it again brings them back.

<img src="https://raw.githubusercontent.com/paleech0/dsh-notify-desktop/main/docs/images/settings-situations.png" width="460" alt="Notification setup (top): sound and text per situation">
<img src="https://raw.githubusercontent.com/paleech0/dsh-notify-desktop/main/docs/images/settings-customize.png" width="460" alt="Notification setup (bottom): reminder minutes and the two collapsible libraries">

## Sounds

**Three sections.** Every sound picker opens a two-level list: the source first, that source's sounds second.

- *Windows sounds* — twenty built-in choices: the five toast events plus the media library
  (`chimes`, `ding`, `tada`, `Windows Error`, `Critical Stop`, `Alarm0x`, `Ring0x`, …).
- *Author sounds* — the four `.wav` files in [`sounds/`](sounds/). Drop another file in that folder and
  it appears; no code change is involved.
- *Custom sounds* — your own imports.

**Your own files.** *Add sound…* copies the file into `%LOCALAPPDATA%\dsh-notify\custom`, so the
original can move or be deleted afterwards. Accepted formats are `.wav`, `.mp3`, `.m4a`, `.aac`,
`.wma`, `.flac`, `.ogg` and `.opus`. Deleting a custom sound asks for confirmation first.

**When a sound stops.** A `.wav` plays directly. Anything else is transcoded once with the `ffmpeg` on
your `PATH` and lands in the transcode cache inside "Custom sounds", which reports its size and can clear
it. File sounds are capped at eight seconds, and a sound already playing stops immediately when you switch
notifications off, switch to "Toast only", or when the DSH window regains focus. Without ffmpeg, wav files
and the two shipped libraries still work; the diagnostics route reports `media.ffmpeg: null`.

**Why custom sounds exist.** A toast can only reference five `ms-winsoundevent` values, and on Windows 11
those resolve to four very similar chimes — `Notification.IM` and `Notification.SMS` are literally the
same file. Playing the audio from the host is the only way to get sounds that are actually distinguishable.

## Popup texts

**One text per situation.** A real notification's title and body come from the text that situation has
selected: the **default text** (built-in `{工作区} · {状态}` / `{内容}`, nothing to configure), or a **custom
text** saved for that situation. Each situation keeps at most **three** custom texts.

**The editor.** Name (24 characters), title (120), body (300); the placeholders `{工作区}` `{状态}` `{内容}`
`{分钟}` are insertable with one click, and a live preview line renders the template while you type.

**Test vs preview.** The test button in card 1 always uses fixed copy and the default Windows sound; the
Preview button in card 3 uses the situation's real text and sound (following the delivery mode). An empty
`{内容}` falls back to that situation's built-in line.

**Where they live.** The wording is stored in
`%LOCALAPPDATA%\dsh-notify\templates\templates.json` (under the same `dsh-notify` folder as the custom
sounds), grouped by situation, at most three per situation; writes go through a temp file plus a rename,
and a corrupt file reads as an empty library instead of crashing. The settings store only the chosen id;
when a template is deleted the situation falls back to the default text. **Restart the app after editing
this file by hand** — the client loads it once at start-up.

## Compatibility

| | |
|---|---|
| Verified on | DSH desktop **0.2.1-rc.3**: plugin loading, projection delivery, host toast / sound / silence / text-template routes, plus the settings page's preview, test notification and cache clearing all pass ([evidence](docs/acceptance/2026-10-25-notification-customization.md)); earlier acceptance runs on 0.2.1-rc.2 / rc.1 / 0.2.0-rc.2 are kept in `docs/acceptance/` |
| Declared range | `>=0.2.0-rc.2 <0.3.0-0` — the whole 0.2 line, prereleases included; the loader checks it with `includePrerelease`, so 0.2.1-rc.3 passes |
| Platform | Windows desktop profile only; the web profile has no toast channel and is untested |
| Seam check | The 0.2.1 runtime image ships no `.d.ts`; every seam used here was checked against its compiled JS and still matches |

The profile loader reads the `peerDependencies` entries named `@deepseek-ai/dsh` or `@deepseek-ai/dsh-*`
and checks them with `semver.satisfies(runtime, range, { includePrerelease: true })`. A mismatch makes it
skip the plugin rather than load it. On another runtime, grant an exemption:

```powershell
dsh.cmd plugin --profile desktop allow-version dsh-notify-desktop@0.2.0 --dsh-version <your-version> --accept-risk
```

## How it works

Two halves, and no harness code is modified.

- The **host half** registers one session projection (`notify`) and a few same-origin routes; it also
  owns the text-template file (atomic write, per-situation cap and length validation).
- The **client half** reads that projection from the session list, decides whether a notification is
  warranted, composes the situation's sound and text, and sends it: a host PowerShell toast while the
  window is unfocused, the renderer's own notification as the fallback.

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
| `GET/POST /dsh-notify/text-templates` | Read every saved text; save or delete one |
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
- A custom text belongs to exactly one situation; using the same wording in two situations means saving it
  twice. Hand-edited template files are only re-read after an app restart.
- Windows desktop profile only.

## License

[MIT](LICENSE) · third-party notices in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Unofficial plugin: not affiliated with, endorsed by, or sponsored by DeepSeek. "DeepSeek", "DSH" and
"DeepSeek Harness" are used descriptively, to say what this plugin plugs into.
