/**
 * dsh-notify-desktop client half.
 *
 * Reads the host `notify` projection off the session list (the projection seam
 * delivers it for every session, so a background session notifies exactly like
 * the visible one), decides whether the signal deserves a Windows toast, shows
 * it, and — on click — raises the window and jumps to that session.
 *
 * Nothing here extends a harness allowlist: the projection, the session list,
 * the settings slot, and the locale registry are all ordinary plugin seams.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
/**
 * Required client services: the session list, the slot registry, the locale
 * registry, and the remote channel that forwards questions.
 */
export declare const inject: string[];
/** How often unanswered waits are re-checked, in milliseconds. */
export declare const REMINDER_TICK_MS = 30000;
/** How often the client polls the host's question queue, in milliseconds. */
export declare const QUESTION_POLL_MS = 2000;
/**
 * Compose the notification surface.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
