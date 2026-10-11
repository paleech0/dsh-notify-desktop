# S2 实验记录：托盘 / 角标 / 窗口闪烁可达性（2026-10-10）

> 结论先行：**插件侧一个都做不到**，与 D2 决策一致（只用通知本身，不做托盘角标、不做窗口闪烁）。

## Step 1 复核：这些 API 的归属

对桌面端安装目录做了两轮全文扫描（脚本内联在会话中执行，非人工抽样）：

| 模式 | 壳（`app.asar\\lib\\*.js`，Electron 主进程） | 运行时（`app.asar\\dsh\\node_modules\\@deepseek-ai\\**`，289 个包，插件唯一能 import 的世界） |
|---|---|---|
| `new Tray(` | 1（main.js，DesktopTray 私有类，菜单硬编码） | **0** |
| `flashFrame` | 2（main.js，更新提醒用） | **0** |
| `setBadgeCount` | 0 | **0** |
| `setOverlayIcon` | 0 | **0** |
| `displayBalloon` | 0 | **0** |
| `new Notification(` | 1（main.js，强制更新提示） | **0** |

补充事实：宿主侧插件跑在 Electron **fork 出来的纯 Node 子进程**里（可行性报告 §实测：`require('electron')` 抛错），
连 `electron` 模块都 require 不到；壳的 IPC 面（`preload-app.cjs` 里 `contextBridge.exposeInMainWorld`）
只暴露 `dshOnboarding` / `dshDesktopBoot` / `dshPlatform` / `dshDesktop`（browser / deviceInfo / keyboard / shortcuts / updates），
**没有任何窗口控制、托盘、角标入口**，且该面由壳硬编码，第三方插件无法扩展。

## Step 2 替代方案评估（client 侧）

| 方案 | 可行性 | 代价 | 本期取舍 |
|---|---|---|---|
| `document.title` 闪烁 | 可行（改标题） | 桌面端窗口标题不被渲染/被壳覆写，用户看不到；且会污染标签语义 | 不做 |
| favicon 红点 | 不可行 | Electron 页签不显示 favicon（无浏览器标签栏） | 不做 |
| 侧栏会话行红点 | 可行（`sidebar.session.row.*` 槽位） | 需要额外槽位契约 + 样式，且 D2 已定「只靠通知本身」 | 不做（保留为后续可选） |

## Step 3 结论

- 插件**无法**注册托盘图标、设置任务栏角标/覆盖图标、触发窗口闪烁 —— 这些都属于 Electron 主进程私有能力。
- 真正「离开 DSH 也能提醒」的通道只有 **系统通知本身**（E1 已验证可弹），外加点击通知后的**回前台**（走 `dsh://open`，见 S1 的 E3/E4）。
- 已知限制将写进 README：**本插件不提供托盘角标与窗口闪烁**。
