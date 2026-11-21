window.__ModuleLoader__.load({
	id: "dsh-notify-desktop",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/decision.ts
		/** The de-duplication window: two identical signals inside it collapse into one. */
		const DEDUPE_MS = 3e3;
		/** Map a raw projection reason to a notifiable reason, or undefined when unknown. */
		function asReason(reason) {
			switch (reason) {
				case "completed":
				case "error":
				case "aborted":
				case "blocked":
				case "max-tokens": return reason;
				default: return;
			}
		}
		/** Whether the switch for one kind of blocking interaction is on. */
		function pendingEnabled(settings, kind) {
			switch (kind) {
				case "approval": return settings.notifyApproval;
				case "question": return settings.notifyQuestion;
				case "plan-review": return settings.notifyPlanReview;
			}
		}
		/** The situation one turn-end reason belongs to. */
		function scenarioOfReason(reason) {
			switch (reason) {
				case "completed": return "completed";
				case "error": return "error";
				case "aborted": return "aborted";
				case "blocked": return "blocked";
				case "max-tokens": return "max-tokens";
			}
		}
		/** The situation one blocking interaction belongs to. */
		function scenarioOfPending(kind) {
			switch (kind) {
				case "approval": return "approval";
				case "question": return "question";
				case "plan-review": return "plan-review";
			}
		}
		/** The situation one trigger belongs to. */
		function scenarioOfTrigger(trigger) {
			return trigger.kind === "turn" ? scenarioOfReason(trigger.reason) : scenarioOfPending(trigger.pending);
		}
		/**
		* Whether a situation is switched on.
		*
		* The reminder has no switch of its own: it only exists while at least one
		* waiting situation is enabled, and each tracked wait is additionally filtered
		* by its own kind inside {@link dueReminders}.
		* @param settings - the live settings.
		* @param scenario - the situation to test.
		* @returns true when the situation may notify.
		*/
		function scenarioEnabled(settings, scenario) {
			switch (scenario) {
				case "completed": return settings.notifyCompleted;
				case "error": return settings.notifyError;
				case "aborted": return settings.notifyAborted;
				case "blocked": return settings.notifyBlocked;
				case "max-tokens": return settings.notifyMaxTokens;
				case "approval": return settings.notifyApproval;
				case "question": return settings.notifyQuestion;
				case "plan-review": return settings.notifyPlanReview;
				case "reminder": return settings.notifyApproval || settings.notifyQuestion || settings.notifyPlanReview;
			}
		}
		/**
		* The sound one situation plays.
		*
		* `sound`-only mode plays the situation's own choice; `notify`-only mode mutes
		* every toast (the sound-only route never runs for it); `both` is the
		* historical behaviour. The old `soundEnabled` boolean and its AND with the
		* master switch collapse into this one field.
		* @param settings - the live settings.
		* @param scenario - the situation.
		* @returns the chosen sound, or 'silent' when toasts are muted.
		*/
		function scenarioSound(settings, scenario) {
			return settings.mode === "notify" ? "silent" : settings.sounds[scenario];
		}
		/**
		* Whether a notification in this mode plays a sound without raising a toast.
		* The caller routes the decision to the host's sound-only route instead of
		* showing anything.
		* @param settings - the live settings.
		* @returns true when nothing visual is raised.
		*/
		function isSoundOnly(settings) {
			return settings.mode === "sound";
		}
		/**
		* Whether this trigger from a subagent-origin session must stay silent.
		*
		* `all` never mutes; `silent` mutes every trigger (turn ends, approvals,
		* questions — and the caller also drops the reminder for that session);
		* `quiet` mutes only the finished turn, which is the burst this exists for.
		* @param settings - the live settings.
		* @param trigger - what raised the signal.
		* @returns true when the signal must not become a toast.
		*/
		function subagentMuted(settings, trigger) {
			if (settings.subagentMode === "all") return false;
			if (settings.subagentMode === "silent") return true;
			return trigger.kind === "turn";
		}
		/**
		* Decide whether one signal becomes a toast.
		* @param input - the settings, trigger, view state, clock, and dedupe memory.
		* @returns the decision, or null when this signal must stay silent.
		*/
		function decideNotification(input) {
			const { settings, trigger } = input;
			if (!settings.enabled) return null;
			const scenario = scenarioOfTrigger(trigger);
			if (!scenarioEnabled(settings, scenario)) return null;
			if (input.sessionOrigin === "subagent" && subagentMuted(settings, trigger)) return null;
			if (input.focused) return null;
			if (!settings.notifyViewedUnfocused && input.activeSessionId !== void 0 && input.sessionId === input.activeSessionId) return null;
			const window = input.dedupeWindowMs ?? 3e3;
			const seenAt = input.recent.get(input.dedupeKey);
			if (seenAt !== void 0 && input.now - seenAt < window) return null;
			return {
				scenario,
				sound: scenarioSound(settings, scenario),
				dedupeKey: input.dedupeKey
			};
		}
		/**
		* Record one shown decision in the dedupe memory, pruning entries older than
		* the window so the map cannot grow without bound.
		* @param recent - the existing memory (mutated in place).
		* @param dedupeKey - the key to record.
		* @param now - the current clock (ms).
		* @param windowMs - the retention window.
		*/
		function rememberDecision(recent, dedupeKey, now, windowMs = DEDUPE_MS) {
			recent.set(dedupeKey, now);
			for (const [key, at] of recent) if (now - at >= windowMs) recent.delete(key);
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* The `notify` locale namespace: the settings-section copy and the toast
		* titles. Chinese is the product copy; English mirrors it key for key.
		*/
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			nav: "通知",
			"settings.title": "桌面通知",
			"settings.language.label": "界面语言",
			"settings.language.auto": "自动",
			"settings.language.autoHint": "跟随 DSH 的语言设置",
			"settings.language.zh": "中文",
			"settings.language.en": "English",
			"settings.subtitle": "会话跑完、出错、或停下来等你确认时，弹出 Windows 通知；点通知可以回到对应会话。",
			"settings.enabled": "启用通知",
			"settings.enabledDesc": "总开关；关闭后不再弹任何通知，也不响音效。关闭时通知形式、各情况的音效与文本选择、预览和下面的通知情况都会变灰（已选内容保留），只有自定义音效和自定义文本仍可编辑。",
			"settings.test.button": "发送测试通知",
			"settings.test.desc": "固定使用默认音效（Windows 通知）并弹窗，不受通知形式和下面任何设置影响；用于检测配置是否正常。",
			"settings.mode.label": "通知形式",
			"settings.mode.desc": "总开关开启时生效：决定真实通知怎么发。已选内容在关闭总开关后保留。",
			"settings.mode.both": "通知 + 提示音",
			"settings.mode.bothDesc": "弹窗，并播放该情况所选音效。",
			"settings.mode.notify": "仅通知",
			"settings.mode.notifyDesc": "只弹窗，不出声。",
			"settings.mode.sound": "仅提示音",
			"settings.mode.soundDesc": "只播该情况所选音效，不弹窗。",
			"settings.customize.title": "通知自定义",
			"settings.customize.desc": "给每个已勾选的情况分别挑选音效和弹窗文本；点「预览效果」马上看/听。没勾的情况不会出现在这里，新增情况请在上面的「选择接收以下哪种情况的通知」里勾选。音效来自内置列表，或下方「自定义音效」里导入的文件；删除某个文件时，用到它的情况会自动改为默认音效。",
			"settings.scenario.sound": "音效",
			"settings.scenario.text": "文本",
			"settings.scenario.preview": "预览效果",
			"settings.scenario.completed": "正常完成",
			"settings.scenario.error": "出错",
			"settings.scenario.aborted": "被中止",
			"settings.scenario.blocked": "被阻塞",
			"settings.scenario.maxTokens": "达到 Token 上限",
			"settings.scenario.approval": "等待审批",
			"settings.scenario.question": "等待回答",
			"settings.scenario.planReview": "等待计划评审",
			"settings.scenario.reminder": "超时催办",
			"settings.scenario.completedExample": "这一轮回复写完了。",
			"settings.scenario.errorExample": "模型或工具报错，这一轮没跑完。",
			"settings.scenario.abortedExample": "你点了停止，或这一轮被中断。",
			"settings.scenario.blockedExample": "这一轮卡住，没能继续。",
			"settings.scenario.maxTokensExample": "上下文太长，这一轮被截断。",
			"settings.scenario.approvalExample": "要执行命令或改文件，先等你允许。",
			"settings.scenario.questionExample": "有问题要你选一个或填一段。",
			"settings.scenario.planReviewExample": "计划模式下等你批准计划。",
			"settings.remind.prefix": "等待超过",
			"settings.remind.suffix": "分钟仍未处理时提醒一次。",
			"settings.remind.every": "之后每隔",
			"settings.remind.everySuffix": "分钟再提醒一次，直到你处理。",
			"settings.remind.modeLabel": "催办方式",
			"settings.remind.mode.once": "只提醒一次",
			"settings.remind.mode.onceDesc": "超过设定时间补一条普通通知。",
			"settings.remind.mode.repeat": "反复提醒",
			"settings.remind.mode.repeatDesc": "按间隔重复发通知，直到你处理为止。",
			"settings.remind.mode.sticky": "常驻提醒",
			"settings.remind.mode.stickyDesc": "补一条会一直留在屏幕上、直到你点关闭的通知；音效只响一次。",
			"notify.dismiss": "知道了",
			"settings.text.default": "默认文本",
			"settings.text.custom": "自定义",
			"settings.text.empty": "这个情况还没有自定义文本",
			"settings.text.missing": "这套文本已被删除，暂用默认文本",
			"settings.text.pickerLabel": "选择弹窗文本",
			"settings.soundLibrary.title": "自定义音效",
			"settings.soundLibrary.count": "{count} 个文件",
			"settings.soundLibrary.empty": "还没有自定义音效",
			"settings.soundLibrary.add": "添加音效…",
			"settings.soundLibrary.added": "已添加：{name}",
			"settings.soundLibrary.removed": "已删除",
			"settings.soundLibrary.addFailed": "操作失败：宿主没有响应，或这个格式不支持",
			"settings.soundLibrary.missing": "这个音效文件不在了，重新选一个或再添加一次",
			"settings.soundLibrary.remove": "删除",
			"settings.soundLibrary.rename": "重命名",
			"settings.soundLibrary.renameSave": "保存",
			"settings.soundLibrary.renamed": "已重命名",
			"settings.soundLibrary.renameEmpty": "名称不能为空",
			"settings.soundLibrary.renameFailed": "重命名失败：名字不能用，或宿主没有响应",
			"settings.soundLibrary.removeConfirm": "删除「{name}」？插件里的这份副本会被移除，用到它的情况自动改为默认音效。",
			"settings.soundLibrary.desc": "点「添加音效…」选一个音频文件，插件会复制一份到 {path} 作为音效本体，之后原文件移动或删除都不影响。支持 .wav / .mp3 / .m4a / .aac / .wma / .flac / .ogg / .opus；除 .wav 外的格式要先转成 wav 才能播放，转出的临时文件计入下面的「转换缓存」。",
			"settings.soundLibrary.ffmpegMissing": "本机未安装 ffmpeg，mp3 / m4a / aac / wma / flac / ogg / opus 格式的音效不会播放（.wav 不受影响）。",
			"settings.soundLibrary.ffmpegInstall": "安装后返回本页即可生效：在 PowerShell 执行 winget install Gyan.FFmpeg",
			"settings.soundLibrary.ffmpegPreview": "该音效不是 .wav 格式，需要 ffmpeg 才能播放；本机未安装。",
			"settings.sounds.groupWindows": "Windows 音效",
			"settings.sounds.groupAuthor": "作者音效",
			"settings.sounds.groupCustom": "自定义音效",
			"settings.sounds.authorEmpty": "作者音效：暂无（放在插件 sounds/ 文件夹里）",
			"settings.sounds.author.completed": "任务正常结束",
			"settings.sounds.author.error": "任务出错",
			"settings.sounds.author.attention": "需要你处理",
			"settings.sounds.author.reminder": "超时催办",
			"settings.sounds.customEmpty": "还没有自定义音效，展开下方的 自定义音效 以添加音效",
			"settings.sounds.pickerLabel": "选择音效",
			"settings.cache.label": "转换缓存",
			"settings.cache.empty": "暂无转换缓存",
			"settings.cache.inUse": "缓存占用：{files} 个文件 · {size}",
			"settings.cache.clear": "清理缓存",
			"settings.cache.cleared": "已清理 {files} 个缓存文件，释放 {size}",
			"settings.cache.failed": "清理失败：宿主没有响应",
			"settings.cache.desc": "非 wav 音效第一次播放时，由音效副本转出的临时 wav，存在 %LOCALAPPDATA%\\dsh-notify\\sounds。它不是音效本体：清理不会删除任何音效，只是下次播放要重新转一次。",
			"settings.textLibrary.title": "自定义文本",
			"settings.textLibrary.count": "{count} 套",
			"settings.textLibrary.empty": "还没有自定义文本",
			"settings.textLibrary.add": "新建文本",
			"settings.textLibrary.limit": "每个情况最多 3 套，删一套再建",
			"settings.textLibrary.edit": "编辑",
			"settings.textLibrary.delete": "删除",
			"settings.textLibrary.deleteConfirm": "删除「{name}」？如果它正被这个情况使用，会回退到默认文本。",
			"settings.textLibrary.saveFailed": "保存失败：宿主没有响应",
			"settings.textLibrary.deleteFailed": "删除失败：宿主没有响应",
			"settings.textLibrary.saving": "保存中…",
			"settings.textEditor.title": "编辑文本 · {scenario}",
			"settings.textEditor.newTitle": "新建文本 · {scenario}",
			"settings.textEditor.name": "名称",
			"settings.textEditor.namePlaceholder": "例如：简洁版",
			"settings.textEditor.defaultName": "自定义 {n}",
			"settings.textEditor.titleField": "标题",
			"settings.textEditor.bodyField": "正文",
			"settings.textEditor.placeholders": "可用占位符（点一下插入正文）：",
			"settings.textEditor.placeholderWorkspace": "会话所在的工作目录名，用来区分是哪个项目",
			"settings.textEditor.placeholderStatus": "这条通知表示什么：任务完成 / 待审批 / 仍未处理…",
			"settings.textEditor.placeholderBody": "这一轮回复的摘要；等待类通知是提问或审批的摘要",
			"settings.textEditor.placeholderMinutes": "已经等待的分钟数，只有「超时催办」会出现",
			"settings.textEditor.preview": "预览：",
			"settings.textEditor.save": "保存",
			"settings.textEditor.cancel": "取消",
			"settings.textEditor.nameRequired": "名称不能为空（最多 24 字）",
			"settings.textEditor.titleRequired": "标题不能为空（最多 120 字）",
			"settings.textEditor.bodyRequired": "正文不能为空（最多 300 字）",
			"settings.situations.title": "选择接收以下哪种情况的通知",
			"settings.situations.desc": "勾选后，只有这些情况会提醒你；没勾的既不弹窗也不出声。勾选会让下面的「通知自定义」出现对应的设置行。",
			"settings.situations.turnTitle": "会话结束",
			"settings.situations.turnDesc": "DSH 跑完一轮，或者没能跑完。",
			"settings.situations.subagentTitle": "子代理会话",
			"settings.situations.subagentDesc": "派出的子代理（subagent）是主对话一轮里的步骤。选一档决定它们怎么提醒：",
			"settings.situations.subagentSilent": "完全不提醒",
			"settings.situations.subagentSilentDesc": "子代理结束、等待审批/回答都不提醒——最安静，但可能错过它真的停下来等你。",
			"settings.situations.subagentQuiet": "结束时静音，等你时提醒（默认）",
			"settings.situations.subagentQuietDesc": "子代理跑完不弹窗，一次派活不会连环响；它真的等你审批/回答时照常提醒，超时也催办。",
			"settings.situations.subagentAll": "和主会话一样提醒",
			"settings.situations.subagentAllDesc": "每个子代理结束都弹窗——旧行为，一次派多个子代理时可能连环响。",
			"settings.situations.pendingTitle": "等待你确认",
			"settings.situations.pendingDesc": "DSH 停下来等你审批、回答或评审计划。",
			"settings.situations.viewedTitle": "正在查看的会话",
			"settings.situations.viewedDesc": "DSH 不在前台时，你正点开的会话结束 / 等你确认 / 催办仍会提醒你（因为那时你并没在看它）；DSH 在前台时本来就不弹任何通知。它靠你点开某条会话记住「正在看哪个」；启动时自动恢复的那条暂时不算（但那时窗口有焦点，本来也不弹）。",
			"settings.situations.viewedLabel": "不在前台时仍通知当前会话",
			"settings.situations.viewedLabelDesc": "默认开启。关闭后，正在查看的会话一律静音，无论前后台。",
			"settings.sound.systemDefault": "系统提示音（叮）",
			"settings.sound.systemIm": "系统消息",
			"settings.sound.systemMail": "系统邮件",
			"settings.sound.systemCalendar": "系统日历",
			"settings.sound.fileDing": "叮（轻）",
			"settings.sound.fileChimes": "和弦（柔和）",
			"settings.sound.fileNotify": "Windows 通知",
			"settings.sound.fileNotifyLegacy": "旧版通知",
			"settings.sound.fileMessageNudge": "消息轻推",
			"settings.sound.fileTada": "完成号角",
			"settings.sound.fileExclamation": "警告",
			"settings.sound.fileError": "错误",
			"settings.sound.fileCriticalStop": "严重错误",
			"settings.sound.fileAlarm1": "闹钟 1",
			"settings.sound.fileAlarm2": "闹钟 2",
			"settings.sound.fileAlarm3": "闹钟 3",
			"settings.sound.fileRing1": "铃声 1",
			"settings.sound.fileRing2": "铃声 2",
			"settings.sound.fileRing3": "铃声 3",
			"settings.sound.silent": "静音",
			"notify.shortCompleted": "任务完成",
			"notify.shortError": "任务出错",
			"notify.shortAborted": "任务中止",
			"notify.shortBlocked": "任务阻塞",
			"notify.shortMaxTokens": "Token 达上限",
			"notify.shortApproval": "等待审批",
			"notify.shortQuestion": "等待回答",
			"notify.shortPlanReview": "等待计划评审",
			"notify.shortReminder": "仍未处理",
			"notify.emptyBody": "这一轮已结束。",
			"notify.pendingBody": "有一条待处理的确认。",
			"notify.reminderBody": "已经等了 {minutes} 分钟，还没有处理。",
			"notify.legacyTextName": "原来的自定义文本",
			"notify.testTitle": "测试通知",
			"notify.testBody": "看到这条通知，说明弹窗与默认提示音（Windows 通知）均正常。",
			"notify.previewWorkspace": "示例工作区",
			"notify.previewSampleBody": "这是示例内容；真实通知会显示这一轮的回复摘要。",
			"settings.push.title": "外部推送",
			"settings.push.desc": "把同一条通知同时推到手机 / 聊天软件 / 邮箱（Bark、Server酱、PushPlus、企业微信、钉钉、飞书、Telegram、ntfy、Gotify、Slack、Discord、WxPusher、PushDeer、SMTP、通用 Webhook）。可配多个渠道，逐条独立投递，一条失败不影响其它；密钥只存在宿主磁盘，不进浏览器。推送跟随上面的通知开关：DSH 在前台（已静音）时不推。",
			"settings.push.add": "添加渠道",
			"settings.push.testAll": "全部测试",
			"settings.push.test": "测试",
			"settings.push.edit": "编辑",
			"settings.push.remove": "删除",
			"settings.push.removeConfirm": "删除这个渠道？",
			"settings.push.cancel": "取消",
			"settings.push.save": "保存",
			"settings.push.saved": "已保存",
			"settings.push.deleted": "已删除",
			"settings.push.saveFailed": "保存失败",
			"settings.push.deleteFailed": "删除失败",
			"settings.push.missingFields": "缺少必填项：",
			"settings.push.noChannel": "没有可测试的渠道",
			"settings.push.testOk": "测试已发送",
			"settings.push.testFail": "有渠道测试失败：",
			"settings.push.empty": "还没有配置任何外部推送渠道。",
			"settings.push.typeLabel": "渠道类型",
			"settings.push.nameLabel": "名称",
			"settings.push.namePlaceholder": "给这个渠道起个名字（可留空）",
			"settings.push.type.webhook": "通用 Webhook",
			"settings.push.type.bark": "Bark",
			"settings.push.type.serverchan": "Server酱",
			"settings.push.type.pushplus": "PushPlus",
			"settings.push.type.wecom": "企业微信",
			"settings.push.type.dingtalk": "钉钉",
			"settings.push.type.feishu": "飞书",
			"settings.push.type.telegram": "Telegram",
			"settings.push.type.ntfy": "ntfy",
			"settings.push.type.gotify": "Gotify",
			"settings.push.type.slack": "Slack",
			"settings.push.type.discord": "Discord",
			"settings.push.type.wxpusher": "WxPusher",
			"settings.push.type.pushdeer": "PushDeer",
			"settings.push.type.smtp": "邮件 (SMTP)",
			"settings.push.field.url": "URL",
			"settings.push.field.headers": "自定义请求头 (JSON)",
			"settings.push.field.barkKey": "设备 Key",
			"settings.push.field.server": "服务器地址",
			"settings.push.field.barkSound": "铃声",
			"settings.push.field.barkGroup": "分组",
			"settings.push.field.sendKey": "SendKey",
			"settings.push.field.token": "Token",
			"settings.push.field.wecomKey": "Webhook Key",
			"settings.push.field.secret": "加签密钥",
			"settings.push.field.botToken": "Bot Token",
			"settings.push.field.chatId": "Chat ID",
			"settings.push.field.apiBase": "API 地址",
			"settings.push.field.topic": "主题",
			"settings.push.field.priority": "优先级",
			"settings.push.field.appToken": "AppToken",
			"settings.push.field.uid": "UID",
			"settings.push.field.pushKey": "PushKey",
			"settings.push.field.smtpHost": "SMTP 服务器",
			"settings.push.field.smtpPort": "端口",
			"settings.push.field.smtpSecure": "加密方式 (ssl / starttls / none)",
			"settings.push.field.smtpUser": "用户名",
			"settings.push.field.smtpPass": "密码",
			"settings.push.field.smtpFrom": "发件人",
			"settings.push.field.smtpTo": "收件人（逗号分隔）",
			"settings.push.field.topicIds": "主题 ID（逗号分隔，可选）",
			"settings.push.field.qmsgKey": "Qmsg Key",
			"settings.push.field.qq": "收件 QQ（可选）",
			"settings.push.field.nickname": "昵称",
			"settings.push.field.targetId": "目标 ID",
			"settings.push.field.messageType": "消息类型",
			"settings.push.field.target": "目标（QQ 号 / 群号）",
			"settings.push.field.roomId": "房间 ID",
			"settings.push.field.userKey": "用户 Key",
			"settings.push.type.qmsg": "Qmsg酱",
			"settings.push.type.meow": "MeoW",
			"settings.push.type.kook": "KOOK",
			"settings.push.type.onebot": "OneBot (QQ)",
			"settings.push.type.matrix": "Matrix",
			"settings.push.type.pushover": "Pushover",
			"settings.push.field.jsonBody": "自定义 JSON body 模板（可选）",
			"settings.push.scenariosLabel": "适用情况（不选=全部）",
			"settings.push.titleTemplateLabel": "标题模板（可选）",
			"settings.push.bodyTemplateLabel": "正文模板（可选）",
			"settings.push.templatePlaceholder": "留空则沿用默认；可用 {工作区} {状态} {内容} {分钟}",
			"settings.push.markdownLabel": "Markdown 富文本",
			"settings.push.markdownHint": "该渠道支持时用 markdown 发送（企微/钉钉/飞书）",
			"settings.push.type.auto": "自动识别",
			"settings.push.field.value": "粘贴 URL / key / token",
			"settings.push.detected": "识别为：{type}",
			"settings.push.detectedMissing": "识别为 {type}，还需：{fields}（请改选该渠道填写）",
			"settings.push.detectedUnknown": "无法识别，请改选具体渠道"
		};
		/** English dictionary, keyed exactly like {@link zh}. */
		const en = {
			nav: "Notifications",
			"settings.title": "Desktop notifications",
			"settings.language.label": "Interface language",
			"settings.language.auto": "Auto",
			"settings.language.autoHint": "Follow the DSH language setting",
			"settings.language.zh": "中文",
			"settings.language.en": "English",
			"settings.subtitle": "A Windows toast when a session finishes, fails, or stops to ask you something; click it to return to that session.",
			"settings.enabled": "Enable notifications",
			"settings.enabledDesc": "Master switch; turning it off stops every toast and sound. Every delivery control greys out (the chosen values stay): the mode, each situation's sound and text, the previews and the situations below. Only the custom sounds and the custom texts remain editable.",
			"settings.test.button": "Send a test notification",
			"settings.test.desc": "Always the default Windows notification sound plus a toast, unaffected by the delivery mode and every setting below; use it to check that the configuration works.",
			"settings.mode.label": "Delivery mode",
			"settings.mode.desc": "Applies while the master switch is on: how a real notification is delivered. The choice survives the switch being off.",
			"settings.mode.both": "Toast + sound",
			"settings.mode.bothDesc": "Raise the toast and play the sound chosen for that situation.",
			"settings.mode.notify": "Toast only",
			"settings.mode.notifyDesc": "Raise the toast silently.",
			"settings.mode.sound": "Sound only",
			"settings.mode.soundDesc": "Play the chosen sound without a toast.",
			"settings.customize.title": "Notification setup",
			"settings.customize.desc": "Pick a sound and a popup text for each situation you enabled; Preview shows and plays it right away. Disabled situations do not appear here; to add one, tick it in the situations card above. Sounds come from the built-in list or from the files imported under \"Custom sounds\"; deleting one of those files switches every situation using it back to its default sound.",
			"settings.scenario.sound": "Sound",
			"settings.scenario.text": "Text",
			"settings.scenario.preview": "Preview",
			"settings.scenario.completed": "Completed",
			"settings.scenario.error": "Error",
			"settings.scenario.aborted": "Aborted",
			"settings.scenario.blocked": "Blocked",
			"settings.scenario.maxTokens": "Token limit reached",
			"settings.scenario.approval": "Waiting for approval",
			"settings.scenario.question": "Waiting for an answer",
			"settings.scenario.planReview": "Waiting for a plan review",
			"settings.scenario.reminder": "Still-waiting reminder",
			"settings.scenario.completedExample": "This turn's reply was written.",
			"settings.scenario.errorExample": "The model or a tool failed; the turn did not finish.",
			"settings.scenario.abortedExample": "You pressed stop, or the turn was interrupted.",
			"settings.scenario.blockedExample": "The turn got stuck and could not continue.",
			"settings.scenario.maxTokensExample": "The context grew too long and the turn was cut off.",
			"settings.scenario.approvalExample": "It wants to run a command or edit a file and needs your permission.",
			"settings.scenario.questionExample": "It has a question you need to pick or type an answer for.",
			"settings.scenario.planReviewExample": "Plan mode is waiting for you to approve the plan.",
			"settings.remind.prefix": "Remind me after",
			"settings.remind.suffix": "minutes of waiting.",
			"settings.remind.every": "then every",
			"settings.remind.everySuffix": "minutes until you answer it.",
			"settings.remind.modeLabel": "Reminder style",
			"settings.remind.mode.once": "Once",
			"settings.remind.mode.onceDesc": "One ordinary toast after the delay.",
			"settings.remind.mode.repeat": "Repeat",
			"settings.remind.mode.repeatDesc": "Keep toasting on the interval until you answer it.",
			"settings.remind.mode.sticky": "Stay on screen",
			"settings.remind.mode.stickyDesc": "One toast that stays until you dismiss it; the sound plays once.",
			"notify.dismiss": "Dismiss",
			"settings.text.default": "Default text",
			"settings.text.custom": "Custom",
			"settings.text.empty": "No custom text for this situation yet",
			"settings.text.missing": "That text was deleted; the default text is used",
			"settings.text.pickerLabel": "Choose the popup text",
			"settings.soundLibrary.title": "Custom sounds",
			"settings.soundLibrary.count": "{count} file(s)",
			"settings.soundLibrary.empty": "No custom sounds yet",
			"settings.soundLibrary.add": "Add sound…",
			"settings.soundLibrary.added": "Added: {name}",
			"settings.soundLibrary.removed": "Removed",
			"settings.soundLibrary.addFailed": "Failed: the host did not answer, or the format is unsupported",
			"settings.soundLibrary.missing": "That sound file is gone: pick another one, or add it again",
			"settings.soundLibrary.remove": "Remove",
			"settings.soundLibrary.rename": "Rename",
			"settings.soundLibrary.renameSave": "Save",
			"settings.soundLibrary.renamed": "Renamed",
			"settings.soundLibrary.renameEmpty": "The name cannot be empty",
			"settings.soundLibrary.renameFailed": "Rename failed: that name is not usable, or the host did not answer",
			"settings.soundLibrary.removeConfirm": "Delete \"{name}\"? The plugin's copy is removed, and any situation using it switches to its default sound.",
			"settings.soundLibrary.desc": "Add sound… copies the audio file you pick into {path}, so moving or deleting the original later changes nothing. .wav / .mp3 / .m4a / .aac / .wma / .flac / .ogg / .opus; anything but a wav is transcoded on its first play and shows up in the transcode cache below.",
			"settings.soundLibrary.ffmpegMissing": "ffmpeg is not installed, so mp3 / m4a / aac / wma / flac / ogg / opus sounds will not play (.wav is unaffected).",
			"settings.soundLibrary.ffmpegInstall": "Install it, then return to this page: winget install Gyan.FFmpeg in PowerShell",
			"settings.soundLibrary.ffmpegPreview": "This sound is not a .wav and needs ffmpeg, which is not installed.",
			"settings.sounds.groupWindows": "Windows sounds",
			"settings.sounds.groupAuthor": "Author sounds",
			"settings.sounds.groupCustom": "Custom sounds",
			"settings.sounds.authorEmpty": "No author sounds (they live in the plugin's sounds/ folder)",
			"settings.sounds.author.completed": "Task completed",
			"settings.sounds.author.error": "Task failed",
			"settings.sounds.author.attention": "Needs your attention",
			"settings.sounds.author.reminder": "Overdue reminder",
			"settings.sounds.customEmpty": "No custom sounds yet - expand Custom sounds below to add one",
			"settings.sounds.pickerLabel": "Choose a sound",
			"settings.cache.label": "Transcode cache",
			"settings.cache.empty": "No transcoded sounds yet",
			"settings.cache.inUse": "Cache in use: {files} file(s) · {size}",
			"settings.cache.clear": "Clear cache",
			"settings.cache.cleared": "Cleared {files} cached file(s), freed {size}",
			"settings.cache.failed": "Clear failed: the host did not answer",
			"settings.cache.desc": "The temporary wav a non-wav sound is transcoded into on its first play, kept in %LOCALAPPDATA%\\dsh-notify\\sounds. It is not the sound itself: clearing it deletes no sound, it only makes the next play transcode again.",
			"settings.textLibrary.title": "Custom texts",
			"settings.textLibrary.count": "{count} text(s)",
			"settings.textLibrary.empty": "No custom text yet",
			"settings.textLibrary.add": "New text",
			"settings.textLibrary.limit": "At most 3 per situation; delete one to add another",
			"settings.textLibrary.edit": "Edit",
			"settings.textLibrary.delete": "Delete",
			"settings.textLibrary.deleteConfirm": "Delete \"{name}\"? If this situation is using it, it falls back to the default text.",
			"settings.textLibrary.saveFailed": "Save failed: the host did not answer",
			"settings.textLibrary.deleteFailed": "Delete failed: the host did not answer",
			"settings.textLibrary.saving": "Saving…",
			"settings.textEditor.title": "Edit text · {scenario}",
			"settings.textEditor.newTitle": "New text · {scenario}",
			"settings.textEditor.name": "Name",
			"settings.textEditor.namePlaceholder": "e.g. Short version",
			"settings.textEditor.defaultName": "Custom {n}",
			"settings.textEditor.titleField": "Title",
			"settings.textEditor.bodyField": "Body",
			"settings.textEditor.placeholders": "Placeholders (click to insert into the body):",
			"settings.textEditor.placeholderWorkspace": "The session's working directory - which project this is",
			"settings.textEditor.placeholderStatus": "What the notification says: completed / needs approval / still waiting…",
			"settings.textEditor.placeholderBody": "This turn's reply summary; for a wait, the question or approval summary",
			"settings.textEditor.placeholderMinutes": "Minutes already waited - only the reminder has it",
			"settings.textEditor.preview": "Preview:",
			"settings.textEditor.save": "Save",
			"settings.textEditor.cancel": "Cancel",
			"settings.textEditor.nameRequired": "Name cannot be empty (max 24 characters)",
			"settings.textEditor.titleRequired": "Title cannot be empty (max 120 characters)",
			"settings.textEditor.bodyRequired": "Body cannot be empty (max 300 characters)",
			"settings.situations.title": "Notify me in which of these situations",
			"settings.situations.desc": "Only the ticked situations notify you; the rest neither toast nor sound. Ticking one adds its row to the \"Notification setup\" card below.",
			"settings.situations.turnTitle": "A session ends",
			"settings.situations.turnDesc": "DSH finished the turn, or could not.",
			"settings.situations.subagentTitle": "Subagent sessions",
			"settings.situations.subagentDesc": "A delegated subagent session is a step inside the parent turn. Pick how it notifies:",
			"settings.situations.subagentSilent": "Never notify",
			"settings.situations.subagentSilentDesc": "No toast for a subagent finishing, and none for its approvals or questions either — the quietest gear, at the risk of missing a child that really stops for you.",
			"settings.situations.subagentQuiet": "Silent on finish, notify while waiting (default)",
			"settings.situations.subagentQuietDesc": "A subagent finishing raises nothing, so one delegation never storms. Its approvals and questions still notify, and a long wait is still nudged.",
			"settings.situations.subagentAll": "Notify like the main session",
			"settings.situations.subagentAllDesc": "Every subagent finish raises a toast — the old behaviour, which can storm when you delegate several children.",
			"settings.situations.pendingTitle": "Waiting on you",
			"settings.situations.pendingDesc": "DSH stopped for an approval, an answer or a plan review.",
			"settings.situations.viewedTitle": "The session you are viewing",
			"settings.situations.viewedDesc": "When DSH is in the background, the session you have open still notifies you on completion, waits or reminders — you are not looking at it then. While DSH is in the foreground nothing toasts anyway. The plugin learns which session that is when you open one; the session restored at launch is not tracked, but the window has focus then.",
			"settings.situations.viewedLabel": "Notify the current session when not focused",
			"settings.situations.viewedLabelDesc": "On by default. Turn off to always mute the session you are viewing, in any window state.",
			"settings.sound.systemDefault": "System chime",
			"settings.sound.systemIm": "System message",
			"settings.sound.systemMail": "System mail",
			"settings.sound.systemCalendar": "System calendar",
			"settings.sound.fileDing": "Ding (soft)",
			"settings.sound.fileChimes": "Chimes (gentle)",
			"settings.sound.fileNotify": "Windows notify",
			"settings.sound.fileNotifyLegacy": "Legacy notify",
			"settings.sound.fileMessageNudge": "Message nudge",
			"settings.sound.fileTada": "Tada",
			"settings.sound.fileExclamation": "Exclamation",
			"settings.sound.fileError": "Error",
			"settings.sound.fileCriticalStop": "Critical stop",
			"settings.sound.fileAlarm1": "Alarm 1",
			"settings.sound.fileAlarm2": "Alarm 2",
			"settings.sound.fileAlarm3": "Alarm 3",
			"settings.sound.fileRing1": "Ring 1",
			"settings.sound.fileRing2": "Ring 2",
			"settings.sound.fileRing3": "Ring 3",
			"settings.sound.silent": "Silent",
			"notify.shortCompleted": "done",
			"notify.shortError": "failed",
			"notify.shortAborted": "aborted",
			"notify.shortBlocked": "blocked",
			"notify.shortMaxTokens": "token limit",
			"notify.shortApproval": "needs approval",
			"notify.shortQuestion": "needs an answer",
			"notify.shortPlanReview": "needs a plan review",
			"notify.shortReminder": "still waiting",
			"notify.emptyBody": "This turn has ended.",
			"notify.pendingBody": "There is a pending confirmation.",
			"notify.reminderBody": "Waiting for {minutes} minutes already.",
			"notify.legacyTextName": "Original custom text",
			"notify.testTitle": "DSH notification test",
			"notify.testBody": "If you can see this, the toast and the default notification sound both work.",
			"notify.previewWorkspace": "Example workspace",
			"notify.previewSampleBody": "This is sample text; a real notification shows the turn's reply summary.",
			"settings.push.title": "External push",
			"settings.push.desc": "Send the same notification out to your phone / chat / mailbox as well (Bark, ServerChan, PushPlus, WeCom, DingTalk, Feishu, Telegram, ntfy, Gotify, Slack, Discord, WxPusher, PushDeer, SMTP, generic Webhook). Add several channels; each is delivered independently, so one failure never blocks the rest. Secrets live only on the host disk, never in the browser. Push follows the switches above: nothing is pushed while DSH is in the foreground (already muted).",
			"settings.push.add": "Add channel",
			"settings.push.testAll": "Test all",
			"settings.push.test": "Test",
			"settings.push.edit": "Edit",
			"settings.push.remove": "Remove",
			"settings.push.removeConfirm": "Delete this channel?",
			"settings.push.cancel": "Cancel",
			"settings.push.save": "Save",
			"settings.push.saved": "Saved",
			"settings.push.deleted": "Deleted",
			"settings.push.saveFailed": "Save failed",
			"settings.push.deleteFailed": "Delete failed",
			"settings.push.missingFields": "Missing required fields:",
			"settings.push.noChannel": "No channel to test",
			"settings.push.testOk": "Test sent",
			"settings.push.testFail": "Some channels failed the test:",
			"settings.push.empty": "No external push channel configured yet.",
			"settings.push.typeLabel": "Channel type",
			"settings.push.nameLabel": "Name",
			"settings.push.namePlaceholder": "A name for this channel (optional)",
			"settings.push.type.webhook": "Generic Webhook",
			"settings.push.type.bark": "Bark",
			"settings.push.type.serverchan": "ServerChan",
			"settings.push.type.pushplus": "PushPlus",
			"settings.push.type.wecom": "WeCom",
			"settings.push.type.dingtalk": "DingTalk",
			"settings.push.type.feishu": "Feishu",
			"settings.push.type.telegram": "Telegram",
			"settings.push.type.ntfy": "ntfy",
			"settings.push.type.gotify": "Gotify",
			"settings.push.type.slack": "Slack",
			"settings.push.type.discord": "Discord",
			"settings.push.type.wxpusher": "WxPusher",
			"settings.push.type.pushdeer": "PushDeer",
			"settings.push.type.smtp": "Email (SMTP)",
			"settings.push.field.url": "URL",
			"settings.push.field.headers": "Custom headers (JSON)",
			"settings.push.field.barkKey": "Device key",
			"settings.push.field.server": "Server URL",
			"settings.push.field.barkSound": "Sound",
			"settings.push.field.barkGroup": "Group",
			"settings.push.field.sendKey": "SendKey",
			"settings.push.field.token": "Token",
			"settings.push.field.wecomKey": "Webhook key",
			"settings.push.field.secret": "Signing secret",
			"settings.push.field.botToken": "Bot token",
			"settings.push.field.chatId": "Chat ID",
			"settings.push.field.apiBase": "API base URL",
			"settings.push.field.topic": "Topic",
			"settings.push.field.priority": "Priority",
			"settings.push.field.appToken": "AppToken",
			"settings.push.field.uid": "UID",
			"settings.push.field.pushKey": "PushKey",
			"settings.push.field.smtpHost": "SMTP host",
			"settings.push.field.smtpPort": "Port",
			"settings.push.field.smtpSecure": "Encryption (ssl / starttls / none)",
			"settings.push.field.smtpUser": "Username",
			"settings.push.field.smtpPass": "Password",
			"settings.push.field.smtpFrom": "From address",
			"settings.push.field.smtpTo": "To addresses (comma separated)",
			"settings.push.field.topicIds": "Topic IDs (comma separated, optional)",
			"settings.push.field.qmsgKey": "Qmsg key",
			"settings.push.field.qq": "Target QQ (optional)",
			"settings.push.field.nickname": "Nickname",
			"settings.push.field.targetId": "Target id",
			"settings.push.field.messageType": "Message type",
			"settings.push.field.target": "Target (QQ / group id)",
			"settings.push.field.roomId": "Room id",
			"settings.push.field.userKey": "User key",
			"settings.push.type.qmsg": "Qmsg",
			"settings.push.type.meow": "MeoW",
			"settings.push.type.kook": "KOOK",
			"settings.push.type.onebot": "OneBot (QQ)",
			"settings.push.type.matrix": "Matrix",
			"settings.push.type.pushover": "Pushover",
			"settings.push.field.jsonBody": "Custom JSON body template (optional)",
			"settings.push.scenariosLabel": "Situations (none = all)",
			"settings.push.titleTemplateLabel": "Title template (optional)",
			"settings.push.bodyTemplateLabel": "Body template (optional)",
			"settings.push.templatePlaceholder": "Leave empty to inherit; {工作区} {状态} {内容} {分钟}",
			"settings.push.markdownLabel": "Markdown",
			"settings.push.markdownHint": "Send as markdown where the channel supports it (WeCom/DingTalk/Feishu)",
			"settings.push.type.auto": "Auto detect",
			"settings.push.field.value": "Paste a URL / key / token",
			"settings.push.detected": "Detected: {type}",
			"settings.push.detectedMissing": "Detected {type}; still needs: {fields} (pick that type to fill it)",
			"settings.push.detectedUnknown": "Not recognized — pick a channel type"
		};
		/** The locale namespace registered under ctx.locale. */
		const NS = "notify";
		/**
		* Fill one dictionary template's `{name}` placeholders.
		* @param template - dictionary text.
		* @param params - placeholder values.
		* @returns the filled text.
		*/
		function fmt(template, params) {
			if (params === void 0) return template;
			return template.replace(/\{(\w+)\}/g, (whole, key) => params[key] ?? whole);
		}
		//#endregion
		//#region src/client/language.ts
		/**
		* Resolve the effective language.
		* @param setting - the stored choice.
		* @param activeLocale - the DSH interface locale id (e.g. `zh`, `en`, `ja`).
		* @returns the dictionary to read.
		*/
		function resolveLanguage(setting, activeLocale) {
			if (setting === "zh" || setting === "en") return setting;
			return activeLocale.toLowerCase().startsWith("zh") ? "zh" : "en";
		}
		/**
		* Build the translate function the section and the toast composer share.
		*
		* The language is read on every call rather than captured, so a toggle takes
		* effect on the next render (and on the next toast) without rebuilding
		* anything.
		* @param getLanguage - reads the current resolved language.
		* @returns a `t(key, params)` lookup with `{name}` placeholders filled.
		*/
		function createTranslator(getLanguage) {
			return (key, params) => {
				return fmt((getLanguage() === "zh" ? zh : en)[key], params);
			};
		}
		//#endregion
		//#region src/protocol.ts
		/**
		* The one piece of wire vocabulary both halves must agree on: the same-origin
		* route a toast click posts to, and the header that keeps drive-by requests out.
		* It lives alone so the browser bundle never has to import the host entry (and
		* with it node:child_process and the host's zod schemas).
		*/
		/** The same-origin route the client posts to when a toast is clicked. */
		const FOCUS_ROUTE = "/dsh-notify/focus";
		/** Header the client sets; keeps drive-by requests from other origins out. */
		const FOCUS_HEADER = "x-dsh-notify";
		/**
		* The route the client posts one-line diagnostics to. The desktop shell cannot
		* show a plugin's renderer console to anyone but a human with DevTools open, so
		* the client reports what it decided and what the platform answered, and the
		* host keeps the last few lines for the debug route to serve.
		*/
		const REPORT_ROUTE = "/dsh-notify/report";
		/**
		* The route the client posts a toast to when its own renderer cannot present
		* one. Measured on 0.2.0-rc.2: while the app window is minimized/hidden the
		* renderer constructs the Notification but the platform never shows it (no
		* `show`, no `error`), so the host raises the toast through the shell's own
		* Windows notification channel instead.
		*/
		const HOST_TOAST_ROUTE = "/dsh-notify/toast";
		/**
		* The sound-only route: play one catalog sound without raising a toast.
		*
		* Every sound used to ride on the toast that showed it, which made
		* "sound without a toast" impossible. The host resolves the id exactly as it
		* does for a toast — catalog id only, never a path — and plays it in its own
		* child, so the silence route and the 8-second cap apply here too.
		*/
		const SOUND_ROUTE = "/dsh-notify/sound";
		/**
		* The route the client polls for questions the host observed on the
		* `user-questions/request` waterfall.
		*
		* Questions cannot be read from any projection (a service-level ask such as
		* the plan review never reaches the session log), and a global client plugin
		* cannot subscribe to the agent-scoped waterfall either (measured: the
		* subscription registers and then receives nothing). The host can: it fires
		* that waterfall itself, so a `{ global: true }` listener sees every question.
		*/
		const QUESTIONS_ROUTE = "/dsh-notify/questions";
		/**
		* Stop whatever notification sound is playing right now.
		*
		* The host plays file sounds in a child PowerShell process (`PlaySync`), which
		* keeps going even after the user switches sounds off; the client posts here on
		* that switch so the sound stops immediately instead of finishing its file.
		*/
		const SILENCE_ROUTE = "/dsh-notify/silence";
		/**
		* Ask the host whether this app's window is the OS foreground window.
		*
		* The renderer's own `document.hasFocus()` reports false in situations where the
		* user is plainly looking at the window (measured: the question view takes
		* document focus), so the client defers to the host's OS-level answer whenever
		* its own signal says "unfocused".
		*/
		const FOREGROUND_ROUTE = "/dsh-notify/foreground";
		/**
		* The sound library the settings section offers: the sounds shipped with the
		* plugin (`author`) and the ones the user imported (`custom`).
		*/
		const SOUND_LIBRARY_ROUTE = "/dsh-notify/sound-library";
		/** Copy one picked audio file into the user's custom-sound folder. */
		const IMPORT_SOUND_ROUTE = "/dsh-notify/import-sound";
		/** Remove one imported custom sound. */
		const DELETE_SOUND_ROUTE = "/dsh-notify/delete-sound";
		/** Rename one imported custom sound, keeping its extension. */
		const RENAME_SOUND_ROUTE = "/dsh-notify/rename-sound";
		/** Ask the host to open a Windows file picker and return the chosen wav path. */
		const PICK_FILE_ROUTE = "/dsh-notify/pick-file";
		/**
		* The transcoded-wav cache: GET reports its size, POST empties it.
		*
		* Custom sounds in any format other than wav are transcoded once into this
		* folder; the settings section shows the占用 and offers to clear it.
		*/
		const SOUND_CACHE_ROUTE = "/dsh-notify/sound-cache";
		/**
		* The user's saved popup texts: GET returns every situation's library, POST
		* saves or deletes one entry. The templates live on disk (next to the custom
		* sounds) so hand-written wording survives a storage clear and can be copied
		* between machines; only the chosen id stays in the client settings.
		*/
		const TEXT_TEMPLATES_ROUTE = "/dsh-notify/text-templates";
		/**
		* The external-push channels: GET lists every configured channel, POST saves or
		* deletes one and answers with the whole list. The channels (and their tokens)
		* live host-side, so the renderer only ever sends/receives field values.
		*/
		const CHANNELS_ROUTE = "/dsh-notify/channels";
		/**
		* Deliver one notification to every enabled external channel (Bark, Telegram,
		* 钉钉, 飞书, generic webhook, …). The host makes the outbound HTTPS requests
		* because the renderer cannot (CORS); it answers with a per-channel receipt.
		*/
		const PUSH_ROUTE = "/dsh-notify/push";
		/** Send a fixed test message to one channel (by id) or to every enabled one. */
		const TEST_PUSH_ROUTE = "/dsh-notify/test-push";
		//#endregion
		//#region src/client/navigate.ts
		/**
		* What a toast click does: raise the DSH window and jump to the session the
		* toast was about. The window raise goes through the desktop shell (the
		* renderer cannot raise its own window — verified on 0.2.0-rc.2), and the jump
		* goes through the workspace service. Both halves are injected so the flow is
		* testable without a browser.
		*/
		/**
		* Post the focus request to the host route.
		* @param fetchImpl - the fetch implementation (defaults to the ambient fetch).
		* @returns a promise that settles when the request was dispatched.
		*/
		function focusWindowRequest(fetchImpl = globalThis.fetch) {
			if (fetchImpl === void 0) return Promise.resolve();
			return fetchImpl(FOCUS_ROUTE, {
				method: "POST",
				headers: { [FOCUS_HEADER]: "1" }
			}).catch(() => void 0);
		}
		/**
		* Run a toast click: raise the window first, then select the session.
		* @param deps - the injected window and workspace faces.
		* @param sessionId - the session the toast was about.
		*/
		async function activateSession(deps, sessionId) {
			try {
				await deps.focusWindow();
			} catch {}
			try {
				deps.openSession?.(sessionId);
			} catch {}
		}
		//#endregion
		//#region src/client/notifier.ts
		/**
		* Send one diagnostics line to the host's report route. The desktop shell
		* cannot show a plugin's renderer console to anyone without DevTools open, so
		* every interesting step is mirrored to the host, where the debug route serves
		* it over plain HTTP.
		* @param line - the line to report.
		*/
		function report(line) {
			console.info("[dsh-notify] " + line);
			try {
				const fetchImpl = globalThis.fetch;
				if (fetchImpl === void 0) return;
				fetchImpl(REPORT_ROUTE, {
					method: "POST",
					headers: { [FOCUS_HEADER]: "1" },
					body: line
				}).catch(() => void 0);
			} catch {}
		}
		/** The short status key for one situation (composed into the title, and the preview). */
		function shortScenarioKey(scenario) {
			switch (scenario) {
				case "completed": return "notify.shortCompleted";
				case "error": return "notify.shortError";
				case "aborted": return "notify.shortAborted";
				case "blocked": return "notify.shortBlocked";
				case "max-tokens": return "notify.shortMaxTokens";
				case "approval": return "notify.shortApproval";
				case "question": return "notify.shortQuestion";
				case "plan-review": return "notify.shortPlanReview";
				case "reminder": return "notify.shortReminder";
			}
		}
		/**
		* The grouping tag. Turn- and request-scoped rather than session-scoped: the
		* OS replaces same-tag toasts, and a stale same-tag entry left in the action
		* center silently swallows every later toast carrying it.
		*/
		function notificationTag(sessionId, turn) {
			return `dsh-notify-${sessionId}-t${turn}`;
		}
		/** The tag for one blocking interaction's toast. */
		function pendingTag(sessionId, requestId) {
			return `dsh-notify-${sessionId}-r-${requestId}`;
		}
		/** The tag for one reminder toast. */
		function reminderTag(sessionId, requestId) {
			return `dsh-notify-${sessionId}-m-${requestId}`;
		}
		/** The notification surface this code may use (absent outside a browser). */
		function notificationsApi() {
			return typeof Notification === "undefined" ? void 0 : Notification;
		}
		/**
		* Ask the shell for notification permission when it has not decided yet.
		*
		* Load-bearing: Electron reports `permission === 'default'` for a freshly
		* started app, and Chromium then refuses to present the toast — a plugin that
		* only checks `permission === 'granted'` silently shows nothing until some
		* other page happens to request permission first. The desktop shell's own
		* permission handler answers `true` for every non-media permission, so this
		* resolves to `granted` on the first call.
		* @returns the effective permission after the request.
		*/
		async function ensureNotificationPermission() {
			const api = notificationsApi();
			if (api === void 0) return "denied";
			if (api.permission !== "default") return api.permission;
			try {
				return await api.requestPermission();
			} catch {
				return api.permission;
			}
		}
		/**
		* Show one toast when the platform allows it.
		* @param request - the toast to show.
		* @returns true when a notification object was constructed.
		*/
		/**
		* Ask the host to raise the toast through the shell's Windows channel.
		* @param request - the toast to show.
		* @returns true when the request was dispatched.
		*/
		function requestHostToast(request) {
			try {
				const fetchImpl = globalThis.fetch;
				if (fetchImpl === void 0) return false;
				fetchImpl(HOST_TOAST_ROUTE, {
					method: "POST",
					headers: {
						[FOCUS_HEADER]: "1",
						"content-type": "application/json"
					},
					body: JSON.stringify({
						title: request.title,
						body: request.body,
						sound: request.sound,
						sticky: request.sticky === true,
						dismissLabel: request.dismissLabel ?? ""
					})
				}).catch(() => void 0);
				return true;
			} catch {
				return false;
			}
		}
		/**
		* Stop whatever notification sound is playing right now.
		*
		* The host plays file sounds in its own child process; this is the client half
		* of "switching the sound off also stops the sound that is already playing".
		* @returns a promise that settles when the host answered (failures are silent).
		*/
		function silenceSounds() {
			const fetchImpl = globalThis.fetch;
			if (fetchImpl === void 0) return Promise.resolve();
			return fetchImpl(SILENCE_ROUTE, {
				method: "POST",
				headers: { [FOCUS_HEADER]: "1" }
			}).then(() => void 0, () => void 0);
		}
		/**
		* Play one sound without raising a toast (sound-only notification mode, and
		* the audition in that mode).
		*
		* The id is validated by the host exactly as it is for a toast — the client
		* never sends a path — so this is as safe as the toast channel and just as
		* silencable.
		* @param sound - the sound id to play.
		* @returns true when the request was dispatched.
		*/
		function playSoundOnly(sound) {
			try {
				const fetchImpl = globalThis.fetch;
				if (fetchImpl === void 0) return false;
				fetchImpl(SOUND_ROUTE, {
					method: "POST",
					headers: {
						[FOCUS_HEADER]: "1",
						"content-type": "application/json"
					},
					body: JSON.stringify({ sound })
				}).catch(() => void 0);
				return true;
			} catch {
				return false;
			}
		}
		/**
		* Ask the host to open the Windows file picker for a wav.
		* @returns the chosen absolute path, or '' when the user cancelled.
		*/
		function pickSoundFile() {
			const fetchImpl = globalThis.fetch;
			if (fetchImpl === void 0) return Promise.resolve("");
			return fetchImpl(PICK_FILE_ROUTE, {
				method: "POST",
				headers: { [FOCUS_HEADER]: "1" }
			}).then((response) => response.ok ? response.json() : void 0).then((payload) => {
				const path = payload?.path;
				return typeof path === "string" ? path : "";
			}, () => "");
		}
		/**
		* Ask the host whether this app's window is the OS foreground window.
		*
		* `document.hasFocus()` is not trustworthy on its own: measured, it returned
		* false while the user was looking straight at the window (the question view
		* takes document focus), which produced toasts aimed at someone already there.
		* The host answers from the OS, and any failure falls back to false so the
		* renderer's own signal keeps deciding.
		* @returns true when the foreground window belongs to this app.
		*/
		function appWindowFocused(fresh = false) {
			const fetchImpl = globalThis.fetch;
			if (fetchImpl === void 0) return Promise.resolve(false);
			return fetchImpl(fresh ? FOREGROUND_ROUTE + "?fresh=1" : FOREGROUND_ROUTE, { headers: { [FOCUS_HEADER]: "1" } }).then((response) => response.ok ? response.json() : null).then((payload) => payload?.focused === true, () => false);
		}
		/**
		* Read the sound library: what the plugin ships and what the user imported.
		* @returns both lists, or an empty library when the host is unreachable.
		*/
		function soundLibrary() {
			const empty = {
				author: [],
				custom: [],
				ffmpeg: true
			};
			const fetchImpl = globalThis.fetch;
			if (fetchImpl === void 0) return Promise.resolve(empty);
			return fetchImpl(SOUND_LIBRARY_ROUTE, { headers: { [FOCUS_HEADER]: "1" } }).then((response) => response.ok ? response.json() : null).then((payload) => {
				const value = payload;
				return {
					author: Array.isArray(value?.author) ? value.author : [],
					custom: Array.isArray(value?.custom) ? value.custom : [],
					ffmpeg: value?.ffmpeg !== false
				};
			}, () => empty);
		}
		/**
		* Copy one picked file into the user's custom-sound folder.
		* @param file - the absolute path the picker returned.
		* @returns the imported name, or null when the host refused it.
		*/
		function importSound(file) {
			const fetchImpl = globalThis.fetch;
			if (fetchImpl === void 0) return Promise.resolve(null);
			return fetchImpl(IMPORT_SOUND_ROUTE, {
				method: "POST",
				headers: {
					[FOCUS_HEADER]: "1",
					"content-type": "application/json"
				},
				body: JSON.stringify({ file })
			}).then((response) => response.ok ? response.json() : null).then((payload) => {
				const name = payload?.name;
				return typeof name === "string" ? name : null;
			}, () => null);
		}
		/**
		* Rename one imported custom sound.
		* @param id - the 'custom:<file>' id.
		* @param name - the new display name (the host keeps the extension).
		* @returns the new id, or null when the host refused the name.
		*/
		function renameSound(id, name) {
			const fetchImpl = globalThis.fetch;
			if (fetchImpl === void 0) return Promise.resolve(null);
			return fetchImpl(RENAME_SOUND_ROUTE, {
				method: "POST",
				headers: {
					[FOCUS_HEADER]: "1",
					"content-type": "application/json"
				},
				body: JSON.stringify({
					id,
					name
				})
			}).then((response) => response.ok ? response.json() : null).then((payload) => {
				const value = payload;
				return value?.ok === true && typeof value.name === "string" ? "custom:" + value.name : null;
			}, () => null);
		}
		/**
		* Delete one imported custom sound.
		* @param id - the 'custom:<file>' id.
		* @returns true when the host removed it.
		*/
		function deleteSound(id) {
			const fetchImpl = globalThis.fetch;
			if (fetchImpl === void 0) return Promise.resolve(false);
			return fetchImpl(DELETE_SOUND_ROUTE, {
				method: "POST",
				headers: {
					[FOCUS_HEADER]: "1",
					"content-type": "application/json"
				},
				body: JSON.stringify({ id })
			}).then((response) => response.ok ? response.json() : null).then((payload) => payload?.ok === true, () => false);
		}
		/**
		* Read the sound-cache size from the host.
		* @returns the file count and total bytes, or null when the host is unreachable.
		*/
		function soundCacheInfo() {
			const fetchImpl = globalThis.fetch;
			if (fetchImpl === void 0) return Promise.resolve(null);
			return fetchImpl(SOUND_CACHE_ROUTE, { headers: { [FOCUS_HEADER]: "1" } }).then((response) => response.ok ? response.json() : null).then((payload) => {
				const info = payload;
				return typeof info?.files === "number" && typeof info.bytes === "number" ? info : null;
			}, () => null);
		}
		/**
		* Empty the sound cache.
		* @returns how many files were removed and how many bytes they held, or null.
		*/
		function clearSoundCache() {
			const fetchImpl = globalThis.fetch;
			if (fetchImpl === void 0) return Promise.resolve(null);
			return fetchImpl(SOUND_CACHE_ROUTE, {
				method: "POST",
				headers: { [FOCUS_HEADER]: "1" }
			}).then((response) => response.ok ? response.json() : null).then((payload) => {
				const info = payload;
				return typeof info?.removed === "number" && typeof info.bytes === "number" ? {
					files: info.removed,
					bytes: info.bytes
				} : null;
			}, () => null);
		}
		/**
		* Show one toast through the host channel even when the window has focus.
		*
		* The settings section auditions sounds with this: the renderer path can only
		* mute or not (Chromium's Notification cannot name a Windows sound event), so a
		* preview must take the host path to play the exact sound the user picked.
		* @param request - the toast to show.
		* @returns true when the platform accepted a notification.
		*/
		function previewToast(request) {
			if (requestHostToast(request)) {
				report("preview delegated to host: sound=" + request.sound);
				return true;
			}
			return showToast(request);
		}
		function showToast(request) {
			if (typeof document !== "undefined" && !document.hasFocus() && requestHostToast(request)) {
				report("toast delegated to host (window unfocused): " + request.title);
				return true;
			}
			const api = notificationsApi();
			if (api === void 0) {
				report("toast no-api " + request.title);
				return false;
			}
			if (api.permission !== "granted") {
				report("toast permission=" + api.permission + " attempting anyway: " + request.title);
				api.requestPermission().then((next) => {
					report("toast permission-after-request=" + next);
				}, () => void 0);
			}
			try {
				const notification = new api(request.title, {
					body: request.body,
					tag: request.tag,
					silent: request.sound === "silent"
				});
				report("toast created perm=" + api.permission + " tag=" + request.tag);
				notification.onshow = () => {
					report("toast shown: " + request.title);
				};
				notification.onerror = () => {
					report("toast rejected by the platform: " + request.title);
				};
				notification.onclick = () => {
					report("toast clicked: " + request.title);
					request.onClick();
				};
				return true;
			} catch (error) {
				report("toast threw: " + String(error));
				return false;
			}
		}
		//#endregion
		//#region src/scenarios.ts
		/**
		* The notification situations, shared by both halves of the plugin.
		*
		* A "scenario" is one event that can raise a notification: the five ways a turn
		* can end, the three blocking interactions, and the reminder for a wait that is
		* still unanswered. Each scenario carries its own sound and its own popup-text
		* choice, and owns a small library of named custom texts (at most
		* {@link TEXT_LIMIT_PER_SCENARIO}).
		*
		* The host validates text templates against this list; the client keys its
		* sound map, its text map and the settings UI by it. It lives outside
		* `types.ts` so the host bundle can pull it in without the client's preference
		* shapes.
		*/
		/** Every notifiable situation, in the order the settings page lists them. */
		const SCENARIO_IDS = Object.freeze([
			"completed",
			"error",
			"aborted",
			"blocked",
			"max-tokens",
			"approval",
			"question",
			"plan-review",
			"reminder"
		]);
		Object.freeze([
			"completed",
			"error",
			"aborted",
			"blocked",
			"max-tokens"
		]);
		Object.freeze([
			"approval",
			"question",
			"plan-review"
		]);
		/** The shape of a stored template id. */
		const TEMPLATE_ID = /^t_[a-z0-9]{4,}$/i;
		/** A library with every situation empty. */
		function emptyTextLibrary() {
			const library = {};
			for (const scenario of SCENARIO_IDS) library[scenario] = [];
			return library;
		}
		/** Whether a value is one stored template's id. */
		function isTemplateId(value) {
			return typeof value === "string" && TEMPLATE_ID.test(value);
		}
		/**
		* Find one situation's template by id.
		* @param library - the loaded library.
		* @param scenario - the situation it belongs to.
		* @param id - the settings' stored choice.
		* @returns the template, or undefined when it is gone.
		*/
		function templateOf(library, scenario, id) {
			if (id === void 0) return void 0;
			return library[scenario].find((entry) => entry.id === id);
		}
		//#endregion
		//#region src/types.ts
		/** The selectable sounds, softest first. */
		const SOUND_CHOICES = Object.freeze([
			{
				id: "system:default",
				event: "ms-winsoundevent:Notification.Default"
			},
			{
				id: "system:im",
				event: "ms-winsoundevent:Notification.IM"
			},
			{
				id: "system:mail",
				event: "ms-winsoundevent:Notification.Mail"
			},
			{
				id: "system:calendar",
				event: "ms-winsoundevent:Notification.Reminder"
			},
			{
				id: "file:ding",
				file: "ding.wav"
			},
			{
				id: "file:chimes",
				file: "chimes.wav"
			},
			{
				id: "file:notify",
				file: "Windows Notify.wav"
			},
			{
				id: "file:notify-legacy",
				file: "notify.wav"
			},
			{
				id: "file:message-nudge",
				file: "Windows Message Nudge.wav"
			},
			{
				id: "file:tada",
				file: "tada.wav"
			},
			{
				id: "file:exclamation",
				file: "Windows Exclamation.wav"
			},
			{
				id: "file:error",
				file: "Windows Error.wav"
			},
			{
				id: "file:critical-stop",
				file: "Windows Critical Stop.wav"
			},
			{
				id: "file:alarm-1",
				file: "Alarm01.wav"
			},
			{
				id: "file:alarm-2",
				file: "Alarm02.wav"
			},
			{
				id: "file:alarm-3",
				file: "Alarm03.wav"
			},
			{
				id: "file:ring-1",
				file: "Ring01.wav"
			},
			{
				id: "file:ring-2",
				file: "Ring02.wav"
			},
			{
				id: "file:ring-3",
				file: "Ring03.wav"
			},
			{ id: "silent" }
		]);
		/** Every selectable id, for validation. */
		const SOUND_IDS = Object.freeze(SOUND_CHOICES.map((choice) => choice.id));
		/** The choice that means "use the built-in default text". */
		const DEFAULT_TEXT_CHOICE = "default";
		/**
		* How a notification is delivered.
		*
		* `both` raises the toast and plays the chosen sound (the historical behaviour);
		* `notify` raises a muted toast; `sound` plays the chosen sound without raising
		* anything — the host's sound-only route, because every sound in the catalog
		* otherwise rides on the toast that shows it.
		*/
		const NOTIFY_MODES = Object.freeze([
			"both",
			"notify",
			"sound"
		]);
		/**
		* Which language the plugin's own interface and popup text use.
		*
		* `auto` follows the DSH interface language (Chinese when DSH runs in Chinese,
		* English otherwise); `zh` and `en` pin the plugin without touching the rest
		* of the app. The dictionaries already ship both languages, so this only picks
		* one of them.
		*/
		const PLUGIN_LANGUAGES = Object.freeze([
			"auto",
			"zh",
			"en"
		]);
		/**
		* How the reminder for a long-unanswered wait behaves.
		*
		* `once` sends a single extra toast (the original behaviour), `repeat` keeps
		* nudging every `remindEveryMinutes` until the wait is answered, and `sticky`
		* raises one reminder that stays on screen until the user dismisses it (Windows
		* reminder-scenario toasts) with the sound played once.
		*/
		const REMINDER_MODES = Object.freeze([
			"once",
			"repeat",
			"sticky"
		]);
		/**
		* How a background subagent session's notifications are treated.
		*
		* A delegated subagent session is a step inside its parent turn, not a
		* conversation of its own, and the projection seam delivers it like any other
		* session — so one delegation that spawns N children would otherwise raise N
		* completion toasts.
		*
		* `silent`: nothing at all from a child session — its finished turns, its
		* approvals and questions, and the reminder are all dropped. The quietest
		* gear; a child that really stops for an approval will sit there unheard.
		* `quiet` (default): its finished turn stays silent, but its approvals,
		* questions and reminder still notify.
		* `all`: every child session notifies exactly like an ordinary conversation —
		* the behaviour before this switch existed.
		*/
		const SUBAGENT_MODES = Object.freeze([
			"silent",
			"quiet",
			"all"
		]);
		/** The built-in title: what the composed title was before templates existed. */
		const DEFAULT_TITLE_TEMPLATE = "{工作区} · {状态}";
		/** The built-in body: just the summary. */
		const DEFAULT_BODY_TEMPLATE = "{内容}";
		/** The default sound for every situation, one entry per scenario. */
		function defaultSounds() {
			const sounds = {};
			for (const scenario of SCENARIO_IDS) switch (scenario) {
				case "error":
					sounds[scenario] = "file:error";
					break;
				case "approval":
				case "question":
				case "plan-review":
					sounds[scenario] = "file:ding";
					break;
				case "reminder":
					sounds[scenario] = "file:exclamation";
					break;
				default: sounds[scenario] = "file:chimes";
			}
			return Object.freeze(sounds);
		}
		/** The default text choice for every situation: the built-in wording. */
		function defaultTexts() {
			const texts = {};
			for (const scenario of SCENARIO_IDS) texts[scenario] = DEFAULT_TEXT_CHOICE;
			return Object.freeze(texts);
		}
		/**
		* Defaults: everything on, sounds on, one reminder after ten minutes.
		*
		* The sound defaults are the set the user auditioned against: chimes for work
		* that simply finished, the unmistakable Windows error for a failure, ding for
		* anything waiting on the user, and Exclamation for the nudge that it is still
		* waiting.
		*/
		const DEFAULT_SETTINGS = Object.freeze({
			enabled: true,
			mode: "both",
			sounds: defaultSounds(),
			texts: defaultTexts(),
			legacyText: null,
			notifyCompleted: true,
			notifyError: true,
			notifyAborted: false,
			notifyBlocked: true,
			notifyMaxTokens: true,
			subagentMode: "quiet",
			notifyApproval: true,
			notifyQuestion: true,
			notifyPlanReview: true,
			notifyViewedUnfocused: true,
			remindAfterMinutes: 10,
			reminderMode: "once",
			remindEveryMinutes: 5,
			language: "auto"
		});
		Object.freeze([
			"completed",
			"error",
			"aborted",
			"blocked",
			"max-tokens"
		]);
		/**
		* Flatten markdown into one bounded plain-text line.
		* @param text - the projected reply text (may be markdown, may be empty).
		* @param limit - the character budget.
		* @returns the plain summary, ellipsized on overflow.
		*/
		function plainSummary(text, limit = 78) {
			let out = text;
			out = out.replace(/```[\s\S]*?```/g, " ");
			out = out.replace(/`([^`]*)`/g, "$1");
			out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
			out = out.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
			out = out.replace(/^\s{0,3}#{1,6}\s+/gm, "");
			out = out.replace(/^\s{0,3}>\s?/gm, "");
			out = out.replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, "");
			out = out.replace(/^\s*\|.*\|\s*$/gm, " ");
			out = out.replace(/\*\*(.+?)\*\*/g, "$1");
			out = out.replace(/(?:\*|_)([^*_]+)(?:\*|_)/g, "$1");
			out = out.replace(/<[^>]+>/g, " ");
			out = out.replace(/\s+/g, " ").trim();
			if (out.length <= limit) return out;
			let cut = Math.max(1, limit - 2);
			const wordChar = (ch) => ch !== void 0 && /[A-Za-z0-9]/.test(ch);
			while (cut > 1 && wordChar(out[cut - 1]) && wordChar(out[cut])) cut -= 1;
			return out.slice(0, cut).trimEnd() + "…";
		}
		/**
		* The workspace name a session belongs to: the last segment of its directory.
		*
		* Sessions are named by DSH itself (a one-word summary of the first prompt),
		* which reads poorly in a toast; the workspace is what the user actually
		* recognises.
		* @param cwd - the session's working directory, when known.
		* @returns the workspace name, or an empty string.
		*/
		function workspaceName(cwd) {
			if (cwd === void 0) return "";
			return cwd.split(/[\\/]+/).filter((part) => part !== "").at(-1) ?? "";
		}
		//#endregion
		//#region src/client/template.ts
		/**
		* The user-facing toast text templates (decision: global title + body template).
		*
		* The settings store two plain-text templates; this module fills them with the
		* notification's live values. Deliberately NOT a general formatter: four known
		* placeholders are replaced, everything else — including unknown `{tokens}` —
		* passes through untouched, so a template can talk about e.g. `{内容}` in its
		* help text without that text being eaten.
		*/
		/** How many characters of one rendered toast body are kept (the host caps at 300). */
		const BODY_LIMIT = 300;
		/**
		* Fill one template's known placeholders.
		*
		* Both token spellings are accepted (the Chinese product copy and the English
		* mirror), because a stored template outlives any one UI language. `{分钟}`
		* with no value renders as nothing, so a reminder-only token does not litter
		* the other toasts with an empty gap the user never typed.
		* @param template - the stored template (already clamped non-empty).
		* @param parts - the live values.
		* @returns the filled text.
		*/
		function fill(template, parts) {
			const workspace = collapse(parts.workspace, 40);
			const body = collapse(parts.body, BODY_LIMIT);
			return template.replaceAll("{工作区}", workspace).replaceAll("{workspace}", workspace).replaceAll("{状态}", parts.status).replaceAll("{status}", parts.status).replaceAll("{内容}", body).replaceAll("{body}", body).replaceAll("{分钟}", parts.minutes ?? "").replaceAll("{minutes}", parts.minutes ?? "");
		}
		/** Collapse whitespace runs and bound the length the way the old title did. */
		function collapse(text, limit) {
			const flat = text.trim().replace(/\s+/g, " ");
			if (flat.length <= limit) return flat;
			return flat.slice(0, limit - 1) + "…";
		}
		/**
		* Render the toast title from the title template.
		* @param template - the stored title template.
		* @param parts - the live values.
		* @returns the title; a template that renders empty falls back to the status.
		*/
		function renderTitle(template, parts) {
			const filled = fill(template === "" ? DEFAULT_TITLE_TEMPLATE : template, parts).trim();
			return filled === "" ? parts.status : filled;
		}
		/**
		* Render the toast body from the body template.
		*
		* An empty summary falls back to the whole fallback line: a template like
		* `{工作区} 需要你：{内容}` must not render its own punctuation with nothing
		* after it.
		* @param template - the stored body template.
		* @param parts - the live values.
		* @param fallback - the line to use when there is no content at all.
		* @returns the body.
		*/
		function renderBody(template, parts, fallback) {
			if (parts.body.trim() === "") return fallback;
			const filled = fill(template === "" ? DEFAULT_BODY_TEMPLATE : template, parts).trim();
			return filled === "" ? fallback : filled;
		}
		//#endregion
		//#region src/client/reminder.ts
		/** Convert the configured minutes into milliseconds (at least one minute). */
		function remindAfterMs(minutes) {
			return Math.max(1, Math.round(minutes)) * 6e4;
		}
		/**
		* When a wait's next reminder is due.
		*
		* The first one counts from the moment the wait appeared; later ones count from
		* the previous reminder, so `repeat` stays on its own cadence even when the
		* timer ticks late.
		* @param wait - the tracked wait.
		* @param settings - the live settings.
		* @returns the clock value at which the next reminder may fire.
		*/
		function nextReminderAt(wait, settings) {
			return wait.lastRemindedAt === 0 ? wait.firstSeenAt + remindAfterMs(settings.remindAfterMinutes) : wait.lastRemindedAt + remindAfterMs(settings.remindEveryMinutes);
		}
		/**
		* Pick the waits that are due for a reminder.
		*
		* `once` and `sticky` fire a single time each; `repeat` keeps firing on the
		* shorter interval until the wait is answered.
		* @param waits - every currently tracked, still-unanswered wait.
		* @param settings - the live settings (master and per-scenario switches).
		* @param now - the current clock (ms).
		* @returns the waits to remind about, in tracking order.
		*/
		function dueReminders(waits, settings, now) {
			if (!settings.enabled) return [];
			return waits.filter((wait) => pendingEnabled(settings, wait.kind) && (settings.reminderMode === "repeat" || !wait.reminded) && now >= nextReminderAt(wait, settings));
		}
		//#endregion
		//#region src/client/runner.ts
		/** The projection key this plugin reads off `projectionValues`. */
		const NOTIFY_PROJECTION_KEY = "notify";
		/**
		* Fold one session's projection turn observation.
		* @param previousTurn - the turn last observed for this session (undefined = seed).
		* @param projection - the current projection value (absent = nothing yet).
		* @returns the next observed turn and whether it advanced past the previous.
		*/
		function turnAdvance(previousTurn, projection) {
			const turn = projection?.turn ?? 0;
			return {
				nextTurn: turn,
				fresh: previousTurn !== void 0 && turn > previousTurn
			};
		}
		/**
		* Whether a folded event is recent enough to notify about.
		* @param updatedAt - the projection's event time (0 = nothing folded yet).
		* @param now - the client clock (ms).
		* @returns true when the event happened inside the freshness window.
		*/
		function isFresh(updatedAt, now) {
			return updatedAt > 0 && now - updatedAt <= 6e4;
		}
		/**
		* The blocking interactions that appeared since the last tick.
		* @param known - request ids already observed for this session.
		* @param pending - the projection's current pending list.
		* @returns the newly appeared interactions, in projection order.
		*/
		function newPending(known, pending) {
			return pending.filter((entry) => !known.has(entry.requestId));
		}
		/**
		* The cross-source key for one ask.
		*
		* Questions can arrive from two places — the session projection (tool-call
		* asks) and the host's question queue (service-level asks such as the plan
		* review) — and the two carry different ids for the same ask. The queue cannot
		* even name the session for a tool-call ask, so the key must not include the
		* session: it is the summary alone. The cost is that two sessions asking
		* identically-worded questions inside the window notify once.
		* @param summary - the ask's one-line summary.
		* @returns the dedupe key.
		*/
		function askKey(summary) {
			return "ask:" + summary.slice(0, 40);
		}
		/**
		* Whether a dedupe key was recorded inside the window.
		* @param recent - the record of recent decisions.
		* @param key - the key to test.
		* @param now - the current clock (ms).
		* @param windowMs - how long a recorded key suppresses its twin.
		* @returns true when the twin was recorded recently.
		*/
		function recentlyKeyed(recent, key, now, windowMs) {
			const at = recent.get(key);
			return at !== void 0 && now - at < windowMs;
		}
		//#endregion
		//#region src/client/SoundPicker.tsx
		/**
		* The two-level sound picker.
		*
		* A native select cannot nest: its optgroups are one flat level, so the twenty
		* Windows sounds sat in the same list as everything else and made the control
		* unwieldy. This is a small popover instead - level one is the source (Windows /
		* author / custom), level two is that source's sounds - which keeps each row one
		* line tall and the list scannable.
		*/
		/**
		* Render the picker.
		* @param props - see {@link SoundPickerProps}.
		* @returns the trigger and, while open, the grouped panel.
		*/
		function SoundPicker(props) {
			const [open, setOpen] = (0, react.useState)(false);
			const [expanded, setExpanded] = (0, react.useState)(null);
			const root = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (!open) return void 0;
				const onPointerDown = (event) => {
					const node = root.current;
					if (node !== null && event.target instanceof Node && !node.contains(event.target)) setOpen(false);
				};
				const onKeyDown = (event) => {
					if (event.key === "Escape") setOpen(false);
				};
				document.addEventListener("mousedown", onPointerDown);
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("mousedown", onPointerDown);
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [open]);
			const sections = !open ? [] : [
				{
					id: "windows",
					label: props.t("settings.sounds.groupWindows"),
					items: SOUND_CHOICES.map((choice) => ({
						id: choice.id,
						label: props.labelOf(choice.id)
					})),
					empty: ""
				},
				{
					id: "author",
					label: props.t("settings.sounds.groupAuthor"),
					items: props.library.author.map((item) => ({
						id: item.id,
						label: props.labelOf(item.id)
					})),
					empty: props.t("settings.sounds.authorEmpty")
				},
				{
					id: "custom",
					label: props.t("settings.sounds.groupCustom"),
					items: props.library.custom.map((item) => ({
						id: item.id,
						label: item.name
					})),
					empty: props.t("settings.sounds.customEmpty")
				}
			];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh_notify_picker",
				ref: root,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "dsh_notify_pickerTrigger",
					"aria-haspopup": "listbox",
					"aria-expanded": open,
					disabled: props.disabled,
					onClick: () => {
						if (!open) setExpanded(null);
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsh_notify_pickerValue",
						children: props.labelOf(props.value)
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsh_notify_pickerCaret",
						"aria-hidden": "true"
					})]
				}), !open ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsh_notify_pickerPanel",
					role: "listbox",
					"aria-label": props.t("settings.sounds.pickerLabel"),
					children: sections.map((section) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_pickerSection",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "dsh_notify_pickerHeader",
							"aria-expanded": expanded === section.id,
							onClick: () => {
								setExpanded(expanded === section.id ? null : section.id);
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh_notify_pickerCaretSmall",
									"data-open": expanded === section.id,
									"aria-hidden": "true"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh_notify_pickerHeaderLabel",
									children: section.label
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh_notify_pickerCount",
									children: section.items.length
								})
							]
						}), expanded !== section.id ? null : section.items.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsh_notify_pickerEmpty",
							children: section.empty
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: "dsh_notify_pickerList",
							children: section.items.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "option",
								"aria-selected": item.id === props.value,
								className: "dsh_notify_pickerOption" + (item.id === props.value ? " is-selected" : ""),
								onClick: () => {
									props.onPick(item.id);
									setOpen(false);
								},
								children: item.label
							}) }, item.id))
						})]
					}, section.id))
				})]
			});
		}
		//#endregion
		//#region src/client/TextPicker.tsx
		/**
		* The popup-text picker for one situation.
		*
		* Same shape as {@link SoundPicker}: a trigger that shows the current choice and
		* a floating panel with two level-one groups — the built-in default wording and
		* the situation's own saved texts (at most {@link TEXT_LIMIT_PER_SCENARIO}).
		* The panel is flat (no second click to expand a group): with two short lists
		* the extra fold only costs a click.
		*/
		/**
		* Render the picker.
		* @param props - see {@link TextPickerProps}.
		* @returns the trigger and, while open, the two-section panel.
		*/
		function TextPicker(props) {
			const [open, setOpen] = (0, react.useState)(false);
			const root = (0, react.useRef)(null);
			const chosen = props.value === "default" ? void 0 : props.options.find((entry) => entry.id === props.value);
			const label = props.value === "default" ? props.t("settings.text.default") : chosen === void 0 ? props.t("settings.text.missing") : chosen.name;
			(0, react.useEffect)(() => {
				if (!open) return void 0;
				const onPointerDown = (event) => {
					const node = root.current;
					if (node !== null && event.target instanceof Node && !node.contains(event.target)) setOpen(false);
				};
				const onKeyDown = (event) => {
					if (event.key === "Escape") setOpen(false);
				};
				document.addEventListener("mousedown", onPointerDown);
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("mousedown", onPointerDown);
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [open]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh_notify_picker dsh_notify_textPicker",
				ref: root,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "dsh_notify_pickerTrigger",
					"aria-haspopup": "listbox",
					"aria-expanded": open,
					disabled: props.disabled,
					title: label,
					onClick: () => {
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsh_notify_pickerValue",
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsh_notify_pickerCaret",
						"aria-hidden": "true"
					})]
				}), !open ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsh_notify_pickerPanel dsh_notify_textPanel",
					role: "listbox",
					"aria-label": props.t("settings.text.pickerLabel"),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_pickerSection",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsh_notify_pickerHeader dsh_notify_pickerHeaderStatic",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh_notify_pickerHeaderLabel",
								children: props.t("settings.text.default")
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: "dsh_notify_pickerList",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "option",
								"aria-selected": props.value === DEFAULT_TEXT_CHOICE,
								className: "dsh_notify_pickerOption" + (props.value === "default" ? " is-selected" : ""),
								onClick: () => {
									props.onPick(DEFAULT_TEXT_CHOICE);
									setOpen(false);
								},
								children: props.t("settings.text.default")
							}) })
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_pickerSection",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh_notify_pickerHeader dsh_notify_pickerHeaderStatic",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh_notify_pickerHeaderLabel",
								children: props.t("settings.text.custom")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh_notify_pickerCount",
								children: props.options.length + "/3"
							})]
						}), props.options.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsh_notify_pickerEmpty",
							children: props.t("settings.text.empty")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: "dsh_notify_pickerList",
							children: props.options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "option",
								"aria-selected": option.id === props.value,
								className: "dsh_notify_pickerOption" + (option.id === props.value ? " is-selected" : ""),
								title: option.title,
								onClick: () => {
									props.onPick(option.id);
									setOpen(false);
								},
								children: option.name
							}) }, option.id))
						})]
					})]
				})]
			});
		}
		//#endregion
		//#region src/client/TextManager.tsx
		/**
		* The saved-popup-text manager: one group per enabled situation, each holding
		* that situation's templates (at most {@link TEXT_LIMIT_PER_SCENARIO}), the
		* inline editor and the delete confirmation.
		*
		* The manager owns no storage: the section injects the text store's save/delete
		* calls, so the same code path refreshes the notification cache the runner
		* reads. Only situations that are switched on are listed; the caller decides
		* which those are.
		*/
		/** Why the last save failed, as a locale key. */
		const PROBLEM_KEY = {
			name: "settings.textEditor.nameRequired",
			title: "settings.textEditor.titleRequired",
			body: "settings.textEditor.bodyRequired",
			limit: "settings.textLibrary.limit"
		};
		/** The four placeholders, with the explanation shown under the editor. */
		const PLACEHOLDER_HINTS = [
			{
				token: "{工作区}",
				hint: "settings.textEditor.placeholderWorkspace"
			},
			{
				token: "{状态}",
				hint: "settings.textEditor.placeholderStatus"
			},
			{
				token: "{内容}",
				hint: "settings.textEditor.placeholderBody"
			},
			{
				token: "{分钟}",
				hint: "settings.textEditor.placeholderMinutes"
			}
		];
		/**
		* Render the manager.
		* @param props - see {@link TextManagerProps}.
		* @returns the per-situation groups, editor and confirmations.
		*/
		function TextManager(props) {
			const [editor, setEditor] = (0, react.useState)(null);
			const [problem, setProblem] = (0, react.useState)(null);
			const [saving, setSaving] = (0, react.useState)(false);
			const [confirming, setConfirming] = (0, react.useState)(null);
			const [note, setNote] = (0, react.useState)(null);
			/** Start a new template, pre-filled with the built-in wording. */
			const startNew = (scenario) => {
				setProblem(null);
				setNote(null);
				setEditor({
					scenario,
					name: fmt(props.t("settings.textEditor.defaultName"), { n: String(props.library[scenario].length + 1) }),
					title: DEFAULT_TITLE_TEMPLATE,
					body: DEFAULT_BODY_TEMPLATE
				});
			};
			/** Edit one existing template. */
			const startEdit = (scenario, template) => {
				setProblem(null);
				setNote(null);
				setEditor({
					scenario,
					id: template.id,
					name: template.name,
					title: template.title,
					body: template.body
				});
			};
			/** Validate locally, then hand the draft to the store. */
			const save = async () => {
				if (editor === null || saving) return;
				const name = editor.name.trim();
				const title = editor.title.trim();
				const body = editor.body.trim();
				if (name === "" || name.length > 24) {
					setProblem("settings.textEditor.nameRequired");
					return;
				}
				if (title === "" || title.length > 120) {
					setProblem("settings.textEditor.titleRequired");
					return;
				}
				if (body === "" || body.length > 300) {
					setProblem("settings.textEditor.bodyRequired");
					return;
				}
				setSaving(true);
				const outcome = await props.onSave(editor.scenario, {
					name,
					title,
					body
				}, editor.id);
				setSaving(false);
				if (!outcome.ok) {
					setProblem(PROBLEM_KEY[outcome.problem] ?? "settings.textLibrary.saveFailed");
					return;
				}
				setEditor(null);
				setProblem(null);
				setNote(null);
			};
			/** Delete one template after the inline confirmation. */
			const remove = async (scenario, id) => {
				const result = await props.onDelete(scenario, id);
				setConfirming(null);
				setNote(result.ok ? props.t("settings.soundLibrary.removed") : props.t("settings.textLibrary.deleteFailed"));
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh_notify_textManager",
				children: [props.scenarios.map((scenario) => {
					const templates = props.library[scenario];
					const editing = editor !== null && editor.scenario === scenario ? editor : null;
					const parts = props.partsOf(scenario);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_textGroup",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_textGroupHeader",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsh_notify_textGroupName",
										children: props.labelOf(scenario)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsh_notify_textGroupCount",
										children: String(templates.length) + "/" + String(3)
									}),
									editing === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsh_notify_button dsh_notify_textGroupAdd",
										disabled: templates.length >= 3,
										...templates.length >= 3 ? { title: props.t("settings.textLibrary.limit") } : {},
										onClick: () => {
											startNew(scenario);
										},
										children: props.t("settings.textLibrary.add")
									}) : null
								]
							}),
							templates.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: "dsh_notify_textList",
								children: templates.map((template) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
									className: "dsh_notify_textItem",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsh_notify_textItemName",
											title: template.name,
											children: template.name
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsh_notify_textItemBody",
											title: template.body,
											children: renderBody(template.body, parts, "")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh_notify_iconButton",
											onClick: () => {
												startEdit(scenario, template);
											},
											children: props.t("settings.textLibrary.edit")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh_notify_iconButton dsh_notify_danger",
											onClick: () => {
												setProblem(null);
												setConfirming({
													scenario,
													template
												});
											},
											children: props.t("settings.textLibrary.delete")
										})
									]
								}, template.id))
							}),
							confirming !== null && confirming.scenario === scenario ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_confirm",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: fmt(props.t("settings.textLibrary.deleteConfirm"), { name: confirming.template.name }) }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsh_notify_button dsh_notify_dangerButton",
										onClick: () => {
											remove(confirming.scenario, confirming.template.id);
										},
										children: props.t("settings.textLibrary.delete")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsh_notify_button",
										onClick: () => {
											setConfirming(null);
										},
										children: props.t("settings.textEditor.cancel")
									})
								]
							}) : null,
							editing === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextEditor, {
								state: editing,
								t: props.t,
								parts: props.partsOf(editing.scenario),
								fallback: props.fallbackOf(editing.scenario),
								problem,
								saving,
								onChange: (next) => {
									setEditor({
										...editing,
										...next
									});
								},
								onCancel: () => {
									setEditor(null);
									setProblem(null);
								},
								onSave: () => {
									save();
								}
							}, editing.id ?? "new")
						]
					}, scenario);
				}), note === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsh_notify_note",
					children: note
				})]
			});
		}
		/** One input field of the editor. */
		function Field(props) {
			const count = String(props.value.length) + "/" + String(props.limit);
			const mono = props.mono === true ? " dsh_notify_mono" : "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "dsh_notify_editorRow",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsh_notify_editorLabel",
						children: props.label
					}),
					props.multiline === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
						className: "dsh_notify_textArea" + mono,
						value: props.value,
						maxLength: props.limit,
						rows: 3,
						onChange: (event) => {
							props.onChange(event.target.value);
						}
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "text",
						className: "dsh_notify_textInput" + mono,
						value: props.value,
						maxLength: props.limit,
						onChange: (event) => {
							props.onChange(event.target.value);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsh_notify_editorCount",
						children: count
					})
				]
			});
		}
		/** The inline editor for one template. */
		function TextEditor(props) {
			const title = props.state.title === "" ? DEFAULT_TITLE_TEMPLATE : props.state.title;
			const body = props.state.body === "" ? DEFAULT_BODY_TEMPLATE : props.state.body;
			const previewTitle = renderTitle(title, props.parts);
			const previewBody = renderBody(body, props.parts, props.fallback);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh_notify_editor",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: props.t("settings.textEditor.name"),
						value: props.state.name,
						limit: 24,
						onChange: (value) => {
							props.onChange({ name: value });
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: props.t("settings.textEditor.titleField"),
						value: props.state.title,
						limit: 120,
						mono: true,
						onChange: (value) => {
							props.onChange({ title: value });
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: props.t("settings.textEditor.bodyField"),
						value: props.state.body,
						limit: 300,
						multiline: true,
						mono: true,
						onChange: (value) => {
							props.onChange({ body: value });
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_editorPlaceholders",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsh_notify_rowDesc",
							children: props.t("settings.textEditor.placeholders")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsh_notify_placeholderHints",
							children: PLACEHOLDER_HINTS.map((placeholder) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_placeholderHint",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh_notify_chip",
									onClick: () => {
										props.onChange({ body: props.state.body + placeholder.token });
									},
									children: placeholder.token
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh_notify_placeholderHintText",
									children: props.t(placeholder.hint)
								})]
							}, placeholder.token))
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_editorPreview",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_rowDesc",
								children: props.t("settings.textEditor.preview")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_previewTitle",
								children: previewTitle
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_previewBody",
								children: previewBody
							})
						]
					}),
					props.problem === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh_notify_error",
						children: props.t(props.problem)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_editorActions",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsh_notify_button",
							disabled: props.saving,
							onClick: props.onSave,
							children: props.saving ? props.t("settings.textLibrary.saving") : props.t("settings.textEditor.save")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsh_notify_button",
							onClick: props.onCancel,
							children: props.t("settings.textEditor.cancel")
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/channels.ts
		/** Every channel kind this build can deliver to, in catalogue order. */
		const CHANNEL_TYPES = Object.freeze([
			"auto",
			"webhook",
			"bark",
			"serverchan",
			"pushplus",
			"wecom",
			"dingtalk",
			"feishu",
			"telegram",
			"ntfy",
			"gotify",
			"slack",
			"discord",
			"wxpusher",
			"pushdeer",
			"qmsg",
			"meow",
			"kook",
			"onebot",
			"matrix",
			"pushover",
			"smtp"
		]);
		/**
		* The form schema per channel type: which string fields the channel carries,
		* in display order. The host validates the same keys, so a field the UI never
		* shows can never sneak into the store.
		*/
		/** Freeze a field list while typing each entry as a {@link ChannelField}. */
		function fields(list) {
			return Object.freeze(list);
		}
		const CHANNEL_FIELDS = Object.freeze({
			auto: fields([{
				key: "value",
				labelKey: "settings.push.field.value",
				required: true,
				placeholder: "粘贴 URL / key / token"
			}]),
			webhook: fields([
				{
					key: "url",
					labelKey: "settings.push.field.url",
					required: true,
					placeholder: "https://example.com/hook"
				},
				{
					key: "headers",
					labelKey: "settings.push.field.headers",
					required: false,
					placeholder: "{\"Authorization\":\"Bearer ...\"}"
				},
				{
					key: "jsonBody",
					labelKey: "settings.push.field.jsonBody",
					required: false,
					placeholder: "{\"text\":\"{title}\\n{body}\"}"
				}
			]),
			bark: fields([
				{
					key: "deviceKey",
					labelKey: "settings.push.field.barkKey",
					required: true,
					secret: true,
					kind: "password"
				},
				{
					key: "server",
					labelKey: "settings.push.field.server",
					required: false,
					placeholder: "https://api.day.app"
				},
				{
					key: "sound",
					labelKey: "settings.push.field.barkSound",
					required: false
				},
				{
					key: "group",
					labelKey: "settings.push.field.barkGroup",
					required: false
				}
			]),
			serverchan: fields([{
				key: "sendKey",
				labelKey: "settings.push.field.sendKey",
				required: true,
				secret: true,
				kind: "password",
				placeholder: "SCT… 或 sctp…"
			}]),
			pushplus: fields([{
				key: "token",
				labelKey: "settings.push.field.token",
				required: true,
				secret: true,
				kind: "password"
			}, {
				key: "topic",
				labelKey: "settings.push.field.topic",
				required: false
			}]),
			wecom: fields([{
				key: "key",
				labelKey: "settings.push.field.wecomKey",
				required: true,
				secret: true,
				kind: "password"
			}]),
			dingtalk: fields([{
				key: "url",
				labelKey: "settings.push.field.url",
				required: true,
				placeholder: "https://oapi.dingtalk.com/robot/send?access_token=..."
			}, {
				key: "secret",
				labelKey: "settings.push.field.secret",
				required: false,
				secret: true,
				kind: "password"
			}]),
			feishu: fields([{
				key: "url",
				labelKey: "settings.push.field.url",
				required: true,
				placeholder: "https://open.feishu.cn/open-apis/bot/v2/hook/..."
			}, {
				key: "secret",
				labelKey: "settings.push.field.secret",
				required: false,
				secret: true,
				kind: "password"
			}]),
			telegram: fields([
				{
					key: "botToken",
					labelKey: "settings.push.field.botToken",
					required: true,
					secret: true,
					kind: "password"
				},
				{
					key: "chatId",
					labelKey: "settings.push.field.chatId",
					required: true
				},
				{
					key: "apiBase",
					labelKey: "settings.push.field.apiBase",
					required: false,
					placeholder: "https://api.telegram.org"
				}
			]),
			ntfy: fields([
				{
					key: "topic",
					labelKey: "settings.push.field.topic",
					required: true
				},
				{
					key: "server",
					labelKey: "settings.push.field.server",
					required: false,
					placeholder: "https://ntfy.sh"
				},
				{
					key: "token",
					labelKey: "settings.push.field.token",
					required: false,
					secret: true,
					kind: "password"
				}
			]),
			gotify: fields([
				{
					key: "server",
					labelKey: "settings.push.field.server",
					required: true,
					placeholder: "https://gotify.example.com"
				},
				{
					key: "token",
					labelKey: "settings.push.field.token",
					required: true,
					secret: true,
					kind: "password"
				},
				{
					key: "priority",
					labelKey: "settings.push.field.priority",
					required: false,
					kind: "number",
					placeholder: "5"
				}
			]),
			slack: fields([{
				key: "url",
				labelKey: "settings.push.field.url",
				required: true,
				placeholder: "https://hooks.slack.com/services/..."
			}]),
			discord: fields([{
				key: "url",
				labelKey: "settings.push.field.url",
				required: true,
				placeholder: "https://discord.com/api/webhooks/..."
			}]),
			wxpusher: fields([
				{
					key: "appToken",
					labelKey: "settings.push.field.appToken",
					required: true,
					secret: true,
					kind: "password",
					placeholder: "AT_..."
				},
				{
					key: "uid",
					labelKey: "settings.push.field.uid",
					required: false,
					placeholder: "UID_..."
				},
				{
					key: "topicIds",
					labelKey: "settings.push.field.topicIds",
					required: false,
					placeholder: "123,456"
				}
			]),
			pushdeer: fields([{
				key: "pushKey",
				labelKey: "settings.push.field.pushKey",
				required: true,
				secret: true,
				kind: "password"
			}, {
				key: "server",
				labelKey: "settings.push.field.server",
				required: false,
				placeholder: "https://api2.pushdeer.com"
			}]),
			qmsg: fields([{
				key: "key",
				labelKey: "settings.push.field.qmsgKey",
				required: true,
				secret: true,
				kind: "password"
			}, {
				key: "qq",
				labelKey: "settings.push.field.qq",
				required: false,
				placeholder: "收件 QQ（可选）"
			}]),
			meow: fields([{
				key: "nickname",
				labelKey: "settings.push.field.nickname",
				required: true
			}, {
				key: "server",
				labelKey: "settings.push.field.server",
				required: false,
				placeholder: "https://api.chuckfang.com"
			}]),
			kook: fields([{
				key: "token",
				labelKey: "settings.push.field.token",
				required: true,
				secret: true,
				kind: "password"
			}, {
				key: "targetId",
				labelKey: "settings.push.field.targetId",
				required: true,
				placeholder: "频道/用户 id"
			}]),
			onebot: fields([
				{
					key: "server",
					labelKey: "settings.push.field.server",
					required: true,
					placeholder: "http://127.0.0.1:5700"
				},
				{
					key: "messageType",
					labelKey: "settings.push.field.messageType",
					required: false,
					kind: "select",
					options: ["private", "group"]
				},
				{
					key: "target",
					labelKey: "settings.push.field.target",
					required: true,
					placeholder: "QQ 号 / 群号"
				}
			]),
			matrix: fields([
				{
					key: "server",
					labelKey: "settings.push.field.server",
					required: true,
					placeholder: "https://matrix.example.com"
				},
				{
					key: "roomId",
					labelKey: "settings.push.field.roomId",
					required: true,
					placeholder: "!abc:example.com"
				},
				{
					key: "token",
					labelKey: "settings.push.field.token",
					required: true,
					secret: true,
					kind: "password"
				}
			]),
			pushover: fields([{
				key: "token",
				labelKey: "settings.push.field.token",
				required: true,
				secret: true,
				kind: "password"
			}, {
				key: "user",
				labelKey: "settings.push.field.userKey",
				required: true,
				secret: true,
				kind: "password"
			}]),
			smtp: fields([
				{
					key: "host",
					labelKey: "settings.push.field.smtpHost",
					required: true,
					placeholder: "smtp.example.com"
				},
				{
					key: "port",
					labelKey: "settings.push.field.smtpPort",
					required: true,
					kind: "number",
					placeholder: "465"
				},
				{
					key: "secure",
					labelKey: "settings.push.field.smtpSecure",
					required: false,
					kind: "select",
					options: [
						"ssl",
						"starttls",
						"none"
					]
				},
				{
					key: "user",
					labelKey: "settings.push.field.smtpUser",
					required: false
				},
				{
					key: "pass",
					labelKey: "settings.push.field.smtpPass",
					required: false,
					secret: true,
					kind: "password"
				},
				{
					key: "from",
					labelKey: "settings.push.field.smtpFrom",
					required: true,
					placeholder: "dsh@example.com"
				},
				{
					key: "to",
					labelKey: "settings.push.field.smtpTo",
					required: true,
					placeholder: "me@example.com, other@example.com"
				}
			])
		});
		/** The locale key for one channel type's display name. */
		function channelTypeKey(type) {
			return "settings.push.type." + type;
		}
		/** Build a detection, computing which required fields are still blank. */
		function detected(type, fields) {
			const missing = [];
			for (const field of CHANNEL_FIELDS[type]) if (field.required && (fields[field.key] ?? "").trim() === "") missing.push(field.key);
			return {
				type,
				fields,
				missing
			};
		}
		/** Decode one URL path segment, falling back to the raw text. */
		function segment(value) {
			try {
				return decodeURIComponent(value);
			} catch {
				return value;
			}
		}
		/**
		* Guess which channel a pasted value belongs to.
		*
		* The "auto" channel lets the user paste one string — a group-bot webhook, a
		* Server酱 key, a Bark device key, an ntfy topic URL, or any https URL — and
		* this decides the concrete channel. URLs are matched by host; bare values only
		* by an unmistakable prefix (`SCT…` / `sctp…` / `AT_…` / a Telegram bot token).
		* A non-empty `missing` means the type was recognized but the paste cannot
		* supply every required field (for example a Telegram bot token with no chat
		* id). The console URLs (`sct.ftqq.com`, `sc3.ft07.com`) are not endpoints and
		* read as unrecognized.
		* @param raw - whatever the user pasted.
		* @returns the detection, or null when nothing matches.
		*/
		function detectChannelValue(raw) {
			const value = raw.trim();
			if (value === "") return null;
			let url = null;
			try {
				url = new URL(value);
			} catch {
				url = null;
			}
			if (url !== null) {
				const host = url.hostname.toLowerCase();
				const path = url.pathname;
				if (host === "sct.ftqq.com" || host === "sc3.ft07.com") return null;
				if (host === "qyapi.weixin.qq.com" && url.searchParams.get("key") !== null) return detected("wecom", { key: url.searchParams.get("key") ?? "" });
				if (host === "oapi.dingtalk.com" && path.includes("/robot/send")) return detected("dingtalk", { url: value });
				if ((host === "open.feishu.cn" || host === "open.larksuite.com" || host.endsWith(".feishu.cn") || host.endsWith(".larksuite.com")) && path.includes("/bot/v2/hook")) return detected("feishu", { url: value });
				if (host === "hooks.slack.com") return detected("slack", { url: value });
				if ((host === "discord.com" || host === "discordapp.com") && path.includes("/api/webhooks/")) return detected("discord", { url: value });
				if (host === "sctapi.ftqq.com") {
					const match = /^\/(.+)\.send$/.exec(path);
					if (match !== null) return detected("serverchan", { sendKey: segment(match[1] ?? "") });
					return detected("serverchan", {});
				}
				if (host.endsWith(".push.ft07.com") && path.startsWith("/send/")) {
					const match = /^\/send\/(.+)\.send$/.exec(path);
					if (match !== null) return detected("serverchan", { sendKey: segment(match[1] ?? "") });
					return detected("serverchan", {});
				}
				if (host === "api.day.app") {
					const first = path.replace(/^\/+/, "").split("/")[0] ?? "";
					if (first !== "") return detected("bark", { deviceKey: segment(first) });
					return detected("bark", {});
				}
				if (host === "ntfy.sh") {
					const topic = path.replace(/^\/+/, "").split("/")[0] ?? "";
					if (topic !== "") return detected("ntfy", {
						topic: segment(topic),
						server: "https://ntfy.sh"
					});
					return detected("ntfy", {});
				}
				if (host === "qmsg.zendee.cn") {
					const match = /^\/send\/(.+)$/.exec(path);
					if (match !== null) return detected("qmsg", { key: segment(match[1] ?? "") });
					return detected("qmsg", {});
				}
				if (path.includes("/message") && url.searchParams.get("token") !== null) return detected("gotify", {
					server: url.origin,
					token: url.searchParams.get("token") ?? ""
				});
				return detected("webhook", { url: value });
			}
			if (/^SCT/i.test(value) || /^sctp\d+t/i.test(value)) return detected("serverchan", { sendKey: value });
			if (/^AT_[A-Za-z0-9]+$/.test(value)) return detected("wxpusher", { appToken: value });
			if (/^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(value)) return detected("telegram", { botToken: value });
			return null;
		}
		//#endregion
		//#region src/client/channels.ts
		/**
		* The renderer half of the external-push channels: thin `fetch` wrappers over
		* the host routes. The host owns the channels and secrets; this module only
		* lists, saves, deletes, tests and pushes. Nothing here blocks the notification
		* that triggered it — {@link pushNotification} is fire-and-forget.
		*/
		/**
		* Read every configured channel from the host.
		* @returns the list, or [] when the host is unreachable.
		*/
		async function listChannels() {
			const fetchImpl = globalThis.fetch;
			if (fetchImpl === void 0) return [];
			try {
				const response = await fetchImpl(CHANNELS_ROUTE, { headers: { [FOCUS_HEADER]: "1" } });
				if (!response.ok) return [];
				const payload = await response.json();
				return Array.isArray(payload.channels) ? payload.channels : [];
			} catch {
				return [];
			}
		}
		/**
		* Save one channel (upsert by id) on the host.
		* @param draft - the channel to save.
		* @returns the new list and saved channel, or the reason it was refused.
		*/
		async function saveChannel(draft) {
			const fetchImpl = globalThis.fetch;
			if (fetchImpl === void 0) return {
				ok: false,
				problem: "no-host"
			};
			try {
				const payload = await (await fetchImpl(CHANNELS_ROUTE, {
					method: "POST",
					headers: {
						[FOCUS_HEADER]: "1",
						"content-type": "application/json"
					},
					body: JSON.stringify({
						action: "save",
						channel: draft
					})
				})).json();
				if (payload.ok === true && Array.isArray(payload.channels) && payload.channel !== void 0) return {
					ok: true,
					channels: payload.channels,
					channel: payload.channel
				};
				const problem = typeof payload.problem === "string" ? payload.problem : "error";
				return Array.isArray(payload.missing) ? {
					ok: false,
					problem,
					missing: payload.missing
				} : {
					ok: false,
					problem
				};
			} catch {
				return {
					ok: false,
					problem: "no-host"
				};
			}
		}
		/**
		* Delete one channel on the host.
		* @param id - the channel id.
		* @returns the new list, or the reason it was refused.
		*/
		async function deleteChannel(id) {
			const fetchImpl = globalThis.fetch;
			if (fetchImpl === void 0) return {
				ok: false,
				problem: "no-host"
			};
			try {
				const payload = await (await fetchImpl(CHANNELS_ROUTE, {
					method: "POST",
					headers: {
						[FOCUS_HEADER]: "1",
						"content-type": "application/json"
					},
					body: JSON.stringify({
						action: "delete",
						id
					})
				})).json();
				if (payload.ok === true && Array.isArray(payload.channels)) return {
					ok: true,
					channels: payload.channels
				};
				return {
					ok: false,
					problem: typeof payload.problem === "string" ? payload.problem : "error"
				};
			} catch {
				return {
					ok: false,
					problem: "no-host"
				};
			}
		}
		/**
		* Fire-and-forget: deliver one notification to every enabled channel.
		* @param message - the message to push.
		*/
		function pushNotification(message) {
			const fetchImpl = globalThis.fetch;
			if (fetchImpl === void 0) return;
			try {
				fetchImpl(PUSH_ROUTE, {
					method: "POST",
					headers: {
						[FOCUS_HEADER]: "1",
						"content-type": "application/json"
					},
					body: JSON.stringify(message)
				}).catch(() => void 0);
			} catch {}
		}
		/**
		* Send a fixed test message to one channel (or every enabled one when id '').
		* @param id - the channel id, or '' for all enabled channels.
		* @returns the per-channel receipts.
		*/
		async function testPush(id) {
			const fetchImpl = globalThis.fetch;
			if (fetchImpl === void 0) return [];
			try {
				const payload = await (await fetchImpl(TEST_PUSH_ROUTE, {
					method: "POST",
					headers: {
						[FOCUS_HEADER]: "1",
						"content-type": "application/json"
					},
					body: JSON.stringify({ id })
				})).json();
				return Array.isArray(payload.receipts) ? payload.receipts : [];
			} catch {
				return [];
			}
		}
		//#endregion
		//#region src/client/ChannelManager.tsx
		/**
		* The "external push" card's body: list configured channels, add/edit/delete
		* them, toggle each on/off, and send a test to one channel or all.
		*
		* The channels (and their tokens) live on the host; this component only edits
		* them through {@link listChannels} / {@link saveChannel} / {@link deleteChannel}
		* and asks the host to deliver the test through {@link testPush}. It renders the
		* per-type form from {@link CHANNEL_FIELDS}, so adding a channel type never
		* needs a hand-written form here.
		*/
		/** The locale key of each scenario's display name. */
		const SCENARIO_LABEL = {
			completed: "settings.scenario.completed",
			error: "settings.scenario.error",
			aborted: "settings.scenario.aborted",
			blocked: "settings.scenario.blocked",
			"max-tokens": "settings.scenario.maxTokens",
			approval: "settings.scenario.approval",
			question: "settings.scenario.question",
			"plan-review": "settings.scenario.planReview",
			reminder: "settings.scenario.reminder"
		};
		/** A fresh empty draft for a given type. */
		function emptyDraft(type) {
			return {
				id: "",
				type,
				enabled: true,
				label: "",
				fields: {},
				scenarios: [],
				titleTemplate: "",
				bodyTemplate: "",
				markdown: false
			};
		}
		/** How many receipts are failing. */
		function failures(receipts) {
			return receipts.filter((entry) => !entry.ok).length;
		}
		/**
		* The external-push channel manager.
		* @param props - the plugin translator.
		* @returns the rendered card body.
		*/
		function ChannelManager(props) {
			const t = props.t;
			const [channels, setChannels] = (0, react.useState)([]);
			const [draft, setDraft] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [note, setNote] = (0, react.useState)(null);
			const [confirmId, setConfirmId] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const reload = async () => {
				setChannels(await listChannels());
			};
			(0, react.useEffect)(() => {
				reload();
			}, []);
			const typeName = (type) => t(channelTypeKey(type));
			const labelOf = (channel) => channel.label !== "" ? channel.label : typeName(channel.type);
			const beginAdd = () => {
				setError(null);
				setNote(null);
				setDraft(emptyDraft("auto"));
			};
			const beginEdit = (channel) => {
				setError(null);
				setNote(null);
				setDraft({
					id: channel.id,
					type: channel.type,
					enabled: channel.enabled,
					label: channel.label,
					fields: { ...channel.fields },
					scenarios: [...channel.scenarios],
					titleTemplate: channel.titleTemplate,
					bodyTemplate: channel.bodyTemplate,
					markdown: channel.markdown
				});
			};
			const updateDraft = (patch) => {
				setDraft((current) => current === null ? current : {
					...current,
					...patch
				});
			};
			const setField = (key, value) => {
				setDraft((current) => current === null ? current : {
					...current,
					fields: {
						...current.fields,
						[key]: value
					}
				});
			};
			const commit = async () => {
				if (draft === null || busy) return;
				setBusy(true);
				const outcome = await saveChannel(draft);
				setBusy(false);
				if (outcome.ok) {
					setChannels([...outcome.channels]);
					setDraft(null);
					setError(null);
					setNote(t("settings.push.saved"));
					return;
				}
				setError(outcome.problem === "fields" && outcome.missing !== void 0 ? t("settings.push.missingFields") + " " + outcome.missing.join(", ") : t("settings.push.saveFailed") + " (" + outcome.problem + ")");
			};
			const toggle = async (channel) => {
				const outcome = await saveChannel({
					id: channel.id,
					type: channel.type,
					enabled: !channel.enabled,
					label: channel.label,
					fields: { ...channel.fields },
					scenarios: [...channel.scenarios],
					titleTemplate: channel.titleTemplate,
					bodyTemplate: channel.bodyTemplate,
					markdown: channel.markdown
				});
				if (outcome.ok) setChannels([...outcome.channels]);
				else setError(t("settings.push.saveFailed") + " (" + outcome.problem + ")");
			};
			const remove = async (id) => {
				setConfirmId(null);
				const outcome = await deleteChannel(id);
				if (outcome.ok) {
					setChannels([...outcome.channels]);
					setNote(t("settings.push.deleted"));
				} else setError(t("settings.push.deleteFailed") + " (" + outcome.problem + ")");
			};
			const runTest = async (id) => {
				if (busy) return;
				setBusy(true);
				setNote(null);
				const receipts = await testPush(id);
				setBusy(false);
				if (receipts.length === 0) {
					setError(t("settings.push.noChannel"));
					return;
				}
				setError(null);
				const failed = failures(receipts);
				setNote(failed === 0 ? t("settings.push.testOk") : t("settings.push.testFail") + " " + receipts.filter((entry) => !entry.ok).map((entry) => labelOf({
					...emptyDraft(entry.type),
					label: entry.label,
					type: entry.type
				}) + (entry.error !== void 0 ? " (" + entry.error + ")" : "")).join("; "));
			};
			const draftType = draft === null ? null : draft.type;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh_notify_push",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_customControls",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsh_notify_button",
							disabled: busy,
							onClick: beginAdd,
							children: t("settings.push.add")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsh_notify_button",
							disabled: busy || channels.length === 0,
							onClick: () => {
								runTest("");
							},
							children: t("settings.push.testAll")
						})]
					}),
					error === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh_notify_error",
						children: error
					}),
					note === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh_notify_note",
						children: note
					}),
					channels.length === 0 && draft === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh_notify_rowDesc",
						children: t("settings.push.empty")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: "dsh_notify_pushList",
						children: channels.map((channel) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
							className: "dsh_notify_pushItem",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									id: "dsh-notify-push-" + channel.id,
									type: "checkbox",
									checked: channel.enabled,
									disabled: busy,
									onChange: () => {
										toggle(channel);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									className: "dsh_notify_rowLabel",
									htmlFor: "dsh-notify-push-" + channel.id,
									children: labelOf(channel)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh_notify_rowDesc",
									children: typeName(channel.type)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dsh_notify_pushActions",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh_notify_iconButton",
											disabled: busy,
											onClick: () => {
												runTest(channel.id);
											},
											children: t("settings.push.test")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh_notify_iconButton",
											disabled: busy,
											onClick: () => {
												beginEdit(channel);
											},
											children: t("settings.push.edit")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh_notify_iconButton dsh_notify_danger",
											disabled: busy,
											onClick: () => {
												setConfirmId(channel.id);
											},
											children: t("settings.push.remove")
										})
									]
								}),
								confirmId === channel.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dsh_notify_confirm",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("settings.push.removeConfirm") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh_notify_button dsh_notify_dangerButton",
											onClick: () => {
												remove(channel.id);
											},
											children: t("settings.push.remove")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh_notify_button",
											onClick: () => {
												setConfirmId(null);
											},
											children: t("settings.push.cancel")
										})
									]
								}) : null
							]
						}, channel.id))
					}),
					draft === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_pushForm",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_pushFormRow",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh_notify_pushFormLabel",
									children: t("settings.push.typeLabel")
								}), draft.id === "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
									className: "dsh_notify_select",
									value: draft.type,
									disabled: busy,
									onChange: (event) => {
										updateDraft({
											type: event.target.value,
											fields: {}
										});
									},
									children: CHANNEL_TYPES.map((type) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: type,
										children: typeName(type)
									}, type))
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh_notify_rowLabel",
									children: draftType === null ? "" : typeName(draftType)
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_pushFormRow",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh_notify_pushFormLabel",
									children: t("settings.push.nameLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "dsh_notify_renameInput",
									type: "text",
									maxLength: 60,
									value: draft.label,
									placeholder: t("settings.push.namePlaceholder"),
									disabled: busy,
									onChange: (event) => {
										updateDraft({ label: event.target.value });
									}
								})]
							}),
							draftType === null ? null : CHANNEL_FIELDS[draftType].map((field) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_pushFormRow",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dsh_notify_pushFormLabel",
									children: [t(field.labelKey), field.required ? " *" : ""]
								}), field.kind === "select" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
									className: "dsh_notify_select",
									value: draft.fields[field.key] ?? field.options?.[0] ?? "",
									disabled: busy,
									onChange: (event) => {
										setField(field.key, event.target.value);
									},
									children: (field.options ?? []).map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: option,
										children: option
									}, option))
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: field.kind === "number" ? "dsh_notify_number" : "dsh_notify_renameInput",
									type: field.kind === "number" ? "number" : field.secret === true ? "password" : "text",
									value: draft.fields[field.key] ?? "",
									placeholder: field.placeholder ?? "",
									disabled: busy,
									onChange: (event) => {
										setField(field.key, event.target.value);
									}
								})]
							}, field.key)),
							draftType === "auto" ? (() => {
								const raw = draft.fields["value"] ?? "";
								if (raw.trim() === "") return null;
								const det = detectChannelValue(raw);
								if (det === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsh_notify_rowDesc",
									children: t("settings.push.detectedUnknown")
								});
								if (det.missing.length > 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsh_notify_rowDesc",
									children: t("settings.push.detectedMissing", {
										type: typeName(det.type),
										fields: det.missing.join(", ")
									})
								});
								return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsh_notify_rowDesc",
									children: t("settings.push.detected", { type: typeName(det.type) })
								});
							})() : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_pushFormRow",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh_notify_pushFormLabel",
									children: t("settings.push.scenariosLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh_notify_pushScenarios",
									children: SCENARIO_IDS.map((scenario) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: "dsh_notify_pushScenario",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: draft.scenarios.includes(scenario),
											disabled: busy,
											onChange: (event) => {
												updateDraft({ scenarios: event.target.checked ? [...draft.scenarios, scenario] : draft.scenarios.filter((id) => id !== scenario) });
											}
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(SCENARIO_LABEL[scenario] ?? scenario) })]
									}, scenario))
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_pushFormRow",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh_notify_pushFormLabel",
									children: t("settings.push.titleTemplateLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "dsh_notify_renameInput",
									type: "text",
									maxLength: 400,
									value: draft.titleTemplate,
									placeholder: t("settings.push.templatePlaceholder"),
									disabled: busy,
									onChange: (event) => {
										updateDraft({ titleTemplate: event.target.value });
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_pushFormRow",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh_notify_pushFormLabel",
									children: t("settings.push.bodyTemplateLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "dsh_notify_renameInput",
									type: "text",
									maxLength: 1e3,
									value: draft.bodyTemplate,
									placeholder: t("settings.push.templatePlaceholder"),
									disabled: busy,
									onChange: (event) => {
										updateDraft({ bodyTemplate: event.target.value });
									}
								})]
							}),
							draftType === "wecom" || draftType === "dingtalk" || draftType === "feishu" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_pushFormRow",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsh_notify_pushFormLabel",
										children: t("settings.push.markdownLabel")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: draft.markdown,
										disabled: busy,
										onChange: (event) => {
											updateDraft({ markdown: event.target.checked });
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsh_notify_rowDesc",
										children: t("settings.push.markdownHint")
									})
								]
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_customControls",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh_notify_button",
									disabled: busy,
									onClick: () => {
										commit();
									},
									children: t("settings.push.save")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh_notify_button",
									disabled: busy,
									onClick: () => {
										setDraft(null);
										setError(null);
									},
									children: t("settings.push.cancel")
								})]
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/SettingsSection.tsx
		/**
		* The settings-page section, three cards.
		*
		*  1. "Desktop notifications": the master switch, the test button tucked right
		*     under it, and the delivery mode.
		*  2. "Notification setup": one row per enabled situation with its sound, its
		*     popup text and a live preview, then the two collapsible libraries (custom
		*     sounds with the transcode cache inside, custom texts with their editor).
		*  3. "Notify me in which situations": the two groups of situation switches,
		*     each row carrying an example sentence.
		*
		* Every control writes straight through to the persisted store, except the
		* sound and text libraries, which live in the host (a folder and a JSON file).
		*/
		/** Human-readable byte size for the cache row. */
		function formatBytes(bytes) {
			if (bytes < 1024) return String(bytes) + " B";
			if (bytes < 1048576) return (bytes / 1024).toFixed(0) + " KB";
			return (bytes / 1024 / 1024).toFixed(1) + " MB";
		}
		/**
		* One native-checkbox preference row.
		*
		* The hit area is deliberately small: only the checkbox itself and the title
		* text toggle it. Wrapping the whole row in a label made a stray click anywhere
		* on the card flip a setting (user feedback: the target was too large).
		*/
		function Toggle(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: props.disabled === true ? "dsh_notify_row dsh_notify_rowDisabled" : "dsh_notify_row",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					id: props.id,
					type: "checkbox",
					checked: props.checked,
					disabled: props.disabled === true,
					onChange: (event) => {
						props.onChange(event.target.checked);
					}
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsh_notify_rowText",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
						className: "dsh_notify_rowLabel",
						htmlFor: props.id,
						children: props.label
					}), props.desc === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsh_notify_rowDesc",
						children: props.desc
					})]
				})]
			});
		}
		/** A collapsed/expanded block inside the customization card. */
		function Collapse(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh_notify_customRow dsh_notify_collapse",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "dsh_notify_collapseHeader",
					id: props.id,
					"aria-expanded": props.open,
					onClick: props.onToggle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsh_notify_pickerCaretSmall",
							"data-open": props.open,
							"aria-hidden": "true"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsh_notify_collapseLabel",
							children: props.title
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsh_notify_collapseCount",
							children: props.count
						})
					]
				}), props.open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsh_notify_collapseBody",
					children: props.children
				}) : null]
			});
		}
		/** The turn-outcome switches, in presentation order. */
		const OUTCOMES = [
			{
				field: "notifyCompleted",
				scenario: "completed"
			},
			{
				field: "notifyError",
				scenario: "error"
			},
			{
				field: "notifyAborted",
				scenario: "aborted"
			},
			{
				field: "notifyBlocked",
				scenario: "blocked"
			},
			{
				field: "notifyMaxTokens",
				scenario: "max-tokens"
			}
		];
		/** The waiting-on-you switches, in presentation order. */
		const PENDING = [
			{
				field: "notifyApproval",
				scenario: "approval"
			},
			{
				field: "notifyQuestion",
				scenario: "question"
			},
			{
				field: "notifyPlanReview",
				scenario: "plan-review"
			}
		];
		/** The delivery modes, in presentation order. */
		const MODES = [
			{
				value: "both",
				labelKey: "settings.mode.both",
				descKey: "settings.mode.bothDesc"
			},
			{
				value: "notify",
				labelKey: "settings.mode.notify",
				descKey: "settings.mode.notifyDesc"
			},
			{
				value: "sound",
				labelKey: "settings.mode.sound",
				descKey: "settings.mode.soundDesc"
			}
		];
		/** The subagent gears, in presentation order; SUBAGENT_MODES is the domain. */
		const SUBAGENT_GEARS = [
			{
				value: "silent",
				labelKey: "settings.situations.subagentSilent",
				descKey: "settings.situations.subagentSilentDesc"
			},
			{
				value: "quiet",
				labelKey: "settings.situations.subagentQuiet",
				descKey: "settings.situations.subagentQuietDesc"
			},
			{
				value: "all",
				labelKey: "settings.situations.subagentAll",
				descKey: "settings.situations.subagentAllDesc"
			}
		];
		/** The locale key of each selectable sound; an unknown id falls back to the first. */
		const SOUND_LABEL_KEYS = {
			"system:default": "settings.sound.systemDefault",
			"system:im": "settings.sound.systemIm",
			"system:mail": "settings.sound.systemMail",
			"system:calendar": "settings.sound.systemCalendar",
			"file:ding": "settings.sound.fileDing",
			"file:chimes": "settings.sound.fileChimes",
			"file:notify": "settings.sound.fileNotify",
			"file:notify-legacy": "settings.sound.fileNotifyLegacy",
			"file:message-nudge": "settings.sound.fileMessageNudge",
			"file:tada": "settings.sound.fileTada",
			"file:exclamation": "settings.sound.fileExclamation",
			"file:error": "settings.sound.fileError",
			"file:critical-stop": "settings.sound.fileCriticalStop",
			"file:alarm-1": "settings.sound.fileAlarm1",
			"file:alarm-2": "settings.sound.fileAlarm2",
			"file:alarm-3": "settings.sound.fileAlarm3",
			"file:ring-1": "settings.sound.fileRing1",
			"file:ring-2": "settings.sound.fileRing2",
			"file:ring-3": "settings.sound.fileRing3",
			silent: "settings.sound.silent"
		};
		/** The display name of each situation. */
		const SCENARIO_LABEL_KEYS = {
			completed: "settings.scenario.completed",
			error: "settings.scenario.error",
			aborted: "settings.scenario.aborted",
			blocked: "settings.scenario.blocked",
			"max-tokens": "settings.scenario.maxTokens",
			approval: "settings.scenario.approval",
			question: "settings.scenario.question",
			"plan-review": "settings.scenario.planReview",
			reminder: "settings.scenario.reminder"
		};
		/** The example sentence shown beside each switch in the situations card. */
		const SCENARIO_EXAMPLE_KEYS = {
			completed: "settings.scenario.completedExample",
			error: "settings.scenario.errorExample",
			aborted: "settings.scenario.abortedExample",
			blocked: "settings.scenario.blockedExample",
			"max-tokens": "settings.scenario.maxTokensExample",
			approval: "settings.scenario.approvalExample",
			question: "settings.scenario.questionExample",
			"plan-review": "settings.scenario.planReviewExample",
			reminder: "settings.scenario.reminder"
		};
		/**
		* Whether playing this sound needs ffmpeg.
		* @param id - a stored sound id.
		* @returns true for a library file that is not a wav.
		*/
		function needsFfmpeg(id) {
			if (!id.startsWith("custom:") && !id.startsWith("author:")) return false;
			return !id.toLowerCase().endsWith(".wav");
		}
		/**
		* Locale keys for the sounds shipped in the plugin's `sounds/` folder.
		*
		* Keyed by the stored id, which is the file name the host reports, so only the
		* four shipped files are translated and anything else falls back to its name.
		*/
		const AUTHOR_SOUND_KEYS = {
			"author:1-任务正常结束.wav": "settings.sounds.author.completed",
			"author:2-任务出错.wav": "settings.sounds.author.error",
			"author:3-需要你处理.wav": "settings.sounds.author.attention",
			"author:4-超时催办.wav": "settings.sounds.author.reminder"
		};
		/** Display label of each reminder style. */
		const REMIND_MODE_KEYS = {
			once: "settings.remind.mode.once",
			repeat: "settings.remind.mode.repeat",
			sticky: "settings.remind.mode.sticky"
		};
		/** One-line explanation of each reminder style. */
		const REMIND_MODE_DESC = {
			once: "settings.remind.mode.onceDesc",
			repeat: "settings.remind.mode.repeatDesc",
			sticky: "settings.remind.mode.stickyDesc"
		};
		/** The three language choices, in display order. */
		const LANGUAGE_OPTIONS = [
			{
				value: "auto",
				labelKey: "settings.language.auto"
			},
			{
				value: "zh",
				labelKey: "settings.language.zh"
			},
			{
				value: "en",
				labelKey: "settings.language.en"
			}
		];
		/**
		* The notification settings section.
		* @param props - section props supplied by the settings slot.
		* @returns the rendered section.
		*/
		function NotifySettingsSection(props) {
			const settings = (0, react.useSyncExternalStore)(props.store.subscribe, props.store.getSnapshot);
			const language = (0, react.useSyncExternalStore)(props.subscribeLanguage, props.language);
			const texts = (0, react.useSyncExternalStore)(props.texts.subscribe, props.texts.getSnapshot);
			const [error, setError] = (0, react.useState)(null);
			const [cache, setCache] = (0, react.useState)(null);
			const [cacheNote, setCacheNote] = (0, react.useState)(null);
			const [library, setLibrary] = (0, react.useState)({
				author: [],
				custom: [],
				ffmpeg: true
			});
			const [libraryNote, setLibraryNote] = (0, react.useState)(null);
			const [soundConfirm, setSoundConfirm] = (0, react.useState)(null);
			const [renaming, setRenaming] = (0, react.useState)(null);
			const [renameDraft, setRenameDraft] = (0, react.useState)("");
			const [soundsOpen, setSoundsOpen] = (0, react.useState)(false);
			const [textsOpen, setTextsOpen] = (0, react.useState)(false);
			const t = props.tr;
			const readCache = props.cacheInfo;
			const wipeCache = props.clearCache;
			const readLibrary = props.loadLibrary;
			const formEnabled = settings.enabled;
			(0, react.useEffect)(() => {
				readCache().then((info) => {
					setCache(info);
				}, () => void 0);
				readLibrary().then((next) => {
					setLibrary(next);
				}, () => void 0);
			}, [readCache, readLibrary]);
			/**
			* The display label of one sound id.
			*
			* Built-ins come from the locale table; a library sound is shown by its file
			* name (without the extension), which is what the picker lists too.
			*/
			const soundLabel = (id) => {
				if (id.startsWith("author:")) {
					const known = AUTHOR_SOUND_KEYS[id];
					if (known !== void 0) return t(known);
					const item = library.author.find((entry) => entry.id === id);
					return item === void 0 ? id : item.name;
				}
				if (id.startsWith("custom:")) {
					const item = library.custom.find((entry) => entry.id === id);
					return item === void 0 ? id : item.name;
				}
				const key = SOUND_LABEL_KEYS[id];
				return t(key ?? "settings.sound.systemDefault");
			};
			/** Reload the library after the folder changed. */
			const refreshLibrary = () => readLibrary().then((next) => {
				setLibrary(next);
			}, () => void 0);
			/** Pick a file, copy it into the custom folder, and reload the list. */
			const addCustomSound = async () => {
				const file = await props.pickFile();
				if (file === "") return;
				const name = await props.importSound(file);
				if (name === null) {
					setError(t("settings.soundLibrary.addFailed"));
					return;
				}
				setError(null);
				setLibraryNote(fmt(t("settings.soundLibrary.added"), { name }));
				await refreshLibrary();
			};
			/** Remove one imported sound after the inline confirmation. */
			const removeCustomSound = async (id) => {
				const removed = await props.deleteSound(id);
				setSoundConfirm(null);
				setLibraryNote(removed ? t("settings.soundLibrary.removed") : t("settings.soundLibrary.addFailed"));
				if (!removed) return;
				const next = { ...settings.sounds };
				let changed = false;
				for (const scenario of SCENARIO_IDS) if (next[scenario] === id) {
					next[scenario] = DEFAULT_SETTINGS.sounds[scenario];
					changed = true;
				}
				if (changed) props.set({ sounds: next });
				await refreshLibrary();
			};
			/** Rename one imported sound and carry the new id into every situation. */
			const commitRename = async (id) => {
				const next = renameDraft.trim();
				if (next === "") {
					setLibraryNote(t("settings.soundLibrary.renameEmpty"));
					return;
				}
				const renamed = await props.renameSound(id, next);
				if (renamed === null) {
					setLibraryNote(t("settings.soundLibrary.renameFailed"));
					return;
				}
				setRenaming(null);
				const nextSounds = { ...settings.sounds };
				let changed = false;
				for (const scenario of SCENARIO_IDS) if (nextSounds[scenario] === id) {
					nextSounds[scenario] = renamed;
					changed = true;
				}
				if (changed) props.set({ sounds: nextSounds });
				setLibraryNote(t("settings.soundLibrary.renamed"));
				await refreshLibrary();
			};
			/**
			* Audition one situation.
			*
			* A library sound that is no longer in the folder (deleted, or the settings
			* outlived the file) must not silently preview the system chime instead.
			*/
			const preview = (scenario) => {
				const sound = settings.sounds[scenario];
				const fromLibrary = sound.startsWith("custom:") || sound.startsWith("author:");
				const known = library.custom.some((item) => item.id === sound) || library.author.some((item) => item.id === sound);
				if (fromLibrary && !known) {
					setError(t("settings.soundLibrary.missing"));
					return;
				}
				setError(null);
				props.previewScenario(scenario);
			};
			/** The label of one situation. */
			const scenarioLabel = (scenario) => t(SCENARIO_LABEL_KEYS[scenario]);
			/** The placeholder values one editor preview renders with. */
			const previewParts = (scenario) => ({
				workspace: t("notify.previewWorkspace"),
				status: t(shortScenarioKey(scenario)),
				body: t("notify.previewSampleBody"),
				minutes: String(settings.remindAfterMinutes)
			});
			/** The body fallback of one situation's built-in wording. */
			const previewFallback = (scenario) => {
				switch (scenario) {
					case "approval":
					case "question":
					case "plan-review": return t("notify.pendingBody");
					case "reminder": return fmt(t("notify.reminderBody"), { minutes: String(settings.remindAfterMinutes) });
					default: return t("notify.emptyBody");
				}
			};
			const visibleScenarios = SCENARIO_IDS.filter((scenario) => scenarioEnabled(settings, scenario));
			const textCount = SCENARIO_IDS.reduce((sum, scenario) => sum + texts[scenario].length, 0);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dsh_notify_section",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_card",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_cardHead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsh_notify_cardHeadText",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh_notify_cardTitle",
										children: t("settings.title")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh_notify_cardDesc",
										children: t("settings.subtitle")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsh_notify_langSwitch",
									role: "group",
									"aria-label": t("settings.language.label"),
									"data-language": language,
									children: LANGUAGE_OPTIONS.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsh_notify_langOption",
										"aria-pressed": settings.language === option.value,
										title: option.value === "auto" ? t("settings.language.autoHint") : void 0,
										onClick: () => {
											props.setLanguage(option.value);
										},
										children: t(option.labelKey)
									}, option.value))
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
								id: "dsh-notify-enabled",
								checked: settings.enabled,
								label: t("settings.enabled"),
								desc: t("settings.enabledDesc"),
								onChange: (checked) => {
									props.set({ enabled: checked });
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_testBlock",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh_notify_button",
									disabled: !formEnabled,
									onClick: () => {
										props.sendTest();
									},
									children: t("settings.test.button")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsh_notify_rowDesc",
									children: t("settings.test.desc")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_modeBlock",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh_notify_modeLabel",
										children: t("settings.mode.label")
									}),
									MODES.map((mode) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: formEnabled ? "dsh_notify_modeRow" : "dsh_notify_modeRow dsh_notify_modeRowDisabled",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: "dsh-notify-mode",
											disabled: !formEnabled,
											checked: settings.mode === mode.value,
											onChange: () => {
												props.set({ mode: mode.value });
											}
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dsh_notify_modeText",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsh_notify_rowLabel",
												children: t(mode.labelKey)
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsh_notify_rowDesc",
												children: t(mode.descKey)
											})]
										})]
									}, mode.value)),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh_notify_rowDesc",
										children: t("settings.mode.desc")
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_card",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_cardTitle",
								children: t("settings.situations.title")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_cardDesc",
								children: t("settings.situations.desc")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_subcard",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh_notify_subcardTitle",
										children: t("settings.situations.turnTitle")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh_notify_rowDesc",
										children: t("settings.situations.turnDesc")
									}),
									OUTCOMES.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
										id: "dsh-notify-" + entry.field,
										checked: settings[entry.field],
										disabled: !formEnabled,
										label: scenarioLabel(entry.scenario),
										desc: t(SCENARIO_EXAMPLE_KEYS[entry.scenario]),
										onChange: (checked) => {
											props.set({ [entry.field]: checked });
										}
									}, entry.field))
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_subcard",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh_notify_subcardTitle",
										children: t("settings.situations.subagentTitle")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh_notify_rowDesc",
										children: t("settings.situations.subagentDesc")
									}),
									SUBAGENT_GEARS.map((gear) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: formEnabled ? "dsh_notify_modeRow" : "dsh_notify_modeRow dsh_notify_modeRowDisabled",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: "dsh-notify-subagent-mode",
											disabled: !formEnabled,
											checked: settings.subagentMode === gear.value,
											onChange: () => {
												props.set({ subagentMode: gear.value });
											}
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dsh_notify_modeText",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsh_notify_rowLabel",
												children: t(gear.labelKey)
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsh_notify_rowDesc",
												children: t(gear.descKey)
											})]
										})]
									}, gear.value))
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_subcard",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh_notify_subcardTitle",
										children: t("settings.situations.pendingTitle")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh_notify_rowDesc",
										children: t("settings.situations.pendingDesc")
									}),
									PENDING.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
										id: "dsh-notify-" + entry.field,
										checked: settings[entry.field],
										disabled: !formEnabled,
										label: scenarioLabel(entry.scenario),
										desc: t(SCENARIO_EXAMPLE_KEYS[entry.scenario]),
										onChange: (checked) => {
											props.set({ [entry.field]: checked });
										}
									}, entry.field))
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_subcard",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh_notify_subcardTitle",
										children: t("settings.situations.viewedTitle")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh_notify_rowDesc",
										children: t("settings.situations.viewedDesc")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
										id: "dsh-notify-notifyViewedUnfocused",
										checked: settings.notifyViewedUnfocused,
										disabled: !formEnabled,
										label: t("settings.situations.viewedLabel"),
										desc: t("settings.situations.viewedLabelDesc"),
										onChange: (checked) => {
											props.set({ notifyViewedUnfocused: checked });
										}
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_card",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_cardTitle",
								children: t("settings.customize.title")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_cardDesc",
								children: t("settings.customize.desc")
							}),
							error === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_error",
								children: error
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_scenarios",
								children: visibleScenarios.map((scenario) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsh_notify_scenarioRow",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsh_notify_scenarioName",
											children: scenarioLabel(scenario)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsh_notify_rowPrefix",
											children: t("settings.scenario.sound")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SoundPicker, {
											value: settings.sounds[scenario],
											library,
											labelOf: soundLabel,
											t,
											disabled: !formEnabled,
											onPick: (chosen) => {
												const nextSounds = {
													...settings.sounds,
													[scenario]: chosen
												};
												props.set({ sounds: nextSounds });
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsh_notify_rowPrefix",
											children: t("settings.scenario.text")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextPicker, {
											value: settings.texts[scenario],
											options: texts[scenario],
											t,
											disabled: !formEnabled,
											onPick: (chosen) => {
												const nextTexts = {
													...settings.texts,
													[scenario]: chosen
												};
												props.set({ texts: nextTexts });
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh_notify_button dsh_notify_scenarioPreview",
											disabled: !formEnabled,
											onClick: () => {
												if (!library.ffmpeg && needsFfmpeg(settings.sounds[scenario])) {
													setError(t("settings.soundLibrary.ffmpegPreview"));
													return;
												}
												preview(scenario);
											},
											children: t("settings.scenario.preview")
										})
									]
								}, scenario))
							}),
							visibleScenarios.includes("reminder") ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_remindBlock",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh_notify_remindRow",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsh_notify_remindLabel",
											children: t("settings.remind.prefix")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsh_notify_remindControl",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												className: "dsh_notify_number",
												type: "number",
												min: 1,
												max: 240,
												disabled: !formEnabled,
												value: settings.remindAfterMinutes,
												onChange: (event) => {
													const next = Number(event.target.value);
													if (Number.isFinite(next)) props.set({ remindAfterMinutes: next });
												}
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsh_notify_remindHint",
												children: t("settings.remind.suffix")
											})]
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh_notify_remindRow",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsh_notify_remindLabel",
											children: t("settings.remind.modeLabel")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsh_notify_remindControl",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
												className: "dsh_notify_select",
												disabled: !formEnabled,
												value: settings.reminderMode,
												onChange: (event) => {
													props.set({ reminderMode: event.target.value });
												},
												children: REMINDER_MODES.map((mode) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: mode,
													children: t(REMIND_MODE_KEYS[mode])
												}, mode))
											}), settings.reminderMode === "repeat" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsh_notify_remindHint",
													children: t("settings.remind.every")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: "dsh_notify_number",
													type: "number",
													min: 1,
													max: 240,
													disabled: !formEnabled,
													value: settings.remindEveryMinutes,
													onChange: (event) => {
														const next = Number(event.target.value);
														if (Number.isFinite(next)) props.set({ remindEveryMinutes: next });
													}
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsh_notify_remindHint",
													children: t("settings.remind.everySuffix")
												})
											] }) : null]
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh_notify_remindDesc",
										children: t(REMIND_MODE_DESC[settings.reminderMode])
									})
								]
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Collapse, {
								id: "dsh-notify-sounds",
								title: t("settings.soundLibrary.title"),
								count: fmt(t("settings.soundLibrary.count"), { count: String(library.custom.length) }),
								open: soundsOpen,
								onToggle: () => {
									setSoundsOpen(!soundsOpen);
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh_notify_customControls",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsh_notify_cacheText",
											children: library.custom.length === 0 ? t("settings.soundLibrary.empty") : fmt(t("settings.soundLibrary.count"), { count: String(library.custom.length) })
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh_notify_button",
											onClick: () => {
												addCustomSound();
											},
											children: t("settings.soundLibrary.add")
										})]
									}),
									library.custom.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
										className: "dsh_notify_soundList",
										children: library.custom.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
											className: "dsh_notify_soundItem",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "dsh_notify_soundItemMain",
												children: renaming === item.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: "dsh_notify_renameInput",
													value: renameDraft,
													maxLength: 60,
													autoFocus: true,
													"aria-label": t("settings.soundLibrary.rename"),
													onChange: (event) => {
														setRenameDraft(event.target.value);
													},
													onKeyDown: (event) => {
														if (event.key === "Enter") commitRename(item.id);
														if (event.key === "Escape") setRenaming(null);
													}
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsh_notify_soundItemName",
													title: item.name,
													children: item.name
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsh_notify_soundItemSize",
													children: formatBytes(item.bytes)
												})] })
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "dsh_notify_soundItemActions",
												children: renaming === item.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "dsh_notify_iconButton",
													onClick: () => {
														commitRename(item.id);
													},
													children: t("settings.soundLibrary.renameSave")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "dsh_notify_iconButton",
													onClick: () => {
														setRenaming(null);
													},
													children: t("settings.textEditor.cancel")
												})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "dsh_notify_iconButton",
													onClick: () => {
														setLibraryNote(null);
														setRenaming(item.id);
														setRenameDraft(item.name);
													},
													children: t("settings.soundLibrary.rename")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "dsh_notify_iconButton dsh_notify_danger",
													onClick: () => {
														setLibraryNote(null);
														setSoundConfirm(item.id);
													},
													children: t("settings.soundLibrary.remove")
												})] })
											})]
										}, item.id))
									}),
									soundConfirm === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh_notify_confirm",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: fmt(t("settings.soundLibrary.removeConfirm"), { name: library.custom.find((item) => item.id === soundConfirm)?.name ?? soundConfirm }) }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "dsh_notify_button dsh_notify_dangerButton",
												onClick: () => {
													if (soundConfirm !== null) removeCustomSound(soundConfirm);
												},
												children: t("settings.textLibrary.delete")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "dsh_notify_button",
												onClick: () => {
													setSoundConfirm(null);
												},
												children: t("settings.textEditor.cancel")
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh_notify_rowDesc",
										children: fmt(t("settings.soundLibrary.desc"), { path: "%LOCALAPPDATA%\\dsh-notify\\custom" })
									}),
									library.ffmpeg ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh_notify_warn",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("settings.soundLibrary.ffmpegMissing") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "dsh_notify_warnHint",
											children: t("settings.soundLibrary.ffmpegInstall")
										})]
									}),
									libraryNote === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh_notify_note",
										children: libraryNote
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh_notify_cacheBlock",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsh_notify_customControls",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsh_notify_soundLabel",
														children: t("settings.cache.label")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsh_notify_cacheText",
														children: cache === null || cache.files === 0 ? t("settings.cache.empty") : fmt(t("settings.cache.inUse"), {
															files: String(cache.files),
															size: formatBytes(cache.bytes)
														})
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dsh_notify_button",
														onClick: () => {
															wipeCache().then((result) => {
																if (result === null) {
																	setCacheNote(t("settings.cache.failed"));
																	return;
																}
																setCache({
																	files: 0,
																	bytes: 0
																});
																setCacheNote(fmt(t("settings.cache.cleared"), {
																	files: String(result.files),
																	size: formatBytes(result.bytes)
																}));
															}, () => void 0);
														},
														children: t("settings.cache.clear")
													})
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "dsh_notify_rowDesc",
												children: t("settings.cache.desc")
											}),
											cacheNote === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "dsh_notify_note",
												children: cacheNote
											})
										]
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Collapse, {
								id: "dsh-notify-texts",
								title: t("settings.textLibrary.title"),
								count: fmt(t("settings.textLibrary.count"), { count: String(textCount) }),
								open: textsOpen,
								onToggle: () => {
									setTextsOpen(!textsOpen);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextManager, {
									scenarios: visibleScenarios,
									library: texts,
									t,
									labelOf: scenarioLabel,
									partsOf: previewParts,
									fallbackOf: previewFallback,
									onSave: (scenario, draft, id) => props.texts.save(scenario, draft, id),
									onDelete: (scenario, id) => props.texts.remove(scenario, id)
								})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_card",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_cardTitle",
								children: t("settings.push.title")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_cardDesc",
								children: t("settings.push.desc")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChannelManager, { t: props.tr })
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/settings.ts
		/**
		* The client-persisted notification preferences: a tiny observable store over
		* localStorage. The host knows nothing of these preferences — the client owns
		* them, and every read is tolerant of a missing or unwritable storage.
		*
		* The stored shape grew twice: an old `soundEnabled` boolean became the
		* delivery `mode`, and the first template iteration's single title/body pair
		* became per-situation text choices. Both migrations happen here, at read time,
		* so no version bump or separate migration step is needed.
		*/
		/** Persist key; the version suffix lets a shape change migrate instead of crash. */
		const PERSIST_KEY = "dsh-notify-desktop.v1";
		/** The ambient storage, or undefined when the embedding has none. */
		function ambientStorage() {
			try {
				return typeof localStorage === "undefined" ? void 0 : localStorage;
			} catch {
				return;
			}
		}
		/** Clamp one stored value back into the settings domain. */
		function clampMinutes(value) {
			if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_SETTINGS.remindAfterMinutes;
			return Math.min(240, Math.max(1, Math.round(value)));
		}
		/** One delivery mode, or the default for anything the catalog does not name. */
		function clampMode(value) {
			return NOTIFY_MODES.includes(value) ? value : DEFAULT_SETTINGS.mode;
		}
		/** One reminder behaviour, or `once` for anything the catalog does not name. */
		function clampReminderMode(value) {
			return REMINDER_MODES.includes(value) ? value : DEFAULT_SETTINGS.reminderMode;
		}
		/** One plugin language, or `auto` for anything the catalog does not name. */
		function clampLanguage(value) {
			return PLUGIN_LANGUAGES.includes(value) ? value : DEFAULT_SETTINGS.language;
		}
		/** One subagent notification mode, or the default for anything unknown. */
		function clampSubagentMode(value) {
			return SUBAGENT_MODES.includes(value) ? value : DEFAULT_SETTINGS.subagentMode;
		}
		/** A library id: what a folder listing produced, and the only ids not in SOUND_IDS. */
		const LIBRARY_ID = /^(?:custom|author):[^\\/:*?"<>|]+$/;
		/**
		* One sound id, or the default for that situation when the stored value is
		* unknown. Library ids (`custom:` / `author:`) are accepted even though they
		* are not in the static catalog: the host's folder listing decides what exists,
		* and rejecting them here silently reset every custom choice back to the
		* default.
		*/
		function clampSound(scenario, value) {
			if (typeof value !== "string") return DEFAULT_SETTINGS.sounds[scenario];
			if (SOUND_IDS.includes(value)) return value;
			return LIBRARY_ID.test(value) ? value : DEFAULT_SETTINGS.sounds[scenario];
		}
		/** Which pre-per-situation group used to feed a situation's sound. */
		const LEGACY_SOUND_GROUP = {
			completed: "finished",
			error: "error",
			aborted: "finished",
			blocked: "finished",
			"max-tokens": "finished",
			approval: "attention",
			question: "attention",
			"plan-review": "attention",
			reminder: "reminder"
		};
		/**
		* Clamp the stored sound map back into the settings domain, situation by
		* situation. A stored value under the new shape wins; otherwise the old
		* four-group value is inherited, which is how a pre-upgrade sound choice
		* survives.
		* @param value - whatever was persisted.
		* @returns a complete map, defaulted per situation.
		*/
		function clampSounds(value) {
			const saved = value ?? {};
			const out = {};
			for (const scenario of SCENARIO_IDS) {
				const direct = saved[scenario];
				const inherited = direct === void 0 ? saved[LEGACY_SOUND_GROUP[scenario]] : void 0;
				out[scenario] = clampSound(scenario, direct === void 0 ? inherited : direct);
			}
			return out;
		}
		/**
		* Clamp the stored text choices: `default` or a template id. Unknown values
		* (including a template deleted while the settings survived) read as the
		* default text; the runner falls back the same way if a chosen id is missing.
		* @param value - whatever was persisted.
		* @returns a complete choice map.
		*/
		function clampTexts(value) {
			const saved = value ?? {};
			const out = {};
			for (const scenario of SCENARIO_IDS) {
				const choice = saved[scenario];
				out[scenario] = choice === "default" || isTemplateId(choice) ? choice : DEFAULT_TEXT_CHOICE;
			}
			return out;
		}
		/**
		* Recover the first template iteration's global pair, when it was customized.
		*
		* That shape stored one title/body pair for every real notification. It is
		* carried in the settings only until the client has written it into each
		* enabled situation's library on disk (the store cannot do that itself: it is
		* synchronous and host-free).
		* @param saved - the parsed persisted payload.
		* @returns the pair to migrate, or null when nothing was customized.
		*/
		function readLegacyTemplates(saved) {
			const title = typeof saved["titleTemplate"] === "string" ? saved["titleTemplate"].trim() : "";
			const body = typeof saved["bodyTemplate"] === "string" ? saved["bodyTemplate"].trim() : "";
			const normalizedTitle = title === "" ? DEFAULT_TITLE_TEMPLATE : title;
			const normalizedBody = body === "" ? DEFAULT_BODY_TEMPLATE : body;
			if (normalizedTitle === "{工作区} · {状态}" && normalizedBody === "{内容}") return null;
			return {
				title: normalizedTitle,
				body: normalizedBody
			};
		}
		/** One boolean field, defaulted when the stored value is not a boolean. */
		function clampBoolean(value, fallback) {
			return typeof value === "boolean" ? value : fallback;
		}
		/**
		* Read the persisted settings, layering them over the defaults so a partial or
		* older payload never yields a half-formed settings object.
		* @param storage - the storage to read (defaults to the ambient localStorage).
		* @returns the effective settings.
		*/
		function readSettings(storage = ambientStorage()) {
			if (storage === void 0) return DEFAULT_SETTINGS;
			try {
				const raw = storage.getItem(PERSIST_KEY);
				if (raw === null) return DEFAULT_SETTINGS;
				const saved = JSON.parse(raw);
				const mode = saved["mode"] === void 0 && saved["soundEnabled"] === false ? "notify" : clampMode(saved["mode"]);
				const legacyText = readLegacyTemplates(saved);
				return {
					enabled: clampBoolean(saved["enabled"], DEFAULT_SETTINGS.enabled),
					mode,
					sounds: clampSounds(saved["sounds"]),
					texts: clampTexts(saved["texts"]),
					legacyText,
					notifyCompleted: clampBoolean(saved["notifyCompleted"], DEFAULT_SETTINGS.notifyCompleted),
					notifyError: clampBoolean(saved["notifyError"], DEFAULT_SETTINGS.notifyError),
					notifyAborted: clampBoolean(saved["notifyAborted"], DEFAULT_SETTINGS.notifyAborted),
					notifyBlocked: clampBoolean(saved["notifyBlocked"], DEFAULT_SETTINGS.notifyBlocked),
					notifyMaxTokens: clampBoolean(saved["notifyMaxTokens"], DEFAULT_SETTINGS.notifyMaxTokens),
					subagentMode: clampSubagentMode(saved["subagentMode"]),
					notifyApproval: clampBoolean(saved["notifyApproval"], DEFAULT_SETTINGS.notifyApproval),
					notifyQuestion: clampBoolean(saved["notifyQuestion"], DEFAULT_SETTINGS.notifyQuestion),
					notifyPlanReview: clampBoolean(saved["notifyPlanReview"], DEFAULT_SETTINGS.notifyPlanReview),
					notifyViewedUnfocused: clampBoolean(saved["notifyViewedUnfocused"], DEFAULT_SETTINGS.notifyViewedUnfocused),
					remindAfterMinutes: clampMinutes(saved["remindAfterMinutes"]),
					reminderMode: clampReminderMode(saved["reminderMode"]),
					remindEveryMinutes: clampMinutes(saved["remindEveryMinutes"]),
					language: clampLanguage(saved["language"])
				};
			} catch {
				return DEFAULT_SETTINGS;
			}
		}
		/**
		* Persist the settings; a storage failure is swallowed (preferences are a
		* convenience, never a correctness requirement).
		* @param settings - the settings to write.
		* @param storage - the storage to write to (defaults to the ambient localStorage).
		*/
		function writeSettings(settings, storage = ambientStorage()) {
			if (storage === void 0) return;
			try {
				storage.setItem(PERSIST_KEY, JSON.stringify(settings));
			} catch {}
		}
		/**
		* Create the settings store backing both the settings section and the
		* notification runner.
		* @param storage - the storage to persist into (defaults to the ambient localStorage).
		* @returns the observable store.
		*/
		function createSettingsStore(storage = ambientStorage()) {
			let snapshot = readSettings(storage);
			const listeners = /* @__PURE__ */ new Set();
			return {
				getSnapshot: () => snapshot,
				subscribe(listener) {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				update(patch) {
					const next = {
						...snapshot,
						...patch,
						mode: patch.mode === void 0 ? snapshot.mode : clampMode(patch.mode),
						subagentMode: patch.subagentMode === void 0 ? snapshot.subagentMode : clampSubagentMode(patch.subagentMode),
						remindAfterMinutes: patch.remindAfterMinutes === void 0 ? snapshot.remindAfterMinutes : clampMinutes(patch.remindAfterMinutes),
						reminderMode: patch.reminderMode === void 0 ? snapshot.reminderMode : clampReminderMode(patch.reminderMode),
						remindEveryMinutes: patch.remindEveryMinutes === void 0 ? snapshot.remindEveryMinutes : clampMinutes(patch.remindEveryMinutes),
						sounds: patch.sounds === void 0 ? snapshot.sounds : clampSounds(patch.sounds),
						texts: patch.texts === void 0 ? snapshot.texts : clampTexts(patch.texts),
						legacyText: patch.legacyText === void 0 ? snapshot.legacyText : patch.legacyText
					};
					snapshot = next;
					writeSettings(next, storage);
					for (const listener of [...listeners]) listener();
				}
			};
		}
		//#endregion
		//#region src/client/texts.ts
		/**
		* The client half of the saved popup texts: a tiny observable cache over the
		* host's template route.
		*
		* The notification path reads this cache synchronously while it composes a
		* toast, so the library is loaded once at start-up and refreshed after every
		* edit. Only the chosen template id lives in the settings; the wording itself
		* lives on disk and is validated by the host.
		*/
		/** Read one stored template defensively. */
		function sanitizeTemplate(value) {
			if (value === null || typeof value !== "object") return null;
			const record = value;
			if (!isTemplateId(record["id"])) return null;
			const name = typeof record["name"] === "string" ? record["name"].trim() : "";
			const title = typeof record["title"] === "string" ? record["title"] : "";
			const body = typeof record["body"] === "string" ? record["body"] : "";
			if (name === "" || title === "" || body === "") return null;
			const updatedAt = typeof record["updatedAt"] === "number" && Number.isFinite(record["updatedAt"]) ? record["updatedAt"] : 0;
			return {
				id: record["id"],
				name,
				title,
				body,
				updatedAt
			};
		}
		/**
		* Turn an arbitrary payload into a complete library: every scenario present,
		* malformed entries dropped, the per-situation cap enforced.
		* @param value - the wire payload's `library` (or anything at all).
		* @returns a safe library, empty when the payload is unusable.
		*/
		function sanitizeTextLibrary(value) {
			const source = value ?? {};
			const library = {};
			for (const scenario of SCENARIO_IDS) {
				const entries = source[scenario];
				const kept = [];
				if (Array.isArray(entries)) for (const entry of entries) {
					const template = sanitizeTemplate(entry);
					if (template === null) continue;
					kept.push(template);
					if (kept.length >= 3) break;
				}
				library[scenario] = kept;
			}
			return library;
		}
		/** Narrow one wire problem string into the store's vocabulary. */
		function asProblem(value) {
			switch (value) {
				case "limit":
				case "scenario":
				case "missing":
				case "io":
				case "name":
				case "title":
				case "body": return value;
				default: return "invalid";
			}
		}
		/** The ambient fetch, or undefined when the embedding has none. */
		function fetchImpl() {
			return typeof fetch === "undefined" ? void 0 : fetch;
		}
		/**
		* Create the library cache.
		* @returns the store; nothing is fetched until {@link TextStore.load} runs.
		*/
		function createTextStore() {
			let snapshot = emptyTextLibrary();
			const listeners = /* @__PURE__ */ new Set();
			const emit = () => {
				for (const listener of [...listeners]) listener();
			};
			const apply = (library) => {
				snapshot = library;
				emit();
				return snapshot;
			};
			return {
				getSnapshot: () => snapshot,
				subscribe(listener) {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				load() {
					const request = fetchImpl();
					if (request === void 0) return Promise.resolve(snapshot);
					return request(TEXT_TEMPLATES_ROUTE, { headers: { [FOCUS_HEADER]: "1" } }).then((response) => response.ok ? response.json() : void 0).then((payload) => {
						const library = payload?.library;
						if (library === void 0) return snapshot;
						return apply(sanitizeTextLibrary(library));
					}, () => snapshot);
				},
				save(scenario, draft, id) {
					const request = fetchImpl();
					if (request === void 0) return Promise.resolve({
						ok: false,
						problem: "unreachable"
					});
					const body = JSON.stringify(id === void 0 ? {
						action: "save",
						scenario,
						template: draft
					} : {
						action: "save",
						scenario,
						id,
						template: draft
					});
					return request(TEXT_TEMPLATES_ROUTE, {
						method: "POST",
						headers: {
							[FOCUS_HEADER]: "1",
							"content-type": "application/json"
						},
						body
					}).then((response) => response.ok ? response.json() : void 0).then((payload) => {
						const result = payload;
						if (result?.ok !== true) return {
							ok: false,
							problem: asProblem(result?.problem)
						};
						const library = sanitizeTextLibrary(result.library);
						apply(library);
						const template = sanitizeTemplate(result.template);
						if (template === null) return {
							ok: false,
							problem: "invalid"
						};
						return {
							ok: true,
							template
						};
					}, () => ({
						ok: false,
						problem: "unreachable"
					}));
				},
				remove(scenario, id) {
					const request = fetchImpl();
					if (request === void 0) return Promise.resolve({
						ok: false,
						problem: "unreachable"
					});
					return request(TEXT_TEMPLATES_ROUTE, {
						method: "POST",
						headers: {
							[FOCUS_HEADER]: "1",
							"content-type": "application/json"
						},
						body: JSON.stringify({
							action: "delete",
							scenario,
							id
						})
					}).then((response) => response.ok ? response.json() : void 0).then((payload) => {
						const result = payload;
						if (result?.ok !== true) return {
							ok: false,
							problem: asProblem(result?.problem)
						};
						apply(sanitizeTextLibrary(result.library));
						return { ok: true };
					}, () => ({
						ok: false,
						problem: "unreachable"
					}));
				}
			};
		}
		//#endregion
		//#region src/client/styles.ts
		/**
		* The settings-section stylesheet. The web server serves exactly one file per
		* client plugin, so the CSS ships inside the bundle and is injected once.
		*/
		/** Stable `<style>` id (idempotent across hot reloads). */
		const STYLE_ID = "dsh-notify-desktop-style";
		/** The section's stylesheet text. */
		const cssText = `
.dsh_notify_section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  /* Option A: follow the DSH theme font (the user's own text-font setting). */
  font-family: var(--dsw-font-family, inherit);
}
.dsh_notify_card {
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.24));
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dsh_notify_cardTitle { font-weight: 600; font-size: 13px; }
.dsh_notify_cardDesc { font-size: 12px; opacity: 0.78; line-height: 1.55; }
/*
 * Card header: title and description on the left, the plugin's own language
 * switch on the right. It wraps instead of squeezing the title on a narrow
 * settings panel.
 */
