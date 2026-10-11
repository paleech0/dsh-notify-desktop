# DSH 桌面端原生通知插件 —— DSH 侧可行性调查报告

- 调查目标：在 **DSH 官方桌面端 0.2.0-rc.2（Electron 44，profile = desktop）** 上实现「任务完成 / 等待批准 / 出错 → Windows 原生通知 + 提示音 + 托盘角标或窗口闪烁；点击通知把 DSH 窗口调到前台并跳到对应会话」。
- 调查性质：**只读**。未修改 DSH 安装目录、profile 配置、会话文件；未重启 DSH；未安装任何依赖。
- 结论标记：**能做到** / **做不到** / **存疑（未验证）**。存疑项一律给出「缺什么证据」。

> 读取方式说明：本报告通过 DSH 的 run_code（Electron Node 模式进程）与 pwsh 工具读取 app.asar。该进程带 Electron 的 asar 补丁，因此 **<DSH desktop install>\resources\app.asar 在本进程内表现为可遍历目录**（readdirSync 正常；resources 目录里同时把它列为 0 字节项，属 asar 虚拟视图）。官方 skill 文档亦说明「In Desktop the directory sits inside app.asar, which only the Host process's own file reads can open」。所有路径均为绝对路径，行号为该文件内的行号。

---

## 0. 结论速览

| 编号 | 结论项 | 判定 | 一句话说明 |
|---|---|---|---|
| C1 | host 插件订阅「任务/轮次结束」 | **能做到** | agent/status、session/event(turn/end)、api-session/status 三条路都在 |
| C2 | host 插件订阅「出错」 | **能做到** | agent/error、api-session/error、tools/result |
| C3 | host 插件订阅「等待批准 / 等待回答」 | **能做到** | approval/request、user-questions/request（waterfall，可旁听并 next()） |
| C4 | 宿主进程内直接调用 Electron 通知 API | **做不到** | 宿主是 Electron 的 Node 模式子进程，实测 require('electron') 抛错 |
| C5 | 宿主插件 spawn 子进程（PowerShell） | **能做到** | 纯 node:child_process，实测 stdio:'ignore'/'inherit' 可用 |
| C6 | PowerShell 弹 Windows 原生 Toast | **能做到**（有条件） | **Medium 完整性级别下实测成功**；DSH 沙箱内的 Low IL shell 下失败 0x80073D54 |
| C7 | 渲染侧用 Web Notification 弹原生通知 | **存疑** | 权限与 secure context 都没问题（有代码证据），但 Electron 默认 AUMID 与安装器写入的 com.deepseek.dsh 是否一致未验证 |
| C8 | 把窗口调到前台 | **能做到** | dsh://open 协议注册表实测存在 → second-instance → focusPrimaryWindow()（restore+show+focus） |
| C9 | 通知携带「跳到哪个会话」的 deep link | **做不到** | Electron 只认 dsh://open，Windows 的 second-instance 回调忽略 argv |
| C10 | 在页面内跳到指定会话 | **能做到** | 客户端服务 uiWorkspace.openSession(sessionId)（第三方插件已有先例） |
| C11 | client 插件播放提示音 | **能做到**（大概率） | 标准 Web Audio；Electron 默认 autoplayPolicy 未在 webPreferences 中覆盖 |
| C12 | 会话列表里高亮/加角标 | **能做到** | 侧栏槽位 sidebar.session.row.leading 等真实存在 |
| C13 | 插件改托盘菜单 / 托盘角标 | **做不到** | DesktopTray 在 Electron 主进程私有类里，硬编码两项菜单 |
| C14 | 插件触发窗口闪烁 flashFrame | **做不到**（Electron 途径）；**存疑**（Win32 途径） | Electron 的 flashFrame 只在更新流程被调用；插件可用 PowerShell P/Invoke FlashWindowEx 兜底，未验证 |
| C15 | 无依赖地给页面注入脚本 | **能做到** | webserver/index-inject + webServer.register()，whale-widget 已在用 |
| C16 | 宿主→页面推送自定义事件 | **能做到**（自定义通道） | 官方转发事件表 API_REMOTE_FORWARDED_EVENTS 是**硬编码 + 单例**，插件加不进去；须走自己的 HTTP 路由或 @Remote 方法 |

**一句话总纲**：**「检测」全部能做，且大部分可以直接在渲染侧做**；**「弹原生通知」有两条互相独立的路（PowerShell Toast / 渲染侧 Web Notification）**，两条都需要 1 个小实验定生死；**「点击后跳会话」必须在渲染侧完成**（因为 Electron 侧没有带参数的 deep link），**「点击后拉前台」可以在宿主侧用 dsh://open 完成**。

---

## 1. 运行时架构（先决事实，后面所有结论都建立在这上面）

### 1.1 进程模型

DSH 桌面端不是「Electron 里跑插件」，而是 **Electron 主进程 fork 出一个纯 Node 子进程**跑整个 Cordis 宿主。

<DSH desktop install>\resources\app.asar\lib\main.js:147168 起（DesktopHostProcess.start()）：

```js
const entry = join(this.runtimeDir, "node_modules", "@deepseek-ai", "dsh-desktop-host", "lib", "index.js");
const child = spawn(this.node, ["--expose-internals", ..., entry, this.runtimeDir, this.projectDir, ...], {
    cwd: this.projectDir,
    env: desktopNodeEnvironment(this.node, void 0, this.environment),   // ELECTRON_RUN_AS_NODE=1
    stdio: ["ignore", "pipe", "pipe", "ipc"]
});
```

对应宿主侧入口 <DSH desktop install>\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-desktop-host\lib\index.js:216：async function main()，跑 runProfile({profile: "desktop", args:["--no-open","--port","19387"]})。

**推论（后面反复用到）**：
1. 插件（host 侧）跑在这个 **Node 子进程**里 —— 它可以用 node:* 全部能力（child_process / fs / net …），但**拿不到 Electron API**。
2. 插件与 Electron 之间只有一条 process.send 私有 IPC，且协议是**白名单**的（见 §3.5，越界会致命）。

### 1.2 页面来源

main.js:11019：

```js
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME /* "dsh-app" */, privileges: {
    standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true
}}]);
```

页面 URL = dsh-app://app/ ；主窗口 webPreferences（main.js 约 L439200）：

```js
webPreferences: { preload, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: primary, devTools: true }
```

**关键推论**：dsh-app://app 是 **secure context**（secure: true），所以 Notification、WebCrypto、Service Worker 这类要求安全上下文的 API **可用**。

### 1.3 宿主插件形态

官方 skill 文档：<DSH desktop install>\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-agent-preset\skills\cordis-plugin-development\references\host-plugin.md。要点：bundle 包在 package.json 里声明 dsh.bundle.patch，patch 用 YAML - insert: [{id, name, config}] 插入行；index.js 导出 export function apply(ctx, config) 或一个 Service 类。

---

## 2. Q1 —— 能被插件订阅的事件与服务

### 2.1 权威事件总表（81 条）

DSH 自带一份**机器可读的完整事件目录**：

