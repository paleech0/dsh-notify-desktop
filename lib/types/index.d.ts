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
 * Register the projection and the focus route.
 * @param ctx - host cordis context.
 */
export declare function apply(ctx: Context): void;