.dsh_notify_cardHead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.dsh_notify_cardHeadText { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1 1 220px; }
.dsh_notify_langSwitch {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.06));
  flex: 0 0 auto;
}
.dsh_notify_langOption {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 11px;
  line-height: 1.4;
  padding: 3px 9px;
  border-radius: 999px;
  cursor: pointer;
  opacity: 0.7;
  white-space: nowrap;
}
.dsh_notify_langOption:hover { opacity: 1; background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.14)); }
.dsh_notify_langOption[aria-pressed='true'] {
  opacity: 1;
  font-weight: 600;
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.18));
  box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.32));
}
.dsh_notify_row { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; }
.dsh_notify_row input[type='checkbox'] { margin-top: 2px; }
.dsh_notify_rowText { display: flex; flex-direction: column; gap: 2px; }
/* Only the checkbox and this label toggle a row; the rest of the row does not. */
.dsh_notify_rowLabel { cursor: pointer; }
.dsh_notify_error { color: #e5484d; font-size: 12px; line-height: 1.5; }
.dsh_notify_note { color: #3dd68c; font-size: 12px; line-height: 1.5; }
/* A missing optional dependency: readable, but unmistakably not a success note. */
.dsh_notify_warn {
  color: #f5a524;
  font-size: 12px;
  line-height: 1.55;
  margin-top: 6px;
  padding-left: 8px;
  border-left: 2px solid rgba(245, 165, 36, 0.45);
}
.dsh_notify_warnHint { opacity: 0.85; margin-top: 2px; }
/*
 * The reminder block: a label column, then the controls. Both rows share the
 * column so the delay box and the style box line up, and both controls are one
 * style — the user read the old 11px dim select as a different kind of control.
 */
.dsh_notify_remindBlock { display: flex; flex-direction: column; gap: 9px; padding: 4px 0 2px; }
.dsh_notify_remindRow {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.dsh_notify_remindLabel { opacity: 0.9; }
.dsh_notify_remindControl {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}
.dsh_notify_remindHint { font-size: 12.5px; opacity: 0.82; line-height: 1.5; }
.dsh_notify_remindDesc {
  font-size: 12px;
  opacity: 0.74;
  line-height: 1.55;
  padding-left: 74px;
}
/* One box style for every numeric field and the style selector. */
.dsh_notify_number,
.dsh_notify_select {
  font: inherit;
  font-size: 13px;
  color: inherit;
  background: transparent;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  border-radius: 8px;
  padding: 4px 8px;
  height: 30px;
  box-sizing: border-box;
}
.dsh_notify_number { width: 72px; font-variant-numeric: tabular-nums; }
.dsh_notify_select {
  min-width: 128px;
  padding-right: 26px;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%238f8f8f' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 9px center;
}
.dsh_notify_number:focus,
.dsh_notify_select:focus {
  outline: none;
  border-color: var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.55));
}
.dsh_notify_number:disabled,
.dsh_notify_select:disabled { opacity: 0.5; cursor: default; }
.dsh_notify_select option { color: initial; }
/* Inline rename field: sits where the row's name sits, so the list does not jump. */
.dsh_notify_renameInput {
  flex: 1 1 auto;
  min-width: 0;
  font: inherit;
  font-size: 12.5px;
  color: inherit;
  background: transparent;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  border-radius: 8px;
  padding: 4px 8px;
}
.dsh_notify_renameInput:focus {
  outline: none;
  border-color: var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.55));
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.06));
}
.dsh_notify_cacheText { flex: 1 1 auto; font-size: 12px; opacity: 0.8; font-variant-numeric: tabular-nums; }
.dsh_notify_rowDesc { font-size: 12px; opacity: 0.74; line-height: 1.55; }
.dsh_notify_rowPrefix { font-size: 11px; opacity: 0.62; }
.dsh_notify_button {
  align-self: flex-start;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.35;
}
.dsh_notify_button:hover { background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12)); }

