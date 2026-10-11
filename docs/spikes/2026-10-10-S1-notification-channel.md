# S1 实验记录：通知通道与窗口行为（2026-10-10）

> 环境：DSH 桌面端 0.2.0-rc.2（Electron 44，dsh-app://app/），Windows 11，2560×1600。
> 手段：F12 打开主窗口 DevTools（`devToolsItems` 里 `toggleDevTools` 带 F12 accelerator，main.js:11921-11928），
> 在 Console 里直接执行 JS；桌面窗口用 windows-mcp 操作（托盘图标唤出、通知点击、截图判读）。

## E1（生死线）：渲染层 Web Notification 能否真弹 Windows 通知 —— **通过**

执行（DevTools Console，页面上下文 dsh-app://app/）：

```js
Notification.requestPermission().then(p=>{console.log('E1_PERM='+p);
  new Notification('DSH E1 test',{body:'renderer notification channel',tag:'e1'});console.log('E1_CREATED')})
var n=new Notification('DSH E1 toast',{body:'onshow probe'});
n.onshow=()=>console.log('E1_SHOW'); n.onerror=e=>console.log('E1_ERR',e&&e.type); n.onclose=()=>console.log('E1_CLOSE')
```

原始输出：

```
E1_PERM=granted
E1_CREATED
E1_PROBE
E1_SHOW      ← OS 接受并真正显示了通知
E1_CLOSE     ← 通知超时关闭
```

截图证据：右下角真实弹出 Windows 通知，来源名 **DeepSeek Harness**，标题/正文与代码一致
（`DSH E1 toast` / `onshow probe`）。`requireInteraction: true` 时通知常驻，且带「关闭」按钮。

静态佐证（app.asar\\lib\\main.js）：应用窗口 session 的权限处理对**非 media 权限一律放行**——

- `setPermissionCheckHandler`：`if (permission !== "media") return true`（main.js:6275-6278）
- `setPermissionRequestHandler`：`if (permission !== "media") { callback(true); return }`（main.js:6279-6283）

**结论：路线 A 成立。**渲染侧 `new Notification()` 就是可用的原生通知通道，不需要宿主侧 PowerShell Toast（路线 B 不启用）。

## E8：Toast 来源名 —— **DeepSeek Harness（无需自建 AUMID 快捷方式）**

弹窗标题栏显示应用名 `DeepSeek Harness`（exe 名派生），不是空名或 "Electron"。
因此 **不需要**为插件单独注册 AUMID 快捷方式。

## E2（路线 B 生死线）：宿主侧 PowerShell Toast —— **不执行（已被 E1 取代）**

E1 通过后路线 B 不再需要；且可行性报告已实测 Medium IL 可弹、DSH 沙箱 Low IL 会 0x80073D54。
保留该结论备查，不作为本期实现。

## E4：渲染侧 `window.focus()` 能否拉前台 —— **失败**

执行：`setTimeout(()=>{console.log('E4_FOCUS_CALL');window.focus()},4000)`，窗口被 DevTools 遮挡时触发。

原始输出：`E4_ARMED` / `E4_FOCUS_CALL`（回调确实执行）——但截图显示 **窗口未回到前台**。

**结论：`window.focus()` 不能把窗口拉到前台**；点击通知后的「回前台」必须走桌面壳。

## 点击通知：onclick 能收到，但不会自动拉起窗口（E3 前置）

执行：`var t=new Notification('DSH click test',{body:'click to focus',tag:'click1',requireInteraction:true});t.onclick=()=>console.log('E1_CLICKED')`
→ 点击通知气泡：`E1_CLICKED` 打印（渲染侧确实收到点击），但窗口**未**被 OS 激活到前台。

## E3：`dsh://open` 拉前台 —— **机制成立，前台授权待验收阶段确认**

- 注册表已注册协议：`HKCU\\Software\\Classes\\dsh\\shell\\open\\command` = `"<DSH desktop install>\DeepSeek Harness.exe" "%1"`。
- 壳侧逻辑（main.js:12165-12188）：`second-instance` → `focusPrimaryWindow()`，内部 `if (window.isMinimized()) window.restore(); window.show(); window.focus()`；
  `app.setAsDefaultProtocolClient("dsh")` 仅在 packaged 或 `DSH_DESKTOP_DEV_APP=1` 时执行（本机是安装版 → 已执行）。
- 实测：从 PowerShell 执行 `Start-Process "dsh://open"` → 进程表出现新实例后自行退出（单实例锁生效，未产生第二个宿主，**进程数回到 4**）。
- 但那一轮截图中窗口没有可见地回到最前——受 Win32 前台锁影响（非前台进程的 `SetForegroundWindow` 会被拒），
  **结论留待 Task 8 端到端验收**：真实点击 Windows 通知属于用户激活，前台授权路径与本次不同。
- 若验收仍失败：降级为「不自动拉前台」，并在 README 已知限制里写明（DoD 允许降级）。

## E5 / E6 / E7：**已随路线简化取消**

- E5（自动播放策略）：D4 决定用系统通知自带音（不设 `silent`），不播自备音效 → 不需要。
- E6（index-inject 注入时序）：简化后不注入脚本 → 不需要。
- E7（第三方 client 插件 `ctx.remote.$on`）：简化后不订阅转发事件 → 不需要。

## E9：FlashWindowEx 兜底 —— **不做**（D2：只用通知本身；插件侧拿不到窗口/托盘 API）

## 路线决定（回填计划 §2）

**路线 A（单包双面）确认，并按实证进一步简化：**

- 检测与投递全部走 **session projection seam**：宿主半注册 `notify` 投影（最近一次 turn 的结束原因 + 正文 + 当前阻塞交互），
  渲染半从会话列表 `projectionValues.notify` 读取——0.2.0-rc.2 的 `api-session-controller` 客户端本来就带 `projectionValues`。
- **不做** `webserver/index-inject` 注入脚本、**不做** `ctx.remote.$on` 转发事件订阅（27 条白名单用不上）。
- 唯一新增的宿主侧通道：一条同源路由 `POST /dsh-notify/focus`，点通知时由它 `spawn("cmd.exe", ["/c","start","","dsh://open"])` 拉前台（E4 失败后的唯一可行路径）。
- `pendingInteraction` 字段在 0.2.0-rc.2 的客户端会话列表里**已被移除**（0.1.2 版插件依赖它）→ 阻塞交互由我们自己的投影 fold 出来：
  `approval/asked` + `approval/decided`（审批）、`tool/call`(`ask_user_question`) + `tool/result` + `user/message`(source.kind=`user-question-reply`)（提问 / 计划评审）。

## 运行时 API 差异（相对 0.1.2 版参考插件，影响实现）

| 项 | 0.1.2-rc.1（参考插件） | 0.2.0-rc.2（本机运行时） |
|---|---|---|
| 投影定义 | `schema` + 顶层 `view` | `stateSchema` + `wire: { viewSchema, view }`，`init(header, inheritedEventCount)`，`stateVersion` |
| 会话列表阻塞态 | `summary.pendingInteraction` | **已移除**，需自建投影 |
| turn 结束原因 | completed/error/aborted/blocked/max-tokens | 追加 `interrupted`、`forked`（不通知） |
| 客户端设置槽位 | `settings.section` | 同（0.2.0-rc.2 仍存在） |
| 跳会话 | `uiWorkspace.openSession(sessionId)` | 同（`dsh-client-ui-workspace/lib/client.js:821`） |
