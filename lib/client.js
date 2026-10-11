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
		/** Whether the per-outcome switch for a turn-end reason is on. */
		function reasonEnabled(settings, reason) {
			switch (reason) {
				case "completed": return settings.notifyCompleted;
				case "error": return settings.notifyError;
				case "aborted": return settings.notifyAborted;
				case "blocked": return settings.notifyBlocked;
				case "max-tokens": return settings.notifyMaxTokens;
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
		/** Which of the four situations a trigger belongs to. */
		function soundGroupOf(trigger) {
			if (trigger.kind === "turn") return trigger.reason === "error" ? "error" : "finished";
			return "attention";
		}
		/**
		* The sound one situation group plays.
		* @param settings - the live settings.
		* @param group - the situation group.
		* @returns the chosen sound, or 'silent' when sounds are switched off.
		*/
		function groupSound(settings, group) {
			return settings.soundEnabled ? settings.sounds[group] : "silent";
		}
		/**
		* Decide whether one signal becomes a toast.
		* @param input - the settings, trigger, view state, clock, and dedupe memory.
		* @returns the decision, or null when this signal must stay silent.
		*/
		function decideNotification(input) {
			const { settings, trigger } = input;
			if (!settings.enabled) return null;
			if (!(trigger.kind === "turn" ? reasonEnabled(settings, trigger.reason) : pendingEnabled(settings, trigger.pending))) return null;
			if (input.focused) return null;
			const window = input.dedupeWindowMs ?? 3e3;
			const seenAt = input.recent.get(input.dedupeKey);
			if (seenAt !== void 0 && input.now - seenAt < window) return null;
			return {
				sound: groupSound(settings, soundGroupOf(trigger)),
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
			"settings.enabledDesc": "总开关；关闭后不再弹任何通知，下面的偏好会保留。",
			"settings.sound": "提示音",
			"settings.soundDesc": "使用系统通知自带提示音；关闭后静音弹出。",
			"settings.when.title": "结束提醒",
			"settings.when.subtitle": "选择哪些结束状态需要提醒。",
			"settings.when.completed": "正常完成",
			"settings.when.error": "出错",
			"settings.when.aborted": "被中止",
			"settings.when.blocked": "被阻塞",
			"settings.when.maxTokens": "达到 Token 上限",
			"settings.pending.title": "等待确认",
			"settings.pending.subtitle": "会话停下来等你审批、回答或评审计划时提醒。",
			"settings.pending.approval": "等待审批",
			"settings.pending.question": "等待回答",
			"settings.pending.planReview": "等待计划评审",
			"settings.remind.title": "超时催办",
			"settings.remind.desc": "等待确认超过设定分钟数仍未处理时，补一条提醒（每次等待只补一次）。",
			"settings.remind.minutes": "分钟",
			"settings.test.title": "测试",
			"settings.test.desc": "发一条测试通知，确认权限与提示音正常。",
			"settings.test.button": "发送测试通知",
			"settings.sounds.title": "音效",
			"settings.sounds.desc": "给四类情况各挑一个声音，点「试听」立刻听一遍。下拉里分三组：Windows 音效 / 作者音效 / 自定义音效。文件类音效最长播 8 秒；关掉上面的「提示音」或者切回 DSH 窗口，都会立刻停。",
			"settings.sounds.finished": "任务正常结束",
			"settings.sounds.error": "任务出错",
			"settings.sounds.attention": "需要你处理（审批 / 提问 / 计划评审）",
			"settings.sounds.reminder": "超时催办",
			"settings.sounds.preview": "试听",
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
			"settings.sounds.groupWindows": "Windows 音效",
			"settings.sounds.groupAuthor": "作者音效",
			"settings.sounds.groupCustom": "自定义音效",
			"settings.sounds.authorEmpty": "作者音效：暂无（放在插件 sounds/ 文件夹里）",
			"settings.sounds.customEmpty": "还没有自定义音效，点下面的「添加音效…」",
			"settings.library.title": "自定义音效",
			"settings.library.empty": "还没有自定义音效",
			"settings.library.count": "音效占用：{files} 个文件 · {size}",
			"settings.library.add": "添加音效…",
			"settings.library.remove": "删除",
			"settings.library.desc": "点「添加音效…」选一个音频文件：它会被复制到 {path}，之后原文件移动或删除都不影响。支持 .wav / .mp3 / .m4a / .aac / .wma / .flac / .ogg / .opus；除 .wav 之外，首次播放时会转成 wav 并计入下面的「转换缓存」——占用和清理都在那里。",
			"settings.library.added": "已添加：{name}",
			"settings.library.removed": "已删除",
			"settings.library.missing": "这个音效文件不在了，重新选一个或再添加一次",
			"settings.library.addFailed": "操作失败：宿主没有响应，或这个格式不支持",
			"settings.sound.silent": "静音",
			"settings.cache.label": "转换缓存",
			"settings.cache.empty": "暂无转换缓存",
			"settings.cache.inUse": "缓存占用：{files} 个文件 · {size}",
			"settings.cache.clear": "清理缓存",
			"settings.cache.cleared": "已清理 {files} 个缓存文件，释放 {size}",
			"settings.cache.failed": "清理失败：宿主没有响应",
			"settings.cache.desc": "上面「自定义音效」里非 wav 的格式，首次播放时会转成 wav 存在本机（%LOCALAPPDATA%\\dsh-notify\\sounds）。缓存随时可以清，下次播放会自动重建。",
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
			"notify.testTitle": "DSH 通知测试",
			"notify.testBody": "能看到这条通知，说明通知配置正常。"
		};
		/** English dictionary, keyed exactly like {@link zh}. */
		const en = {
			nav: "Notifications",
			"settings.title": "Desktop notifications",
			"settings.subtitle": "A Windows toast when a session finishes, fails, or stops to ask you something; click it to return to that session.",
			"settings.enabled": "Enable notifications",
			"settings.enabledDesc": "Master switch; turning it off silences every notification and keeps the preferences below.",
			"settings.sound": "Sound",
			"settings.soundDesc": "Use the system notification sound; off shows the toast silently.",
			"settings.when.title": "Turn outcomes",
			"settings.when.subtitle": "Which ways of ending a turn should notify.",
			"settings.when.completed": "Completed",
			"settings.when.error": "Error",
			"settings.when.aborted": "Aborted",
			"settings.when.blocked": "Blocked",
			"settings.when.maxTokens": "Token limit reached",
			"settings.pending.title": "Waiting on you",
			"settings.pending.subtitle": "Notify while a session waits for an approval, an answer, or a plan review.",
			"settings.pending.approval": "Waiting for approval",
			"settings.pending.question": "Waiting for an answer",
			"settings.pending.planReview": "Waiting for a plan review",
			"settings.remind.title": "Unanswered reminder",
			"settings.remind.desc": "Send one extra toast when a confirmation has been waiting longer than the configured minutes (one reminder per wait).",
			"settings.remind.minutes": "minutes",
			"settings.test.title": "Test",
			"settings.test.desc": "Send a test notification to confirm permission and sound.",
			"settings.test.button": "Send a test notification",
			"settings.sounds.title": "Sounds",
			"settings.sounds.desc": "Pick one sound per situation; Preview plays it right away. The list has three sections: Windows sounds, author sounds and your own custom sounds. File sounds stop after 8 seconds, and also stop when sound is switched off or the DSH window regains focus.",
			"settings.sounds.finished": "Finished normally",
			"settings.sounds.error": "Failed",
			"settings.sounds.attention": "Waiting on you (approval / question / plan review)",
			"settings.sounds.reminder": "Still-waiting reminder",
			"settings.sounds.preview": "Preview",
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
			"settings.sounds.groupWindows": "Windows sounds",
			"settings.sounds.groupAuthor": "Author sounds",
			"settings.sounds.groupCustom": "Custom sounds",
			"settings.sounds.authorEmpty": "No author sounds (they live in the plugin's sounds/ folder)",
			"settings.sounds.customEmpty": "No custom sounds yet - use Add sound… below",
			"settings.library.title": "Custom sounds",
			"settings.library.empty": "No custom sounds yet",
			"settings.library.count": "Library in use: {files} file(s) · {size}",
			"settings.library.add": "Add sound…",
			"settings.library.remove": "Remove",
			"settings.library.desc": "Add sound… copies the audio file you pick into {path}, so moving or deleting the original later changes nothing. .wav / .mp3 / .m4a / .aac / .wma / .flac / .ogg / .opus; anything but a wav is transcoded on its first play and shows up in the transcode cache below, where its size lives and can be cleared.",
			"settings.library.added": "Added: {name}",
			"settings.library.removed": "Removed",
			"settings.library.missing": "That sound file is gone: pick another one, or add it again",
			"settings.library.addFailed": "Failed: the host did not answer, or the format is unsupported",
			"settings.sound.silent": "Silent",
			"settings.cache.label": "Transcode cache",
			"settings.cache.empty": "No transcoded sounds yet",
			"settings.cache.inUse": "Cache in use: {files} file(s) · {size}",
			"settings.cache.clear": "Clear cache",
			"settings.cache.cleared": "Cleared {files} cached file(s), freed {size}",
			"settings.cache.failed": "Clear failed: the host did not answer",
			"settings.cache.desc": "A non-wav file from the custom sounds above is transcoded once into %LOCALAPPDATA%\\dsh-notify\\sounds. It is safe to clear: the next play rebuilds it.",
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
			"notify.testTitle": "DSH notification test",
			"notify.testBody": "If you can see this, notifications are configured correctly."
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
		/** The short status key for one turn-end reason (composed into the title). */
		function shortReasonKey(reason) {
			switch (reason) {
				case "completed": return "notify.shortCompleted";
				case "error": return "notify.shortError";
				case "aborted": return "notify.shortAborted";
				case "blocked": return "notify.shortBlocked";
				case "max-tokens": return "notify.shortMaxTokens";
			}
		}
		/** The short status key for one blocking interaction. */
		function shortPendingKey(kind) {
			switch (kind) {
				case "approval": return "notify.shortApproval";
				case "question": return "notify.shortQuestion";
				case "plan-review": return "notify.shortPlanReview";
			}
		}
		/** The notification body: the projected reply snippet, or the fallback line. */
		function bodyText(body, fallback) {
			const trimmed = body.trim();
			return trimmed === "" ? fallback : trimmed;
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
		/**
		* Compose the toast title: who it is about, then the short status.
		* @param label - the workspace name (falls back to the session title).
		* @param statusLabel - the localized short status, e.g. 任务完成.
		* @returns the bounded title.
		*/
		function toastTitle(label, statusLabel) {
			const name = label.trim().replace(/\s+/g, " ");
			if (name === "") return statusLabel;
			return (name.length > 40 ? name.slice(0, 39) + "…" : name) + " · " + statusLabel;
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
		/**
		* The four situations that can sound different.
		*
		* Nine scenarios would be more flexible but a nuisance to configure; these four
		* match what a user actually distinguishes: something finished, something
		* failed, something is waiting for you, and the reminder that it is still
		* waiting.
		*/
		const SOUND_GROUPS = Object.freeze([
			"finished",
			"error",
			"attention",
			"reminder"
		]);
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
			soundEnabled: true,
			sounds: Object.freeze({
				finished: "file:chimes",
				error: "file:error",
				attention: "file:ding",
				reminder: "file:exclamation"
			}),
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
					"aria-label": props.t("settings.sounds.title"),
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
		//#region src/client/SettingsSection.tsx
		/**
		* The settings-page section: master switch, sound switch, per-outcome and
		* waiting-on-you switches, the reminder delay, and a test button. Every control
		* writes straight through to the persisted store.
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
				className: "dsh_notify_row",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					id: props.id,
					type: "checkbox",
					checked: props.checked,
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
		/** The turn-outcome switches, in presentation order. */
		const OUTCOMES = [
			{
				field: "notifyCompleted",
				key: "settings.when.completed"
			},
			{
				field: "notifyError",
				key: "settings.when.error"
			},
			{
				field: "notifyAborted",
				key: "settings.when.aborted"
			},
			{
				field: "notifyBlocked",
				key: "settings.when.blocked"
			},
			{
				field: "notifyMaxTokens",
				key: "settings.when.maxTokens"
			}
		];
		/** The four situations whose sound is configurable, in presentation order. */
		const SOUND_ROWS = [
			{
				group: "finished",
				key: "settings.sounds.finished"
			},
			{
				group: "error",
				key: "settings.sounds.error"
			},
			{
				group: "attention",
				key: "settings.sounds.attention"
			},
			{
				group: "reminder",
				key: "settings.sounds.reminder"
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
		/** The waiting-on-you switches, in presentation order. */
		const PENDING = [
			{
				field: "notifyApproval",
				key: "settings.pending.approval"
			},
			{
				field: "notifyQuestion",
				key: "settings.pending.question"
			},
			{
				field: "notifyPlanReview",
				key: "settings.pending.planReview"
			}
		];
		/**
		* The notification settings section.
		* @param props - section props supplied by the settings slot.
		* @returns the rendered section.
		*/
		function NotifySettingsSection(props) {
			const settings = (0, react.useSyncExternalStore)(props.store.subscribe, props.store.getSnapshot);
			const [error, setError] = (0, react.useState)(null);
			const [cache, setCache] = (0, react.useState)(null);
			const [cacheNote, setCacheNote] = (0, react.useState)(null);
			const [library, setLibrary] = (0, react.useState)({
				author: [],
				custom: []
			});
			const [libraryNote, setLibraryNote] = (0, react.useState)(null);
			const t = props.t;
			const readCache = props.cacheInfo;
			const wipeCache = props.clearCache;
			const readLibrary = props.loadLibrary;
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
					setError(t("settings.library.addFailed"));
					return;
				}
				setError(null);
				setLibraryNote(fmt(t("settings.library.added"), { name }));
				await refreshLibrary();
			};
			/** Remove one imported sound and reload the list. */
			const removeCustomSound = async (id) => {
				const removed = await props.deleteSound(id);
				setLibraryNote(removed ? t("settings.library.removed") : t("settings.library.addFailed"));
				if (removed) await refreshLibrary();
			};
			/**
			* Preview one sound.
			*
			* A group set to the custom sound has nothing to play until a file is chosen,
			* so the click explains that instead of raising a toast with the system chime.
			*/
			const preview = (sound) => {
				const fromLibrary = sound.startsWith("custom:") || sound.startsWith("author:");
				const known = library.custom.some((item) => item.id === sound) || library.author.some((item) => item.id === sound);
				if (fromLibrary && !known) {
					setError(t("settings.library.missing"));
					return;
				}
				setError(null);
				props.sendTest(sound);
			};
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
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
								id: "dsh-notify-sound",
								checked: settings.soundEnabled,
								label: t("settings.sound"),
								desc: t("settings.soundDesc"),
								onChange: (checked) => {
									props.set({ soundEnabled: checked });
								}
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_card",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_cardTitle",
								children: t("settings.sounds.title")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_cardDesc",
								children: t("settings.sounds.desc")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_sounds",
								children: SOUND_ROWS.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsh_notify_soundRow",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsh_notify_soundLabel",
											children: t(row.key)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SoundPicker, {
											value: settings.sounds[row.group],
											library,
											labelOf: soundLabel,
											t,
											onPick: (chosen) => {
												props.set({ sounds: {
													...settings.sounds,
													[row.group]: chosen
												} });
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh_notify_button dsh_notify_preview",
											style: { width: "68px" },
											onClick: () => {
												preview(settings.sounds[row.group]);
											},
											children: t("settings.sounds.preview")
										})
									]
								}, row.group))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_customRow",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsh_notify_soundLabel",
										children: t("settings.library.title")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh_notify_customControls",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsh_notify_cacheText",
											children: library.custom.length === 0 ? t("settings.library.empty") : fmt(t("settings.library.count"), {
												files: String(library.custom.length),
												size: formatBytes(library.custom.reduce((sum, item) => sum + item.bytes, 0))
											})
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh_notify_button",
											onClick: () => {
												addCustomSound();
											},
											children: t("settings.library.add")
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
													className: "dsh_notify_iconButton",
													onClick: () => {
														removeCustomSound(item.id);
													},
													children: t("settings.library.remove")
												})
											]
										}, item.id))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh_notify_rowDesc",
										children: fmt(t("settings.library.desc"), { path: "%LOCALAPPDATA%\\dsh-notify\\custom" })
									}),
									libraryNote === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh_notify_note",
										children: libraryNote
									}),
									error === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh_notify_error",
										children: error
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh_notify_customRow",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsh_notify_soundLabel",
										children: t("settings.cache.label")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh_notify_customControls",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsh_notify_cacheText",
											children: cache === null || cache.files === 0 ? t("settings.cache.empty") : fmt(t("settings.cache.inUse"), {
												files: String(cache.files),
												size: formatBytes(cache.bytes)
											})
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
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
										})]
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
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_card",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_cardTitle",
								children: t("settings.when.title")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_cardDesc",
								children: t("settings.when.subtitle")
							}),
							OUTCOMES.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
								id: "dsh-notify-" + entry.field,
								checked: settings[entry.field],
								label: t(entry.key),
								onChange: (checked) => {
									props.set({ [entry.field]: checked });
								}
							}, entry.field))
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_card",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_cardTitle",
								children: t("settings.pending.title")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_cardDesc",
								children: t("settings.pending.subtitle")
							}),
							PENDING.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
								id: "dsh-notify-" + entry.field,
								checked: settings[entry.field],
								label: t(entry.key),
								onChange: (checked) => {
									props.set({ [entry.field]: checked });
								}
							}, entry.field))
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_card",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_cardTitle",
								children: t("settings.remind.title")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_cardDesc",
								children: t("settings.remind.desc")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dsh_notify_minutes",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "number",
									min: 1,
									max: 240,
									value: settings.remindAfterMinutes,
									onChange: (event) => {
										const next = Number(event.target.value);
										if (Number.isFinite(next)) props.set({ remindAfterMinutes: next });
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("settings.remind.minutes") })]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh_notify_card",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_cardTitle",
								children: t("settings.test.title")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_cardDesc",
								children: t("settings.test.desc")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsh_notify_button",
								onClick: () => {
									preview(settings.sounds.finished);
								},
								children: t("settings.test.button")
							}),
							error === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh_notify_error",
								children: error
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
		/** A library id: what a folder listing produced, and the only ids not in SOUND_IDS. */
		const LIBRARY_ID = /^(?:custom|author):[^\\/:*?"<>|]+$/;
		/**
		* One sound id, or the default for that group when the stored value is unknown.
		*
		* Library ids (`custom:` / `author:`) are accepted even though they are not in
		* the static catalog: the host's folder listing decides what exists, and
		* rejecting them here silently reset every custom choice back to the default.
		*/
		function clampSound(group, value) {
			if (typeof value !== "string") return DEFAULT_SETTINGS.sounds[group];
			if (SOUND_IDS.includes(value)) return value;
			return LIBRARY_ID.test(value) ? value : DEFAULT_SETTINGS.sounds[group];
		}
		/**
		* Clamp the stored sound map back into the settings domain, group by group.
		* @param value - whatever was persisted.
		* @returns a complete map, defaulted per group.
		*/
		function clampSounds(value) {
			const saved = value ?? {};
			const out = {};
			for (const group of SOUND_GROUPS) out[group] = clampSound(group, saved[group]);
			return out;
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
				const merged = {
					...DEFAULT_SETTINGS,
					...saved
				};
				return {
					...merged,
					remindAfterMinutes: clampMinutes(merged.remindAfterMinutes),
					sounds: clampSounds(merged.sounds)
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
						remindAfterMinutes: clampMinutes(patch.remindAfterMinutes ?? snapshot.remindAfterMinutes),
						sounds: clampSounds(patch.sounds ?? snapshot.sounds)
					};
					snapshot = next;
					writeSettings(next, storage);
					for (const listener of [...listeners]) listener();
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
/* The imported-sound list: one quiet row per file, hover to reveal the action. */
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
.dsh_notify_rowDesc { font-size: 12px; opacity: 0.66; }
.dsh_notify_minutes { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.dsh_notify_minutes input {
  width: 72px;
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  background: transparent;
  color: inherit;
}
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
 * The sound rows are a fixed three-column grid, and every control is sized
 * explicitly: the surrounding settings theme gives a select element a full
 * width and its own height, which turned each row into three stacked lines.
 * The selectors below are written long enough to win against those theme rules
 * without needing an important flag.
 */
.dsh_notify_sounds { display: flex; flex-direction: column; gap: 2px; }
.dsh_notify_card .dsh_notify_soundRow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 148px 68px;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  min-height: 38px;
}
.dsh_notify_card .dsh_notify_soundRow + .dsh_notify_soundRow {
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.16));
}
.dsh_notify_card .dsh_notify_soundLabel { font-size: 13px; line-height: 1.4; }
/*
 * The select is drawn by hand: the native one (grey hairline, system arrow,
 * square focus ring) looked nothing like the rest of the section. appearance is
 * none with an inline chevron, and the surface matches the row's own layer.
 */
