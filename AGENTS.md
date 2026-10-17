# AGENTS.md — dsh-notify-desktop 仓库规则

> 面向在本仓库工作的 AI/人类协作者。**规则在此**；实现说明见 README。

## 铁律

1. **不改 harness**。本插件只用公开 seam：session projection、session list、settings slot、locale、webServer route。
   不修改 `<DSH desktop install>` 下任何文件，不往官方转发事件表里加事件，不给外壳 `process.send` 发自定义 type（白名单外 = 外壳 SIGTERM 打死宿主）。
2. **peer 依赖精确对齐运行时**。运行时 = `<DSH desktop install>`（**0.2.1-rc.1**；devDependencies 仍锁 0.2.0-rc.2 仅供构建/类型检查，且 0.2.1 运行时镜像不带 `.d.ts`）。装/升任何 `@deepseek-ai/*` 前
   用 `"<DSH desktop install>\resources\runtime\cli\bin\dsh.cmd" --version` 核对；对不上就停手问人。
3. **`lib/` 必须随源码提交**（profile 以链接方式装配，不发 npm 包）。
4. **`pnpm run check` 必须全绿**（typecheck + vitest + build）才能提交。
5. **装配只走桌面端自带 CLI**：
   `dsh.cmd plugin --profile desktop add "link:<repo>"`
   （**用 `link:`**，与 dsh-golden-caret 同形式：本体留在本地磁盘，profile 里只登记一条链接）；
   **重启权归用户** —— 我只做准备与验证，然后提示用户重启。
6. **宿主 bundle 必须自包含**：`lib/index.js` 除 node 内置模块外不得有 import，
   否则 profile 链接安装后解析不到依赖 → 插件树失败 → 桌面端起不来（历史事故见 DSH 记忆 `dsh-issues.md` §3）。
7. **client bundle 单文件**：web 服务器每个插件只服务一个 `client.js`，CSS/文案都打进去，不额外产物。

## 本机环境的两个坑（写进脚本，不靠人记）

- **沙箱禁止 spawn 带管道的子进程**：esbuild 的 CLI 因此不可用 → 构建走 **rolldown**（原生绑定，进程内）；
  vitest 必须用 **threads pool**（默认 forks 会 spawn）；vite 的 `net use` 探测需要打补丁
  （`scripts/patch-vite-sandbox.mjs`，`pnpm run test` 会自动应用）。
- **pnpm 设置写在 `pnpm-workspace.yaml`**（pnpm 11 不再读 package.json 的 `pnpm` 字段，`.npmrc` 只留 npm 兼容项）：
  `nodeLinker: hoisted`（本机不允许建目录链接）、`autoInstallPeers: false`（否则会拉进整个 DSH 应用 + 190MB LibreOffice）、
  `storeDir/cacheDir` 留在工作区内（默认 store 在别的盘且沙箱不可写）。

## 通知的两条通道（改代码前必读）

| 窗口状态 | 通道 | 点击 |
|---|---|---|
| **有焦点** | **不弹**（按设计抑制） | — |
| **无焦点**（可见但没被选中 / 最小化 / 隐藏） | 宿主 PowerShell Toast（AUMID `electron.app.DeepSeek Harness`） | 只能回前台 |
| 无焦点但宿主路由不可达 | 渲染层 `new Notification()`（兜底） | 回前台 + 跳会话 |

**判据是 `!document.hasFocus()`，不是 `document.hidden`**：渲染层通知只在窗口有焦点时可靠，而那时按设计不弹 ——
所以按「可见/隐藏」分流等于让最常见的场景落到一条不可靠的通道上（实测：最小化、可见但失焦，渲染层都是静默失效）。

宿主 Toast 的三个硬约束（实测，别"优化"掉）：PowerShell **绝对路径**、**不要 `detached`**、**stdio 保留管道并 drain**（`'ignore'` 会让 Toast 静默失效且退出码仍为 0）。

## 音效（2026-10-10 实测，别再往媒体栈上撞）

- 宿主播放**只走 `System.Media.SoundPlayer`（wav）**。这台机器上三个媒体引擎在**子进程里全都打不开文件**：
  WinRT `MediaPlayer` → `state=None / IsOpen=False`；WPF `MediaPlayer` → 加了显式 Dispatcher 消息泵也 `hasDur=False`；
  `WMPlayer.OCX` → `state=9 / duration=0`。**沙箱 pwsh 和真 STA `WindowsPowerShell` 结果一致**。别再"优化"回媒体栈。