/*
 * Card 1: the test button sits directly under the master switch, then the
 * delivery modes as one radio row each.
 */
.dsh_notify_testBlock { display: flex; flex-direction: column; gap: 4px; padding-left: 0; }
.dsh_notify_modeBlock { display: flex; flex-direction: column; gap: 6px; }
.dsh_notify_modeLabel { font-weight: 600; font-size: 13px; }
.dsh_notify_modeRow { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; }
.dsh_notify_modeRow input[type='radio'] { margin-top: 3px; }
.dsh_notify_modeText { display: flex; flex-direction: column; gap: 2px; }


/*
 * Card 2: one row per situation — name, sound picker, text picker, preview.
 * The pickers shrink to 118px here so the three controls and the preview fit
 * the settings panel on one line.
 */
.dsh_notify_scenarios { display: flex; flex-direction: column; }
.dsh_notify_card .dsh_notify_scenarioRow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 118px auto 118px 64px;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  min-height: 38px;
}
.dsh_notify_card .dsh_notify_scenarioRow + .dsh_notify_scenarioRow {
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.16));
}
.dsh_notify_scenarioName { font-size: 13px; line-height: 1.4; }
.dsh_notify_card .dsh_notify_scenarioRow .dsh_notify_pickerTrigger {
  width: 118px;
  min-width: 118px;
  max-width: 118px;
}
.dsh_notify_card .dsh_notify_scenarioPreview {
  width: 64px;
  height: 30px;
  padding: 0;
  font-size: 12px;
  line-height: 28px;
  text-align: center;
  align-self: center;
}

