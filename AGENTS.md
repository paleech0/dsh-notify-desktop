# AGENTS.md — dsh-notify-desktop 仓库规则

> 面向在本仓库工作的 AI/人类协作者。**规则在此**；实现说明见 README。

## 铁律

1. **不改 harness**。本插件只用公开 seam：session projection、session list、settings slot、locale、webServer route。
   不修改 `<DSH desktop install>` 下任何文件，不往官方转发事件表里加事件，不给外壳 `process.send` 发自定义 type（白名单外 = 外壳 SIGTERM 打死宿主）。
2. **peer 依赖精确对齐运行时**。运行时 = `<DSH desktop install>`（**0.2.1-rc.2**；devDependencies 仍锁 0.2.0-rc.2 仅供构建/类型检查，且 0.2.1-rc.2 运行时镜像不带 `.d.ts`）。装/升任何 `@deepseek-ai/*` 前
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
| 通知形式 = 仅提示音（2026-10-25 新增） | **不弹任何东西**，`POST /dsh-notify/sound` 让宿主单独播放音效 | 无 |

**判据是 `!document.hasFocus()`，不是 `document.hidden`**：渲染层通知只在窗口有焦点时可靠，而那时按设计不弹 ——
所以按「可见/隐藏」分流等于让最常见的场景落到一条不可靠的通道上（实测：最小化、可见但失焦，渲染层都是静默失效）。

宿主 Toast 的三个硬约束（实测，别"优化"掉）：PowerShell **绝对路径**、**不要 `detached`**、**stdio 保留管道并 drain**（`'ignore'` 会让 Toast 静默失效且退出码仍为 0）。

## 通知形式、按情况音效与弹窗文本（2026-10-25 重构）

**情况（scenario）是唯一的分组键**，共 9 个（`src/scenarios.ts` 的 `SCENARIO_IDS`，顺序即 UI 顺序）：
`completed / error / aborted / blocked / max-tokens / approval / question / plan-review / reminder`。
前 5 个由 `turn/end` 的 reason 决定，中间 3 个由阻塞交互 kind 决定，`reminder` 没有独立开关（任一等待情况开启时才存在）。
**不要再引入"4 组音效"的概念**：音效和文本都按 9 个情况分别存（`settings.sounds` / `settings.texts`）。

- 设置模型：`enabled`（总开关）× `mode: 'both' | 'notify' | 'sound'` × `sounds[scenario]` × `texts[scenario]`
  （`'default'` 或磁盘模板 id）。决策返回 `scenario + sound`，**客户端按 mode 分流**：
  `sound` → 仅发声路由；`notify` → 静音 Toast；`both` → 照旧。`scenarioSound()` 在 `notify` 下统一返回 `'silent'`。
- 迁移（都在 `readSettings` 里、不换存储键）：`soundEnabled=false` → `mode:'notify'`；
  旧 4 组 `sounds.finished/error/attention/reminder` 按组下发到 9 个情况；旧全局 `titleTemplate/bodyTemplate`
  若有自定义值 → 放进 `legacyText`，客户端启动后写进各已启用情况的磁盘库并清掉该字段（失败则下次启动重试）。
- UI 三张卡：**① 桌面通知**（总开关 → 发送测试通知 → 通知形式三选一）→ **② 通知自定义**（按已勾选情况的行：
  音效选择器 + 文本选择器 + 预览效果；下方两个可折叠库：自定义音效（含转换缓存）、自定义文本）→
  **③ 选择接收以下哪种情况的通知**（"会话结束"5 个开关 / "等待你确认"3 个开关，每行带例子）。
- 总开关关闭时灰显：通知形式、各情况行的音效/文本选择、预览效果、催办分钟数、卡三全部开关、测试按钮；
  **只有**自定义音效（含缓存清理）和自定义文本仍可编辑；**总开关本身不变灰**。取消勾选只是隐藏该情况行，已配内容保留。
- 测试通知（卡一内）：**固定** `system:default` + 固定文案 + 永远走宿主 Toast 通道（无视焦点），不受任何其他设置影响。
- 预览效果（卡二每行）：用该情况**当前选中的文本**（默认文本用示例值渲染）+ 该情况音效，跟随 mode；
  这不是测试通知，文案不固定。
