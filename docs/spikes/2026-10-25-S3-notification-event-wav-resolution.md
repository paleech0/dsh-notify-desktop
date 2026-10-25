# S3 — `ms-winsoundevent` 事件能否解析成具体 wav（2026-10-25）

**目的**：「仅提示音」模式（通知形式三选一之一）不弹 Toast，声音必须由宿主单独播放。
`file:*` 音效本来就是 SoundPlayer 播文件，没有问题；`system:*` 音效在 Toast 里走
`<audio src="ms-winsoundevent:...">`，离开 Toast 就没有播放器。验证：能否从注册表
把事件解析成具体 wav 路径，交给现有的 SoundPlayer 管线。

**方法**（只读）：

```powershell
Get-ItemProperty 'HKCU:\AppEvents\Schemes\Apps\.Default\<事件>\.Current' .'(default)'
```

**实测结果**（本机，Windows 11）：

| 事件 | `.Current` 指向 | 存在 |
|---|---|---|
| `Notification.Default` | `C:\Windows\media\Windows Notify System Generic.wav` | ✅ |
| `Notification.IM` | `C:\Windows\media\Windows Notify Messaging.wav` | ✅ |
| `Notification.Mail` | `C:\Windows\media\Windows Notify Email.wav` | ✅ |
| `Notification.SMS` | `C:\Windows\media\Windows Notify Messaging.wav` | ✅（与 IM 同文件，印证 AGENTS.md「IM 与 SMS 同一个 wav」） |
| `Notification.Reminder` | `C:\Windows\media\Windows Notify Calendar.wav` | ✅ |

事件键清单里同时存在 `Notification.Looping.*` 系列（闹钟/来电循环音），本插件不使用。

**结论**：可行。宿主在「仅发声」路径上把 `system:*` 的 id 映射到对应事件名，经
注册表 `.Current` 解析出 wav（结果按事件缓存，方案变更或文件缺失时重查/回退），
然后走与文件音效完全相同的 SoundPlayer 子进程管线（8 秒封顶、`/silence`、焦点掐音）。
解析失败 → 静音并在 `/dsh-notify/debug` 上报。