/* The two collapsible libraries. */
.dsh_notify_card .dsh_notify_collapse {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 10px;
  margin-top: 2px;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.16));
}
.dsh_notify_collapseHeader {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  align-self: flex-start;
}
.dsh_notify_collapseLabel { font-weight: 600; font-size: 13px; }
.dsh_notify_collapseCount { font-size: 12px; opacity: 0.6; }
.dsh_notify_collapseBody { display: flex; flex-direction: column; gap: 8px; padding-left: 16px; }
.dsh_notify_cacheBlock {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 10px;
  margin-top: 4px;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.16));
}
.dsh_notify_card .dsh_notify_soundLabel { font-size: 13px; line-height: 1.4; }
.dsh_notify_card .dsh_notify_customControls { display: flex; align-items: center; gap: 8px; }
.dsh_notify_card .dsh_notify_customControls .dsh_notify_button {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  white-space: nowrap;
  flex: 0 0 auto;
}
/* The imported-sound and saved-text lists: one quiet row per entry. */
.dsh_notify_soundList {
  list-style: none;
  margin: 2px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 210px;
  overflow-y: auto;
}
/*
 * One imported sound: the name and the size on the first line, its two actions
 * on a second line. A single line cannot hold a long file name next to both
 * buttons without the buttons collapsing into a full-width block.
 */
