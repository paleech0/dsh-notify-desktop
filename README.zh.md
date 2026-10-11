# dsh-notify-desktop

[English](README.md) · 中文

给 **DSH 桌面端** 加 Windows 原生通知：会话跑完、出错、或停下来等你确认时弹一条系统通知，并播放**为这种情况挑好的音效**；
点通知把 DSH 窗口拉回前台。

<img src="docs/images/settings.png" width="460" alt="通知设置">

## 它能给你什么

- **该提醒时提醒** —— 回合结束（正常完成 / 出错 / 被中止 / 被阻塞 / Token 上限）、等待审批、等待回答、计划评审，
  以及等待过久时的一条催办。
- **你在看就不吵** —— DSH 窗口有焦点时一律不弹；同一件事只弹一次（3 秒去重）。
- **每种情况一个声音** —— 四组（正常结束 / 出错 / 需要你处理 / 超时催办），可选的来源有三类：Windows 音效、
  随插件发布的作者音效（[`sounds/`](sounds/)）、以及你自己导入的文件。
- **可以用自己的音效** —— 点「添加音效…」会把选中的文件**复制**进插件目录，可以同时放多个，之后也能逐个删除。
- **不会一直响** —— 文件类音效最长 8 秒；关掉提示音、或切回 DSH 窗口，正在响的会**立刻停**。
- **点击回前台** —— 通知只把窗口拉回前台，**刻意不跳转会话**（更可预测）。

**环境要求**：Windows + DSH 桌面端（profile `desktop`），运行时 0.2.x。`ffmpeg` 可选（仅用于把非 `.wav` 的自定义音效转码），
放在 `PATH` 里即可。

## 安装

1. 把本仓库 clone 到一个**固定目录**（profile 以链接方式指向它，之后别挪动）。
2. 用桌面端自带 CLI 注册：

   ```powershell
   & "<DSH 桌面端安装目录>\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "link:<本仓库路径>"
   ```

3. 重启 DSH 桌面端，然后打开 **设置 → 通知**（窗口有焦点时按 `Ctrl+,`）。

## 设置项

所有开关都在设置页的同一个「通知」段里。偏好存在渲染层 `localStorage`，改完立即生效。

| 控件 | 作用 |
|---|---|
| 启用通知 | 总开关；关掉后一律不弹 |
| 提示音 | 一次性静音所有音效组 |
| 音效 | 四类情况各一个选择器，带「试听」 |
| 自定义音效 | 添加 / 列出 / 删除你自己的文件 |
| 转换缓存 | 显示转码 wav 的占用，并可一键清理 |
| 结束提醒 | 每种回合结束原因一个开关 |
| 等待确认 | 每种阻塞交互一个开关 |
| 催办 | 多少分钟后补一条；另有测试按钮 |

## 音效

**三个分区。** 每个选择器都是两级：先选**来源**，再选该来源下的具体音效。

- *Windows 音效* —— 内置 20 个：5 个通知事件 + 系统媒体库（`chimes`、`ding`、`tada`、`Windows Error`、
  `Critical Stop`、`Alarm0x`、`Ring0x` 等）。
- *作者音效* —— 本仓库 [`sounds/`](sounds/) 里的 4 个 `.wav`。**往那个文件夹再丢文件就等于加音效**，不用改代码。
- *自定义音效* —— 你自己导入的。

**用自己的文件。** 点「添加音效…」会把文件**复制**到 `%LOCALAPPDATA%\dsh-notify\custom`，所以原文件之后移动或删除都不影响。
支持 `.wav`、`.mp3`、`.m4a`、`.aac`、`.wma`、`.flac`、`.ogg`、`.opus`。

**声音什么时候停。** `.wav` 直接播放；其他格式首次播放时用 `PATH` 上的 `ffmpeg` 转码一次，占用计入列表下面的
**「转换缓存」**（在那里查看与清理）。文件类音效最长 8 秒；关掉提示音或窗口重获焦点时，正在响的**立刻停**。
没有 ffmpeg 时，wav 与随插件发布的音效照常可用，诊断接口会显示 `media.ffmpeg: null`。

**为什么需要自定义音效。** Toast 只能引用 5 个 `ms-winsoundevent` 值，而在 Windows 11 上它们只对应 4 个**彼此很像**的
「叮」—— `Notification.IM` 与 `Notification.SMS` 甚至是同一个文件。想让四类情况真的听得出差别，只能由宿主自己播放音频。

