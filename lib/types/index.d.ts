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
 * Register the projection and the focus route.
 * @param ctx - host cordis context.
 */
export declare function apply(ctx: Context): void;
