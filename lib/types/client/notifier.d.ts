/**
 * The toast layer: title/body selection (pure, unit-tested) and the thin
 * `Notification` wrapper. The sound switch only ever flips Electron's
 * `silent` flag, so the OS notification sound is what you hear (decision D4).
 */
import type { SoundId } from '../types.ts';
import type { SoundLibrary } from '../types.ts';
import type { NotifyReason, PendingKind } from '../types.ts';
/**
 * Send one diagnostics line to the host's report route. The desktop shell
 * cannot show a plugin's renderer console to anyone without DevTools open, so
 * every interesting step is mirrored to the host, where the debug route serves
 * it over plain HTTP.
 * @param line - the line to report.
 */
export declare function report(line: string): void;
/**
 * The dictionary keys this feature can render as a status.
 *
 * Only the short form exists: the toast title is composed from the workspace
 * name plus one of these, so the older "DSH 任务完成"-style full titles are gone.
 */
export type TitleKey = 'notify.shortCompleted' | 'notify.shortError' | 'notify.shortAborted' | 'notify.shortBlocked' | 'notify.shortMaxTokens' | 'notify.shortApproval' | 'notify.shortQuestion' | 'notify.shortPlanReview' | 'notify.shortReminder';
/** The short status key for one turn-end reason (composed into the title). */
export declare function shortReasonKey(reason: NotifyReason): TitleKey;
/** The short status key for one blocking interaction. */
export declare function shortPendingKey(kind: PendingKind): TitleKey;
/** The notification body: the projected reply snippet, or the fallback line. */
export declare function bodyText(body: string, fallback: string): string;
/**
 * The grouping tag. Turn- and request-scoped rather than session-scoped: the
 * OS replaces same-tag toasts, and a stale same-tag entry left in the action
 * center silently swallows every later toast carrying it.
 */
export declare function notificationTag(sessionId: string, turn: number): string;
/** The tag for one blocking interaction's toast. */
export declare function pendingTag(sessionId: string, requestId: string): string;
/** The tag for one reminder toast. */
export declare function reminderTag(sessionId: string, requestId: string): string;
/** The notification surface this code may use (absent outside a browser). */
export declare function notificationsApi(): typeof Notification | undefined;
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
export declare function ensureNotificationPermission(): Promise<NotificationPermission>;
/** One toast to show. */
export interface ToastRequest {
    readonly title: string;
    readonly body: string;
    readonly tag: string;
    /** Which sound to play; 'silent' mutes this toast. */
    readonly sound: SoundId;
    readonly onClick: () => void;
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
export declare function requestHostToast(request: ToastRequest): boolean;
/**
 * Stop whatever notification sound is playing right now.
 *
 * The host plays file sounds in its own child process; this is the client half
 * of "switching the sound off also stops the sound that is already playing".
 * @returns a promise that settles when the host answered (failures are silent).
 */
export declare function silenceSounds(): Promise<void>;
/**
 * Ask the host to open the Windows file picker for a wav.
 * @returns the chosen absolute path, or '' when the user cancelled.
 */
export declare function pickSoundFile(): Promise<string>;
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
export declare function appWindowFocused(): Promise<boolean>;
/**
 * Read the sound library: what the plugin ships and what the user imported.
 * @returns both lists, or an empty library when the host is unreachable.
 */
export declare function soundLibrary(): Promise<SoundLibrary>;
/**
 * Copy one picked file into the user's custom-sound folder.
 * @param file - the absolute path the picker returned.
 * @returns the imported name, or null when the host refused it.
 */
export declare function importSound(file: string): Promise<string | null>;
/**
 * Delete one imported custom sound.
 * @param id - the 'custom:<file>' id.
 * @returns true when the host removed it.
 */
export declare function deleteSound(id: string): Promise<boolean>;
/** What the transcoded-wav cache currently costs. */
export interface SoundCacheInfo {
    /** How many cached wavs exist. */
    readonly files: number;
    /** Their total size in bytes. */
    readonly bytes: number;
}
/**
 * Read the sound-cache size from the host.
 * @returns the file count and total bytes, or null when the host is unreachable.
 */
export declare function soundCacheInfo(): Promise<SoundCacheInfo | null>;
/**
 * Empty the sound cache.
 * @returns how many files were removed and how many bytes they held, or null.
 */
export declare function clearSoundCache(): Promise<SoundCacheInfo | null>;
/**
 * Show one toast through the host channel even when the window has focus.
 *
 * The settings section auditions sounds with this: the renderer path can only
 * mute or not (Chromium's Notification cannot name a Windows sound event), so a
 * preview must take the host path to play the exact sound the user picked.
 * @param request - the toast to show.
 * @returns true when the platform accepted a notification.
 */
export declare function previewToast(request: ToastRequest): boolean;
export declare function showToast(request: ToastRequest): boolean;