## 兼容性

| | |
|---|---|
| 实测版本 | DSH 桌面端 **0.2.0-rc.2**，每个场景都跑过真机（[证据](docs/acceptance/2026-10-10-desktop-e2e.md)）|
| 声明范围 | `>=0.2.0-rc.2 <0.3.0-0` —— 即整条 0.2 线，含预发布版 |
| 平台 | 仅 Windows 桌面端 profile；web profile 没有 Toast 通道，未验证 |
| 0.2.1-alpha.2 | 未运行过；已把其发布的类型声明与本机 rc.2 逐行对比，本插件用到的 seam 完全一致 |

profile 加载器只看 `peerDependencies` 里名为 `@deepseek-ai/dsh` 或 `@deepseek-ai/dsh-*` 的条目，
用 `semver.satisfies(runtime, range, { includePrerelease: true })` 判定；**不匹配会直接跳过该插件**（不加载）。
运行时不在范围内时，可以显式豁免：

```powershell
dsh.cmd plugin --profile desktop allow-version dsh-notify-desktop@0.1.0 --dsh-version <你的版本> --accept-risk
```

## 工作原理

两半组成，**不改任何 harness 代码**。

- **宿主半侧**：注册一个会话投影（`notify`）和若干同源路由。
- **客户端半侧**：从会话列表读那个投影，判断该不该通知，然后发出去 —— 窗口失焦时走宿主 PowerShell Toast，
  路由不可达时退回渲染层通知。

提问**故意有两个来源，都不能删**：工具调用式提问能进投影；而服务级提问（计划评审）根本不进会话日志，
所以宿主用 `{ global: true }` 监听 `user-questions/request` 瀑布，经有界队列交给客户端。跨源去重键保证不会重复弹两条。

| 路由 | 用途 |
|---|---|
| `GET /dsh-notify/debug` | 投影状态 + 客户端最近上报 + ffmpeg/播放器状态 |
| `POST /dsh-notify/toast` | 弹一条通知（标题、正文、音效 id）|
| `POST /dsh-notify/focus` | 通过 `dsh://open` 把窗口拉回前台 |
| `POST /dsh-notify/silence` | 停掉正在播放的声音 |
| `GET/POST /dsh-notify/sound-library` | 列出两个音效目录 |
| `POST /dsh-notify/import-sound`、`/delete-sound` | 添加 / 删除自定义音效 |
| `GET/POST /dsh-notify/sound-cache` | 查询 / 清理转码缓存 |
| `POST /dsh-notify/pick-file`、`GET /dsh-notify/foreground` | Windows 选文件框；OS 级焦点判定 |
| `GET /dsh-notify/questions` | 轮询宿主侧提问队列 |

## 排查

Windows 通知**不进操作中心**，所以诊断接口是唯一的证据通道：

```powershell
Invoke-WebRequest http://127.0.0.1:19387/dsh-notify/debug
```

返回投影注册状态、客户端最近 40 条上报（每条决定、通道选择、平台结果），以及音效链路状态
（`media.ffmpeg`、`media.soundPlayers`）。

## 开发

```powershell
pnpm install
pnpm run check      # typecheck + vitest + build
```

`lib/` 是**故意提交**的：profile 链接的就是这个目录，构建产物随源码一起走。[AGENTS.md](AGENTS.md) 里是仓库规则，
以及那些**不许"优化"掉**的实测约束 —— 宿主 bundle 必须自包含、Toast 子进程必须保留管道 stdio、音频只能走
`System.Media.SoundPlayer`。

## 已知限制

- 没有托盘角标 / 任务栏角标 / 窗口闪烁；那些需要主进程 API，插件够不到。
- 点通知只把窗口拉回前台，不跳转会话。
- `error` 与 `max-tokens` 两个结束态只有单测覆盖，没有真机构造过。
- 插件无法感知通知被关闭，所以文件类音效用「封顶 8 秒」代替跟随通知生命周期。
- 仅支持 Windows 桌面端 profile。

## 许可证

[MIT](LICENSE) · 第三方许可见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

非官方插件：与 DeepSeek 官方无关，未获其背书或赞助。「DeepSeek」「DSH」「DeepSeek Harness」仅用于说明本插件接入的对象。
