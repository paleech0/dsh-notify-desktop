# Author sounds

The four `.wav` files here ship with the plugin and appear in the settings
section under **作者音效 / Author sounds**, next to the Windows sounds and the
user's own imports:

| File | Situation |
|---|---|
| `1-任务正常结束.wav` | 任务正常结束 / finished |
| `2-任务出错.wav` | 任务出错 / error |
| `3-需要你处理.wav` | 需要你处理（审批 / 提问 / 计划评审）/ waiting on you |
| `4-超时催办.wav` | 超时催办 / still waiting |

The file name (without the extension) is the label the user sees, which is why
these are named after the situation in the user's language.

All four are original works by the repository owner, released under this
project's MIT licence (see [../LICENSE](../LICENSE) and
[../THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md)).

Adding more needs **no code change**: drop the file in this folder and it shows
up on the next load, because the host lists the folder instead of carrying a
fixed table.

- Formats: `.wav` `.mp3` `.m4a` `.aac` `.wma` `.flac` `.ogg` `.opus`
- The file name (without its extension) is the label the user sees.
- `.wav` plays directly; anything else is transcoded once with the user's
  `ffmpeg` and cached, so `.wav` is the friendliest thing to ship.
- Keep them short (a notification sound, not a track) and quiet.
