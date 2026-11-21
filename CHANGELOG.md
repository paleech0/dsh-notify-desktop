# Changelog

All notable changes to this plugin are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **External push channels: send every notification to your phone / chat / mailbox, too.**
  A new "External push" card delivers each notification, alongside the Windows toast, to any of
  21 channels — Bark, Server酱, PushPlus, 企业微信, 钉钉, 飞书, Telegram, ntfy, Gotify, Slack,
  Discord, WxPusher (uid or topic broadcast), PushDeer, Qmsg酱, MeoW, KOOK, OneBot (QQ), Matrix,
  Pushover, SMTP and a generic webhook. Each channel is independent (one
  failure never blocks the rest), and the push rides the same decision as the toast, so it fires
  exactly when a toast would — i.e. only while DSH is in the background, never while it is
  focused. The channels and their secrets live host-side in
  `%LOCALAPPDATA%\dsh-notify\channels.json`, never in the browser. 钉钉 / 飞书 support HMAC
  signing; SMTP is delivered over Node's built-in `net` / `tls` (implicit TLS on 465 or STARTTLS
  on 587; no third-party mailer, keeping the host bundle self-contained). Each channel can narrow
  which situations it receives, override the title/body template, and opt into markdown
  (WeCom / DingTalk / Feishu); the generic webhook also accepts a custom JSON body template.

- **The session you are currently viewing notifies when DSH is in the background.**
  When you have a session open in the main pane and DSH is focused, nothing toasts
  anyway (the existing window-focus suppression covers it). When DSH is in the
  background, that session now notifies on completion, errors, waits and reminders —
  you are not looking at it then — unless you turn the new switch
  (`notifyViewedUnfocused`, default on) off, which mutes it in every situation. The
  plugin learns which session you are viewing by observing every `openSession`
  navigation (DSH exposes no "currently open session" signal of its own); the session
  the app restores at launch is not tracked, but the window is focused then.

- **Background subagent sessions no longer raise a toast storm, with three gears to choose from.**
  DSH lists every delegated `subagent` session as its own session (`origin: 'subagent'`, hidden from
  the sidebar by that field), so one delegation that spawns N children used to raise N completion
  toasts. Card 2 now carries a three-way choice (`subagentMode`):
  - `quiet` (**default**) — a subagent's finished turn is silent, so one delegation never storms;
    its approvals, questions and the reminder still notify.
  - `silent` — nothing at all from a subagent session, including its approvals, questions and
    reminder; the quietest gear, at the risk of missing a child that really waits on you.
  - `all` — every subagent session notifies like an ordinary conversation (the pre-0.2.2 behaviour).

  The gate lives in the pure decision function (`subagentMuted`) and only matches rows whose
  `origin` is `'subagent'`, so an ordinary conversation and a user's own fork are untouched. The
  diagnostics ring labels a suppressed child turn `-> suppressed (subagent quiet|silent)` and a
  dropped child wait `-> suppressed (subagent silent)`.

## [0.2.5] - 2026-11-07

### Fixed

- The shipped author sounds are named in the plugin's own language. Their titles come from the .wav file names,
  which are Chinese, so an English UI used to list "1-任务正常结束" — the picker now reads the locale table. A file
  dropped into `sounds/` by hand still shows its own name.
- The empty custom-sound state now points at the right control ("展开下方的 自定义音效 以添加音效"): the previous
  sentence told the user to press an "Add sound…" button they could not see until the card was expanded.
- The reminder-style select and the delay field share one box style and one aligned column; the select used to be
  smaller and dimmer than the field above it.
- An imported sound is laid out on two lines (name + size, then its actions), so a long file name no longer pushes
  the buttons into a full-width red block.

### Added

- Three reminder styles for a long-unanswered wait: `once` (the previous behaviour, still the default), `repeat`
  (re-notifies every `remindEveryMinutes` until the wait is answered) and `sticky` (one reminder raised as a Windows
  reminder-scenario toast that stays on screen until dismissed, with the sound played once).
- `buildToastXml` is exported and covered: a sticky toast carries `scenario="reminder"` plus a `system` dismiss
  button. Measured on this machine: without the button Windows ignores the scenario and the toast disappears after
  the usual five seconds, so the button is load-bearing rather than decoration.

## [0.2.4] - 2026-11-07

### Fixed

- Non-wav custom sounds play again. 0.2.3 started transcoding into `.wav.part` without `-f wav`; ffmpeg infers the
  container from the file extension, refused the output, and every mp3 / m4a / flac sound went silent with no cache
  written and nothing in the UI. The host now also records a child process that exits abnormally in the diagnostics
  ring, so this class of failure is visible instead of silent.
