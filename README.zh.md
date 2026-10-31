# dsh-notify-desktop

[![npm](https://img.shields.io/npm/v/dsh-notify-desktop.svg)](https://www.npmjs.com/package/dsh-notify-desktop) · [English](README.md) · 中文

给 **DSH 桌面端** 加 Windows 原生通知：会话跑完、出错、或停下来等你确认时弹一条系统通知，并播放**为这种情况挑好的音效**、
显示**为这种情况写好的文字**；点通知把 DSH 窗口拉回前台。

<img src="https://raw.githubusercontent.com/paleech0/dsh-notify-desktop/main/docs/images/settings.png" width="460" alt="桌面通知与通知情况（上半）">

## 0.2.1 更新

- **Toast 身份自适应**：桌面端新版用 `com.deepseek.dsh` 登记通知、旧版用 `electron.app.DeepSeek Harness`。
  插件现在会在弹通知前探测系统认得的身份（新号优先、旧号兜底），桌面端换过通知身份后弹窗不会再静默失效；
  本次使用的身份会记进诊断接口。
- **兼容性**：在 DSH 桌面端 **0.2.1-rc.5** 实测通过（插件加载、会话投影、宿主 Toast 与身份自适应、诊断与文本模板路由）；
  声明范围不变。旧版设置和已保存的自定义文本原样保留，设置界面没有改动。

## 它能给你什么

- **该提醒时提醒** —— 回合结束（正常完成 / 出错 / 被中止 / 被阻塞 / Token 上限）、等待审批、等待回答、计划评审，
  以及等待过久时的一条催办。
- **你在看就不吵** —— DSH 窗口有焦点时一律不弹；同一件事只弹一次（3 秒去重）。
- **每种情况一套音效和文字** —— 九个情况（五个结束原因、三种等待、一个催办）各自挑音效、各自选弹窗文本；
  每个情况可以保存最多 3 套自定义文本，每行都能先点「预览效果」看/听。
- **通知形式三选一** —— 通知 + 提示音 / 仅通知（静音弹窗）/ 仅提示音（只出声，不弹窗）。
- **可以用自己的音效和文字** —— 音效来源三类：Windows 音效、随插件发布的作者音效（[sounds/](sounds/)）、你导入的文件；
  文字支持名称、标题、正文和占位符，保存在本机 JSON 里，改名/删除都走二次确认。
- **不会一直响** —— 文件类音效最长 8 秒；关掉总开关、切到「仅通知」、或切回 DSH 窗口，正在响的**立刻停**。
- **点击回前台** —— 通知只把窗口拉回前台，**刻意不跳转会话**（更可预测）。

**环境要求**：Windows + DSH 桌面端（profile `desktop`），运行时 0.2.x。`ffmpeg` 可选（仅用于把非 `.wav` 的自定义音效转码），
放在 `PATH` 里即可。

## 安装

### 从 npm 安装

```powershell
& "<DSH 桌面端安装目录>\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add dsh-notify-desktop
```

然后重启 DSH 桌面端，打开 **设置 → 通知**（窗口有焦点时按 `Ctrl+,`）。

### 从本地仓库安装

1. 把本仓库 clone 到一个**固定目录**（profile 以链接方式指向它，之后别挪动）。
2. 用桌面端自带 CLI 注册：

   ```powershell
   & "<DSH 桌面端安装目录>\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "link:<本仓库路径>"
   ```

3. 重启 DSH 桌面端，然后打开 **设置 → 通知**（窗口有焦点时按 `Ctrl+,`）。

## 设置项

设置页的「通知」段现在共三张卡。偏好存在渲染层 `localStorage`，文字和音效文件存在本机磁盘，改完立即生效。

**卡一「桌面通知」—— 要不要发、怎么发：**

| 控件 | 作用 |
|---|---|
| 启用通知 | 总开关；关掉后不再弹窗也不出声。交付相关的控件全部**变灰**（已选内容保留）：通知形式、各情况的音效/文本选择、预览、催办分钟数、下面的情况开关；只有「自定义音效」「自定义文本」仍可编辑 |
| 发送测试通知 | 就在总开关下方；固定用默认音效（Windows 通知）+ 弹窗，**不受**通知形式和下面任何设置影响，用于检测配置是否正常 |
| 通知形式 | 三选一：**通知 + 提示音**（默认）/ **仅通知**（只弹窗）/ **仅提示音**（只出声，不弹窗） |
<img width="415" height="534" alt="屏幕截图 2026-10-25 180124" src="https://github.com/user-attachments/assets/cbecba0a-704f-4e7f-a411-ed1ffca2b84f" />

**卡二「选择接收以下哪种情况的通知」—— 哪些情况要提醒：**

| 分组 | 开关 |
|---|---|
| 会话结束 | 正常完成 / 出错 / 被中止 / 被阻塞 / 达到 Token 上限（每行附一句例子） |
| 等待你确认 | 等待审批 / 等待回答 / 等待计划评审（每行附一句例子） |

<img width="409" height="427" alt="屏幕截图 2026-10-25 181130" src="https://github.com/user-attachments/assets/2558b1eb-7b2b-497c-bb8f-a3144ee1718f" />

**卡三「通知自定义」—— 每个情况的声音和文字：**

| 控件 | 作用 |
|---|---|
| 情况行 | 只列出你在卡二勾选的情况（勾选变化实时增减）。每行 = 情况名 + 音效选择器 + 文本选择器 + 「预览效果」 |
| 预览效果 | 用该情况当前选中的文本（默认文本按示例值渲染）和音效，按当前通知形式弹/响 |
| 音效选择器 | 两级：先选来源（Windows / 作者 / 自定义），再选具体音效 |
| 文本选择器 | 两级：**默认**（内置文案）或**自定义**（该情况保存的文本，按名称列出） |
| 自定义音效（可收起） | 添加 / 列出 / 删除你的音效文件；「转换缓存」占用与清理也在里面 |
| 自定义文本（可收起） | 按情况管理已保存文本：每个情况最多 3 套，每套有名称、标题、正文，带「编辑」和红色「删除」（删除有二次确认） |

勾选情况后，下面的「通知自定义」会实时出现对应行；取消勾选只是隐藏，已配的音效和文本都保留，重新勾选回来还在。

<img src="https://raw.githubusercontent.com/paleech0/dsh-notify-desktop/main/docs/images/settings-customize.png" width="460" alt="通知自定义：每个情况的音效、文本与两个折叠库">

## 音效

**三个分区。** 每个音效选择器都是两级：先选**来源**，再选该来源下的具体音效。

- *Windows 音效* —— 内置 20 个：5 个通知事件 + 系统媒体库（`chimes`、`ding`、`tada`、`Windows Error`、
  `Critical Stop`、`Alarm0x`、`Ring0x` 等）。
- *作者音效* —— 本仓库 [`sounds/`](sounds/) 里的 4 个 `.wav`。**往那个文件夹再丢文件就等于加音效**，不用改代码。
- *自定义音效* —— 你自己导入的。

**用自己的文件。** 点「添加音效…」会把文件**复制**到 `%LOCALAPPDATA%\dsh-notify\custom`，所以原文件之后移动或删除都不影响。
支持 `.wav`、`.mp3`、`.m4a`、`.aac`、`.wma`、`.flac`、`.ogg`、`.opus`。删除自定义音效会先弹行内确认。

**声音什么时候停。** `.wav` 直接播放；其他格式首次播放时用 `PATH` 上的 `ffmpeg` 转码一次，占用计入「自定义音效」里的
**「转换缓存」**（在那里查看与清理）。文件类音效最长 8 秒；总开关关掉、切到「仅通知」，或窗口重获焦点时，正在响的**立刻停**。
没有 ffmpeg 时，wav 与随插件发布的音效照常可用，诊断接口会显示 `media.ffmpeg: null`。

**为什么需要自定义音效。** Toast 只能引用 5 个 `ms-winsoundevent` 值，而在 Windows 11 上它们只对应 4 个**彼此很像**的
「叮」—— `Notification.IM` 与 `Notification.SMS` 甚至是同一个文件。想让不同情况真的听得出差别，只能由宿主自己播放音频。

## 弹窗文本

**每个情况一套文字。** 真实通知的标题和正文来自该情况当前选中的文本：

- **默认文本** —— 内置的 `{工作区} · {状态}` / `{内容}`，不需要配置。
- **自定义文本** —— 在该情况行里选择，或在卡三的「自定义文本」里新建/编辑。每个情况最多保存 **3 套**。

**编辑器。** 名称（最多 24 字）、标题（120 字）、正文（300 字）；占位符 `{工作区}` `{状态}` `{内容}` `{分钟}`
可点击插入，编辑器里会实时渲染一行预览。长度上限与 Windows Toast 的截断一致。

**测试与预览。** 卡一的「发送测试通知」永远是固定文案 + 系统默认音效；卡三的「预览效果」才用该情况真正的文本和音效
（跟随当前通知形式）。默认文本的 `{内容}` 为空时整条正文回退到该情况的内置提示句。

**存在哪里。** 文本内容保存在 `%LOCALAPPDATA%\dsh-notify\templates\templates.json`（和自定义音效同一个 `dsh-notify` 目录），
按情况分组、每个情况最多 3 套；写入走临时文件 + rename，损坏时按空库处理不会崩。设置里只存"当前用哪一套"的 id；
模板被删掉时该情况自动回退默认文本。**手动编辑这个文件后需要重启桌面端**（客户端启动时加载一次）。

## 兼容性

| | |
|---|---|
| 实测版本 | DSH 桌面端 **0.2.1-rc.5**：插件加载、会话投影、宿主 Toast（含 0.2.1 起的新旧身份自适应）、诊断与文本模板路由实测通过（[证据](docs/acceptance/2026-10-31-toast-identity.md)）；更早的 0.2.1-rc.3（设置页/音效/文本）与 rc.2 / rc.1 / 0.2.0-rc.2 记录见 `docs/acceptance/` |
| 声明范围 | `>=0.2.0-rc.2 <0.3.0-0`（semver 加载闸门）—— 表示**加载器会放行**从 0.2.0-rc.2 起的整条 0.2 线（含预发布）；**只有上表实测版本经过验证，范围内其它版本不保证**。0.2.0-rc.1 及更早、0.3.x 不在范围内 |
| 平台 | 仅 Windows 桌面端 profile；web profile 没有 Toast 通道，未验证 |
| seam 核对 | 0.2.1 运行时镜像不带 `.d.ts`；本插件用到的全部 seam 均按其编译 JS 复核通过 |

兼容声明同时写在 `dsh.engines.dsh` 和 `peerDependencies.@deepseek-ai/dsh`（两处保持一致）；
加载器用 `semver.satisfies(runtime, range, { includePrerelease: true })` 判定，**不匹配会直接跳过该插件**（不加载）。
运行时不在范围内时，可以显式豁免：

```powershell
dsh.cmd plugin --profile desktop allow-version dsh-notify-desktop@0.2.1 --dsh-version <你的版本> --accept-risk
```

## 工作原理

两半组成，**不改任何 harness 代码**。

- **宿主半侧**：注册一个会话投影（`notify`）和若干同源路由；文本模板的读写也由宿主完成（原子写、上限校验）。
- **客户端半侧**：从会话列表读那个投影，判断该不该通知，按情况取音效与文本，然后发出去 —— 窗口失焦时走宿主 PowerShell Toast，
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
| `GET/POST /dsh-notify/text-templates` | 读取全部文本模板；保存 / 删除一套 |
| `POST /dsh-notify/pick-file`、`GET /dsh-notify/foreground` | Windows 选文件框；OS 级焦点判定 |
| `GET /dsh-notify/questions` | 轮询宿主侧提问队列 |

**Toast 身份自适应。** 桌面端可能用两个 AppUserModelID 之一登记通知：新版是 `com.deepseek.dsh`，
旧版是 `electron.app.DeepSeek Harness`。宿主不写死：弹 Toast 前先在子进程里探测候选
（`CreateToastNotifier(...).Setting` 非空即视为已登记），新号优先、旧号兜底，选中的身份会记进诊断接口。
需要手动指定时，启动桌面端前设 `DSH_NOTIFY_AUMID=id1;id2`（分号分隔，按顺序尝试）。

## 排查

Windows 通知**不进操作中心**，所以诊断接口是唯一的证据通道。端口每次启动可能不同，取当前桌面端 Web 地址里的那个：

```powershell
Invoke-WebRequest http://127.0.0.1:<桌面端端口>/dsh-notify/debug
```

返回投影注册状态、客户端最近 40 条上报（每条决定、通道选择、平台结果），以及音效链路状态
（`media.ffmpeg`、`media.soundPlayers`）。每次宿主弹 Toast 还会记一行
`host-toast aumid=… candidates=…`，可以确认这次用的是哪个通知身份。

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
- 部分场景下点通知只把窗口拉回前台，不跳转会话。
- `error` 与 `max-tokens` 两个结束态只有单测覆盖，没有真机构造过。
- 插件无法感知通知被关闭，所以文件类音效用「封顶 8 秒」代替跟随通知生命周期。
- 一套自定义文本只属于一个情况；同一套文案给多个情况用需要各存一份。手工编辑模板文件后需重启桌面端才会重新读取。
- 仅支持 Windows 桌面端 profile。

## 许可证

[MIT](LICENSE) · 第三方许可见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

非官方插件：与 DeepSeek 官方无关，未获其背书或赞助。「DeepSeek」「DSH」「DeepSeek Harness」仅用于说明本插件接入的对象。
