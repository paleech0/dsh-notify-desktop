# DSH 桌面端原生通知插件 实施计划

> **给自动化执行者**：本计划按任务逐条执行，步骤用 - [ ] 复选框跟踪；建议配合 superpowers:executing-plans 使用。

**Goal**：为 DSH 官方桌面端（profile = desktop，运行时 0.2.0-rc.2）做一个通知插件——任务完成 / 等待你确认 / 出错时弹 Windows 原生通知 + 可关闭的提示音，点击通知把 DSH 窗口调到前台并跳到对应会话；交互语义对齐 ZCode。

**Architecture**：沿用已被验证的 DSH 插件形态（host 半侧 + client 半侧）。host 侧通过 session projection seam 把会话事件折成有界投影（最近一次 turn 的结束原因 + 当前阻塞交互），**不需要改 harness**；client 半侧（浏览器 bundle）读投影 + 本地偏好，决定是否弹通知、播放提示音、处理点击跳转。

**Tech Stack**：TypeScript / @deepseek-ai/cordis 4.0.4 / @deepseek-ai/dsh-session 0.2.0-rc.2 / @deepseek-ai/dsh-session-projection 0.2.0-rc.2 / zod / vitest / esbuild(build.mjs) / React（设置页）/ Electron 渲染层（Notification API + HTMLAudioElement）

## 全局约束（每个任务都隐含遵守）

- 本期只做 **desktop profile**；web（0.1.2-rc.1）不在范围内（用户 2026-10-10 确认：先桌面端跑通）。
- 运行时精确版本：DSH 0.2.0-rc.2（Node 24.21.0 / pnpm 11.7.0，Electron 44）。peer 依赖按下方版本表精确声明，**装前必须核对兼容声明 == 运行时版本**。
- 插件只能通过桌面端自带 CLI（<DSH desktop install>\resources\runtime\cli\bin\dsh.cmd plugin --profile desktop ...）或 GUI 插件页管理；npm 全局装的 dsh 会被官方拒绝。
- **重启权归用户**：需要重启才生效的变更，我只做全部准备工作（改文件、备份、node --check、真实 import 验证），然后明确提示用户重启并停下。
- 不改 harness 源码；不改 profile 的 cordis.patch.yml 既有内容（只允许插件安装动作自身写入的行）。
- 安装任何依赖前必须先问用户；不在 DSH 会话内执行 npm i -g @deepseek-ai/dsh。
- 删除文件一律送回收站；临时产物用完即清并告知用户。
- 文档与交互用中文；代码内注释沿用生态习惯（英文亦可）。

### 运行时版本表（2026-10-10 实测，取自 <DSH desktop install>\resources\app.asar\dsh\node_modules\@deepseek-ai\*）

    @deepseek-ai/cordis                 4.0.4
    @deepseek-ai/dsh-session            0.2.0-rc.2
    @deepseek-ai/dsh-session-projection 0.2.0-rc.2
    @deepseek-ai/dsh-user-approval      0.2.0-rc.2
    @deepseek-ai/dsh-user-questions     0.2.0-rc.2
    @deepseek-ai/dsh-jobs               0.2.0-rc.2
    @deepseek-ai/dsh-client-ui-settings 0.2.0-rc.2
    @deepseek-ai/dsh-client-ui-renderer 0.2.0-rc.2
    @deepseek-ai/dsh-client-locale      0.2.0-rc.2
    @deepseek-ai/dsh-api-session-controller 0.2.0-rc.2
    @deepseek-ai/dsh-client-store       0.2.0-rc.2
    @deepseek-ai/dsh-client-ui-conversation 0.2.0-rc.2

## 0. 已拍板的决策（2026-10-10 用户确认）

- **D1 = 方案 A：新建独立包。** 不改造 <plugins dir>\dsh-notification 0.1.2（它面向 DSH 0.1.2-rc.1 的 web profile）；新包复用它的投影写法与 seam，按 0.2.0-rc.2 + ZCode 语义重写。
- **D2 = ① 只靠通知本身。** 放弃托盘角标与窗口闪烁（插件侧拿不到桌面壳 API），在 README 写明这条限制。
- **D3 = 确认。** 包名 dsh-notify-desktop；源码放当前工作区 <repo>；装配走 file: 路径。
- **D4 = 提示音先用系统通知自带音**（不自备音效；声音开关保留，将来接自备音效时无需改契约）。
- **D5 = 场景加一条「等待确认超过 N 分钟 → 补一条催办提醒」**（N 做成设置项，默认 10 分钟）。