- Renaming a custom sound keeps the extension and accepts non-ASCII names: the sanitizer only replaces the characters
  Windows refuses, where it used to flatten anything outside `[A-Za-z0-9 ._-]` to underscores.

### Added

- Custom sounds can be renamed from the settings card; every situation that used the file follows its new id.

## [0.2.3] - 2026-11-06

### Added

- The settings page explains a silent sound instead of leaving it a mystery: with no `ffmpeg` on `PATH`, the
  "Custom sounds" card carries a yellow note with the install command, and Preview refuses a non-wav sound with
  the same reason.
- The host re-scans `PATH` for ffmpeg while it is missing, so installing it takes effect when the settings page
  is reopened — no DSH restart.

### Changed

- `GET /dsh-notify/sound-library` also reports `ffmpeg: boolean`; a host that does not send it is treated as
  "ffmpeg present" so an older host never raises a false warning.
- The custom-sounds copy now spells out how the three things relate: a situation picks a sound, importing copies the
  file into the plugin's own folder (so the original may be moved or deleted), and the transcode cache is a temporary
  derivative that clearing never deletes a sound.

### Fixed

- A transcode now writes a `.part` file and is promoted only once ffmpeg finishes. A conversion cut off by the
  eight-second sound cap used to leave a truncated wav that the next play accepted as cache; the clear button also
  reclaims leftover `.part` files.
- Deleting a custom sound switches every situation that used it back to that situation's default sound. Before,
  the stored id pointed at a file that no longer existed, the picker showed the raw id, and playback quietly fell
  back to the system chime.
- The settings navigation row follows the plugin language again: the section re-registers when the resolved
  language changes, which is how the shell re-reads an entry's label. Before, switching to 中文 could leave
  "Notifications" in the sidebar while the page itself was Chinese.

## [0.2.2] - 2026-11-06

### Added

- The plugin has its own interface language. A segmented control in the top-right corner of the settings
  card switches the plugin's copy and every popup text between Chinese and English, or leaves it on
  **Auto** to follow the DSH interface language. The choice is stored with the other settings
  (`language: 'auto' | 'zh' | 'en'`, default `auto`); nothing else in DSH changes.
- `package.json` declares the top-level `types` entry next to the `exports` types, so TypeScript
  consumers using the classic `node` module resolution find the declarations.

### Changed

- The host half awaits the projection registration and reads state through the returned handle — the
  0.2.2 API; the diagnostics route takes the title unit's presence from the snapshot keys instead of the
  deprecated `stateOf(session, key)`.
- Efficiency, no behaviour change: the foreground-focus answer is cached for 2.5s (longer than one client
  poll) and the client asks for a fresh read when the window loses focus, so an unfocused window no longer
  spawns a PowerShell child every two seconds; the session tick compares a cheap shape before composing
  diagnostic strings, drops its per-session entry when a session disappears, and rebuilds the pending-id
  set only when an ask actually left; settings writes clamp only the fields a patch carries; the text
  manager composes one preview per group instead of one per saved text; the sound picker builds its panel
  only while open; the silence route logs only real stops.

### Verified

- DSH desktop 0.2.2-rc.1 on Windows 11 25H2 (build 26200): the plugin loads, the projection reports
  `notifyState=present`, host toasts are raised, the diagnostics and text-template routes answer, and the
  settings page switches between Chinese and English. See
  [acceptance](docs/acceptance/2026-11-06-bilingual-ui.md).

## [0.2.1] - 2026-10-31

### Fixed

- Toast identity is no longer the hard-coded Electron default. The host probes the candidate
  AppUserModelIDs — the named legacy id `electron.app.DeepSeek Harness` first (Windows resolves its
  display name and icon), then the manifest id `com.deepseek.dsh` — and uses the first identity Windows
  has registered; the choice is recorded in the diagnostics ring. Toasts keep working when the desktop
  app changes its AppUserModelID, and `DSH_NOTIFY_AUMID=id1;id2` overrides the candidate list for
  diagnosis.

### Verified

- DSH desktop 0.2.1-rc.5 on Windows 11 25H2 (build 26200): the plugin loads, the projection reports
  `notifyState=present`, the host toast is raised under `com.deepseek.dsh`, and the diagnostics and
  text-template routes answer. See [acceptance](docs/acceptance/2026-10-31-toast-identity.md).