.dsh_notify_card .dsh_notify_soundItem {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 7px;
  font-size: 12px;
  border: 1px solid transparent;
}
.dsh_notify_card .dsh_notify_soundItem:hover {
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.1));
  border-color: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
}
.dsh_notify_soundItemMain {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}
.dsh_notify_soundItemName {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  line-height: 1.45;
}
.dsh_notify_soundItemSize {
  flex: 0 0 auto;
  font-size: 11px;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}
.dsh_notify_soundItemActions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dsh_notify_soundItemActions .dsh_notify_iconButton { flex: 0 0 auto; }
.dsh_notify_card .dsh_notify_iconButton {
  height: 24px;
  padding: 0 8px;
  font-size: 11px;
  line-height: 22px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.75;
}
.dsh_notify_card .dsh_notify_iconButton:hover { opacity: 1; background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12)); }

/* Delete is the one destructive action on the page: red, and confirmed inline. */
.dsh_notify_card .dsh_notify_iconButton.dsh_notify_danger { color: #e5484d; border-color: rgba(229, 72, 77, 0.4); opacity: 0.9; }
.dsh_notify_card .dsh_notify_iconButton.dsh_notify_danger:hover { background: rgba(229, 72, 77, 0.12); opacity: 1; }
.dsh_notify_button.dsh_notify_dangerButton { color: #e5484d; border-color: rgba(229, 72, 77, 0.55); }
.dsh_notify_button.dsh_notify_dangerButton:hover { background: rgba(229, 72, 77, 0.12); }
.dsh_notify_confirm {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 7px;
  border: 1px solid rgba(229, 72, 77, 0.35);
  background: rgba(229, 72, 77, 0.08);
  font-size: 12px;
  line-height: 1.5;
}
.dsh_notify_confirm .dsh_notify_button { height: 26px; padding: 0 10px; font-size: 12px; }

/* The external-push channel list: one row per channel, actions pushed right. */
.dsh_notify_card .dsh_notify_pushList {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dsh_notify_card .dsh_notify_pushItem {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 7px;
  font-size: 12px;
  border: 1px solid transparent;
}
.dsh_notify_card .dsh_notify_pushItem:hover {
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.1));
  border-color: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
}
.dsh_notify_pushItem .dsh_notify_rowLabel { font-size: 12.5px; }
.dsh_notify_pushItem .dsh_notify_rowDesc { opacity: 0.7; }
.dsh_notify_pushActions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.dsh_notify_pushForm {
  margin-top: 10px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.22));
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.06));
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dsh_notify_pushFormRow { display: flex; align-items: center; gap: 10px; }
.dsh_notify_pushFormLabel { flex: 0 0 132px; font-size: 12px; opacity: 0.8; }
.dsh_notify_pushFormRow .dsh_notify_renameInput { flex: 1 1 auto; }
.dsh_notify_pushScenarios { flex: 1 1 auto; display: flex; flex-wrap: wrap; gap: 6px 12px; }
.dsh_notify_pushScenario { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; }