.dsh_notify_card .dsh_notify_soundRow .dsh_notify_select {
  width: 148px;
  min-width: 148px;
  max-width: 148px;
  height: 30px;
  margin: 0;
  padding: 0 24px 0 10px;
  font-size: 12px;
  line-height: 28px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  background-color: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.08));
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6'><path d='M1 1l4 4 4-4' fill='none' stroke='%23909aa8' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  background-repeat: no-repeat;
  background-position: right 9px center;
  background-size: 10px 6px;
  appearance: none;
  -webkit-appearance: none;
  color: inherit;
  cursor: pointer;
  transition: border-color 120ms ease, background-color 120ms ease;
}
.dsh_notify_card .dsh_notify_soundRow .dsh_notify_select:hover {
  border-color: var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.45));
  background-color: var(--dsw-alias-bg-layer-3, rgba(127, 127, 127, 0.14));
}
.dsh_notify_card .dsh_notify_soundRow .dsh_notify_select:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, rgba(77, 107, 254, 0.6));
  outline-offset: 1px;
  border-color: transparent;
}
.dsh_notify_card .dsh_notify_customRow {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 10px;
  margin-top: 2px;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.16));
}
.dsh_notify_card .dsh_notify_customControls { display: flex; align-items: center; gap: 8px; }
.dsh_notify_card .dsh_notify_customControls .dsh_notify_pathInput {
  flex: 1 1 auto;
  width: auto;
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
.dsh_notify_card .dsh_notify_customControls .dsh_notify_button {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  white-space: nowrap;
  flex: 0 0 auto;
}
/*
 * The two-level picker: the trigger keeps the old select's footprint, the panel
 * floats above the card with the section headers as level one.
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
/* The preview button is the picker trigger's twin: same height, radius and surface. */
.dsh_notify_card .dsh_notify_soundRow .dsh_notify_preview {
  width: 68px;
  height: 30px;
  margin: 0;
  padding: 0;
  font-size: 12px;
  line-height: 28px;
  text-align: center;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  background-color: transparent;
  align-self: center;
  transition: border-color 120ms ease, background-color 120ms ease;
}
.dsh_notify_card .dsh_notify_soundRow .dsh_notify_preview:hover {
  border-color: var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.45));
  background-color: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12));
}
.dsh_notify_card .dsh_notify_soundRow .dsh_notify_preview:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, rgba(77, 107, 254, 0.6));
  outline-offset: 1px;
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
			const set = (patch) => {
				store.update(patch);
				if (patch.soundEnabled === false) silenceSounds();
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
					firstSeenAt: ask.firstSeenAt,
					reminded: false
				});
				report("pending " + where + " focused=" + String(focused) + " -> " + (decision === null ? "suppressed" : "toast"));
				if (decision === null) return;
				showToast({
					title: toastTitle(ask.label, t(shortPendingKey(ask.kind))),
					body: bodyText(plainSummary(ask.summary), t("notify.pendingBody")),
					tag: pendingTag(ask.sessionId, ask.requestId),
					sound: decision.sound,
					onClick: ask.sessionId === "" ? () => {
						focusWindowRequest();
					} : () => {
						activate(ask.sessionId);
					}
				});
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
						report("turn " + String(projection.turn) + " reason=" + String(reason) + " focused=" + String(focused) + " -> " + (decision === null ? "suppressed" : "toast"));
						if (decision !== null && reason !== void 0) {
							showToast({
								title: toastTitle(toastName, t(shortReasonKey(reason))),
								body: bodyText(plainSummary(projection.body), t("notify.emptyBody")),
								tag: notificationTag(id, projection.turn),
								sound: decision.sound,
								onClick: () => {
									activate(id);
								}
							});
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
				for (const due of dueReminders([...waits.values()], settings, now)) {
					const current = waits.get(due.key);
					if (current === void 0 || current.reminded) continue;
					waits.set(due.key, {
						...current,
						reminded: true
					});
					if (focused) continue;
					showToast({
						title: toastTitle(sessionLabel(due.sessionId), t("notify.shortReminder")),
						body: fmt(t("notify.reminderBody"), { minutes: String(settings.remindAfterMinutes) }),
						tag: reminderTag(due.sessionId, due.requestId),
						sound: groupSound(settings, "reminder"),
						onClick: () => {
							activate(due.sessionId);
						}
					});
				}
			};
			const sendTest = (sound) => {
				previewToast({
					title: t("notify.testTitle"),
					body: t("notify.testBody"),
					tag: "dsh-notify-test-" + String(Date.now()),
					sound: sound ?? groupSound(store.getSnapshot(), "finished"),
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