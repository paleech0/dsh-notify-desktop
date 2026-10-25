# Changelog

All notable changes to this plugin are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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