- 弹窗文本：默认文本 = 内置 `{工作区} · {状态}` / `{内容}`（`DEFAULT_TITLE_TEMPLATE/BODY_TEMPLATE`）；
  自定义文本每个情况最多 **3 套**，每套有名称（≤24）/标题（≤120）/正文（≤300），占位符
  `{工作区} {状态} {内容} {分钟}`（中英两套拼写都认）。`{内容}` 为空 → 正文回退该情况的内置提示句；
  选中模板被删 → 回退默认文本并写诊断。
- 文本内容存磁盘：`%LOCALAPPDATA%\dsh-notify\templates\templates.json`（与 `custom`/`sounds` 同级），
  按情况分组、每组 ≤3；写入 = 临时文件 + rename；损坏按空库处理。宿主路由 `GET/POST /dsh-notify/text-templates`
  负责读写与校验（`src/text-store.ts` 纯逻辑可测）。客户端**启动时加载一次**并缓存（`src/client/texts.ts`），
  编辑后由 store 回填；设置里只存模板 id。
- 排版（2026-10-25）：**字体跟随主题，不写死字体族** —— `.dsh_notify_section` 用 `var(--dsw-font-family, inherit)`，
  模板编辑器/占位符 chips/字数计数用 `var(--ds-font-family-code, …)` 半等宽；数字统一 `font-variant-numeric: tabular-nums`，
  说明文字透明度 0.72–0.78、行高 1.55。改样式时保持这两条，否则用户改了 DSH 正文字体插件会不跟、占位符对不齐。

## 音效（2026-10-10 实测，别再往媒体栈上撞）

- 宿主播放**只走 `System.Media.SoundPlayer`（wav）**。这台机器上三个媒体引擎在**子进程里全都打不开文件**：
  WinRT `MediaPlayer` → `state=None / IsOpen=False`；WPF `MediaPlayer` → 加了显式 Dispatcher 消息泵也 `hasDur=False`；
  `WMPlayer.OCX` → `state=9 / duration=0`。**沙箱 pwsh 和真 STA `WindowsPowerShell` 结果一致**。别再"优化"回媒体栈。
- 非 wav 自定义音效：宿主先用 `ffmpeg` 转成 wav（缓存 `%LOCALAPPDATA%\dsh-notify\sounds\<源路径 sha1 前 16 位>.wav`）再交给 SoundPlayer。
  ffmpeg 从 **PATH** 找（`ffmpeg.exe`），**wav 与内置音效库不依赖它**；找不到 → 静音，诊断接口 `media.ffmpeg` 会显示 `null`。
- 文件类音效**播放封顶 8 秒**（宿主 `setTimeout` + kill 子进程）；关总开关、切到「仅通知」、或窗口重获焦点，都会立刻掐（`POST /dsh-notify/silence`）。
- **仅发声路由**（`POST /dsh-notify/sound`，2026-10-25 新增）：id 解析与 Toast 完全同源（目录/白名单），播放复用同一套
  SoundPlayer 子进程管线（8 秒封顶 + soundPlayers + silence）。`system:*` 事件音**没有弹窗可挂 `<audio>`**，宿主用
  `reg.exe`（静态 argv，一次查整棵 `HKCU\AppEvents\Schemes\Apps\.Default`）解析 `.Current` 的 wav——
  本机实测 5 个事件全部解析成功且与 IM=SMS 重合（spike S3）；解析失败 → 静音 + debug 上报，下次重查。
  ⚠️ Mimosa 钩子拦一切**新增** PowerShell spawn（含 `-File`/`-EncodedCommand`/纯 env 形态）——改这段代码前先和用户对齐。
