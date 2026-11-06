# S4 — 注册表登记能否恢复 Toast 的应用名与图标（2026-11-06）

**目的**：桌面端 0.2.2-rc.1 把开始菜单快捷方式的通知身份从旧号 `electron.app.DeepSeek Harness`
换成了 manifest id `com.deepseek.dsh`。0.2.1 的身份自适应以旧号优先（当时 Windows 能为它解析
显示名/图标），换号后子进程仍选中旧号——Windows 解析不到任何登记，Toast 退化成裸
`electron.app.DeepSeek Harness` 标签、没有图标。验证：能否由插件自己把身份登记好，
让 Toast 无论快捷方式写成哪个号都显示「DeepSeek Harness」+ 鲸鱼图标。

**背景实测**（本机，Windows 11 25H2 build 26200，DSH 桌面端 0.2.2-rc.1）：

| 观察点 | 结果 |
|---|---|
| `Get-StartApps` 快捷方式身份 | `com.deepseek.dsh`（0.2.1-rc.5 时代是旧号，见 2026-10-31 验收） |
| `HKCU/HKLM\SOFTWARE\Classes\AppUserModelId` | 两个 DSH id 都**没有**登记（表里只有 JianyingPro/PowerToys/sunlogin 等，均带 `DisplayName` + `IconUri`） |
| `CreateToastNotifier('electron.app.DeepSeek Harness').Setting` | `Enabled`（但什么都不解析 → 裸标签） |
| `CreateToastNotifier('com.deepseek.dsh').Setting` | `Enabled`（快捷方式可解析） |
| 随机 id（`foo.bar.baz`） | notifier 为 null —— Setting 能挡住乱号，挡不住「曾经合法、现已失效」的号 |

**方法**：两条互补路径——

1. **登记**（`src/identity.ts`）：宿主启动时用 reg.exe 静态 argv 在
   `HKCU\SOFTWARE\Classes\AppUserModelId\com.deepseek.dsh` 写 `DisplayName`（"DeepSeek Harness"）
   和 `IconUri`（随包 `assets/dsh-icon.png`）。这是微软对非打包 Win32 应用的登记机制
   （ToastNotificationManagerCompat、BurntToast 写同一张表）。幂等：先 `reg query` 读现状，
   只补缺失/漂移的值，永不删除；失败只记 debug ring，不阻塞 Toast。
2. **探测改造**（`src/aumid.ts` + `AUMID_RESOLVE_LINES`）：`Test-Path` HKCU/HKLM 注册表键优先——
   登记是「可解析」的真凭据；没有任何登记才退回 `Setting` 粗探测；最后兜底末位候选。
   候选顺序翻转为 manifest id 优先、旧号兜底。

**实测结果**（手动验证，与实现同参数）：

- reg.exe 写入后 `Get-ItemProperty` 确认两个值落盘；重跑写入路径报告 0 次写入（幂等成立）。
- 子进程探测脚本对登记后的 `com.deepseek.dsh` 第一层即命中，不再依赖 Setting。
- 同参数手动弹 Toast（ToastGeneric XML + protocol 激活）：左上角显示 **DeepSeek Harness**，
  带鲸鱼图标；注销旧号残留不影响显示。

**结论**：可行且已成为默认行为。登记不依赖下一个安装器把快捷方式写对，换号类变更不再
破坏显示；`Setting` 探测保留为无登记机器的兜底。reg.exe 是唯一注册表通道（不新增
PowerShell spawn 点）。诊断接口 `identity` 字段记录本次登记的 id、写入值与成败。

**遗留**：`assets/dsh-icon.png` 取自安装目录 exe 的 32×32 图标资源（exe 内无更大位图）；
若上游提供更高分辨率品牌资源可直接替换，键值路径不变。