/*
 * The two-level pickers: the trigger keeps the old select's footprint, the
 * panel floats above the card with the section headers as level one.
 */
.dsh_notify_picker { position: relative; display: flex; }
.dsh_notify_card .dsh_notify_pickerTrigger {
  width: 148px;
  height: 30px;
  margin: 0;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  background-color: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.08));
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color 120ms ease, background-color 120ms ease;
}
.dsh_notify_card .dsh_notify_pickerTrigger:hover {
  border-color: var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.45));
  background-color: var(--dsw-alias-bg-layer-3, rgba(127, 127, 127, 0.14));
}
.dsh_notify_card .dsh_notify_pickerTrigger:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, rgba(77, 107, 254, 0.6));
  outline-offset: 1px;
}
.dsh_notify_pickerValue { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh_notify_pickerCaret {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  margin-top: -3px;
  border-right: 1.6px solid currentColor;
  border-bottom: 1.6px solid currentColor;
  transform: rotate(45deg);
  opacity: 0.6;
}
.dsh_notify_pickerPanel {
  position: absolute;
  z-index: 40;
  top: calc(100% + 6px);
  right: 0;
  width: 240px;
  max-height: 330px;
  overflow-y: auto;
  padding: 6px;
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  background: var(--dsw-alias-bg-layer-1, #1b1d22);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.45);
}
.dsh_notify_card .dsh_notify_pickerHeader {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.dsh_notify_card .dsh_notify_pickerHeader:hover { background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12)); }
/* The text picker's two headers are plain labels, not expanders. */
.dsh_notify_card .dsh_notify_pickerHeaderStatic { cursor: default; }
.dsh_notify_card .dsh_notify_pickerHeaderStatic:hover { background: transparent; }
.dsh_notify_pickerHeaderLabel { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh_notify_pickerCount { opacity: 0.62; font-variant-numeric: tabular-nums; }
.dsh_notify_pickerCaretSmall {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(-45deg);
  opacity: 0.65;
  transition: transform 120ms ease;
}
.dsh_notify_pickerCaretSmall[data-open='true'] { transform: rotate(45deg); }
.dsh_notify_pickerList {
  list-style: none;
  margin: 2px 0 4px;
  padding: 0 0 0 12px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.dsh_notify_card .dsh_notify_pickerOption {
  width: 100%;
  height: 26px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh_notify_card .dsh_notify_pickerOption:hover { background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.14)); }
.dsh_notify_card .dsh_notify_pickerOption.is-selected {
  color: var(--dsw-alias-brand-primary, #6b8afd);
  font-weight: 600;
}
.dsh_notify_pickerEmpty { padding: 2px 8px 8px 20px; font-size: 12px; opacity: 0.68; }
.dsh_notify_textPanel { width: 230px; }

/* The saved-text manager and its inline editor. */
.dsh_notify_textManager { display: flex; flex-direction: column; gap: 2px; }
/* One situation: a single compact header row (name + count + New text), then
   its saved rows and, while open, the inline editor. */
.dsh_notify_textGroup {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 0;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.12));
}
.dsh_notify_textGroup:first-child { border-top: 0; padding-top: 0; }
.dsh_notify_textGroupHeader { display: flex; align-items: center; gap: 8px; min-height: 24px; }
.dsh_notify_textGroupName { font-size: 13px; font-weight: 600; line-height: 20px; }
.dsh_notify_textGroupCount { font-size: 11px; opacity: 0.62; font-variant-numeric: tabular-nums; }
.dsh_notify_card .dsh_notify_textGroupAdd {
  margin-left: auto;
  height: 24px;
  padding: 0 10px;
  font-size: 11px;
  line-height: 22px;
  align-self: center;
}
.dsh_notify_textList { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.dsh_notify_card .dsh_notify_textItem {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 2px 8px;
  border-radius: 7px;
  font-size: 12px;
  line-height: 20px;
  border: 1px solid transparent;
}
.dsh_notify_card .dsh_notify_textItem:hover {
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.1));
  border-color: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
}
.dsh_notify_textItemName { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.dsh_notify_textItemBody { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.78; }
.dsh_notify_editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.06));
}
.dsh_notify_editorRow { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; align-items: center; gap: 8px; }
.dsh_notify_editorLabel { font-size: 12px; opacity: 0.82; }
.dsh_notify_editorCount {
  font-family: var(--ds-font-family-code, "Cascadia Mono", Consolas, "Noto Sans SC", monospace);
  font-size: 11px;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}
