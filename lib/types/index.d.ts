import type { Context } from '@deepseek-ai/cordis';
/** Cordis plugin name (the Loader entry and the client bundle id). */
export declare const name = "dsh-notify-desktop";
/** Services required before load: the projection registry. */
export declare const inject: string[];
export { FOCUS_HEADER, FOCUS_ROUTE } from './protocol.ts';
/**
 * Raise the DSH window. The desktop shell owns the window, and its second
 * instance path (`dsh://open` -> single-instance -> restore/show/focus) is the
 * only supported way to bring it back from the tray; the renderer cannot.
 */
export declare function focusDesktopWindow(): void;
/** The diagnostics route (GET) used while bringing the projection seam up. */
export declare const DEBUG_ROUTE = "/dsh-notify/debug";
/**
 * Rename one imported custom sound, keeping its extension.
 * @param id - the 'custom:<file>' id to rename.
 * @param raw - the new display name the user typed.
 * @returns the file's new name, or a problem code.
 */
export declare function renameSound(id: unknown, raw: unknown): {
    name: string;
} | {
    problem: string;
};
/**
 * The identity half of the child script: pick the first candidate the OS
 * actually knows.
 *
 * `CreateToastNotifier` answers for any string, but only a registered identity
 * reports a `Setting` value; an unregistered one reports null. The candidates
 * arrive newest-first through the environment (never in the command text), and
 * the winner is printed so the host can put it in the diagnostics ring. When
 * none is registered the last candidate (the legacy identity) is used anyway:
 * failing explicitly buys nothing here, and the sound still plays.
 */
export declare const AUMID_RESOLVE_LINES: readonly string[];
/**
 * The toast half of the child script: resolve the identity, build the XML from
 * the environment variable, show it through that identity.
 */
export declare const TOAST_SCRIPT_LINES: readonly string[];
/**
 * The media half of the child script: the toast is muted and the host plays the
 * sound itself, in this same child, always through .NET's SoundPlayer — the
 * only player that works here (the WinRT/WPF/WMP stacks never open a file from
 * a spawned child; measured with a dispatcher pump too). A non-wav source is
 * transcoded to a cached wav first, so the audio path never touches the media
 * stack. PlaySync keeps the process alive until the sound ends, and every path
 * arrives through an environment variable, never in the command.
 *
 * Exported so the sound-only spawn's encoded copy can be pinned to it by a test.
 */
export declare const MEDIA_SCRIPT_LINES: readonly string[];
/**
 * Build the toast XML for one notification.
 *
 * Split out from the spawn so the sticky shape (and its load-bearing dismiss
 * button) can be asserted without starting PowerShell.
 * @param title - toast headline.
 * @param body - toast body, already reduced to one line.
 * @param audio - the `<audio>` element chosen for this toast.
 * @param sticky - the dismiss-button label when the toast must stay on screen.
 * @returns the complete toast XML.
 */
export declare function buildToastXml(title: string, body: string, audio: string, sticky?: {
    readonly dismissLabel: string;
}): string;
/**
 * Register the projection and the routes.
 *
 * Async on purpose: 0.2.2 returns an awaitable registration handle, and awaiting
 * it is the documented replacement for the deprecated `stateOf(session, key)`
 * read. The owning fiber still releases the registration on unload.
 * @param ctx - host cordis context.
 */
export declare function apply(ctx: Context): Promise<void>;