## [0.2.0] - 2026-10-25

### Changed

- The settings section is now three cards: **Desktop notifications** (master switch, the test button
  directly below it, and the delivery mode), **Notify me in which of these situations** (the two groups of
  switches, each row carrying an example sentence) and **Notification setup** (one row per enabled situation
  with its sound, its popup text and a live preview, plus the two collapsible libraries).
- **Sounds are per situation** (nine: five turn ends, three waits, one reminder) instead of four groups.
  Existing group choices migrate automatically at read time - no settings are lost.
- **Popup texts are per situation.** Each situation can save up to three named texts
  (name / title / body, with the `{工作区} {状态} {内容} {分钟}` placeholders); the picker offers the built-in
  default and the saved texts. The wording lives in
  `%LOCALAPPDATA%\dsh-notify\templates\templates.json`; a customized pair from the previous global
  template iteration is migrated into each enabled situation on first start.
- The test notification moved under the master switch and its description now says it is for checking
  the configuration. The per-row **Preview** uses the situation's real text and sound; only the test
  toast keeps fixed copy.
- Custom sounds and custom texts are collapsible; the transcode cache lives inside the custom-sounds
  block. Deleting a custom sound or text asks for confirmation inline with a red destructive button.
- The four sound groups' preview buttons and fixed preview copy are gone, replaced by the per-situation
  preview.
- The custom-text manager is one compact header row per situation (name, count and the New-text
  button on one line); the empty-state line is gone and saved rows are shorter.
- Typography: the section follows the DSH theme font (`--dsw-font-family`); the template editor,
  placeholder chips and character counts use the code font (`--ds-font-family-code`) so placeholders line
  up; descriptions got a little more contrast and all numerals are tabular.
- The situations card moved directly under the master-switch card, above "Notification setup"; the
  example sentences lost their "例：" prefix.
- The template editor now explains each placeholder next to its insertable chip, in an aligned
  two-column hint block (what {工作区} / {状态} / {内容} / {分钟} map to).

### Added

- Host route `GET/POST /dsh-notify/text-templates`: reads every saved text and saves or deletes one,
  with per-situation validation (at most three, bounded name/title/body, atomic file replace).
- `GET /dsh-notify/debug` now also reports text-template save/delete lines in the client report ring.

### Verified

- On DSH desktop **0.2.1-rc.3**: the plugin loads, the projection is delivered, the host toast / sound /
  silence / text-template routes answer, and the settings page's preview, test notification and cache
  clearing were exercised for real. The text-template route passed a save → disk read → fresh GET →
  delete round-trip with Chinese content and left the store byte-identical afterwards.

## [0.1.1] - 2026-10-18

### Verified

- Compatibility with DSH desktop **0.2.1-rc.2** re-verified: version gate, plugin loading,
  session-projection delivery, host toast / sound / silence routes, `dsh://open` focus and a real
  Windows toast all pass. No runtime code changes. See
  `docs/acceptance/2026-10-18-dsh-0.2.1-rc.2-compat.md`.

### Added

- npm distribution: `dsh-notify-desktop` is installable from npm without cloning; local `link:`
  installs remain supported.

## [0.1.0] - 2026-10-10

First release, verified end to end on DSH desktop 0.2.0-rc.2 (see
`docs/acceptance/2026-10-10-desktop-e2e.md`).

### Added

- Windows toast notifications for five turn-end reasons (completed, error,
  aborted, blocked, max-tokens), for approval requests, for questions
  (including `run_code` PTC questions) and for plan reviews.
- Edge-triggered notifications with a 3-second de-duplication key, suppressed
  while the DSH window is focused.
- Click raises the DSH window through the app's own `dsh://open` protocol
  handler; it deliberately does not jump to the session.
- One reminder for a blocking interaction that stays unanswered (10 minutes by
  default, configurable).
- Per-situation sounds in four groups (finished / error / waiting-on-you /
  reminder), picked from a library with three sections: the twenty Windows
  sounds, the four author sounds shipped in `sounds/`, and the user's own
  imports (`.wav` / `.mp3` / `.m4a` / `.aac` / `.wma` / `.flac` /
  `.ogg` / `.opus`, copied into a folder and transcoded once with ffmpeg).
- File sounds are capped at eight seconds, and stop immediately when the sound
  switch is turned off or the DSH window regains focus.
- A settings section (settings → 通知 / Notifications) with every switch, the
  sound pickers with preview, the custom file entry and a transcode-cache
  readout with a clear button.