.dsh_notify_textInput {
  flex: 1 1 auto;
  min-width: 0;
  height: 28px;
  margin: 0;
  padding: 0 8px;
  font-size: 12px;
  border-radius: 7px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  background: transparent;
  color: inherit;
}
/* The template fields are half-mono: placeholders line up and braces read clearly. */
.dsh_notify_card .dsh_notify_mono,
.dsh_notify_textInput.dsh_notify_mono {
  font-family: var(--ds-font-family-code, "Cascadia Mono", Consolas, "Noto Sans SC", monospace);
  font-variant-numeric: tabular-nums;
}
.dsh_notify_textArea {
  min-width: 0;
  padding: 6px 8px;
  font-size: 12px;
  font-family: inherit;
  border-radius: 7px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  background: transparent;
  color: inherit;
  resize: vertical;
}
/* The placeholder list: a chip per token and its explanation, aligned in two columns. */
.dsh_notify_editorPlaceholders { display: flex; flex-direction: column; gap: 6px; }
.dsh_notify_placeholderHints {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  align-items: center;
  gap: 4px 10px;
  padding: 8px 10px;
  border-radius: 7px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.05));
}
.dsh_notify_placeholderHint { display: contents; }
.dsh_notify_placeholderHint .dsh_notify_chip { justify-self: start; }
.dsh_notify_placeholderHintText { font-size: 11px; line-height: 1.55; opacity: 0.7; }
.dsh_notify_chip {
  padding: 2px 8px;
  font-family: var(--ds-font-family-code, "Cascadia Mono", Consolas, "Noto Sans SC", monospace);
  font-size: 11px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.dsh_notify_chip:hover { background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12)); }
.dsh_notify_editorPreview {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 10px;
  border-radius: 7px;
  border: 1px dashed var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
}
.dsh_notify_previewTitle { font-size: 13px; font-weight: 600; }
.dsh_notify_previewBody { font-size: 12px; opacity: 0.8; line-height: 1.5; }
.dsh_notify_editorActions { display: flex; gap: 8px; }

/* Card 3: the two situation groups, each row carrying its example sentence. */
.dsh_notify_subcard {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
}
.dsh_notify_subcardTitle { font-weight: 600; font-size: 13px; }

/*
 * Greys: the master switch off disables every delivery control — disabled, not
 * hidden, so the chosen values stay visible.
 */
.dsh_notify_button[disabled],
.dsh_notify_card .dsh_notify_scenarioRow .dsh_notify_scenarioPreview[disabled],
.dsh_notify_card .dsh_notify_pickerTrigger[disabled] {
  opacity: 0.45;
  cursor: not-allowed;
}
.dsh_notify_button[disabled]:hover,
.dsh_notify_card .dsh_notify_scenarioRow .dsh_notify_scenarioPreview[disabled]:hover,
.dsh_notify_card .dsh_notify_pickerTrigger[disabled]:hover {
  background: transparent;
  border-color: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
}
.dsh_notify_modeRow input[type='radio']:disabled,
.dsh_notify_row input[type='checkbox']:disabled {
  opacity: 0.45;
}
/* Text beside a control the master switch disabled: dimmed through the label
   and the description only, so the checkbox keeps its own single dimming. */
