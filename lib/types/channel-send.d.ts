import { type ChannelConfig, type ChannelReceipt, type PushMessage } from './channels.ts';
/** A structural subset of `fetch` so this file needs no DOM lib types. */
export interface FetchResponseLike {
    readonly status: number;
    text(): Promise<string>;
}
/** The fetch shape the dispatcher uses (injectable for tests). */
export type FetchLike = (url: string, init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
}) => Promise<FetchResponseLike>;
/** Options for one dispatch run. */
export interface DispatchOptions {
    /** Override the HTTP client (tests inject a mock). */
    readonly fetchImpl?: FetchLike;
    /** Per-request timeout in milliseconds (default 15000). */
    readonly timeoutMs?: number;
    /** The clock used for HMAC timestamps (default Date.now()). */
    readonly now?: number;
    /** Test seam: replace the real SMTP delivery. */
    readonly smtpDeliver?: (channel: ChannelConfig, message: PushMessage) => Promise<void>;
}
/** One prepared HTTP request plus its business-code check. */
export interface HttpCall {
    readonly url: string;
    readonly method: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string | undefined;
    /** Return whether the response means success (beyond a 2xx status). */
    readonly check: ((status: number, json: unknown) => {
        ok: boolean;
        error?: string;
    }) | undefined;
}
/** A channel that could not even be built into a request (bad config). */
export declare class ChannelBuildError extends Error {
}
/**
 * Build the HTTP request for one channel.
 * @param channel - the configured channel.
 * @param message - the message to deliver.
 * @param now - the clock (ms) used for HMAC timestamps.
 * @returns the request to send.
 * @throws {ChannelBuildError} when the config is unusable.
 */
export declare function buildHttpCall(channel: ChannelConfig, message: PushMessage, now: number): HttpCall;
/** The connection plan and raw RFC822 message for one SMTP channel. */
export interface SmtpPlan {
    readonly host: string;
    readonly port: number;
    readonly secure: 'ssl' | 'starttls' | 'none';
    readonly user: string;
    readonly pass: string;
    readonly from: string;
    readonly to: readonly string[];
    readonly data: string;
}
/**
 * Build the SMTP connection plan and the raw RFC822 message.
 * @param channel - the configured smtp channel.
 * @param message - the message to send.
 * @returns everything {@link defaultSmtpDeliver} needs.
 * @throws {ChannelBuildError} when the config is unusable.
 */
export declare function buildSmtpPlan(channel: ChannelConfig, message: PushMessage): SmtpPlan;
/**
 * Deliver one message to one channel, never throwing.
 * @param channel - the channel to use.
 * @param message - the message to deliver.
 * @param options - fetch/timeout/clock/smtp seams.
 * @returns the per-channel receipt.
 */
export declare function sendToChannel(channel: ChannelConfig, message: PushMessage, options?: DispatchOptions): Promise<ChannelReceipt>;
/**
 * Deliver one message to every channel, concurrently, isolating failures.
 * @param channels - the channels to use (disabled ones are skipped).
 * @param message - the message to deliver.
 * @param options - fetch/timeout/clock/smtp seams.
 * @returns one receipt per enabled channel.
 */
export declare function dispatchChannels(channels: readonly ChannelConfig[], message: PushMessage, options?: DispatchOptions): Promise<ChannelReceipt[]>;