<DSH desktop install>\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-tool-cordis\lib\types\api-catalog.js:3690

```js
/** Every harness event, sorted by name. */
export const EVENT_API = [ { name: 'agent-loop/config-start-failed', mode: 'emit', signature: '...', ... }, ... ]
```

共 **81 条**，按派发模式：emit 59 / waterfall 17 / parallel 3 / serial 2。同一文件 api-catalog.js:15 是 export const SERVICE_API，共 **91 个服务键**。
（这是官方给 cordis_inspect_query 用的目录，等价于「插件 API 的单一事实来源」。）

### 2.2 「一轮对话/任务结束」

| 事件 | 模式 | 签名 | 适用性 |
|---|---|---|---|
| agent/status | emit | (this: Scoped<Agent>, payload: { agent: Agent; status: 'idle' | 'running' }) | **首选**。起止各触发一次 |
| session/event | emit | (this: Scoped<Session>, session: Session, event: SessionEvent) | **最稳**。可从 turn/end 拿到结束原因 |
| api-session/status | emit | (sessionId: SessionId, running: boolean) | 派生自 agent/status，字段最少 |
| agent/turn-stopping | serial | (this: Scoped<Agent>, payload:{agent,turn,signal}) | 收尾钩子，可 await |

定义与发射点：

- ...\dsh-agent-loop\lib\index.js:798：
```js
get status() { return this.phase.kind === "idle" || this.phase.kind === "maintenance" ? "idle" : "running"; }
setPhase(next) { const previousStatus = this.status; this.phase = next; const status = this.status;
    if (status !== previousStatus) this.dispatch.emit("agent/status", { status }); }
```
- ...\dsh-agent-loop\lib\index.js:1027：this.session.append("turn/end", { turn, reason: turnEnds })
  reason 是 TurnEndReason，取值（api-catalog 的 TurnEndReasonMap）：completed | aborted | blocked | error | max-tokens | interrupted | forked。
- 事件载荷里的 agent 是被 agentEvents 自动注入的：...\dsh-agent\lib\index.js:242 function agentEvents(ctx, agent, carrier = agentCarrier(agent)) → fused = (payload) => ({ ...payload, agent })，再用 ctx.events.dispatch("emit", args) 直接全局派发。**因此根上下文上的 ctx.on("agent/status", ...) 能收到，载荷带 agent。**
- 官方自己就是这么用的：...\dsh-api-session-controller\lib\index.js 里
```js
ctx.on("agent/status", ({ agent, status }) => { ctx.emit("api-session/status", agent.id, status === "running"); });
```
- **第三方先例**：已安装的 dsh-whale-widget@0.3.17（%USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-whale-widget\lib\index.js）就是靠会话事件流做「每轮消耗」与「任务结束音」：
```js
function handleSessionEvent(sessionId, event) {
    const type = event && event.type; const d = event && event.data;
    if (type === 'turn/end') { finalizeTurn(sessionId); return }
    if (type !== 'assistant/message') return
    ...
}
```

### 2.3 「任务出错」

| 事件 | 模式 | 签名 |
|---|---|---|
| agent/error | emit | (this: Scoped<Agent>, payload: { agent: Agent; turn: number; step: number; error: unknown }) |
| api-session/error | emit | (sessionId: SessionId, message: string) |
| tools/result | emit | (this: Scoped<ToolRuntime>, exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>) |
| agent/request-error | waterfall | LLM 请求级错误 |

- 发射点 ...\dsh-agent-loop\lib\index.js:880：
```js
throwError(error) { ...; this.dispatch.emit("agent/error", { turn, step, error }); throw error; }
```
- 派生：...\dsh-api-session-controller\lib\index.js 的 ctx.on("agent/error", ({agent,error}) => ctx.emit("api-session/error", agent.id, errorChain(error)))。

### 2.4 「等待用户批准（permission）」

**服务**：approval（SERVICE_API 键 approval）
**定义文件**：<DSH desktop install>\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-user-approval\lib\index.js