.dsh_notify_rowDisabled .dsh_notify_rowLabel,
.dsh_notify_rowDisabled .dsh_notify_rowDesc,
.dsh_notify_modeRowDisabled .dsh_notify_rowLabel,
.dsh_notify_modeRowDisabled .dsh_notify_rowDesc {
  opacity: 0.5;
}
`;
		/**
		* Inject the stylesheet once.
		* @param doc - the document to inject into (defaults to the ambient one).
		*/
		function adoptStyles(doc = typeof document === "undefined" ? void 0 : document) {
			if (doc === void 0) return;
			if (doc.getElementById("dsh-notify-desktop-style") !== null) return;
			const style = doc.createElement("style");
			style.id = STYLE_ID;
			style.textContent = cssText;
			doc.head.appendChild(style);
		}
		//#endregion
		//#region src/client/index.ts
		/**
		* Required client services: the session list, the slot registry, the locale
		* registry, and the remote channel that forwards questions.
		*/
		const inject = [
			"sessions",
			"slots",
			"locale"
		];
		/** How often unanswered waits are re-checked, in milliseconds. */
		const REMINDER_TICK_MS = 3e4;
		/** How often the client polls the host's question queue, in milliseconds. */
		const QUESTION_POLL_MS = 2e3;
		/** The identity of one tracked wait. */
		function waitKey(sessionId, requestId) {
			return sessionId + ":" + requestId;
		}
		/**
		* Compose the notification surface.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			adoptStyles();
			report("client bundle loaded");
			ensureNotificationPermission().then((permission) => {
				report("notification permission=" + permission);
			});
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-notify-desktop: dictionaries");
			const store = createSettingsStore();
			/** The DSH interface locale id, which the `auto` language choice follows. */
			const activeLocale = () => {
				try {
					return ctx.locale.getSnapshot().active;
				} catch {
					return "en";
				}
			};
			/** The language the plugin's own copy uses right now. */
			const language = () => resolveLanguage(store.getSnapshot().language, activeLocale());
			const t = createTranslator(language);
			const texts = createTextStore();
			const set = (patch) => {
				store.update(patch);
				if (patch.enabled === false || patch.mode === "notify") silenceSounds();
			};
			const sessions = ctx.get("sessions");
			const workspace = ctx.get("uiWorkspace");
			const recent = /* @__PURE__ */ new Map();
			/**
			* The session the user is currently viewing: the last one they opened in the
			* sidebar. DSH exposes no "currently open session" signal, so we learn it by
			* observing `openSession`. Until the first navigation it is undefined, and the
			* per-session muting rule then simply does nothing.
			*/
			let activeSessionId = void 0;
			/**
			* Extract a session id from an `openSession` argument (a bare id, or a
			* subagent address carrying one) and remember it as the viewed session.
			* @param target - the argument the workspace service was called with.
			*/
			const trackViewedSession = (target) => {
				const id = typeof target === "string" ? target : target !== null && typeof target === "object" && typeof target.sessionId === "string" ? target.sessionId : void 0;
				if (id !== void 0) activeSessionId = id;
			};
			if (workspace !== void 0 && typeof workspace.openSession === "function") {
				const originalOpen = workspace.openSession.bind(workspace);
				try {
					Object.defineProperty(workspace, "openSession", {
						configurable: true,
						writable: true,
						value: (target) => {
							trackViewedSession(target);
							originalOpen(target);
						}
					});
				} catch {
					report("could not observe openSession; viewed-session muting disabled");
				}
			}
			/** Last logged projection shape per session (diagnostics only). */
			const seenShape = /* @__PURE__ */ new Map();
			const observedTurn = /* @__PURE__ */ new Map();
			const knownPending = /* @__PURE__ */ new Map();
			const waits = /* @__PURE__ */ new Map();
			/** Highest question sequence already handled from the host queue. */
			let questionSeq = 0;
			/**
			* The workspace label of a session, for a toast title.
			* @param sessionId - the session to name.
			* @returns the workspace name, the session display title, or an empty string.
			*/
			const sessionLabel = (sessionId) => {
				const row = sessions.list.getSnapshot().byId[sessionId];
				return workspaceName(row?.cwd) || row?.displayTitle || "";
			};
			const activate = (sessionId) => {
				activateSession({
					focusWindow: () => focusWindowRequest(),
					openSession: (id) => workspace?.openSession?.(id)
				}, sessionId);
			};
			/** Whether a session is a delegated child (a `subagent` row on the list). */
			const isSubagentSession = (sessionId) => {
				return sessions.list.getSnapshot().byId[sessionId]?.origin === "subagent";
			};
			/**
			* Compose one situation's popup text: its chosen template, or the built-in
			* one when the choice is `default` or the saved template vanished.
			* @param scenario - the situation being announced.
			* @param parts - the live placeholder values.
			* @param fallbackBody - the line used when the body has no content at all.
			* @returns the title and body to hand to the toast layer.
			*/
			const textFor = (scenario, parts, fallbackBody) => {
				const choice = store.getSnapshot().texts[scenario];
				const template = choice === "default" ? void 0 : templateOf(texts.getSnapshot(), scenario, choice);
				if (choice !== "default" && template === void 0) report("text template missing: " + scenario + " " + choice + " -> default");
				return {
					title: renderTitle(template === void 0 ? DEFAULT_TITLE_TEMPLATE : template.title, parts),
					body: renderBody(template === void 0 ? DEFAULT_BODY_TEMPLATE : template.body, parts, fallbackBody)
				};
			};
			/**
			* The body fallback of one situation's built-in wording: the line shown when
			* a template's `{内容}` has nothing to fill in.
			* @param scenario - the situation.
			* @returns the fallback line.
			*/
			const fallbackBodyOf = (scenario) => {
				switch (scenario) {
					case "completed":
					case "error":
					case "aborted":
					case "blocked":
					case "max-tokens": return t("notify.emptyBody");
					case "approval":
					case "question":
					case "plan-review": return t("notify.pendingBody");
					case "reminder": return fmt(t("notify.reminderBody"), { minutes: String(store.getSnapshot().remindAfterMinutes) });
				}
			};
			/**
			* Mirror one situation out to the external channels (Bark / Telegram / …).
			*
			* It rides the same decision that raised the toast, so it fires exactly when
			* the toast would (never while the window is focused, per the subagent gears,
			* or for a muted viewed session) — pushing to the phone only when the user is
			* away. The title/body come from the same template the toast uses. Level is a
			* coarse severity for the channels that rank messages.
			* @param scenario - the situation being announced.
			* @param parts - the live placeholder values.
			* @param fallbackBody - the line used when the body has no content.
			*/
			const emitExternal = (scenario, parts, fallbackBody) => {
				const text = textFor(scenario, parts, fallbackBody);
				const level = scenario === "error" ? "error" : scenario === "approval" || scenario === "question" || scenario === "plan-review" || scenario === "reminder" ? "warning" : "info";
				pushNotification({
					title: text.title,
					body: text.body,
					level,
					scenario,
					source: parts.workspace,
					timestamp: Date.now(),
					vars: {
						"工作区": parts.workspace,
						"状态": parts.status,
						"内容": parts.body,
						"分钟": parts.minutes ?? ""
					}
				});
			};
			/**
			* Move the first template iteration's global title/body pair into the saved
			* text library: one template per enabled situation, selected for it.
			*
			* The pair lived in the settings; its content belongs on disk now. Running
			* this at start-up (after the library has loaded) keeps the migration out of
			* the synchronous settings reader, and leaving `legacyText` in place until it
			* succeeds makes a failed host call retry on the next launch.
			*/
			const migrateLegacyText = async () => {
				const settings = store.getSnapshot();
				const legacy = settings.legacyText;
				if (legacy === null) return;
				const name = t("notify.legacyTextName");
				const nextTexts = { ...settings.texts };
				let migrated = 0;
				for (const scenario of SCENARIO_IDS) {
					if (!scenarioEnabled(settings, scenario)) continue;
					const library = texts.getSnapshot();
					const existing = library[scenario].find((entry) => entry.title === legacy.title && entry.body === legacy.body);
					if (existing !== void 0) {
						if (nextTexts[scenario] === "default") nextTexts[scenario] = existing.id;
						continue;
					}
					if (library[scenario].length >= 3) continue;
					const saved = await texts.save(scenario, {
						name,
						title: legacy.title,
						body: legacy.body
					});
					if (!saved.ok) {
						report("legacy text migration failed: " + scenario + " " + saved.problem);
						return;
					}
					nextTexts[scenario] = saved.template.id;
					migrated += 1;
				}
				store.update({
					texts: nextTexts,
					legacyText: null
				});
				report("legacy text migrated into " + String(migrated) + " situation(s)");
			};
			/**
			* Decide one ask, show its toast, and start tracking its wait.
			*
			* Both sources funnel through here: the projection (approvals and tool-call
			* questions) and the host's question queue (service-level asks such as the
			* plan review). One ask can arrive from both, so the shared key decides which
			* source gets to toast.
			* @param ask - the ask to consider.
			*/
			const notifyAsk = (ask) => {
				const settings = store.getSnapshot();
				const now = Date.now();
				const focused = isFocused();
				const sessionOrigin = ask.sessionOrigin ?? (isSubagentSession(ask.sessionId) ? "subagent" : void 0);
				const silencedChild = sessionOrigin === "subagent" && settings.subagentMode === "silent";
				const where = ask.kind + " " + ask.requestId + " (" + ask.source + ")";
				const shared = askKey(ask.summary);
				if (ask.kind !== "approval" && recentlyKeyed(recent, shared, now, 5e3)) {
					report("pending " + where + " twin of the other source -> suppressed");
					return;
				}
				const decision = decideNotification({
					settings,
					trigger: {
						kind: "pending",
						pending: ask.kind
					},
					sessionId: ask.sessionId,
					...sessionOrigin === void 0 ? {} : { sessionOrigin },
					...activeSessionId === void 0 ? {} : { activeSessionId },
					focused,
					dedupeKey: ask.sessionId + ":request:" + ask.requestId,
					now,
					recent
				});
				if (!silencedChild) waits.set(waitKey(ask.sessionId, ask.requestId), {
					key: waitKey(ask.sessionId, ask.requestId),
					sessionId: ask.sessionId,
					requestId: ask.requestId,
					kind: ask.kind,
					summary: ask.summary,
					firstSeenAt: ask.firstSeenAt,
					reminded: false,
					lastRemindedAt: 0
				});
				const mutedViewed = decision === null && !settings.notifyViewedUnfocused && activeSessionId !== void 0 && ask.sessionId === activeSessionId;
				const delivery = decision === null ? silencedChild ? "suppressed (subagent silent)" : mutedViewed ? "suppressed (viewed session)" : "suppressed" : isSoundOnly(settings) ? "sound-only" : "toast";
				report("pending " + where + " focused=" + String(focused) + " -> " + delivery);
				if (decision === null) return;
				const scenario = scenarioOfPending(ask.kind);
				const parts = {
					workspace: ask.label,
					status: t(shortScenarioKey(scenario)),
					body: plainSummary(ask.summary)
				};
				emitExternal(scenario, parts, fallbackBodyOf(scenario));
				if (isSoundOnly(settings)) playSoundOnly(decision.sound);
				else {
					const text = textFor(scenario, parts, fallbackBodyOf(scenario));
					showToast({
						title: text.title,
						body: text.body,
						tag: pendingTag(ask.sessionId, ask.requestId),
						sound: decision.sound,
						onClick: ask.sessionId === "" ? () => {
							focusWindowRequest();
						} : () => {
							activate(ask.sessionId);
						}
					});
				}
				rememberDecision(recent, ask.sessionId + ":request:" + ask.requestId, now);
				if (ask.kind !== "approval") rememberDecision(recent, shared, now);
			};
			/**
			* The host's OS-level answer to "is our window the foreground window?".
			*
			* `document.hasFocus()` alone is not enough: measured twice in six seconds it
			* claimed "unfocused" while the user was looking at the window, and every
			* toast that decision produced was one the user was already staring at. When
			* the document says unfocused the host's answer gets the final say.
			*/
			let hostFocused = false;
			/**
			* When the document last held focus.
			*
			* The document loses focus for reasons that do not mean the user left — the
			* question view and the settings panel are separate views — so a focus the
			* document held moments ago still counts as "the user is here". The cost is a
			* notification raised in the first seconds after the user really does switch
			* away being suppressed, which is the harmless direction.
			*/
			let lastFocusAt = 0;
			/** How long a document focus keeps counting after the document lost it. */
			const FOCUS_GRACE_MS = 5e3;
			/** Whether the user is plausibly looking at the app right now. */
			const isFocused = () => typeof document !== "undefined" && document.hasFocus() || hostFocused || Date.now() - lastFocusAt < FOCUS_GRACE_MS;
			/**
			* Ask the host for the OS-level answer and remember it.
			* @param fresh - bypass the host's cache (the window just lost focus).
			*/
			const refreshHostFocus = (fresh = false) => {
				appWindowFocused(fresh).then((focused) => {
					hostFocused = focused;
				}, () => void 0);
			};
			/**
			* The name a notification shows for one session.
			*
			* The workspace (recognisable) rather than the session's DSH-generated
			* one-word title. Computed only when a toast is actually composed.
			* @param summary - the session row.
			* @returns the display name, or '' when the row carries none.
			*/
			const toastNameOf = (summary) => workspaceName(summary.cwd) || summary.displayTitle || summary.title || "";
			const tick = () => {
				const state = sessions.list.getSnapshot();
				const settings = store.getSnapshot();
				const now = Date.now();
				const focused = isFocused();
				for (const id of state.ids) {
					const summary = state.byId[id];
					if (summary === void 0) continue;
					const sessionOrigin = summary.origin;
					const projection = summary.projectionValues?.[NOTIFY_PROJECTION_KEY];
					const shape = projection === void 0 ? "absent" : projection.turn + "/" + projection.reason + "/pending:" + String(projection.pending.length);
					if (projection !== void 0 && seenShape.get(id) !== shape) {
						seenShape.set(id, shape);
						const ownList = projection.pending.map((entry) => entry.kind + ":" + entry.requestId).join("|");
						report("scan " + id.slice(0, 12) + " projection=" + shape + " own=[" + ownList + "] focused=" + String(focused));
					}
					const advanced = turnAdvance(observedTurn.get(id), projection);
					observedTurn.set(id, advanced.nextTurn);
					const turnIsFresh = projection !== void 0 && isFresh(projection.updatedAt, now);
					if (advanced.fresh && projection !== void 0 && !turnIsFresh) report("turn " + String(projection.turn) + " reason=" + String(projection.reason) + " stale (" + String(Math.max(0, Math.round((now - projection.updatedAt) / 1e3))) + "s old) -> suppressed");
					if (advanced.fresh && projection !== void 0 && turnIsFresh) {
						const reason = asReason(projection.reason);
						const dedupeKey = id + ":turn:" + String(projection.turn);
						const decision = reason === void 0 ? null : decideNotification({
							settings,
							trigger: {
								kind: "turn",
								reason
							},
							sessionId: id,
							...sessionOrigin === void 0 ? {} : { sessionOrigin },
							...activeSessionId === void 0 ? {} : { activeSessionId },
							focused,
							dedupeKey,
							now,
							recent
						});
						const mutedSubagent = decision === null && sessionOrigin === "subagent";
						const mutedViewed = decision === null && !settings.notifyViewedUnfocused && activeSessionId !== void 0 && id === activeSessionId;
						const delivery = decision === null ? mutedSubagent ? "suppressed (subagent " + settings.subagentMode + ")" : mutedViewed ? "suppressed (viewed session)" : "suppressed" : isSoundOnly(settings) ? "sound-only" : "toast";
						report("turn " + String(projection.turn) + " reason=" + String(reason) + " focused=" + String(focused) + " -> " + delivery);
						if (decision !== null && reason !== void 0) {
							const scenario = scenarioOfReason(reason);
							const parts = {
								workspace: toastNameOf(summary),
								status: t(shortScenarioKey(scenario)),
								body: plainSummary(projection.body)
							};
							emitExternal(scenario, parts, fallbackBodyOf(scenario));
							if (isSoundOnly(settings)) playSoundOnly(decision.sound);
							else {
								const text = textFor(scenario, parts, fallbackBodyOf(scenario));
								showToast({
									title: text.title,
									body: text.body,
									tag: notificationTag(id, projection.turn),
									sound: decision.sound,
									onClick: () => {
										activate(id);
									}
								});
							}
							rememberDecision(recent, dedupeKey, now);
						}
					}
					const pending = projection?.pending ?? [];
					const previous = knownPending.get(id);
					if (previous === void 0) {
						const seeded = /* @__PURE__ */ new Set();
						for (const entry of pending) {
							seeded.add(entry.requestId);
							waits.set(waitKey(id, entry.requestId), {
								key: waitKey(id, entry.requestId),
								sessionId: id,
								requestId: entry.requestId,
								kind: entry.kind,
								summary: entry.summary,
								firstSeenAt: now,
								reminded: false,
								lastRemindedAt: 0
							});
						}
						knownPending.set(id, seeded);
						continue;
					}
					const askIsFresh = projection !== void 0 && isFresh(projection.updatedAt, now);
					const arrivals = newPending(previous, pending);
					for (const entry of arrivals) previous.add(entry.requestId);
					for (const entry of arrivals) {
						if (!askIsFresh) {
							report("pending " + entry.kind + " " + entry.requestId + " (projection) stale -> suppressed");
							continue;
						}
						notifyAsk({
							sessionId: id,
							requestId: entry.requestId,
							kind: entry.kind,
							summary: entry.summary,
							firstSeenAt: now,
							source: "projection",
							label: toastNameOf(summary),
							...sessionOrigin === void 0 ? {} : { sessionOrigin }
						});
					}
					if (previous.size !== pending.length) {
						const live = /* @__PURE__ */ new Set();
						for (const entry of pending) live.add(entry.requestId);
						for (const requestId of previous) {
							if (live.has(requestId)) continue;
							previous.delete(requestId);
							waits.delete(waitKey(id, requestId));
						}
					}
					knownPending.set(id, previous);
				}
				const liveSessions = new Set(state.ids);
				for (const id of [...observedTurn.keys()]) if (!liveSessions.has(id)) observedTurn.delete(id);
				for (const id of [...knownPending.keys()]) if (!liveSessions.has(id)) knownPending.delete(id);
				for (const id of [...seenShape.keys()]) if (!liveSessions.has(id)) seenShape.delete(id);
				for (const entry of [...waits.values()]) if (!liveSessions.has(entry.sessionId)) waits.delete(entry.key);
			};
			/**
			* Poll the host's question queue and notify for every new open question.
			*
			* This is the only source of question notifications: a service-level ask
			* (the plan review) never reaches a projection, and a global client plugin
			* cannot subscribe to the agent-scoped waterfall that carries it (measured),
			* so the host observes and the client decides.
			*/
			const pollQuestions = () => {
				if (typeof document === "undefined" || !document.hasFocus()) refreshHostFocus();
				else {
					hostFocused = false;
					lastFocusAt = Date.now();
				}
				const fetchImpl = globalThis.fetch;
				if (fetchImpl === void 0) return;
				fetchImpl(QUESTIONS_ROUTE, { headers: { [FOCUS_HEADER]: "1" } }).then((response) => response.ok ? response.json() : void 0).then((payload) => {
					const items = payload?.items;
					if (!Array.isArray(items)) return;
					for (const raw of items) {
						const item = raw;
						const seq = typeof item.seq === "number" ? item.seq : 0;
						const key = typeof item.key === "string" ? item.key : "";
						const sessionId = typeof item.sessionId === "string" ? item.sessionId : "";
						if (seq === 0 || key === "") continue;
						const waitId = waitKey(sessionId, key);
						if (item.open !== true) {
							waits.delete(waitId);
							continue;
						}
						if (seq <= questionSeq) continue;
						questionSeq = seq;
						notifyAsk({
							sessionId,
							requestId: key,
							kind: item.kind === "plan-review" ? "plan-review" : "question",
							summary: typeof item.summary === "string" ? item.summary : "",
							firstSeenAt: typeof item.at === "number" ? item.at : Date.now(),
							source: "host queue",
							label: sessionLabel(sessionId)
						});
					}
				}).catch(() => void 0);
			};
			const remind = () => {
				const settings = store.getSnapshot();
				const now = Date.now();
				const focused = isFocused();
				const minutes = String(settings.remindAfterMinutes);
				for (const due of dueReminders([...waits.values()], settings, now)) {
					const wait = waits.get(due.key);
					if (wait === void 0) continue;
					if (wait.reminded && settings.reminderMode !== "repeat") continue;
					waits.set(due.key, {
						...wait,
						reminded: true,
						lastRemindedAt: now
					});
					if (focused) continue;
					if (!settings.notifyViewedUnfocused && activeSessionId !== void 0 && due.sessionId === activeSessionId) continue;
					if (settings.subagentMode === "silent" && isSubagentSession(due.sessionId)) continue;
					const parts = {
						workspace: sessionLabel(due.sessionId),
						status: t(shortScenarioKey("reminder")),
						body: plainSummary(wait.summary),
						minutes
					};
					emitExternal("reminder", parts, fallbackBodyOf("reminder"));
					const sound = scenarioSound(settings, "reminder");
					if (isSoundOnly(settings)) {
						playSoundOnly(sound);
						continue;
					}
					const text = textFor("reminder", parts, fallbackBodyOf("reminder"));
					const sticky = settings.reminderMode === "sticky" && !wait.reminded;
					showToast({
						title: text.title,
						body: text.body,
						tag: reminderTag(due.sessionId, due.requestId) + (sticky ? "-s" : ""),
						sound,
						sticky,
						...sticky ? { dismissLabel: t("notify.dismiss") } : {},
						onClick: () => {
							activate(due.sessionId);
						}
					});
				}
			};
			/** The test toast: fixed copy, fixed default sound, immune to every setting below the master switch. */
			const sendTest = () => {
				previewToast({
					title: t("notify.testTitle"),
					body: t("notify.testBody"),
					tag: "dsh-notify-test-" + String(Date.now()),
					sound: "system:default",
					onClick: () => {
						focusWindowRequest();
					}
				});
			};
			/**
			* The placeholder values one preview renders with: a real workspace name when
			* there is one, and obvious sample text for everything else.
			* @param scenario - the situation being previewed.
			* @returns the values the chosen text is filled with.
			*/
			const previewParts = (scenario) => {
				const ids = sessions.list.getSnapshot().ids;
				const first = ids.length > 0 ? ids[0] : void 0;
				const label = first === void 0 ? "" : sessionLabel(first);
				const parts = {
					workspace: label === "" ? t("notify.previewWorkspace") : label,
					status: t(shortScenarioKey(scenario)),
					body: t("notify.previewSampleBody")
				};
				return scenario === "reminder" ? {
					...parts,
					minutes: String(store.getSnapshot().remindAfterMinutes)
				} : parts;
			};
			/**
			* Audition one situation the way a real notification in the current mode
			* would deliver it: its chosen text and sound, toast + sound, muted toast, or
			* the sound alone.
			* @param scenario - the situation whose settings to show.
			*/
			const previewScenario = (scenario) => {
				const settings = store.getSnapshot();
				const sound = scenarioSound(settings, scenario);
				if (isSoundOnly(settings)) {
					report("preview sound-only: " + scenario + " sound=" + sound);
					playSoundOnly(sound);
					return;
				}
				const parts = previewParts(scenario);
				const text = textFor(scenario, parts, fallbackBodyOf(scenario));
				report("preview " + scenario + " mode=" + settings.mode + " sound=" + sound);
				previewToast({
					title: text.title,
					body: text.body,
					tag: "dsh-notify-preview-" + scenario + "-" + String(Date.now()),
					sound,
					onClick: () => {
						focusWindowRequest();
					}
				});
			};
			ctx.effect(() => {
				const onFocus = () => {
					lastFocusAt = Date.now();
					hostFocused = false;
					silenceSounds().then(() => void 0, () => {
						report("silence request failed");
					});
				};
				const onBlur = () => {
					refreshHostFocus(true);
				};
				window.addEventListener("focus", onFocus);
				window.addEventListener("blur", onBlur);
				return () => {
					window.removeEventListener("focus", onFocus);
					window.removeEventListener("blur", onBlur);
				};
			});
			texts.load().then(() => migrateLegacyText(), () => void 0);
			ctx.effect(() => {
				const reseed = () => {
					observedTurn.clear();
					knownPending.clear();
					waits.clear();
				};
				const offReset = ctx.on("connection/reset", reseed);
				tick();
				const off = sessions.list.subscribe(tick);
				return () => {
					off();
					offReset();
				};
			}, "dsh-notify-desktop: session watcher");
			ctx.effect(() => {
				const timer = setInterval(remind, REMINDER_TICK_MS);
				return () => {
					clearInterval(timer);
				};
			}, "dsh-notify-desktop: reminder timer");
			ctx.effect(() => {
				const timer = setInterval(pollQuestions, QUESTION_POLL_MS);
				return () => {
					clearInterval(timer);
				};
			}, "dsh-notify-desktop: question poll");
			ctx.slots.inject("settings.section", () => {
				const register = () => ctx.slots.register({
					name: "settings.section",
					id: "notify",
					order: 60,
					label: () => t("nav"),
					locale: NS,
					inject: () => ({
						store,
						set,
						sendTest,
						previewScenario,
						texts,
						pickFile: pickSoundFile,
						loadLibrary: soundLibrary,
						importSound,
						deleteSound,
						renameSound,
						cacheInfo: soundCacheInfo,
						clearCache: clearSoundCache,
						tr: t,
						language,
						setLanguage: (value) => {
							set({ language: value });
						},
						subscribeLanguage: (listener) => {
							const offStore = store.subscribe(listener);
							const offLocale = ctx.locale.subscribe(listener);
							return () => {
								offStore();
								offLocale();
							};
						}
					})
				}, NotifySettingsSection);
				let dispose = register();
				let current = language();
				/** Re-register only when the resolved language really changed. */
				const refresh = () => {
					const next = language();
					if (next === current) return;
					current = next;
					dispose();
					dispose = register();
				};
				const offStore = store.subscribe(refresh);
				const offLocale = ctx.locale.subscribe(refresh);
				return () => {
					offStore();
					offLocale();
					dispose();
				};
			});
		}
		//#endregion
		exports.QUESTION_POLL_MS = QUESTION_POLL_MS;
		exports.REMINDER_TICK_MS = REMINDER_TICK_MS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map