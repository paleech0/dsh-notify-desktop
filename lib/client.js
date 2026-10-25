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
		* Decide whether one signal becomes a toast.
		* @param input - the settings, trigger, view state, clock, and dedupe memory.
		* @returns the decision, or null when this signal must stay silent.
		*/
		function decideNotification(input) {
			const { settings, trigger } = input;
			if (!settings.enabled) return null;
			const scenario = scenarioOfTrigger(trigger);
			if (!scenarioEnabled(settings, scenario)) return null;
			if (input.focused) return null;
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
			"settings.customize.desc": "给每个已勾选的情况分别挑选音效和弹窗文本；点「预览效果」马上看/听。没勾的情况不会出现在这里，去最下面的「选择接收以下哪种情况的通知」里勾选。",
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
			"settings.scenario.completedExample": "例：这一轮回复写完了。",
			"settings.scenario.errorExample": "例：模型或工具报错，这一轮没跑完。",
			"settings.scenario.abortedExample": "例：你点了停止，或这一轮被中断。",
			"settings.scenario.blockedExample": "例：这一轮卡住，没能继续。",
			"settings.scenario.maxTokensExample": "例：上下文太长，这一轮被截断。",
			"settings.scenario.approvalExample": "例：要执行命令或改文件，先等你允许。",
			"settings.scenario.questionExample": "例：有问题要你选一个或填一段。",
			"settings.scenario.planReviewExample": "例：计划模式下等你批准计划。",
			"settings.remind.prefix": "等待超过",
			"settings.remind.suffix": "分钟仍未处理时补一条提醒（每次等待只补一次）。",
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
			"settings.soundLibrary.removeConfirm": "删除「{name}」？文件会被移除，正在使用它的情况会退回系统默认提示音。",
			"settings.soundLibrary.desc": "点「添加音效…」选一个音频文件：它会被复制到 {path}，之后原文件移动或删除都不影响。支持 .wav / .mp3 / .m4a / .aac / .wma / .flac / .ogg / .opus；除 .wav 之外，首次播放时会转成 wav 并计入下面的「转换缓存」。",
			"settings.sounds.groupWindows": "Windows 音效",
			"settings.sounds.groupAuthor": "作者音效",
			"settings.sounds.groupCustom": "自定义音效",
			"settings.sounds.authorEmpty": "作者音效：暂无（放在插件 sounds/ 文件夹里）",
			"settings.sounds.customEmpty": "还没有自定义音效，点下面的「添加音效…」",
			"settings.sounds.pickerLabel": "选择音效",
			"settings.cache.label": "转换缓存",
			"settings.cache.empty": "暂无转换缓存",
			"settings.cache.inUse": "缓存占用：{files} 个文件 · {size}",
			"settings.cache.clear": "清理缓存",
			"settings.cache.cleared": "已清理 {files} 个缓存文件，释放 {size}",
			"settings.cache.failed": "清理失败：宿主没有响应",
			"settings.cache.desc": "自定义音效里非 wav 的格式，首次播放时会转成 wav 存在本机（%LOCALAPPDATA%\\dsh-notify\\sounds）。缓存随时可以清，下次播放会自动重建。",
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
			"settings.textEditor.placeholders": "可用占位符（点击插入）：",
			"settings.textEditor.preview": "预览：",
			"settings.textEditor.save": "保存",
			"settings.textEditor.cancel": "取消",
			"settings.textEditor.nameRequired": "名称不能为空（最多 24 字）",
			"settings.textEditor.titleRequired": "标题不能为空（最多 120 字）",
			"settings.textEditor.bodyRequired": "正文不能为空（最多 300 字）",
			"settings.situations.title": "选择接收以下哪种情况的通知",
			"settings.situations.desc": "勾选后，只有这些情况会提醒你；没勾的既不弹窗也不出声。勾选会让上面的「通知自定义」出现对应的设置行。",
			"settings.situations.turnTitle": "会话结束",
			"settings.situations.turnDesc": "例：DSH 跑完一轮，或者没能跑完。",
			"settings.situations.pendingTitle": "等待你确认",
			"settings.situations.pendingDesc": "例：DSH 停下来等你审批、回答或评审计划。",
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
			"notify.previewSampleBody": "这是示例内容；真实通知会显示这一轮的回复摘要。"
		};
		/** English dictionary, keyed exactly like {@link zh}. */
		const en = {
			nav: "Notifications",
			"settings.title": "Desktop notifications",
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
			"settings.customize.desc": "Pick a sound and a popup text for each situation you enabled; Preview shows and plays it right away. Disabled situations do not appear here - tick them in the situations card at the bottom.",
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
			"settings.scenario.completedExample": "e.g. this turn's reply was written.",
			"settings.scenario.errorExample": "e.g. the model or a tool failed; the turn did not finish.",
			"settings.scenario.abortedExample": "e.g. you pressed stop, or the turn was interrupted.",
			"settings.scenario.blockedExample": "e.g. the turn got stuck and could not continue.",
			"settings.scenario.maxTokensExample": "e.g. the context grew too long and the turn was cut off.",
			"settings.scenario.approvalExample": "e.g. it wants to run a command or edit a file and needs your permission.",
			"settings.scenario.questionExample": "e.g. it has a question you need to pick or type an answer for.",
			"settings.scenario.planReviewExample": "e.g. plan mode is waiting for you to approve the plan.",
			"settings.remind.prefix": "Remind me once after",
			"settings.remind.suffix": "minutes of waiting (one reminder per wait).",
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
			"settings.soundLibrary.removeConfirm": "Delete \"{name}\"? The file is removed and any situation using it falls back to the default Windows chime.",
			"settings.soundLibrary.desc": "Add sound… copies the audio file you pick into {path}, so moving or deleting the original later changes nothing. .wav / .mp3 / .m4a / .aac / .wma / .flac / .ogg / .opus; anything but a wav is transcoded on its first play and shows up in the transcode cache below.",
			"settings.sounds.groupWindows": "Windows sounds",
			"settings.sounds.groupAuthor": "Author sounds",
			"settings.sounds.groupCustom": "Custom sounds",
			"settings.sounds.authorEmpty": "No author sounds (they live in the plugin's sounds/ folder)",
			"settings.sounds.customEmpty": "No custom sounds yet - use Add sound… below",
			"settings.sounds.pickerLabel": "Choose a sound",
			"settings.cache.label": "Transcode cache",
			"settings.cache.empty": "No transcoded sounds yet",
			"settings.cache.inUse": "Cache in use: {files} file(s) · {size}",
			"settings.cache.clear": "Clear cache",
			"settings.cache.cleared": "Cleared {files} cached file(s), freed {size}",
			"settings.cache.failed": "Clear failed: the host did not answer",
			"settings.cache.desc": "A non-wav file from the custom sounds above is transcoded once into %LOCALAPPDATA%\\dsh-notify\\sounds. It is safe to clear: the next play rebuilds it.",
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
			"settings.textEditor.placeholders": "Placeholders (click to insert):",
			"settings.textEditor.preview": "Preview:",
			"settings.textEditor.save": "Save",
			"settings.textEditor.cancel": "Cancel",
			"settings.textEditor.nameRequired": "Name cannot be empty (max 24 characters)",
			"settings.textEditor.titleRequired": "Title cannot be empty (max 120 characters)",
			"settings.textEditor.bodyRequired": "Body cannot be empty (max 300 characters)",
			"settings.situations.title": "Notify me in which of these situations",
			"settings.situations.desc": "Only the ticked situations notify you; the rest neither toast nor sound. Ticking one adds its row to the \"Notification setup\" card above.",
			"settings.situations.turnTitle": "A session ends",
			"settings.situations.turnDesc": "e.g. DSH finished the turn, or could not.",
			"settings.situations.pendingTitle": "Waiting on you",
			"settings.situations.pendingDesc": "e.g. DSH stopped for an approval, an answer or a plan review.",
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
			"notify.previewSampleBody": "This is sample text; a real notification shows the turn's reply summary."
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
						sound: request.sound
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
		function appWindowFocused() {
			const fetchImpl = globalThis.fetch;
			if (fetchImpl === void 0) return Promise.resolve(false);
			return fetchImpl(FOREGROUND_ROUTE, { headers: { [FOCUS_HEADER]: "1" } }).then((response) => response.ok ? response.json() : null).then((payload) => payload?.focused === true, () => false);
		}
		/**
		* Read the sound library: what the plugin ships and what the user imported.
		* @returns both lists, or an empty library when the host is unreachable.
		*/
		function soundLibrary() {
			const empty = {
				author: [],
				custom: []
			};
			const fetchImpl = globalThis.fetch;
			if (fetchImpl === void 0) return Promise.resolve(empty);
			return fetchImpl(SOUND_LIBRARY_ROUTE, { headers: { [FOCUS_HEADER]: "1" } }).then((response) => response.ok ? response.json() : null).then((payload) => {
				const value = payload;
				return {
					author: Array.isArray(value?.author) ? value.author : [],
					custom: Array.isArray(value?.custom) ? value.custom : []
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
			notifyApproval: true,
			notifyQuestion: true,
			notifyPlanReview: true,
			remindAfterMinutes: 10
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
		* Pick the waits that are due for their one reminder.
		* @param waits - every currently tracked, still-unanswered wait.
		* @param settings - the live settings (master and per-scenario switches).
		* @param now - the current clock (ms).
		* @returns the waits to remind about, in tracking order.
		*/
		function dueReminders(waits, settings, now) {
			if (!settings.enabled) return [];
			const after = remindAfterMs(settings.remindAfterMinutes);
			return waits.filter((wait) => !wait.reminded && pendingEnabled(settings, wait.kind) && now - wait.firstSeenAt >= after);
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
		/** The request ids currently pending, for pruning tracked waits. */
		function liveRequestIds(pending) {
			return new Set(pending.map((entry) => entry.requestId));
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
			const sections = [
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
						label: item.name
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
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_textGroup",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_textGroupHeader",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh_notify_textGroupName",
									children: props.labelOf(scenario)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh_notify_textGroupCount",
									children: String(templates.length) + "/" + String(3)
								})]
							}),
							templates.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_rowDesc",
								children: props.t("settings.textLibrary.empty")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
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
											children: renderBody(template.body, props.partsOf(scenario), "")
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
							editing === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsh_notify_button",
								disabled: templates.length >= 3,
								...templates.length >= 3 ? { title: props.t("settings.textLibrary.limit") } : {},
								onClick: () => {
									startNew(scenario);
								},
								children: props.t("settings.textLibrary.add")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextEditor, {
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
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "dsh_notify_editorRow",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsh_notify_editorLabel",
						children: props.label
					}),
					props.multiline === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
						className: "dsh_notify_textArea",
						value: props.value,
						maxLength: props.limit,
						rows: 3,
						onChange: (event) => {
							props.onChange(event.target.value);
						}
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "text",
						className: "dsh_notify_textInput",
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
						onChange: (value) => {
							props.onChange({ title: value });
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: props.t("settings.textEditor.bodyField"),
						value: props.state.body,
						limit: 300,
						multiline: true,
						onChange: (value) => {
							props.onChange({ body: value });
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_editorPlaceholders",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsh_notify_rowDesc",
							children: props.t("settings.textEditor.placeholders")
						}), [
							"{工作区}",
							"{状态}",
							"{内容}",
							"{分钟}"
						].map((token) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsh_notify_chip",
							onClick: () => {
								props.onChange({ body: props.state.body + token });
							},
							children: token
						}, token))]
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
		* The notification settings section.
		* @param props - section props supplied by the settings slot.
		* @returns the rendered section.
		*/
		function NotifySettingsSection(props) {
			const settings = (0, react.useSyncExternalStore)(props.store.subscribe, props.store.getSnapshot);
			const texts = (0, react.useSyncExternalStore)(props.texts.subscribe, props.texts.getSnapshot);
			const [error, setError] = (0, react.useState)(null);
			const [cache, setCache] = (0, react.useState)(null);
			const [cacheNote, setCacheNote] = (0, react.useState)(null);
			const [library, setLibrary] = (0, react.useState)({
				author: [],
				custom: []
			});
			const [libraryNote, setLibraryNote] = (0, react.useState)(null);
			const [soundConfirm, setSoundConfirm] = (0, react.useState)(null);
			const [soundsOpen, setSoundsOpen] = (0, react.useState)(false);
			const [textsOpen, setTextsOpen] = (0, react.useState)(false);
			const t = props.t;
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
				if (id.startsWith("author:") || id.startsWith("custom:")) {
					const item = library.author.find((entry) => entry.id === id) ?? library.custom.find((entry) => entry.id === id);
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
				if (removed) await refreshLibrary();
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
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_cardTitle",
								children: t("settings.title")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_cardDesc",
								children: t("settings.subtitle")
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
												preview(scenario);
											},
											children: t("settings.scenario.preview")
										})
									]
								}, scenario))
							}),
							visibleScenarios.includes("reminder") ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_remindLine",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("settings.remind.prefix") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										className: "dsh_notify_minutes",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "number",
											min: 1,
											max: 240,
											disabled: !formEnabled,
											value: settings.remindAfterMinutes,
											onChange: (event) => {
												const next = Number(event.target.value);
												if (Number.isFinite(next)) props.set({ remindAfterMinutes: next });
											}
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("settings.remind.suffix") })
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
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsh_notify_soundItemName",
													children: item.name
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsh_notify_soundItemSize",
													children: formatBytes(item.bytes)
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "dsh_notify_iconButton dsh_notify_danger",
													onClick: () => {
														setLibraryNote(null);
														setSoundConfirm(item.id);
													},
													children: t("settings.soundLibrary.remove")
												})
											]
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
							})
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
					notifyApproval: clampBoolean(saved["notifyApproval"], DEFAULT_SETTINGS.notifyApproval),
					notifyQuestion: clampBoolean(saved["notifyQuestion"], DEFAULT_SETTINGS.notifyQuestion),
					notifyPlanReview: clampBoolean(saved["notifyPlanReview"], DEFAULT_SETTINGS.notifyPlanReview),
					remindAfterMinutes: clampMinutes(saved["remindAfterMinutes"])
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
						remindAfterMinutes: clampMinutes(patch.remindAfterMinutes ?? snapshot.remindAfterMinutes),
						sounds: clampSounds(patch.sounds ?? snapshot.sounds),
						texts: clampTexts(patch.texts ?? snapshot.texts),
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
.dsh_notify_section { display: flex; flex-direction: column; gap: 16px; }
.dsh_notify_card {
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.24));
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dsh_notify_cardTitle { font-weight: 600; font-size: 13px; }
.dsh_notify_cardDesc { font-size: 12px; opacity: 0.72; line-height: 1.5; }
.dsh_notify_row { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; }
.dsh_notify_row input[type='checkbox'] { margin-top: 2px; }
.dsh_notify_rowText { display: flex; flex-direction: column; gap: 2px; }
/* Only the checkbox and this label toggle a row; the rest of the row does not. */
.dsh_notify_rowLabel { cursor: pointer; }
.dsh_notify_error { color: #e5484d; font-size: 12px; line-height: 1.5; }
.dsh_notify_note { color: #3dd68c; font-size: 12px; line-height: 1.5; }
.dsh_notify_cacheText { flex: 1 1 auto; font-size: 12px; opacity: 0.75; }
.dsh_notify_rowDesc { font-size: 12px; opacity: 0.66; line-height: 1.5; }
.dsh_notify_rowPrefix { font-size: 11px; opacity: 0.55; }
.dsh_notify_button {
  align-self: flex-start;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 13px;
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
.dsh_notify_minutes { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.dsh_notify_minutes input {
  width: 72px;
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  background: transparent;
  color: inherit;
}

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
.dsh_notify_remindLine {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0 2px;
  font-size: 12px;
  opacity: 0.85;
}
.dsh_notify_remindLine .dsh_notify_minutes input { width: 64px; }

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
  gap: 2px;
  max-height: 168px;
  overflow-y: auto;
}
.dsh_notify_card .dsh_notify_soundItem {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 5px 8px;
  border-radius: 7px;
  font-size: 12px;
  border: 1px solid transparent;
}
.dsh_notify_card .dsh_notify_soundItem:hover {
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.1));
  border-color: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
}
.dsh_notify_soundItemName { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh_notify_soundItemSize { opacity: 0.6; font-variant-numeric: tabular-nums; }
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
.dsh_notify_pickerCount { opacity: 0.55; font-variant-numeric: tabular-nums; }
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
.dsh_notify_pickerEmpty { padding: 2px 8px 8px 20px; font-size: 12px; opacity: 0.6; }
.dsh_notify_textPanel { width: 230px; }

/* The saved-text manager and its inline editor. */
.dsh_notify_textManager { display: flex; flex-direction: column; gap: 4px; }
.dsh_notify_textGroup {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 0;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.12));
}
.dsh_notify_textGroup:first-child { border-top: 0; padding-top: 0; }
.dsh_notify_textGroupHeader { display: flex; align-items: baseline; gap: 8px; }
.dsh_notify_textGroupName { font-size: 13px; font-weight: 600; }
.dsh_notify_textGroupCount { font-size: 12px; opacity: 0.6; font-variant-numeric: tabular-nums; }
.dsh_notify_textList { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.dsh_notify_card .dsh_notify_textItem {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 7px;
  font-size: 12px;
  border: 1px solid transparent;
}
.dsh_notify_card .dsh_notify_textItem:hover {
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.1));
  border-color: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
}
.dsh_notify_textItemName { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.dsh_notify_textItemBody { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.7; }
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
.dsh_notify_editorLabel { font-size: 12px; opacity: 0.75; }
.dsh_notify_editorCount { font-size: 11px; opacity: 0.5; font-variant-numeric: tabular-nums; }
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
.dsh_notify_editorPlaceholders { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dsh_notify_chip {
  padding: 2px 8px;
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
.dsh_notify_minutes input:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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
			const t = ctx.locale.bind(NS);
			const store = createSettingsStore();
			const texts = createTextStore();
			const set = (patch) => {
				store.update(patch);
				if (patch.enabled === false || patch.mode === "notify") silenceSounds();
			};
			const sessions = ctx.get("sessions");
			const workspace = ctx.get("uiWorkspace");
			const recent = /* @__PURE__ */ new Map();
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
					focused,
					dedupeKey: ask.sessionId + ":request:" + ask.requestId,
					now,
					recent
				});
				waits.set(waitKey(ask.sessionId, ask.requestId), {
					key: waitKey(ask.sessionId, ask.requestId),
					sessionId: ask.sessionId,
					requestId: ask.requestId,
					kind: ask.kind,
					summary: ask.summary,
					firstSeenAt: ask.firstSeenAt,
					reminded: false
				});
				const delivery = decision === null ? "suppressed" : isSoundOnly(settings) ? "sound-only" : "toast";
				report("pending " + where + " focused=" + String(focused) + " -> " + delivery);
				if (decision === null) return;
				const scenario = scenarioOfPending(ask.kind);
				const parts = {
					workspace: ask.label,
					status: t(shortScenarioKey(scenario)),
					body: plainSummary(ask.summary)
				};
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
			/** Ask the host for the OS-level answer and remember it. */
			const refreshHostFocus = () => {
				appWindowFocused().then((focused) => {
					hostFocused = focused;
				}, () => void 0);
			};
			const tick = () => {
				const state = sessions.list.getSnapshot();
				const settings = store.getSnapshot();
				const now = Date.now();
				const focused = isFocused();
				for (const id of state.ids) {
					const summary = state.byId[id];
					if (summary === void 0) continue;
					const projection = summary.projectionValues?.[NOTIFY_PROJECTION_KEY];
					const toastName = workspaceName(summary.cwd) || summary.displayTitle || summary.title || "";
					const shape = projection === void 0 ? "absent" : projection.turn + "/" + projection.reason + "/pending:" + String(projection.pending.length);
					const ownList = (projection?.pending ?? []).map((entry) => entry.kind + ":" + entry.requestId).join("|");
					const shapeWithPending = shape + " own=[" + ownList + "]";
					if ((projection !== void 0 || ownList !== "") && seenShape.get(id) !== shapeWithPending) {
						seenShape.set(id, shapeWithPending);
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
							focused,
							dedupeKey,
							now,
							recent
						});
						const delivery = decision === null ? "suppressed" : isSoundOnly(settings) ? "sound-only" : "toast";
						report("turn " + String(projection.turn) + " reason=" + String(reason) + " focused=" + String(focused) + " -> " + delivery);
						if (decision !== null && reason !== void 0) {
							const scenario = scenarioOfReason(reason);
							const parts = {
								workspace: toastName,
								status: t(shortScenarioKey(scenario)),
								body: plainSummary(projection.body)
							};
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
					const live = liveRequestIds(pending);
					if (previous === void 0) {
						knownPending.set(id, live);
						for (const entry of pending) waits.set(waitKey(id, entry.requestId), {
							key: waitKey(id, entry.requestId),
							sessionId: id,
							requestId: entry.requestId,
							kind: entry.kind,
							summary: entry.summary,
							firstSeenAt: now,
							reminded: false
						});
						continue;
					}
					const askIsFresh = projection !== void 0 && isFresh(projection.updatedAt, now);
					for (const entry of newPending(previous, pending)) {
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
							label: toastName
						});
					}
					for (const requestId of [...previous]) if (!live.has(requestId)) {
						previous.delete(requestId);
						waits.delete(waitKey(id, requestId));
					}
					for (const requestId of live) previous.add(requestId);
					knownPending.set(id, previous);
				}
				const liveSessions = new Set(state.ids);
				for (const id of [...observedTurn.keys()]) if (!liveSessions.has(id)) observedTurn.delete(id);
				for (const id of [...knownPending.keys()]) if (!liveSessions.has(id)) knownPending.delete(id);
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
					if (wait === void 0 || wait.reminded) continue;
					waits.set(due.key, {
						...wait,
						reminded: true
					});
					if (focused) continue;
					const parts = {
						workspace: sessionLabel(due.sessionId),
						status: t(shortScenarioKey("reminder")),
						body: plainSummary(wait.summary),
						minutes
					};
					const sound = scenarioSound(settings, "reminder");
					if (isSoundOnly(settings)) {
						playSoundOnly(sound);
						continue;
					}
					const text = textFor("reminder", parts, fallbackBodyOf("reminder"));
					showToast({
						title: text.title,
						body: text.body,
						tag: reminderTag(due.sessionId, due.requestId),
						sound,
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
					refreshHostFocus();
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
			ctx.slots.inject("settings.section", () => ctx.slots.register({
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
					cacheInfo: soundCacheInfo,
					clearCache: clearSoundCache
				})
			}, NotifySettingsSection));
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