- 客户端**只发音效 id**；只有 `custom` 才附带路径，宿主校验「绝对路径 + 扩展名白名单 + 文件存在」；路径经**环境变量**传递，不进命令文本（同 XML 的规矩）。
- Toast XML 只能引用 `ms-winsoundevent:` 那 5 个事件，**且本机 `Notification.IM` 与 `Notification.SMS` 指向同一个 wav**、四个音彼此很像 —— 这就是"文件类音效"存在的理由，别删。
- 缓存与清理：`GET/POST /dsh-notify/sound-cache`（设置页「自定义音效」折叠里的「转换缓存」行）；清的是插件自己转码出来的 wav，源文件不动。
- 音效库三个分区：`Windows 音效`（静态目录 `SOUND_CHOICES`）、`作者音效`（仓库 `sounds/` 文件夹，宿主**每次请求扫目录**，加文件不用改代码）、`自定义音效`（`%LOCALAPPDATA%\dsh-notify\custom`，用户导入的副本）。
  id 形如 `author:<文件名>` / `custom:<文件名>`，**文件名一律来自宿主侧目录列表**，渲染层只能发音效 id。

## 提问为什么有两个来源（2026-10-10 实测，别再合并）

- 服务级提问（`dsh-plan-mode` 的 `interaction.ask()`）**不进会话日志** → 投影看不到；
- `user-questions/request` 瀑布在**目标 agent 作用域**派发，**全局插件订阅不到**（注册成功、送达 0 次，实测两次）；
- 宿主 `ctx.on(..., { global: true })` **能**收到 → 宿主观察 + 队列 + 客户端轮询，是唯一可行路径；
- 工具调用式提问（含 PTC）仍由投影负责（宿主拿不到它的 session）；
- 跨源去重键 = 摘要前 40 字 + 5 秒（**不含 session**，否则配不上）；代价是同措辞问题 5 秒内只弹一条。

## 事件形状（0.2.0-rc.2 实测；0.2.1-rc.1/rc.2 复核未变）

- 结束态：`turn/end` → `reason.kind`（completed/error/aborted/blocked/max-tokens/interrupted/forked）；
- 审批：`approval/asked` → `approval/decided`（requestId = `data.id`）；
- 问句：**两条路都要覆盖** —— 直接调用是 `tool/call`（`arguments` 为 JSON 字符串），
  从 `run_code` 内发起是 `tool/ptc-dispatch-start` / `tool/ptc-dispatch`（`arguments` 是**对象**，
  结束时才带 `content[].text = '{"answers":[…]}'`）。只写 `tool/call` 会导致问句完全不通知（踩过）。

## 诊断

`Invoke-WebRequest http://127.0.0.1:19387/dsh-notify/debug` → 投影注册状态 + 客户端最近 40 条上报
（每条决定、通道选择、平台结果）。Windows 通知不进操作中心，排查全靠它。

## 目录

    src/index.ts          host 入口：注册 notify 投影 + 全部同源路由
    src/projection.ts     host 纯 fold（turn 结束原因/正文 + 阻塞交互）
    src/text-store.ts     host 文本模板存储（校验、上限、原子写）
    src/scenarios.ts      两端共享的 9 个情况与文本模板模型
    src/protocol.ts       两端共享的线上词汇（路由与请求头）
    src/client/…          client 半侧：决策 / 通知 / 催办 / 跳转 / 设置段 / 文案 / 样式 /
                          文本库缓存（texts.ts）、文本选择器与管理器（TextPicker/TextManager）
    tests/                vitest（决策、催办、投影、通知器、跳转、设置段）
    docs/spikes/          实测记录（E1 通道、S2 托盘角标）
    docs/acceptance/      端到端验收记录

## 发版

- npm 包名 `dsh-notify-desktop`（2026-10-18 已发布 0.1.1；0.1.0 于 2026-10-17 发布）。发版走 GitHub Release：`.github/workflows/publish.yml` 用 **OIDC trusted publishing** 发布，不需要 token 或 2FA。
- npm 包页 Settings → Trusted Publisher 绑定 `paleech0/dsh-notify-desktop` + `publish.yml`（Allow npm publish）。
- 手动流程：`pnpm run check` → 提交 → `git tag v<version>` 推送 → 在 GitHub 创建 Release（workflow 自动发布；该版本已存在时会自动跳过）。
- 兜底：网页 staged 发布 + 账号 2FA（security key）批准（2026-10 实测；bypass-2FA token 直接发布 2027-01 起停用）。
