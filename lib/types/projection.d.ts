/**
 * The `notify` projection unit: a pure fold of one session's committed events
 * into the last finished turn plus every interaction currently blocking on the
 * user. Registered on `ctx.sessionProjections`, whose seam drives `apply` over
 * every committed event and hands the `wire` view to every browser client — no
 * harness change and no forwarded-event allowlist extension.
 *
 * Everything here is pure: the fold returns the SAME state reference for
 * events it does not care about, because the registry's change feed gates on
 * `Object.is` of the view.
 */
import { type ZodType } from 'zod';
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { NotifyProjectionValue, PendingInteraction, PendingKind } from './types.ts';
/** Character budget for the projected reply text. */
export declare const MAX_BODY_CHARS = 400;
/** The projection key this plugin owns. */
export declare const NOTIFY_KEY = "notify";
/** One finished turn, as far as notifications are concerned. */
interface FinishedTurn {
    readonly turn: number;
    readonly reason: string;
    readonly body: string;
}
/** Fold state plus its cached wire view (the view must be reference-stable). */
export interface NotifyState {
    /** Events at or below this seq are fork-inherited and skipped. */
    readonly inheritedEventCount: number;
    /** The open turn's accumulated reply text; null outside a turn. */
    readonly open: {
        readonly turn: number;
        readonly text: string;
    } | null;
    /** The last finished turn; null before the first one. */
    readonly last: FinishedTurn | null;
    /** Blocking interactions, in first-seen order. */
    readonly pending: readonly PendingInteraction[];
    /** Host clock (ms) of the last folded event. */
    readonly updatedAt: number;
    /** Cached wire view; rebuilt only when the fold changed. */
    readonly view: NotifyProjectionValue;
}
/** The empty-log view. */
export declare const EMPTY_VIEW: NotifyProjectionValue;
/**
 * Bound one reply to the body budget, ellipsizing on overflow.
 * @param text - the accumulated reply text.
 * @param maxChars - the character budget.
 * @returns the bounded text.
 */
export declare function boundText(text: string, maxChars: number): string;
/** The initial fold; `inheritedEventCount` comes from the session's fork cut. */
export declare function initialState(inheritedEventCount: number): NotifyState;
/**
 * The programmatic-tool-calling events, declared here because 0.2.0-rc.2 ships
 * no type entry for them in the published packages (their runtime shape was
 * read from a real session log: an `ask_user_question` invoked from inside
 * `run_code` appears only as these two events, never as `tool/call`).
 */
declare module '@deepseek-ai/dsh-session/types' {
    interface SessionEventMap {
        'tool/ptc-dispatch-start': {
            rootCallId: string;
            parentCallId: string;
            subCallId: string;
            name: string;
            arguments?: unknown;
        };
        'tool/ptc-dispatch': {
            rootCallId: string;
            parentCallId: string;
            subCallId: string;
            name: string;
            arguments?: unknown;
            isError?: boolean;
            content?: unknown;
        };
    }
}
/**
 * Read the blocking question out of an `ask_user_question` call's arguments.
 *
 * Two shapes reach this function: a plain `tool/call` carries the arguments as
 * a JSON string, while a `tool/ptc-dispatch-start` (programmatic tool calling)
 * carries them already parsed. Measured in the session log of 0.2.0-rc.2.
 * @param args - the raw argument string or the parsed argument object.
 * @returns the kind, summary, or undefined when this is not a question call.
 */
export declare function questionOf(args: unknown): {
    kind: PendingKind;
    summary: string;
} | undefined;
/**
 * Whether a tool result carries the user's answers (as opposed to a "still
 * waiting" outcome). The answer batch travels as JSON text inside the tool
 * result's content blocks.
 * @param content - the tool result content.
 * @returns true when at least one content block parses to an answers batch.
 */
export declare function carriesAnswers(content: unknown): boolean;
/**
 * Apply one committed event to the fold.
 * @param state - the state covering all prior events.
 * @param event - the next committed event.
 * @param maxChars - the reply-text budget.
 * @returns the next state, or the same reference when nothing changed.
 */
export declare function applyNotifyEvent(state: NotifyState, event: SessionEvent, maxChars?: number): NotifyState;
declare module '@deepseek-ai/dsh-session-projection/types' {
    interface SessionProjectionStateMap {
        notify: NotifyState;
    }
}
/**
 * The `notify` unit as registered: the registry's overload for a client-visible
 * key demands the wire block be present, not merely optional.
 */
export type NotifyProjectionDefinition = ProjectionDefinition<typeof NOTIFY_KEY, NotifyState> & {
    wire: {
        viewSchema: ZodType<NotifyProjectionValue>;
        view(state: NotifyState): NotifyProjectionValue;
    };
};
/**
 * Build the `notify` projection unit.
 * @param maxChars - the reply-text budget folded host-side.
 * @returns the projection definition registered on the projection seam.
 */
export declare function notifyProjection(maxChars?: number): NotifyProjectionDefinition;
export {};