```js
var ApprovalService = class extends Service {
    constructor(ctx, config) { super(ctx, "approval"); ... }
    async request(req) {
        ...
        session.append("approval/asked", { id, toolName: req.toolName, ... });
        const outcome = await this.decide(req, session);
        session.append("approval/decided", { id, outcome });
        return outcome;
    }
    async decide(req, session) {
        ...
        const answer = Promise.resolve().then(() =>
            this.ctx.waterfall(scopeTarget(req.agent, req.agent), "approval/request", req, () => Promise.resolve("unavailable")))
            .then((outcome) => OUTCOMES.includes(outcome) ? outcome : "unavailable", () => "unavailable");
        ...
    }
};
```
（"approval/request" 在 L176；session.append("approval/asked" 在 L132。）

**插件订阅方式（两条，互不冲突）**：
1. **waterfall 旁听**：ctx.on("approval/request", async (req, next) => { notify(req); return next(); })
   签名：'approval/request'(this: Scoped<Agent>, req: ApprovalRequestEvent, next: () => Promise<ApprovalOutcome>): Promise<ApprovalOutcome>
   ApprovalRequestEvent = { agent; toolName; callId?; reason?; displayReason?: { en; [locale] }; signal? }
   ApprovalOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'
   **注意**：必须 return next()，否则会**顶替**真正的批准 UI（dsh-client-ui-approval 也注册在同一个 waterfall 上）→ 批准框会消失。
2. **持久化审计**：ctx.on("session/event", (session, event) => { if (event.type === "approval/asked") ... })，无副作用、不干扰瀑布。

**请求前置条件（坑）**：approval.request() 要求 session 处于**已开启的 turn** 内，否则抛错（源码注释：the approval/asked + approval/decided audit pair must be turn-enclosed）。

### 2.5 「等待用户回答（AskUserQuestion / plan 确认）」

**服务**：userQuestions
**定义文件**：<DSH desktop install>\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-user-questions\lib\index.js

```js
constructor(ctx) {
    super(ctx, "userQuestions");
    ctx.inject(["sessionProjections"], (projectionCtx) => { projectionCtx.sessionProjections.register(userQuestionProjectionDefinition); });
    ...
}
...
return await (agent === void 0
    ? this.ctx.waterfall("user-questions/request", request, noAnswerer)
    : this.ctx.waterfall(scopeTarget(agent, agent), "user-questions/request", { ...request, agent }, noAnswerer));
```
（"user-questions/request" 在 L681。）

签名：'user-questions/request'(this: Scoped<Agent>, request: AskUserQuestionRequestEvent, next: () => Promise<AskUserQuestionAnswer>): Promise<AskUserQuestionAnswer>

```ts
export interface AskUserQuestionRequestEvent {
    questions: AskUserQuestionItem[]; agent?: Agent; signal?: AbortSignal;
    wait?: { callId: ToolCallId; timed?: boolean };
}
export interface AskUserQuestionItem { id; question; detail?; header?; options?: {label; description?}[]; multiSelect?; intent?: AskUserQuestionIntent }
export type AskUserQuestionIntent = { kind: 'plan-review'; approve: string; callId?: ToolCallId };
```

**plan 确认就是它**：request.questions[].intent.kind === 'plan-review' ⇒ 这是 plan 批准确认，不是普通提问。

### 2.6 后台任务（jobs）

- 服务：jobs（JobStatus = 'running' | 'stopping' | 'completed' | 'killed' | 'failed'，JobView { id, kind, label, owner?, status, progress?, startedAt, finishedAt?, output }）。
- 订阅接口**不是** Cordis 事件，而是服务自带的事件对象（api-catalog 的 JobEvents）：
```ts
export interface JobEvents { subscribe(filter: JobEventFilter, listener: JobEventListener): () => void }
```
- Cordis 侧相关：workspace/session-activity（waterfall，(request, next) => SessionActivity[]）、workspace/session-stop（parallel）。desktop host 自己就用它做「退出前是否还有活」：dsh-desktop-host\lib\index.js 的 installDesktopQuitInspection。
- 另有 jobController 服务（dsh-api-job-controller）与客户端 jobs 服务。

### 2.7 其他相关事件（备查）

subagent/start、subagent/end、session/created、session/disposed、goal/changed、goal/activation-changed、schedule/changed、agent/inbox/inserted|claimed|discarded、tools/pre-execute|execute|post-execute|result、webserver/index-inject。

**相关服务键（91 个中的）**：agents、sessions、approval、userQuestions、jobs、jobController、schedule、goals、planMode、permissionPresets、subprocess、shell、webServer、connection、workspaceRegistry、clientModules、pluginManager。

> **结论 Q1：能做到。** 三类触发条件在 host 侧全部有稳定、官方目录登记的事件可用。

---

## 3. Q2 —— 弹 Windows 原生通知

### 3.1 内建 API：宿主侧 = 无；渲染侧 = 有（Web 标准）

- 宿主侧没有任何通知包：@deepseek-ai 下 289 个包中**没有** notification 包；全库检索 new Notification / displayBalloon / setBadgeCount / flashFrame / Shell_NotifyIcon 于 dsh\node_modules\@deepseek-ai **命中 0**（toast/Toast 命中的全是**页面内** UI toast，如 dsh-client-ui-primitives 的 Toast.module.css）。
- Electron 外壳里**只有 1 处** new Notification()：<DSH desktop install>\resources\app.asar\lib\main.js:8909，属更新就绪提醒：

```js
try {
    if (!Notification.isSupported()) return;
    const notification = new Notification({ title: this.locale.messages.mandatoryReady,
        body: this.locale.messages.mandatoryNotification, silent: true });
    this.notification = notification;
    notification.on("failed", () => { ... });       // ← 注意：他们写了 failed 兜底
    notification.once("click", () => { this.clear(); returnToConfirmation(); });
    notification.show();
} catch (error) { console.warn("desktop update: notification unavailable", error); }
```
同一处 L8902 还有 if (this.platform === "win32") parent.flashFrame(true);（**全局唯一**的 flashFrame）。
app.setBadgeCount / setOverlayIcon / displayBalloon：**0 处**。

- **渲染侧**是标准浏览器环境，Notification API 在 secure context（dsh-app: + secure:true）下存在。
  权限甚至**被外壳自动放行**：main.js:6274 function installMicrophonePermissions(session, primary)：

```js
session.setPermissionCheckHandler((contents, permission, origin, details) => {
    if (permission !== "media") return true;                       // 非 media 一律 true
    ...
});
session.setPermissionRequestHandler((contents, permission, callback, details) => {
    if (permission !== "media") { callback(true); return; }        // 非 media 一律批准
    ...
});
```
且在 main.js:11553 安装到**默认会话**：installMicrophonePermissions(session.defaultSession, () => mainWindow?.webContents); —— 主窗口用的正是 defaultSession（它的 webPreferences 未指定 session）。
⇒ Notification.requestPermission() 会直接返回 "granted"（**代码推断，未实测**）。

- **渲染侧 preload 暴露面**（<DSH desktop install>\resources\app.asar\lib\preload-app.cjs:789 function createProductApi()）：
  dshDesktop = { protocolVersion, browser, deviceInfo, keyboard, shortcuts, updates }，另有 __DSH_DIRECTORY_PICKER__、__DSH_HOST_PATHS__、dshDesktopBoot、dshPlatform、__DSH_LOCALE__。
  **没有**任何 notification / 窗口 focus / 角标 API。

### 3.2 宿主插件能不能调 Electron？—— **做不到**

实测（Electron Node 模式进程内）：

```
require('electron') in this Node process → THREW: Error: Cannot find module 'electron'
process.versions: {"electron":"44.0.0","node":"24.18.1","chrome":"152.0.7977.54"}
execPath = <DSH desktop install>\DeepSeek Harness.exe
```

⇒ 宿主进程虽然跑在 Electron 二进制里（ELECTRON_RUN_AS_NODE），但 electron 模块不可解析 ⇒ **拿不到 Notification / Tray / BrowserWindow**。

### 3.3 宿主插件 spawn 子进程 —— **能做到**

- 插件就是 Node 模块，可直接 import { spawn } from "node:child_process"。
- 实测（在 DSH 的沙箱化 run_code 环境里，**比插件处境更苛刻**）：
```
stdio ignore:      ok status=0
stdio inherit:     ok status=0
stdio ["ignore","pipe","pipe"]: EPERM      ← 沙箱禁止「捕获子进程输出」的管道
stdio all ignore:  ok status=0
detached spawn:    ok pid=18292
```
  这正是工具说明里已记录的沙箱边界。**插件不在 agent 沙箱里**，因此不受此限；但如果插件图省事用 DSH 自己的 ctx.subprocess / ctx.shell 服务（走 dsh-pwsh-local / dsh-subprocess-local，可能被施加同样的限制或低完整性），就要按上面的方式收窄 stdio。
- 另有一条**替代服务**：ctx.subprocess.spawn(spec) / spawnTerminal(spec)（api-catalog 的 subprocess），语义完整但会走 provider 的执行世界与沙箱策略。

### 3.4 PowerShell 弹 Toast —— **能做到（有条件，且条件已实测）**

这是本次调查**最有价值的一个实测结果**。

**（a）环境事实**
- 本机 **没有 PowerShell 7**：Test-Path "C:\Program Files\PowerShell\7\pwsh.exe" → False；Get-Command pwsh → C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe（PS 5.1.26100.9444）。
  而 DSH 的解析顺序是 pwsh7 → PATH 里的 pwsh.exe → System32\WindowsPowerShell\v1.0\powershell.exe（...\dsh-pwsh-local\lib\index.js:23 function candidatePwshPaths）。
  ⇒ **不要依赖 DSH 的 pwsh 解析**；通知插件应把 powershell.exe 的绝对路径写死。
- Windows 版本：Microsoft Windows NT 10.0.26200.0。
- Start Menu 快捷方式存在且 AUMID 正确（COM Shell 读取）：
```
DeepSeek Harness.lnk => AUMID=[com.deepseek.dsh] Target=[<DSH desktop install>\DeepSeek Harness.exe]
```

**（b）决定性实验（同一脚本，两种完整性级别）**

| 运行环境 | 完整性级别 | CreateToastNotifier('com.deepseek.dsh') |
|---|---|---|
| DSH 的 pwsh 工具（受 DSH Windows 沙箱约束） | **Low**（Mandatory Label\Low Mandatory Level S-1-16-4096） | ❌ 0x80073D54 The process has no package identity |
| windows-mcp 的 PowerShell 服务（不受该沙箱约束） | **Medium**（Mandatory Label\Medium Mandatory Level S-1-16-8192） | ✅ **OK** |

Low IL 下连经典 BurntToast 的 {1AC14E77-...}\WindowsPowerShell\v1.0\powershell.exe 也是同一个 0x80073D54；Medium IL 下两个 AppId 都 OK。
（探针本身**只构造对象、没有调用 .Show()**，没有弹出任何通知。）

**（c）结论**
- **只要进程是 Medium 完整性**（即由 DSH 宿主进程直接 child_process.spawn，而不是经 DSH 沙箱的 shell 工具），Windows.UI.Notifications.ToastNotificationManager 可用。
- Toast 可以带声音：<audio src="ms-winsoundevent:Notification.Default" />（或 Notification.IM / Notification.Looping.Alarm），也可用文件 URI。
- 点击行为可用 activationType="protocol" launch="dsh://open" 直接串到「拉前台」（见 §4）。

**（d）缺什么证据（→ 存疑的部分）**
- 未实际 .Show() 过一条 Toast（本任务要求只读、不产生可见副作用）⇒「真的会显示」「真的会响」「点它真的会拉前台」需要 1 次实弹实验（见 §9 实验清单 E2/E3）。

### 3.5 **致命注意事项：不要给 Electron 发未知 IPC 消息**

main.js:3544 function isDesktopHostEvent(message) 是白名单，只认：
shutdown-complete / ready / platform-session / fatal / update-tasks / quit-inspection。
而 DesktopHostProcess.start() 的 child.on("message")：

```js
child.on("message", (message) => {
    if (!isDesktopHostEvent(message)) {
        this.fail(new Error("dsh desktop host sent an invalid IPC event"));
        child.kill("SIGTERM");                       // ← 直接杀掉整个宿主
        return;
    }
    ...
});
```

**⇒ 任何插件都不要 process.send({type: "notify", ...}) 之类**：会把 DSH 宿主进程打死（表现为整个应用崩/重启）。这条是硬红线。

---

## 4. Q3 —— 点击通知后的动作：拉前台 + 跳会话

### 4.1 把 DSH 主窗口调到前台 —— **能做到**（有两条独立路）

**路径 A（宿主侧，已验证注册表层面）**：dsh://open 单实例唤醒

- 协议注册实测（HKCU）：
```
HKCU\Software\Classes\dsh            → URL Protocol 存在，(default) = "URL:dsh"
HKCU\Software\Classes\dsh\shell\open\command
    (default) : "<DSH desktop install>\DeepSeek Harness.exe" "%1"
```
  注册代码：main.js:12189 if (app.isPackaged || ...) app.setAsDefaultProtocolClient("dsh");
- 单实例与回调：main.js:6870
```js
function claimDesktopSingleInstance(application, focusOwner) {
    if (!application.requestSingleInstanceLock()) { application.quit(); return false; }
    application.on("second-instance", focusOwner);
    return true;
}
```
  调用点（main.js 末尾）：if (claimDesktopSingleInstance(app, () => { focusPrimaryWindow(); })) app.whenReady().then(main)...
- 前台函数 main.js:10940：
```js
focusPrimaryWindow = () => {
    if (quitting) return;
    if (isMandatory()) { mandatoryUI?.focus(); return; }
    const window = welcomeWindow ?? mainWindow;
    if (window === undefined || window.isDestroyed()) { /* 重建窗口 */ }
    if (window === mainWindow && !enteredWorkspace) return;
    if (window.isMinimized()) window.restore();     // 从最小化恢复
    window.show();                                  // 从托盘隐藏态显示
    window.focus();
};
```
- 因此宿主插件只要：
```js
spawn("cmd.exe", ["/c", "start", "", "dsh://open"], { stdio: "ignore", windowsHide: true, detached: true }).unref();
// 或者 Start-Process "dsh://open"
```
  第二个进程因 requestSingleInstanceLock() 失败而 app.quit()，老实例收到 second-instance → focusPrimaryWindow() → restore + show + focus。
- app.on("open-url", ...) 也处理同一 URL（main.js:12190），但 **open-url 在 Electron 里是 macOS 事件**；Windows 靠的就是上面的 second-instance 通路。

**路径 B（渲染侧）**：window.focus()
- 渲染进程调用 window.focus() 期望 Electron 激活窗口。**存疑**：app.asar 里看不到 Electron 内部实现，无法从代码证明；需要实验 E4。
- 若生效，则完全不需要子进程。

### 4.2 跳到指定会话 —— Electron 侧 **做不到**，渲染侧 **能做到**

**（a）Electron 侧没有带参数的 deep link —— 做不到**
- open-url 只认死字符串：if (url === "dsh://open" || url === "dsh://open/") focusPrimaryWindow(); —— 其它 URL 一律忽略。
- Windows 路径的 second-instance 回调是 () => { focusPrimaryWindow(); }，**形参完全被丢弃**，argv 里带的 dsh://... 没有任何消费者。
- 页面也没有会话路由：全量客户端 bundle 里，只有 dsh-client-ui-sidebar-documentpreview 用 history.pushState（它自己的文档预览），会话切换走的是内存态。

**（b）渲染侧有官方导航接口 —— 能做到**
- 客户端服务 uiWorkspace：...\dsh-client-ui-workspace\lib\client.js:772 super(ctx, "uiWorkspace")；:821 openSession(target) { this.replaceMain(target, this.lifetime.signal, "reveal"); }
- 第三方插件已有生产先例（dsh-sidebar-qa@1.1.0，本机已装）：%USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-sidebar-qa\src\client\show-session.ts
```ts
const uiWorkspace = ctx.get('uiWorkspace')
if (uiWorkspace === undefined || typeof uiWorkspace.openSession !== 'function') { ...; return false }
uiWorkspace.openSession(sessionId)
```
  该文件注释还明确记录：ctx.sessions.open(id) **不存在**（曾经踩过坑），ctx.uiWorkspace.openSession 才是真的；且它是**导航而非即时**——replaceMain 同步保留/选中会话，但真正显示它的 React 表面在后续 commit 才到位。

### 4.3 组合结论

| 想要的最终效果 | 可行实现 |
|---|---|
| 点击通知 → 窗口到前台 | 宿主侧 dsh://open（**已验证**）或渲染侧 window.focus()（**存疑**） |
| 点击通知 → 跳到会话 | **必须**在渲染侧：ctx.uiWorkspace.openSession(sessionId) |
| 两者同时 | 通知由**渲染侧**发出（点击回调里既拿到 sessionId，又能拿到整页上下文），或在宿主侧通知里只做「拉前台」，再由页面侧读「最近一次通知的会话」后导航（更绕，不推荐） |

---

## 5. Q4 —— 渲染侧（client 插件）能力与加载契约

### 5.1 加载契约（官方双面包）

来源：...\dsh-client-modules\lib\index.js（host 半）与 ...\dsh-client-modules\lib\client.js（浏览器半）。

- **声明**：包 package.json 里
```json
{ "exports": { ".": "./index.js", "./client": "./client.js" },
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" },
           "client": { "platform": "web", "immediately": true, "inject": ["@deepseek-ai/dsh-client-ui-conversation"] } } }
```
  parseDshClient（dsh-client-modules\lib\index.js:61）校验：platform(string) 必填；inject / external (string[]) 可选；immediately(boolean) 可选。
  客户端模块的 id **等于包名**；<id>/client 会被 stripClientSuffix 归一化到同一行。
- **浏览器入口**：window.__ModuleLoader__.load({ id, factory })，factory 返回 { inject: [...], apply(ctx) {...} }；require('react') 由运行时提供（不要自带 React）。
  官方模板：...\dsh-agent-preset\skills\cordis-plugin-development\templates\decoration\client.js
```js
window.__ModuleLoader__.load({
  id: '@local/my-decoration',
  factory(require) {
    const React = require('react'); const h = React.createElement;
    function Decoration() { return h('svg', {...}); }
    return { inject: ['slots'], apply(ctx) { ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({name:'conversation.composer.dock', id:'my-decoration', order:5}, Decoration)); } };
  },
});
```
- **懒 CJS 表**：执行 bundle 只**注册** factory；副作用（含 CSS 注入）在 factory 被 materialize 时才跑；首次 import 时递归 materialize，顺序无需外部编排。改动 bundle 内容需经 rebuilt 通知（HMR）。
- **客户端服务清单（全量扫描 74 个 lib/client*.js 得到）**：
  chatFileMentions, commandUi, configForms, connection, conversation, cordisInspect, documentPreviews, dynamicCordisRunner, feedbackUi, fileUpload, inputTriggers, jobs, layout, locale, modelDirectories, modules, pluginNavigation, productAnalytics, remote, resources, sessionLogDownload, sessions, settingsSchema, shortcuts, sidebarRight, sidebarRightTabs, slots, theme, timer, typert, uiConversation, uiRenderer, uiSession, uiWorkspace, userQuestionPanels, webTerminals, workspaces。

### 5.2 渲染侧能拿到哪些主机事件？—— 27 条转发白名单

**这是本节最关键的一条**：浏览器侧**不能**任意订阅宿主事件。宿主把哪些事件转发给页面是**硬编码**的：

<DSH desktop install>\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-api-remotes\lib\index.js:17

```js
const API_REMOTE_FORWARDED_EVENTS = [
    { event: "agent-preset/selected", mode: "emit" },
    { event: "approval/request", mode: "waterfall" },              // ← 等待批准
    { event: "api-session/activity", mode: "emit" },
    { event: "api-session/added", mode: "emit" },
    { event: "api-session/error", mode: "emit" },                  // ← 出错
    { event: "api-session/removed", mode: "emit" },
    { event: "api-session/status", mode: "emit" },                 // ← 跑/停
    { event: "commands/change", mode: "emit" },
    { event: "deepseek-account/session-expired", mode: "emit" },
    { event: "deepseek-account/model-sign-in-required", mode: "emit" },
    { event: "credentials/record-updated", mode: "emit" },
    { event: "credentials/reference-updated", mode: "emit" },
    { event: "goal/activation-changed", mode: "emit" },
    { event: "cordis/request-run", mode: "emit" },
    { event: "cordis/request-run-resolved", mode: "emit" },
    { event: "cordis/dynamic-package", mode: "emit" },
    { event: "cordis/dynamic-retract", mode: "emit" },
    { event: "cordis/inspect-query", mode: "emit" },
    { event: "cordis/inspect-query-resolved", mode: "emit" },
    { event: "llm/adapters-updated", mode: "emit" },
    { event: "permission-presets/catalog-changed", mode: "emit" },
    { event: "plugin-manager/changed", mode: "emit" },
    { event: "plugin-manager/install-log", mode: "emit" },
    { event: "plugin-manager/install-state", mode: "emit" },
    { event: "settings/document-updated", mode: "emit" },
    { event: "schedule/changed", mode: "emit" },
    { event: "user-questions/request", mode: "waterfall" },        // ← 等待回答 / plan 确认
];
```
注册处 registerRemoteEvents(...)，且 gateway 侧是**单例**（typert gateway: forwarded Remote event source is already registered 会抛错）⇒ **第三方插件无法把自己的事件加进这个流**。

**页面侧的订阅 API**：ctx.remote.$on(event, listener)（...\dsh-api-gateway\lib\types\client\index.js，公开方法）。
**一等公民先例**：...\dsh-client-ui-approval\lib\client.js:355
```js
ctx.remote.$on("approval/request", function(request, next) {
    return answerApproval(ctx, this, request, next, registerPendingInteraction);
});
```
（this 是 scope carrier，可用 ctx.sessions.scopeOf(this) 反查 sessionId。）

**⇒ 渲染侧能独立完成三类检测**：

| 触发 | 渲染侧可用事件 |
|---|---|
| 本轮结束 | ctx.remote.$on("api-session/status", (sessionId, running) => ...)，running: true→false 即结束 |
| 出错 | ctx.remote.$on("api-session/error", (sessionId, message) => ...) |
| 等待批准 | ctx.remote.$on("approval/request", function(req, next){ notify(req); return next(); }) |
| 等待回答 / plan 确认 | ctx.remote.$on("user-questions/request", function(req, next){ ...; return next(); }) |

> ⚠️ 两个 waterfall 事件**必须 return next()**，否则会顶掉 dsh-client-ui-approval / dsh-client-ui-user-questions，UI 上的批准框/提问卡会消失。

### 5.3 播声音 —— **能做到（大概率）**

- 渲染进程是标准 Chromium 页面，new Audio(src).play() / WebAudio 均可用；dsh-app: 是 secure context。
- 未在 app.asar 的 webPreferences 中发现 autoplayPolicy 覆盖 ⇒ 沿用 Electron 默认（no-user-gesture-required，即**不需要用户手势**）。**此点未实测**，列为实验 E5。
- 已有插件在同一页面里做音效：dsh-whale-widget（...\dsh-whale-widget\lib\index.js 内置 assets/task-end-a.wav、minecraft-exp-orb.wav，并有 /dsh-whale/* 音频路由与前端播放）。
- 资源投递方式（whale-widget 的做法，可复用）：宿主半用 ctx.webServer.register({kind:"prefix", path:"/your-plugin", handler}) 注册路由（**必须**套 ctx.connection.requestRejection(req) 做信任栅栏），前端 new Audio("/your-plugin/sound.wav")。

### 5.4 会话列表跳转 / 高亮 —— **能做到**

- 跳转：ctx.uiWorkspace.openSession(sessionId)（§4.2）。
- 高亮/角标：侧栏槽位**真实存在**（在 client bundle 中检索到注册点）：
  sidebar.session.row.leading、sidebar.session.row.hover、sidebar.workspaces.session.row.action、sidebar.workspaces.session.menu.item、conversation.session.header.utilities、conversation.session.header.corner、shell.overlay、conversation.composer.dock 等。
  注册写法与官方模板一致：ctx.slots.inject('<slot>', () => ctx.slots.register({ name: '<slot>', id: '...', order: n }, Component))。
- 会话标题/状态读取：客户端 sessions 服务（ctx.sessions.list.getSnapshot()），先例见 dsh-sidebar-qa\src\client\current-session.ts。

### 5.5 无依赖注入脚本 / 自定义宿主↔页面通道 —— **能做到**

两条已被生产插件验证的通道：

1. **注入表**（webserver/index-inject）
   ...\dsh-host-webserver\lib\index.js:350 collectIndexInjections()：this.ctx.emit("webserver/index-inject", table)，订阅者往 table 里 push 行。
   行类型（api-catalog 的 IndexInjection）：
```ts
{ kind:'global'; name; value } | { kind:'script'; placement:'head'|'body'; text } |
{ kind:'script-src'; placement; src } | { kind:'script-preload'; src } |
{ kind:'style'; text } | { kind:'html'; placement; html }
```
   **桌面端时序**：...\dsh-desktop-host\lib\index.js:341 在 main() 里**只收集一次**并随 ready IPC 交给外壳（main.js:11332 injections = ready.injections），再经 dshDesktopBoot.ready() 交给页面。页面侧消费代码在 ...\dsh-web-frontend\dist\assets\index-5SrrfWpU.js:126 async function hM(e,n)：
```js
case "script":  { const s=document.createElement("script"); s.textContent=o.text; (o.placement==="head"?document.head:document.body).append(s); break }
case "script-src": await n(o.src);   // 加载失败 → throw → 整个 boot reject（应用起不来）
case "global":  globalThis[o.name]=o.value; break
```
   **坑（whale-widget 血泪，issue #154）**：script-src 加载失败会让 __DSH_BOOT_READY__ reject ⇒ **整个应用起不来**。必须用 kind:"script" 内联一段自带 onerror 兜底的 loader，或者保证路由永远在。
   且注入行**必须在你插件 apply() 的早期同步注册**（不能等 inject:['webServer'] 就绪后异步注册），否则错过那次唯一收集，注入永远不出现。
2. **自己的 HTTP 路由 + @Remote**
   ctx.webServer.register({kind:'exact'|'prefix', path, handler}) → disposer（api-catalog 的 webServer）。
   安全栅栏：ctx.connection.requestRejection(request) / admit(request) / authorizeIndex（api-catalog 的 connection）。
   页面侧 fetch("/your-plugin/api/...")。生产先例：dsh-sidebar-qa（lib/index.js 注册 /sidebarqa/api/*，前端 src/client/api.ts 直接 fetch）。
   另有官方 RPC 面 ctx.remote.<namespace>.<method>()（宿主服务加 @Remote('name') 装饰即暴露），客户端还可 ctx.remote.$mount(contribution)。

---

## 6. Q5 —— 托盘 / 角标 / 窗口闪烁

### 6.1 托盘实现位置与可扩展性 —— **做不到（从插件）**

<DSH desktop install>\resources\app.asar\lib\main.js:10834：

```js
/** Windows system tray: the always-present way back to a hidden window and the explicit quit entry. */
var DesktopTray = class {
    constructor(options) {
        const tray = new Tray(nativeImage.createFromPath(options.iconPath));
        this.tray = tray;
        tray.on("click", () => { options.open(); });
        this.relabel();
    }
    relabel() {
        const { messages } = this.options.locale();
        tray.setToolTip(messages.aboutProduct);
        tray.setContextMenu(Menu.buildFromTemplate([
            { label: messages.openApplication, click: () => { this.options.open(); } },
            { type: "separator" },
            { label: messages.quitApplication, click: () => { this.options.quit(); } },
        ]));
    }
    dispose() { ... }
};
```

- 实例只在主进程创建（main.js:471564 附近，process.platform === "win32" 才建；图标 resources\tray.ico）。
- **类不导出、无 IPC、无注册点** ⇒ 插件无法：加菜单项、改 tooltip、换图标、加托盘角标。
- displayBalloon（托盘气泡）全库 0 处；setBadgeCount / setOverlayIcon 全库 0 处。
- flashFrame 全库 1 处，且只在更新就绪路径（main.js:8902）。

**替代方案（均为间接，未验证 ⇒ 存疑）**：
- 窗口闪烁：宿主插件 spawn PowerShell + Add-Type P/Invoke user32!FlashWindowEx，句柄从 Get-Process "DeepSeek Harness" 的 MainWindowHandle 取。**注意**：窗口若处于托盘隐藏态则无任务栏按钮可闪；且 Windows 11 对前台窗口的闪烁会忽略。
- 托盘气泡：需要长期驻留一个拥有 Shell_NotifyIcon 图标的进程（自建 helper），复杂度高、体验差，**不建议**。

### 6.2 任务栏角标 —— **做不到**

Electron 在 Windows 上的对应能力是 BrowserWindow.setOverlayIcon()（app.setBadgeCount 在 Windows 无效），外壳一分未用，且不暴露给插件。渲染侧也没有相应 preload API。

### 6.3 推荐替代

用 **「原生 Toast + 有声音 + 点击拉前台」** 取代「托盘角标 + 窗口闪烁」：效果更直接，且都有已验证的路径（§3.4 / §4.1）。

---

## 7. 其他需要注意的硬约束与坑

1. **dsh-app:// 的 IPC 全部有来源校验**：assertDesktopSender(event, ["app"])（main.js 的 const DESKTOP_IPC 下方）。外部网页/其他 origin 一律 401。渲染侧的插件天然在合法 origin 里，没问题。
2. **注入行必须早注册**（§5.5）；**外部 script 加载失败会拖垮整页 boot**。
3. **官方转发事件白名单是单例、不可扩展**（§5.2）——想给页面推自定义事件，走自己的 HTTP 路由（SSE / 轮询）或 @Remote 方法。
4. **不要 process.send 未知类型**（§3.5）——会让外壳 SIGTERM 掉宿主进程。
5. **不要顶替 waterfall**：approval/request、user-questions/request 里必须 next()。
6. **别用 DSH 的 pwsh 解析**：本机 pwsh7 不存在，会落到 PS 5.1；写死 C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe。
7. **Low IL ⇒ 无 Toast**：如果通知走 PowerShell，务必直接 child_process.spawn（Medium IL），不要经 DSH 的沙箱 shell 工具。
8. **桌面端 vs web 端**：webserver/index-inject 在桌面端只收集一次（web 形态每次 renderIndex 都重新收集），两条通道要分开实现（whale-widget 就是这么做的）。
9. **安装契约**：插件是 profile 级；桌面端只能用自带 CLI 或 GUI 插件页管理；插件改动生效需要用户重启（本任务不得代为重启）。

---

## 8. 推荐技术路线

### 路线 A（首选）：**单包双面 —— 宿主半检测 + 渲染半展示**

```
┌─ 一个 bundle 包 @local/dsh-notify ────────────────────────────────┐
│ package.json: dsh.bundle.patch + dsh.client {platform:"web"}       │
│                                                                    │
│ index.js (Host 半, 跑在 dsh-desktop-host Node 进程)                │
│   • ctx.on("webserver/index-inject", table => table.push(           │
│       {kind:"script", placement:"body", text: LOADER_SNIPPET}))     │
│     ← 必须在 apply() 第一件事，同步注册                             │
│   • ctx.webServer.register({kind:"prefix", path:"/dsh-notify",      │
│       handler})  ← 套 ctx.connection.requestRejection()             │
│       - POST /dsh-notify/focus  → spawn cmd /c start "" dsh://open  │
│       - GET  /dsh-notify/sound.wav  提示音资源                      │
│   • （可选）ctx.on("approval/request", ...) 等做宿主侧兜底/日志      │
│                                                                    │
│ client.js (Client 半, 跑在渲染进程)                                 │
│   • ctx.remote.$on("api-session/status", (id, running) => ...)      │
│   • ctx.remote.$on("api-session/error",  (id, msg) => ...)          │
│   • ctx.remote.$on("approval/request",   function(req,next){ ...;   │
│                                            return next() })         │
│   • ctx.remote.$on("user-questions/request", function(req,next){..})│
│   • 展示：new Notification({...}); n.onclick = () => {              │
│        fetch("/dsh-notify/focus", {method:"POST"})   // 拉前台      │
│        ctx.get("uiWorkspace")?.openSession(sessionId) // 跳会话     │
│      }                                                              │
│   • 声音：new Audio("/dsh-notify/sound.wav").play()                 │
│   • 高亮：ctx.slots.inject("sidebar.session.row.leading", ...)      │
└────────────────────────────────────────────────────────────────────┘
```

**为什么这样分工**：
- 检测用**渲染侧**（27 条转发事件里正好覆盖三类触发，且点击回调里天然握着 sessionId）。
- 「拉前台」用**宿主侧 dsh://open**（唯一有代码 + 注册表双重证据的路径）。
- 「跳会话」只能在渲染侧（§4.2）。
- 声音、侧栏高亮只能在渲染侧。

**风险点**：渲染侧 new Notification() 能否真正弹出 Windows Toast（实验 E1）。**若不行的降级方案见路线 B**。

### 路线 B（备选 / 降级）：**宿主侧 PowerShell Toast**

index.js（Host 半）里：
- ctx.on("agent/status", ...) + ctx.on("session/event", ...turn/end) + ctx.on("agent/error", ...) 做检测；
- child_process.spawn(POWERSHELL, ["-NoProfile","-NonInteractive","-EncodedCommand", b64], { stdio:"ignore", windowsHide:true, detached:true })，脚本用 ToastNotificationManager（AUMID com.deepseek.dsh）+ <audio src="ms-winsoundevent:Notification.Default"/> + activationType="protocol" launch="dsh://open"。
- 代价：**点击后只能拉前台，不能直接跳会话**。要补跳会话，需把「最近一次通知的 sessionId」写到一个宿主可见的地方，页面恢复焦点后向宿主查询再导航（多一次往返，且窗口重新获得焦点的事件在渲染侧只有 document.visibilitychange / window.focus 可用）。
- 好处：完全不依赖 Electron 通知通道。

### 路线 C（不推荐）：把窗口闪烁/托盘角标作为主要反馈
理由：flashFrame / 托盘 / 角标从插件都不可达（§6），只能靠 P/Invoke 硬凑，收益低、风险高。

---

## 9. 必须先做的小实验验证清单

> 全部为「只读/低副作用」级别，按优先级排序。E1/E2 决定主路线，先做。

| # | 实验 | 怎么做 | 判定 |
|---|---|---|---|
| **E1** | **渲染侧 Web Notification 是否真能弹出 Windows Toast** | 打开 DSH 主窗口 DevTools（webPreferences 里 devTools: true；也可用 DSH_DESKTOP_OPEN_DEVTOOLS 环境变量），Console 执行 Notification.requestPermission().then(p=>console.log(p, new Notification("t",{body:"b"}))) | 弹出即 **路线 A 成立**；不弹或触发 failed 即转路线 B |
| **E2** | **PowerShell Toast 实弹（含声音）** | 用**非沙箱**的 Medium IL 进程（例如 windows-mcp 的 PowerShell，或用户自己开的 PowerShell 窗口）跑完整 .Show()，AUMID=com.deepseek.dsh，XML 带 <audio src="ms-winsoundevent:Notification.Default"/> | 弹出+响 ⇒ **路线 B 成立**；不弹 ⇒ 试 ToastNotificationManagerCompat（需 WinAppSDK）或改走渲染侧 |
| **E3** | **Toast 点击 → 拉前台** | E2 的 Toast 里加 activationType="protocol" launch="dsh://open"；先把 DSH 最小化到托盘，再点通知 | 窗口 restore+show+focus ⇒ C8 实锤 |
| **E4** | **渲染侧 window.focus() 是否能拉前台** | DevTools 里 window.focus()（先把窗口最小化或点开别的程序） | 能则去掉宿主侧 dsh://open 依赖 |
| **E5** | **页面自动播放策略** | DevTools 里 new Audio(url).play().then(()=>console.log("ok"), e=>console.log("blocked", e))，在与 E1 相同的会话状态下（页面刚加载、无点击） | 若被 blocked，则首次交互后解锁 |
| **E6** | **注入行时序 + 容错** | 写一个最小 bundle，在 apply() 里立刻 ctx.on("webserver/index-inject", ...) 推 {kind:"script"}，重载页面看是否执行 | 验证「一次性收集」的时序约束 |
| **E7** | **ctx.remote.$on("approval/request") 在第三方 client 插件里可用** | 最小 client 半 plugin 注册该监听，触发一次需要批准的操作（如写工作区外文件），看是否进回调、且原批准 UI 仍在 | 同时验证「必须 next()」的坑 |
| **E8** | **原生 Toast 的 AUMID 归属与通知中心行为** | E2 弹出后看通知来源名是否显示「DeepSeek Harness」；把鼠标移到通知上确认可点 | 决定是否需要自建 New-BTAppId 快捷方式 |
| **E9** | **FlashWindowEx 兜底是否值得做** | PowerShell P/Invoke 对 MainWindowHandle 调 FlashWindowEx，窗口可见但未聚焦时试 | 若有效，可作为「静默提醒」的补充 |

同时，以下**已经用证据排除**的路线不必再试：
- ❌ 宿主插件直接 require('electron')（实测抛 Cannot find module）。
- ❌ 通过 process.send 自定义 IPC 让外壳弹通知（会 SIGTERM 掉宿主，见 §3.5）。
- ❌ 往官方 remote 事件流里加自定义事件（单例 + 硬编码表，见 §5.2）。
- ❌ 插件注册/修改托盘菜单、托盘角标、任务栏 overlay（主进程私有类，见 §6）。
- ❌ 用 dsh://<任意内容> 传递会话 id（open-url 只认 dsh://open；Windows 的 second-instance 丢弃 argv，见 §4.2）。

---

## 10. 证据文件索引（全部绝对路径）

**Electron 外壳**

| 文件 | 关键内容 |
|---|---|
| <DSH desktop install>\resources\app.asar\package.json | @deepseek-ai/dsh-desktop 0.2.0-rc.2；dshDesktopAppId: com.deepseek.dsh |
| <DSH desktop install>\resources\app.asar\lib\main.js | L3544 isDesktopHostEvent；L6274 installMicrophonePermissions；L6870 claimDesktopSingleInstance；L8902/8909 flashFrame / new Notification；L10834 DesktopTray；L10940 focusPrimaryWindow；L11019 registerSchemesAsPrivileged；L11332 injections = ready.injections；L11553 权限安装到 defaultSession；L12189/12190 setAsDefaultProtocolClient("dsh") / open-url |
| <DSH desktop install>\resources\app.asar\lib\preload-app.cjs | L789 createProductApi()（渲染侧暴露面：无通知 / 无窗口控制） |
| <DSH desktop install>\resources\app.asar\dsh\desktop-runtime.json | 0.2.0-rc.2 / hostProtocolVersion 4 / node 24.18.1 / pnpm 11.7.0 |

**DSH 运行时（<DSH desktop install>\resources\app.asar\dsh\node_modules\@deepseek-ai\）**

| 文件 | 关键内容 |
|---|---|
| dsh-desktop-host\lib\index.js | L216 main()；L341 collectIndexInjections()（桌面端唯一一次收集）；installDesktopQuitInspection |
| dsh-user-approval\lib\index.js | L132 approval/asked；L176 waterfall(..., "approval/request", ...)；ApprovalService |
| dsh-user-questions\lib\index.js | L681 waterfall("user-questions/request", ...)；UserQuestionService |
| dsh-agent-loop\lib\index.js | L798 emit("agent/status")；L880 emit("agent/error")；L1027 append("turn/end") |
| dsh-agent\lib\index.js | L242 function agentEvents（把 agent 注入载荷的全局派发器） |
| dsh-api-session-controller\lib\index.js | ctx.on("agent/status" / "agent/error" / "session/event") → api-session/* |
| dsh-api-remotes\lib\index.js | L17 API_REMOTE_FORWARDED_EVENTS（27 条转发白名单） |
| dsh-api-gateway\lib\index.js | openRemoteEvents / $events 流 / registerRemoteEvents 单例 |
| dsh-api-gateway\lib\types\client\index.js | $on / $stream / $mount / $host |
| dsh-host-webserver\lib\index.js | L350 collectIndexInjections()；register / tapIndex / renderIndex |
| dsh-client-modules\lib\index.js | L61 parseDshClient；L453 bootInjections（script / script-src / global 行） |
| dsh-client-modules\lib\client.js | 浏览器侧 window.__DSH_BOOT__ 契约、懒 CJS 表 |
| dsh-web-frontend\dist\assets\index-5SrrfWpU.js | L126 async function hM(e,n)：注入行在页面侧的落地实现 |
| dsh-client-ui-approval\lib\client.js | L355 ctx.remote.$on("approval/request", ...)（渲染侧注册 waterfall 的官方范例） |
| dsh-client-ui-workspace\lib\client.js | L772 super(ctx, "uiWorkspace")；L821 openSession(target) |
| dsh-pwsh-local\lib\index.js | L23 candidatePwshPaths（pwsh7 → PATH → WindowsPowerShell 5.1） |
| dsh-tool-cordis\lib\types\api-catalog.js | L15 SERVICE_API（91 服务）；L3690 EVENT_API（81 事件 + 模式 + 签名 + 类型声明） |
| dsh-agent-preset\skills\cordis-plugin-development\* | 官方插件开发规范：SKILL.md、references/host-plugin.md、references/ui-plugin.md、references/practices.md、templates/decoration/* |

**本机实测（注册表 / 进程 / 现存插件）**

| 来源 | 关键内容 |
|---|---|
| HKCU\Software\Classes\dsh\shell\open\command | "<DSH desktop install>\DeepSeek Harness.exe" "%1"（dsh:// 已注册） |
| %APPDATA%\Microsoft\Windows\Start Menu\Programs\DeepSeek Harness.lnk | System.AppUserModel.ID = com.deepseek.dsh |
| %USERPROFILE%\AppData\Roaming\@deepseek-ai\dsh-desktop | userData；logs 仅 2 个崩溃日志（与本主题无关） |
| %USERPROFILE%\.dsh\profiles\desktop\package.json | desktop profile：8 个第三方包 + 4 个官方 bundle |
| %USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-whale-widget\lib\index.js | 已生产验证的 webserver/index-inject + 自建路由 + turn/end 监听 + 音效 |
| %USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-sidebar-qa\src\client\show-session.ts | ctx.get('uiWorkspace').openSession(sessionId) 的正确用法与历史坑 |
| %USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-sidebar-qa\src\client\api.ts | 第三方插件自建 /sidebarqa/api/* + 前端 fetch 的完整先例 |

---

## 11. 未验证清单（明确「缺什么证据」）

1. **渲染侧 new Notification() 是否真弹 Windows Toast** —— 缺实弹证据。宿主半 app.setAppUserModelId 在整个 app.asar 中 **0 处命中**（对 appusermodelid|AppUserModelId|setAppUserModelId 做全文件大小写不敏感检索），而安装器把快捷方式 AUMID 设成了 com.deepseek.dsh；Electron 未显式设置时用的默认 AUMID 是否与之匹配，无法从 app.asar 证明。
2. **Toast 点击是否真触发 second-instance 并 restore/focus 窗口** —— 代码路径完整（setAsDefaultProtocolClient + claimDesktopSingleInstance + focusPrimaryWindow）且协议已注册，但缺一次端到端点击实验。
3. **window.focus() 在 Electron 渲染进程里能否激活主窗口** —— Electron 内部实现不在 app.asar 内。
4. **页面自动播放策略** —— 未在 webPreferences 看到 autoplayPolicy 覆盖，推断为 Electron 默认 no-user-gesture-required，未实测。
5. **第三方 client 插件使用 ctx.remote.$on** —— API 公开（$on(event, listener)）且一等公民包在用，但**本机已装第三方插件里没有任何一个用过 $on(**，属首次使用的未知面。
6. **PowerShell Toast 在插件 spawn 场景下的完整性级别** —— 只验证了「Medium IL OK / Low IL 失败」，插件所在的宿主进程未被 DSH 沙箱降权（合理推断），未直接验证。
7. **FlashWindowEx 兜底的有效性** —— 完全未验证。
8. **托盘角标（任务栏 overlay）** —— 已确认外壳未使用且不暴露；是否需要自建 native helper 未评估。

