/**
 * Questions arrive over the remote waterfall, not the session projection.
 *
 * Measured on 0.2.0-rc.2: a plan review is a *service-level* ask — the
 * plan-mode package calls `interaction.ask({intent:{kind:'plan-review'}})` —
 * and service-level asks never reach the session log. The official
 * `userQuestions` projection folds only five event types (request/header,
 * tool/call, tool/result, tool/ptc-dispatch, user/message) and only tracks the
 * *timed* tool schema, so plan reviews are invisible to any projection reader.
 *
 * The one channel that carries every question — tool-call, timed, and plan
 * review alike — is the forwarded waterfall `user-questions/request`, a legal
 * `ctx.remote.$on` key (see the forwarded-event allowlist in
 * `@deepseek-ai/dsh-api-remotes`) and exactly what the harness' own question
 * UI listens on.
 */
import type { PendingKind } from '../types.ts';
/** What a forwarded request tells the notification layer. */
export interface ObservedQuestion {
    /** Which scenario switch governs this question. */
    readonly kind: PendingKind;
    /** The one-line summary that becomes the toast body. */
    readonly summary: string;
    /** Identity for dedupe and reminder bookkeeping. */
    readonly requestKey: string;
}
/**
 * Read a forwarded question request.
 *
 * An unknown `intent.kind` is treated as an ordinary question rather than
 * dropped: a future question flavour should still notify.
 * @param input - the request the waterfall handed over.
 * @returns the kind, the summary and a dedupe key, or undefined when the
 * request carries no question this plugin can describe.
 */
export declare function questionRequest(input: unknown): ObservedQuestion | undefined;
/**
 * The abort signal of a forwarded request, when it carries one.
 * @param input - the request the waterfall handed over.
 * @returns the signal, or undefined.
 */
export declare function requestSignal(input: unknown): AbortSignal | undefined;