- 非 wav 自定义音效：宿主先用 `ffmpeg` 转成 wav（缓存 `%LOCALAPPDATA%\dsh-notify\sounds\<源路径 sha1 前 16 位>.wav`）再交给 SoundPlayer。
  ffmpeg 从 **PATH** 找（`ffmpeg.exe`），**wav 与内置音效库不依赖它**；找不到 → 静音，诊断接口 `media.ffmpeg` 会显示 `null`。
- 文件类音效**播放封顶 8 秒**（宿主 `setTimeout` + kill 子进程）；关「提示音」总开关、或窗口重获焦点，都会立刻掐（`POST /dsh-notify/silence`）。
- 客户端**只发音效 id**；只有 `custom` 才附带路径，宿主校验「绝对路径 + 扩展名白名单 + 文件存在」；路径经**环境变量**传递，不进命令文本（同 XML 的规矩）。
- Toast XML 只能引用 `ms-winsoundevent:` 那 5 个事件，**且本机 `Notification.IM` 与 `Notification.SMS` 指向同一个 wav**、四个音彼此很像 —— 这就是"文件类音效"存在的理由，别删。
- 缓存与清理：`GET/POST /dsh-notify/sound-cache`（设置页「转换缓存」行）；清的是插件自己转码出来的 wav，源文件不动。
- 音效库三个分区：`Windows 音效`（静态目录 `SOUND_CHOICES`）、`作者音效`（仓库 `sounds/` 文件夹，宿主**每次请求扫目录**，加文件不用改代码）、`自定义音效`（`%LOCALAPPDATA%\dsh-notify\custom`，用户导入的副本）。
  id 形如 `author:<文件名>` / `custom:<文件名>`，**文件名一律来自宿主侧目录列表**，渲染层只能发音效 id。

## 提问为什么有两个来源（2026-10-10 实测，别再合并）

- 服务级提问（`dsh-plan-mode` 的 `interaction.ask()`）**不进会话日志** → 投影看不到；
- `user-questions/request` 瀑布在**目标 agent 作用域**派发，**全局插件订阅不到**（注册成功、送达 0 次，实测两次）；
- 宿主 `ctx.on(..., { global: true })` **能**收到 → 宿主观察 + 队列 + 客户端轮询，是唯一可行路径；
- 工具调用式提问（含 PTC）仍由投影负责（宿主拿不到它的 session）；
- 跨源去重键 = 摘要前 40 字 + 5 秒（**不含 session**，否则配不上）；代价是同措辞问题 5 秒内只弹一条。

## 事件形状（0.2.0-rc.2 实测；0.2.1-rc.1 复核未变）

- 结束态：`turn/end` → `reason.kind`（completed/error/aborted/blocked/max-tokens/interrupted/forked）；
- 审批：`approval/asked` → `approval/decided`（requestId = `data.id`）；
- 问句：**两条路都要覆盖** —— 直接调用是 `tool/call`（`arguments` 为 JSON 字符串），
  从 `run_code` 内发起是 `tool/ptc-dispatch-start` / `tool/ptc-dispatch`（`arguments` 是**对象**，
  结束时才带 `content[].text = '{"answers":[…]}'`）。只写 `tool/call` 会导致问句完全不通知（踩过）。

## 诊断

`Invoke-WebRequest http://127.0.0.1:19387/dsh-notify/debug` → 投影注册状态 + 客户端最近 40 条上报
（每条决定、通道选择、平台结果）。Windows 通知不进操作中心，排查全靠它。

## 目录

    src/index.ts          host 入口：注册 notify 投影 + /dsh-notify/focus 路由
    src/projection.ts     host 纯 fold（turn 结束原因/正文 + 阻塞交互）
    src/protocol.ts       两端共享的线上词汇（路由与请求头）
    src/client/…          client 半侧：决策 / 通知 / 催办 / 跳转 / 设置段 / 文案 / 样式
    tests/                vitest（决策、催办、投影、通知器、跳转、设置段）
    docs/spikes/          实测记录（E1 通道、S2 托盘角标）
    docs/acceptance/      端到端验收记录

## 发版

- npm 包名 `dsh-notify-desktop`（2026-10-17 已发布 0.1.0）。发版走 GitHub Release：`.github/workflows/publish.yml` 用 **OIDC trusted publishing** 发布，不需要 token 或 2FA。
- npm 包页 Settings → Trusted Publisher 绑定 `paleech0/dsh-notify-desktop` + `publish.yml`（Allow npm publish）。
- 手动流程：`pnpm run check` → 提交 → `git tag v<version>` 推送 → 在 GitHub 创建 Release（workflow 自动发布；该版本已存在时会自动跳过）。
- 兜底：网页 staged 发布 + 账号 2FA（security key）批准（2026-10 实测；bypass-2FA token 直接发布 2027-01 起停用）。
