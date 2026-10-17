# Changelog

All notable changes to this plugin are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- npm distribution: `dsh-notify-desktop` is published on npm and can be installed without cloning —
  `dsh.cmd plugin --profile desktop add dsh-notify-desktop`. Local `link:` installs remain supported
  for development.

### Verified

- Compatibility with DSH desktop **0.2.1-rc.1** verified end to end on 2026-10-17: version gate, plugin
  loading, session-projection delivery, host toast / sound / silence channels, and an unfocused
  end-to-end notification all passed. See `docs/acceptance/2026-10-17-dsh-0.2.1-rc.1-compat.md`.

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
