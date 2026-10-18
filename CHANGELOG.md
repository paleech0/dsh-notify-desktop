# Changelog

All notable changes to this plugin are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
