/**
 * The `notify` locale namespace: the settings-section copy and the toast
 * titles. Chinese is the product copy; English mirrors it key for key.
 */
/** Simplified Chinese dictionary (the key-set source of truth). */
export declare const zh: {
    readonly nav: "通知";
    readonly 'settings.title': "桌面通知";
    readonly 'settings.subtitle': "会话跑完、出错、或停下来等你确认时，弹出 Windows 通知；点通知可以回到对应会话。";
    readonly 'settings.enabled': "启用通知";
    readonly 'settings.enabledDesc': "总开关；关闭后不再弹任何通知，下面的偏好会保留。";
    readonly 'settings.sound': "提示音";
    readonly 'settings.soundDesc': "使用系统通知自带提示音；关闭后静音弹出。";
    readonly 'settings.when.title': "结束提醒";
    readonly 'settings.when.subtitle': "选择哪些结束状态需要提醒。";
    readonly 'settings.when.completed': "正常完成";
    readonly 'settings.when.error': "出错";
    readonly 'settings.when.aborted': "被中止";
    readonly 'settings.when.blocked': "被阻塞";
    readonly 'settings.when.maxTokens': "达到 Token 上限";
    readonly 'settings.pending.title': "等待确认";
    readonly 'settings.pending.subtitle': "会话停下来等你审批、回答或评审计划时提醒。";
    readonly 'settings.pending.approval': "等待审批";
    readonly 'settings.pending.question': "等待回答";
    readonly 'settings.pending.planReview': "等待计划评审";
    readonly 'settings.remind.title': "超时催办";
    readonly 'settings.remind.desc': "等待确认超过设定分钟数仍未处理时，补一条提醒（每次等待只补一次）。";
    readonly 'settings.remind.minutes': "分钟";
    readonly 'settings.test.title': "测试";
    readonly 'settings.test.desc': "发一条测试通知，确认权限与提示音正常。";
    readonly 'settings.test.button': "发送测试通知";
    readonly 'settings.sounds.title': "音效";
    readonly 'settings.sounds.desc': "给四类情况各挑一个声音，点「试听」立刻听一遍。下拉里分三组：Windows 音效 / 作者音效 / 自定义音效。文件类音效最长播 8 秒；关掉上面的「提示音」或者切回 DSH 窗口，都会立刻停。";
    readonly 'settings.sounds.finished': "任务正常结束";
    readonly 'settings.sounds.error': "任务出错";
    readonly 'settings.sounds.attention': "需要你处理（审批 / 提问 / 计划评审）";
    readonly 'settings.sounds.reminder': "超时催办";
    readonly 'settings.sounds.preview': "试听";
    readonly 'settings.sound.systemDefault': "系统提示音（叮）";
    readonly 'settings.sound.systemIm': "系统消息";
    readonly 'settings.sound.systemMail': "系统邮件";
    readonly 'settings.sound.systemCalendar': "系统日历";
    readonly 'settings.sound.fileDing': "叮（轻）";
    readonly 'settings.sound.fileChimes': "和弦（柔和）";
    readonly 'settings.sound.fileNotify': "Windows 通知";
    readonly 'settings.sound.fileNotifyLegacy': "旧版通知";
    readonly 'settings.sound.fileMessageNudge': "消息轻推";
    readonly 'settings.sound.fileTada': "完成号角";
    readonly 'settings.sound.fileExclamation': "警告";
    readonly 'settings.sound.fileError': "错误";
    readonly 'settings.sound.fileCriticalStop': "严重错误";
    readonly 'settings.sound.fileAlarm1': "闹钟 1";
    readonly 'settings.sound.fileAlarm2': "闹钟 2";
    readonly 'settings.sound.fileAlarm3': "闹钟 3";
    readonly 'settings.sound.fileRing1': "铃声 1";
    readonly 'settings.sound.fileRing2': "铃声 2";
    readonly 'settings.sound.fileRing3': "铃声 3";
    readonly 'settings.sounds.groupWindows': "Windows 音效";
    readonly 'settings.sounds.groupAuthor': "作者音效";
    readonly 'settings.sounds.groupCustom': "自定义音效";
    readonly 'settings.sounds.authorEmpty': "作者音效：暂无（放在插件 sounds/ 文件夹里）";
    readonly 'settings.sounds.customEmpty': "还没有自定义音效，点下面的「添加音效…」";
    readonly 'settings.library.title': "自定义音效";
    readonly 'settings.library.empty': "还没有自定义音效";
    readonly 'settings.library.count': "音效占用：{files} 个文件 · {size}";
    readonly 'settings.library.add': "添加音效…";
    readonly 'settings.library.remove': "删除";
    readonly 'settings.library.desc': "点「添加音效…」选一个音频文件：它会被复制到 {path}，之后原文件移动或删除都不影响。支持 .wav / .mp3 / .m4a / .aac / .wma / .flac / .ogg / .opus；除 .wav 之外，首次播放时会转成 wav 并计入下面的「转换缓存」——占用和清理都在那里。";
    readonly 'settings.library.added': "已添加：{name}";
    readonly 'settings.library.removed': "已删除";
    readonly 'settings.library.missing': "这个音效文件不在了，重新选一个或再添加一次";
    readonly 'settings.library.addFailed': "操作失败：宿主没有响应，或这个格式不支持";
    readonly 'settings.sound.silent': "静音";
    readonly 'settings.cache.label': "转换缓存";
    readonly 'settings.cache.empty': "暂无转换缓存";
    readonly 'settings.cache.inUse': "缓存占用：{files} 个文件 · {size}";
    readonly 'settings.cache.clear': "清理缓存";
    readonly 'settings.cache.cleared': "已清理 {files} 个缓存文件，释放 {size}";
    readonly 'settings.cache.failed': "清理失败：宿主没有响应";
    readonly 'settings.cache.desc': "上面「自定义音效」里非 wav 的格式，首次播放时会转成 wav 存在本机（%LOCALAPPDATA%\\dsh-notify\\sounds）。缓存随时可以清，下次播放会自动重建。";
    readonly 'notify.shortCompleted': "任务完成";
    readonly 'notify.shortError': "任务出错";
    readonly 'notify.shortAborted': "任务中止";
    readonly 'notify.shortBlocked': "任务阻塞";
    readonly 'notify.shortMaxTokens': "Token 达上限";
    readonly 'notify.shortApproval': "等待审批";
    readonly 'notify.shortQuestion': "等待回答";
    readonly 'notify.shortPlanReview': "等待计划评审";
    readonly 'notify.shortReminder': "仍未处理";
    readonly 'notify.emptyBody': "这一轮已结束。";
    readonly 'notify.pendingBody': "有一条待处理的确认。";
    readonly 'notify.reminderBody': "已经等了 {minutes} 分钟，还没有处理。";
    readonly 'notify.testTitle': "DSH 通知测试";
    readonly 'notify.testBody': "能看到这条通知，说明通知配置正常。";
};
/** The dictionary key set. */
export type NotifyKey = keyof typeof zh;
/** English dictionary, keyed exactly like {@link zh}. */
export declare const en: {
    nav: string;
    'settings.title': string;
    'settings.subtitle': string;
    'settings.enabled': string;
    'settings.enabledDesc': string;
    'settings.sound': string;
    'settings.soundDesc': string;
    'settings.when.title': string;
    'settings.when.subtitle': string;
    'settings.when.completed': string;
    'settings.when.error': string;
    'settings.when.aborted': string;
    'settings.when.blocked': string;
    'settings.when.maxTokens': string;
    'settings.pending.title': string;
    'settings.pending.subtitle': string;
    'settings.pending.approval': string;
    'settings.pending.question': string;
    'settings.pending.planReview': string;
    'settings.remind.title': string;
    'settings.remind.desc': string;
    'settings.remind.minutes': string;
    'settings.test.title': string;
    'settings.test.desc': string;
    'settings.test.button': string;
    'settings.sounds.title': string;
    'settings.sounds.desc': string;
    'settings.sounds.finished': string;
    'settings.sounds.error': string;
    'settings.sounds.attention': string;
    'settings.sounds.reminder': string;
    'settings.sounds.preview': string;
    'settings.sound.systemDefault': string;
    'settings.sound.systemIm': string;
    'settings.sound.systemMail': string;
    'settings.sound.systemCalendar': string;
    'settings.sound.fileDing': string;
    'settings.sound.fileChimes': string;
    'settings.sound.fileNotify': string;
    'settings.sound.fileNotifyLegacy': string;
    'settings.sound.fileMessageNudge': string;
    'settings.sound.fileTada': string;
    'settings.sound.fileExclamation': string;
    'settings.sound.fileError': string;
    'settings.sound.fileCriticalStop': string;
    'settings.sound.fileAlarm1': string;
    'settings.sound.fileAlarm2': string;
    'settings.sound.fileAlarm3': string;
    'settings.sound.fileRing1': string;
    'settings.sound.fileRing2': string;
    'settings.sound.fileRing3': string;
    'settings.sounds.groupWindows': string;
    'settings.sounds.groupAuthor': string;
    'settings.sounds.groupCustom': string;
    'settings.sounds.authorEmpty': string;
    'settings.sounds.customEmpty': string;
    'settings.library.title': string;
    'settings.library.empty': string;
    'settings.library.count': string;
    'settings.library.add': string;
    'settings.library.remove': string;
    'settings.library.desc': string;
    'settings.library.added': string;
    'settings.library.removed': string;
    'settings.library.missing': string;
    'settings.library.addFailed': string;
    'settings.sound.silent': string;
    'settings.cache.label': string;
    'settings.cache.empty': string;
    'settings.cache.inUse': string;
    'settings.cache.clear': string;
    'settings.cache.cleared': string;
    'settings.cache.failed': string;
    'settings.cache.desc': string;
    'notify.shortCompleted': string;
    'notify.shortError': string;
    'notify.shortAborted': string;
    'notify.shortBlocked': string;
    'notify.shortMaxTokens': string;
    'notify.shortApproval': string;
    'notify.shortQuestion': string;
    'notify.shortPlanReview': string;
    'notify.shortReminder': string;
    'notify.emptyBody': string;
    'notify.pendingBody': string;
    'notify.reminderBody': string;
    'notify.testTitle': string;
    'notify.testBody': string;
};
/** The locale namespace registered under ctx.locale. */
export declare const NS = "notify";
/**
 * Fill one dictionary template's `{name}` placeholders.
 * @param template - dictionary text.
 * @param params - placeholder values.
 * @returns the filled text.
 */
export declare function fmt(template: string, params?: Record<string, string>): string;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The notification settings copy and toast titles. */
        [NS]: NotifyKey;
    }
}
