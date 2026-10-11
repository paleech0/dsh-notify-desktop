# Third-party notices

This plugin is MIT licensed (see [LICENSE](LICENSE)). It ships no runtime
dependencies: the host bundle is self-contained apart from Node's own built-in
modules, and the client bundle is a single file that uses the host's React.

The one piece of third-party code compiled into `lib/index.js` is listed below,
with the notice its licence requires.

## zod 4.6.5 — MIT

Compiled into `lib/index.js` (used for the projection payload schema).

```text
MIT License

Copyright (c) 2025 Colin McDonnell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Things that are referenced but not distributed

- **Windows sounds.** The built-in "Windows sounds" are played by asking Windows
  to play the files in `%SystemRoot%\Media`; no sound file from Windows is
  copied into this repository.
- **Author sounds.** The four `.wav` files in [`sounds/`](sounds/) are original
  works by the repository owner, released under the same MIT licence as the rest
  of this project.
- **Dev dependencies.** TypeScript, Vitest, Rolldown, jsdom and the
  `@deepseek-ai/*` packages are used to build and test only; none of them is
  redistributed here.

## Trademarks

This is an **unofficial** plugin. It is not affiliated with, endorsed by, or
sponsored by DeepSeek. "DeepSeek", "DSH" and "DeepSeek Harness" are used
descriptively, to say what this plugin plugs into. "Windows" is a trademark of
Microsoft Corporation.