## 1. 核对结果（本计划的证据基础）

| # | 结论 | 证据 |
|---|---|---|
| 1 | **host 侧插件没有任何原生通知 / 托盘 / 窗口 API** | 扫描 @deepseek-ai 全部 289 个包的 980 个 JS 文件（23.0 MB），对 new Notification( / Notification.isSupported / BrowserWindow / new Tray( / flashFrame / setBadgeCount / displayBalloon 等模式 **0 命中** |
| 2 | 会话事件词汇共 60 个，含 turn/start、turn/end、approval/asked、approval/decided、approval/policy、tool/call、tool/result、step/start、step/end、user/message、assistant/message | dsh-session\lib\types\known-event-types.js |
| 3 | turn 结束原因词汇：completed / error / aborted / blocked / max-tokens | 现有插件 <plugins dir>\dsh-notification\src\contract.ts（NotificationReason 注释：the raw TurnEndReason kind） |
| 4 | 审批 seam：应答者是 **approval/request waterfall** 监听器；审计事件 approval/asked、approval/decided | dsh-user-approval README.zh.md |
| 5 | 提问 seam：ctx.userQuestions.ask() / askTimed()，问题可带 intent（已知标记 plan-review = 计划审阅） | dsh-user-questions README.zh.md |
| 6 | 后台任务结算有事件流，dsh-tool-jobs 把结算变成**会话内**通知（不是系统通知） | dsh-jobs README.zh.md |
| 7 | client 插件契约：package.json 的 dsh.client { platform: 'web', inject: [...] } + 导出 ./client bundle，由 dsh-client-modules 置入 /plugins 懒加载 | dsh-client-modules README.zh.md；运行时 71 个包声明了 dsh.client |
| 8 | 有现成可复用模板：dsh-notification 0.1.2 —— host 用 ctx.sessionProjections 注册纯 fold，client 读会话列表完成提醒 + projectionValues，偏好存 localStorage，构建 pnpm run check（typecheck + vitest + build），lib 提交进仓库 | <plugins dir>\dsh-notification（AGENTS.md / src/projection.ts / src/contract.ts） |
| 9 | desktop profile 现装 8 个第三方包，**没有任何通知插件** | %USERPROFILE%\.dsh\profiles\desktop\package.json |
| 10 | 桌面端关窗口 ≠ 退出，窗口隐藏后仍在后台跑 | %USERPROFILE%\.dsh\memory\desktop.md §6 |

### 1.5 子代理可行性报告（2026-10-10 落地，760 行，全带文件路径证据）

报告：[dsh-notification-feasibility.md](dsh-notification-feasibility.md)（同目录上级 docs/）。对方案影响最大的结论：

- 桌面端 = Electron 主进程 fork 一个**纯 Node 子进程**跑 Cordis 宿主；插件**拿不到 Electron API**（实测 require('electron') 抛错）⇒ 宿主侧没有内建通知通道。
- **红线**：插件给外壳 process.send 发白名单外的 type，外壳会 child.kill("SIGTERM") **打死宿主**（app.asar\lib\main.js:3544）。
- 官方有一份机器可读事件目录：@deepseek-ai\dsh-tool-cordis\lib\types\api-catalog.js（EVENT_API 81 条 @L3690、SERVICE_API 91 个 @L15）。
- 三类检测**全部能做**：turn/end（completed | aborted | blocked | error | max-tokens | interrupted | forked）、agent/error、approval/request（waterfall）、user-questions/request（计划确认看 intent.kind === 'plan-review'）。两个 waterfall 监听**必须 return next()**，否则顶掉官方批准框/提问卡。
- 弹原生通知两条独立路：① **渲染侧 Web Notification**（dsh-app: 是 secure context、主窗口 defaultSession 对非 media 权限一律放行 ⇒ 权限 granted；但 Electron 默认 AUMID 与安装器写入的 com.deepseek.dsh 是否一致**未验证** → 实验 E1）；② **宿主侧 PowerShell Toast**（Medium IL 实测成功；DSH 沙箱的 Low IL 失败 0x80073D54 ⇒ 必须直接 child_process.spawn，且本机只有 PS 5.1，要写死 powershell.exe 绝对路径 → 实验 E2）。
- 拉前台**能做到**：注册表 HKCU\Software\Classes\dsh\shell\open\command 已注册 → second-instance → focusPrimaryWindow()（restore+show+focus）；宿主侧 start "" dsh://open 即可。
- 跳会话：Electron 侧**做不到**（dsh:// 只认 open，Windows second-instance 丢弃 argv）；渲染侧 ctx.uiWorkspace.openSession(sessionId) **能做到**（第三方 dsh-sidebar-qa 已有先例）。
- 渲染侧只能收到 **27 条硬编码转发事件**（dsh-api-remotes API_REMOTE_FORWARDED_EVENTS，单例注册，插件加不进自己的）⇒ 自定义推送要走自己的 HTTP 路由（先例 dsh-sidebar-qa 的 /sidebarqa/api/*）或 @Remote。
- 注入通道 webserver/index-inject 是桌面端唯一进页面的路，**宿主启动只收集一次**，必须在 apply() 最早期同步注册；用 kind:"script" 内联（外链失败会让整页 boot reject）。可抄先例：dsh-whale-widget（注入 + 自建路由 + turn/end 监听 + 音效）。
- 托盘 / 角标 / 窗口闪烁：插件侧**做不到**（DesktopTray 是主进程私有类且菜单硬编码；flashFrame 全库 1 处、setBadgeCount/setOverlayIcon/displayBalloon 全库 0 处）⇒ 印证 D2 决策，替代用侧栏会话行角标。

### ZCode 对照（要实现的语义，全部来自其源码）

| 语义 | ZCode 做法 | 本期是否做 |
|---|---|---|
| 触发场景 | 终态 completed / failed；阻塞 permission_request / elicitation_request（含 ExitPlanMode 计划确认） | 做（对应 turn/end reason + approval/asked + userQuestions） |
| 边沿触发 | 只在状态变化时发，首个快照只做基线 | 做 |
| 等待超时催办 | ZCode 不做 | **做（本期新增，见 D5）** |
| 窗口抑制 | 任一应用窗口处于焦点则不弹 | 做（client 侧判定当前会话可见性 + document.hasFocus） |
| 去重 | 3 秒窗口，键 status:taskId；permission/elicitation 改用 requestId | 做 |
| 提示音 | 系统音关闭（silent: true），应用自己播 mp3；播放前 currentTime 归零；失败静默 | 做 |
| 设置 | 总开关 + 提示音子开关，子开关强制叠加总开关 | 做 |
| 点击 | restore → show → focus → 发 taskId 给渲染层跳会话 | 做 |
| 角标 | 仅 macOS/Linux 用 setBadgeCount，Windows 不做 | 见 D2 |
| 托盘 | Windows 专有 Tray + 菜单 | 见 D2（插件侧预期做不到） |

## 2. 技术路线与风险（2026-10-10 依据可行性报告更新）

**路线 A（首选）：单包双面 —— 宿主半做注入与通道，渲染半做检测与展示**

    Host 半（跑在 dsh-desktop-host 的 Node 子进程）
      ctx.on("webserver/index-inject", ...)   ← apply() 最早期同步注册，注入一段极小 script
      ctx.webServer.register("/dsh-notify")   ← 自建路由：POST /focus（start "" dsh://open 拉前台）、GET /sound.wav
    Client 半（跑在渲染进程）
      ctx.remote.$on("api-session/status" | "api-session/error" | "approval/request" | "user-questions/request")
        ← 官方 27 条转发事件里正好覆盖三类触发；waterfall 监听必须 return next()
      → 决策（总开关 / 场景开关 / 边沿 / 3 秒去重，批准与提问按 requestId / 当前会话可见性抑制）
      → new Notification(...) + new Audio("/dsh-notify/sound.wav")
      → onclick：fetch POST /dsh-notify/focus 拉前台 + ctx.get("uiWorkspace").openSession(sessionId) 跳会话
      → 侧栏槽位 sidebar.session.row.leading 加角标（替代托盘角标）

**路线 B（降级，仅当 E1 判定渲染侧弹不出原生通知）**：检测全挪 Host 半，child_process.spawn(powershell.exe 绝对路径) 弹 Toast（AUMID com.deepseek.dsh + 系统提示音 + activationType="protocol" launch="dsh://open"）。代价：点击只能拉前台，跳会话要多绕一圈（页面恢复焦点后向宿主查询 sessionId 再导航）。

**红线（来自报告，必须遵守）**

- 绝不给外壳 process.send 自定义 type（白名单外 → 外壳 SIGTERM 打死宿主）。
- 绝不用 dsh://<会话 id> 传参（Electron 只认 dsh://open）。
- 绝不经 DSH 沙箱 shell 弹 Toast（Low IL 下 CreateToastNotifier 失败）。
- 注入只允许 kind:"script" 内联；不改 harness；不试图往官方转发事件表里加事件。

**风险**

- R1 渲染侧通知能否真弹（AUMID 未验证）→ 实验 E1 定生死，失败转路线 B。
- R2 窗口隐藏/最小化时渲染层可能被后台节流 → 走路线 B，或「窗口恢复焦点后补发」。
- R3 自动播放策略可能拦下提示音 → 实验 E5；失败则退回系统通知自带音（D4 已选）。
- R4 第三方 client 插件用 ctx.remote.$on 属首次使用（本机已装插件没人用过）→ 实验 E7。

## 3. 文件结构（拟建，源码放当前工作区）

    package.json            name=dsh-notify-desktop，声明 dsh.client、files、scripts
    tsconfig.json / vitest.config.ts / build.mjs      构建：esbuild 产出 lib/index.js 与 lib/client.js
    dsh.plugin.json         插件清单（entry + client.platform）
    cordis.patch.yml        bundle 补丁（insert 一行挂载插件）
    src/types.ts            共享契约：投影 payload / 通知意图 / 偏好形状
    src/index.ts            host 插件入口：注册 projection（唯一副作用）
    src/projection.ts       host 纯 fold：turn/end 原因 + 阻塞交互
    src/invariant.ts        不变式伴生插件（可选，开发期校验）
    src/client/index.ts     client 插件入口：订阅投影 + 串联决策与通知
    src/client/decision.ts  纯决策：开关 / 场景 / 边沿 / 去重 / 抑制（全部可单测）
    src/client/reminder.ts  等待确认超时催办的纯函数 + 调度
    src/client/notifier.ts  Notification 封装 + 提示音播放
    src/client/navigate.ts  跳到对应会话
    src/client/settings.ts  偏好持久化（localStorage）
    src/client/SettingsSection.tsx  设置页「通知」段
    src/client/locales.ts   中英文案
    tests/*.spec.ts         vitest
    docs/spikes/*.md        S1 / S2 实测记录
    docs/acceptance/*.md    端到端验收记录

## 4. 任务

### Task S1（Spike，先做）：E1 / E2 定生死，其余按序

**Files:** Create: docs/spikes/2026-10-10-S1-notification-channel.md

依据：可行性报告 §9（共 9 条实验，E1/E2 决定主路线，先做）

- [ ] **E1（路线 A 生死）** 打开 DSH 主窗口 DevTools，执行 Notification.requestPermission().then(p => console.log(p, new Notification("t", { body: "b" })))。判定：真弹 Windows 通知 ⇒ 路线 A 成立；不弹 ⇒ 转路线 B
- [ ] **E2（路线 B 生死）** 用**非沙箱 Medium IL** 的 PowerShell 实弹一条 Toast（AUMID com.deepseek.dsh，XML 带 ms-winsoundevent:Notification.Default）。判定：弹出且响 ⇒ 路线 B 成立
- [ ] **E3** Toast 加 activationType="protocol" launch="dsh://open"，先把窗口最小化再点它，判定是否 restore+show+focus
- [ ] **E4** 渲染侧 window.focus() 能否拉前台（能则省掉宿主侧 dsh://open）
- [ ] **E5** 自动播放策略：new Audio(url).play() 是否被 blocked
- [ ] **E6** 注入时序：最小 bundle 在 apply() 立刻推 {kind:"script"}，重载页面看是否执行
- [ ] **E7** 第三方 client 插件 ctx.remote.$on("approval/request") 是否进回调、且官方批准 UI 仍在（验证必须 next()）
- [ ] **E8** Toast 来源名是否显示 DeepSeek Harness（决定要不要自建 AUMID 快捷方式）
- [ ] **E9**（可选）FlashWindowEx 兜底是否值得做
- [ ] 把每条结果（含原始输出）写进 spike 记录，并回填本计划 §2 的风险结论

### Task S2（Spike）：托盘 / 角标 / 窗口闪烁 —— 已由报告结论关闭

- [x] 结论：插件侧**做不到**（DesktopTray 为 Electron 主进程私有类且菜单硬编码；flashFrame 全库 1 处、setBadgeCount / setOverlayIcon / displayBalloon 全库 0 处）
- [x] 替代：侧栏会话行角标（sidebar.session.row.leading）+ 应用内视觉提示，与 D2 决策一致
- [ ] Task 9 的 README 里写明这条限制

### Task S2（Spike）：托盘、角标、窗口闪烁可达性

**Files:** Create: docs/spikes/2026-10-10-S2-tray-badge.md

- [ ] **Step 1** 复核 app.asar 里托盘与窗口 API 的归属（已知：全量仅 1 处 new Notification，属更新提示），确认没有插件可用的注入点
- [ ] **Step 2** 在 client 侧试替代方案：document.title 闪烁 / favicon 红点 / 侧栏红点，记录可行性与代价
- [ ] **Step 3** 写结论，供 D2 决策；若确认做不到，在 README 里写明「本插件不提供托盘角标与窗口闪烁」

### Task 1：仓库骨架与构建

**Files:** Create: package.json, tsconfig.json, vitest.config.ts, build.mjs, .gitignore, dsh.plugin.json, cordis.patch.yml

- [ ] **Step 1** git init 并建 .gitignore（node_modules、lib 之外的临时产物、*.log）
- [ ] **Step 2** 写 package.json：name=dsh-notify-desktop、type=module、main=lib/index.js、exports（. / ./client / ./invariant）、dsh.client { platform: 'web', inject: [@deepseek-ai/dsh-api-session-controller, @deepseek-ai/dsh-client-ui-renderer, @deepseek-ai/dsh-client-ui-settings, @deepseek-ai/dsh-client-locale] }、peerDependencies 按版本表精确声明、scripts = typecheck / test / build / check
- [ ] **Step 3** 写 tsconfig（strict、moduleResolution=bundler、jsx=react-jsx）、vitest.config.ts
- [ ] **Step 4** 写 build.mjs（esbuild 打 lib/index.js 与 lib/client.js，external 掉 @deepseek-ai/*）
- [ ] **Step 5** 跑 pnpm run check，期望：typecheck 通过、0 个测试通过、两个 bundle 产出
- [ ] **Step 6** git add -A && git commit -m "build: scaffold dsh-notify-desktop plugin"

### Task 2：契约类型

**Files:** Create: src/types.ts, tests/types.spec.ts

**Interfaces（后续任务依赖，名字与形状固定）:**

    export type NotifyKind = 'completed' | 'error' | 'aborted' | 'blocked' | 'max-tokens'
    export type PendingKind = 'approval' | 'question' | 'plan-review'
    export interface PendingInteraction { kind: PendingKind; requestId: string; summary: string }
    export interface NotifyProjectionValue {
      turn: number; reason: string; body: string;
      pending: readonly PendingInteraction[];
      updatedAt: number;
    }
    export interface NotifySettings {
      enabled: boolean; soundEnabled: boolean;
      notifyCompleted: boolean; notifyError: boolean; notifyAborted: boolean;
      notifyBlocked: boolean; notifyMaxTokens: boolean;
      notifyApproval: boolean; notifyQuestion: boolean;
    }

- [ ] **Step 1** 先写测试：默认设置形状、字段取值域（reason 只接受 5 个已知值）
- [ ] **Step 2** 跑测试确认失败
- [ ] **Step 3** 实现类型与 DEFAULT_SETTINGS
- [ ] **Step 4** 跑测试确认通过
- [ ] **Step 5** commit -m "feat: add notification contract types"

### Task 3：host 侧投影 fold（TDD）

**Files:** Create: src/projection.ts, src/index.ts；Modify: —；Test: tests/projection.spec.ts

**Interfaces:** Consumes 版本表的 dsh-session 事件；Produces applyNotifyEvent(state, event, maxChars) 与 EMPTY_PROJECTION、registerNotifyProjection(ctx)

- [ ] **Step 1** 写失败测试：turn/start 开轮；assistant/message 累积正文；turn/end 落终态并写入 reason；approval/asked 追加 pending（kind=approval）；approval/decided 移除该 requestId；userQuestions 相关事件追加 kind=question 或 plan-review；正文超预算按 maxChars 省略
- [ ] **Step 2** 跑 vitest run tests/projection.spec.ts，确认失败
- [ ] **Step 3** 实现纯 fold（无关事件返回同一引用，保证 Object.is 门控成立）
- [ ] **Step 4** 跑测试确认通过
- [ ] **Step 5** 写 src/index.ts 注册投影（唯一副作用：ctx.sessionProjections 注册）
      （注：若路线 A 成立——检测在渲染侧用 ctx.remote.$on——投影只用于「正文摘要」；是否保留投影以 E7 结果为准）
- [ ] **Step 6** commit -m "feat: add host notification projection"

### Task 4：client 纯决策模块（TDD，对齐 ZCode 语义）

**Files:** Create: src/client/decision.ts；Test: tests/decision.spec.ts

**Interfaces:** Produces decideNotification(input: { settings; previous; current; focused; visibleSessionId; now }): NotifyIntent | null

- [ ] **Step 1** 写失败测试（每条语义一个用例）：总开关关闭 → null；场景开关关闭 → null；同一 turn 重复投影 → null（边沿）；3 秒内同 taskId 重复 → null；**permission/question 用 requestId 做去重键**（同秒两次不同请求都要出）；当前会话可见且窗口有焦点 → null（抑制）；声音开关只影响 sound 字段，不影响是否弹
- [ ] **Step 2** 跑测试确认失败
- [ ] **Step 3** 实现纯函数（不碰 DOM、不读时钟，now/visibleSessionId 由调用方传入）
- [ ] **Step 4** 跑测试确认通过
- [ ] **Step 5** commit -m "feat: add notification decision logic"

### Task 5：client 通知器与提示音

**Files:** Create: src/client/notifier.ts, src/client/settings.ts, src/client/index.ts；Test: tests/notifier.spec.ts

- [ ] **Step 1** 写失败测试：settings 读写（localStorage 不可用时静默回退默认值）；notifier 在 soundEnabled=false 时设 silent: true（静音），=true 时不设 silent（让系统播自带音）
- [ ] **Step 2** 跑测试确认失败
- [ ] **Step 3** 实现 notifier（Notification 封装：title/body、click 回调、tag 复用避免刷屏；**提示音先用系统自带音 = 不设 silent**，声音开关即「是否静音」）与 settings（沿用 localStorage 键 dsh-notify-*）
- [ ] **Step 4** 跑测试确认通过
- [ ] **Step 5** 写 client 入口：订阅投影变化 → 组 decideNotification 输入 → 弹通知
- [ ] **Step 6** commit -m "feat: add client notifier and settings"

### Task 5B：等待确认超时催办（TDD，本期新增需求 D5）

**Files:** Create: src/client/reminder.ts；Modify: src/client/index.ts、src/client/settings.ts；Test: tests/reminder.spec.ts

**Interfaces:** Produces shouldRemind(input: { pendingRequestIds; remindedRequestIds; now; remindAfterMs }): string[] 与 REMIND_DEFAULT_MS = 600000

- [ ] **Step 1** 写失败测试：等待请求通知过一次后，未到 N 分钟不再提醒；超过 N 分钟仍未解决 → 补提醒一次；同一次等待只补一次；请求被批准/回答后不再提醒；总开关或该场景开关关闭时不提醒；N 可在设置里改（默认 10 分钟）
- [ ] **Step 2** 跑 vitest run tests/reminder.spec.ts，确认失败
- [ ] **Step 3** 实现 reminder.ts（纯函数，now 由调用方注入），在 client 入口用定时器驱动（R1：窗口隐藏时可能被节流而延后，可接受，记录下来）
- [ ] **Step 4** 跑测试确认通过
- [ ] **Step 5** commit -m "feat: remind when a pending confirmation is left unanswered"

### Task 6：设置页「通知」段

**Files:** Create: src/client/SettingsSection.tsx, src/client/locales.ts；Test: tests/section.spec.tsx

- [ ] **Step 1** 写失败测试：渲染出总开关、声音开关、各场景开关；切换后写回持久化
- [ ] **Step 2** 跑测试确认失败
- [ ] **Step 3** 实现设置段（沿用 @deepseek-ai/dsh-client-ui-settings 的注入点，参照 dsh-notification 的 SettingsSection 写法），加「发送测试通知」按钮
- [ ] **Step 4** 跑测试确认通过
- [ ] **Step 5** commit -m "feat: add notification settings section"

### Task 7：点击通知 → 聚焦窗口 + 跳到会话

**Files:** Create: src/client/navigate.ts；Modify: src/client/notifier.ts；Test: tests/navigate.spec.ts

**依赖 Task S1 Step 5 的结论**：若 S1 证明渲染层无法切换会话，本任务改为「只把窗口带到前台」并在 README 记录限制。

- [ ] **Step 1** 写失败测试：给定 sessionId，调用导航函数时使用 S1 确认的 client API（先以接口注入方式写测试）
- [ ] **Step 2** 跑测试确认失败
- [ ] **Step 3** 实现 navigate.ts 并接到 notification.onclick
- [ ] **Step 4** 跑测试确认通过
- [ ] **Step 5** commit -m "feat: focus window and open the notified session on click"

### Task 8：装配到 desktop profile + 端到端验收

**Files:** Modify: package.json（如需修版本）；Create: docs/acceptance/2026-10-10-desktop-e2e.md

- [ ] **Step 1** 兼容声明核对：package.json 的 engines/peerDependencies 与 §版本表一致，否则停手报告
- [ ] **Step 2** 依赖自检：node -e "await import('file:///<repo>/lib/index.js')" 必须成功（记忆铁律：不验证不算完）
- [ ] **Step 3** 装配（**先问用户确认再执行**）：
          & "<DSH desktop install>\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add file:"<repo>"
- [ ] **Step 4** 提示用户重启桌面端（不自行重启）；重启后核对插件树无失败项、设置页出现「通知」段
- [ ] **Step 5** 端到端验收：跑一个 60 秒以上的后台任务，切到别的窗口，逐条验证
          ① 完成 → 弹通知 + 出声 ② 出错 → 弹通知 ③ 触发一次权限批准 → 弹通知 ④ 计划确认 → 弹通知
          ⑤ 窗口在前台且正看该会话 → 不打扰 ⑥ 3 秒内连点两次不同批准请求 → 两条都要出
          ⑦ 点击通知 → 窗口到前台 + 跳到该会话
- [ ] **Step 6** 把每条的证据（时间、截图说明、通知标题正文）写进 docs/acceptance/2026-10-10-desktop-e2e.md
- [ ] **Step 7** commit -m "docs: record desktop end-to-end acceptance"

### Task 9：文档与兼容声明

**Files:** Create: README.md, README.zh.md, AGENTS.md

- [ ] **Step 1** README.zh.md：能力、安装、设置项表、已知限制（R1/R2/R3 与 D2 结论）
- [ ] **Step 2** AGENTS.md：仓库规则（lib 必须随源码提交、pnpm run check 必须全绿、装配方式、不改 harness）
- [ ] **Step 3** commit -m "docs: add plugin documentation"

## 5. 验收标准（Definition of Done）

- 四类场景各有一条实测记录：完成 / 出错 / 等待批准 / 等待回答（含计划确认）。
- 窗口前台且正看该会话时不打扰；连续两次阻塞请求不互相吞掉（按 requestId 去重）。
- 提示音可关，关掉后确实不再响（子开关叠加总开关）。
- 点击通知：窗口回前台 + 跳到对应会话（若 S1 判定做不到，则降级为「回前台」并在文档写明）。
- 等待确认超过 N 分钟未处理 → 补一条催办提醒；处理掉之后不再补。
- 不改 harness、不改 profile 既有配置；重启后插件树无失败项。
- pnpm run check 全绿（typecheck + vitest + build）。

## 6. 已确认事项（2026-10-10，无未决项）

1. D1 新建独立包 dsh-notify-desktop（方案 A）。
2. D2 只靠通知本身，放弃托盘角标与窗口闪烁。
3. D3 包名与源码位置照准。
4. 提示音先用系统通知自带音。
5. 触发场景 = 完成 / 等待确认 / 出错 + **等待确认超时催办**（N 分钟可配，默认 10 分钟）。