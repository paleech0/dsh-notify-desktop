import { type ChannelConfig } from './channels.ts';
/** The folder the channels file lives in. */
export declare function channelsDir(root: string): string;
/** The channels file itself. */
export declare function channelsFile(root: string): string;
/** The version this build writes. */
export declare const CHANNELS_STORE_VERSION = 1;
/**
 * Read every channel. A missing, unreadable or malformed file reads as an empty
 * list rather than an error: the caller always has something usable. Each entry
 * is normalized by {@link normalizeChannel}, which keeps a half-filled draft
 * (it only drops an entry that is structurally unusable, never one that is
 * merely missing a required field).
 * @param root - the app-data root.
 * @returns the configured channels, capped and validated.
 */
export declare function readChannels(root: string): ChannelConfig[];
/**
 * Write every channel back, atomically.
 * @param root - the app-data root.
 * @param channels - the complete list to store.
 * @returns true when the file was replaced.
 */
export declare function writeChannels(root: string, channels: readonly ChannelConfig[]): boolean;
/** Why a save was refused. */
export type ChannelStoreProblem = 'type' | 'fields' | 'limit' | 'missing' | 'io';
/** The outcome of one save. */
export type ChannelSaveResult = {
    readonly ok: true;
    readonly channels: readonly ChannelConfig[];
    readonly channel: ChannelConfig;
} | {
    readonly ok: false;
    readonly problem: ChannelStoreProblem;
    readonly missing?: readonly string[];
};
/** The outcome of one delete. */
export type ChannelDeleteResult = {
    readonly ok: true;
    readonly channels: readonly ChannelConfig[];
} | {
    readonly ok: false;
    readonly problem: ChannelStoreProblem;
};
/**
 * Save one channel: replace an existing entry by id, or add a new one while the
 * list still has room. Required fields are enforced here, at the host, so an
 * out-of-date renderer cannot store an unusable channel.
 * @param root - the app-data root.
 * @param raw - the channel the renderer posted.
 * @returns the new list, or the reason it was refused.
 */
export declare function saveChannel(root: string, raw: unknown): ChannelSaveResult;
/**
 * Delete one channel.
 * @param root - the app-data root.
 * @param id - the channel id.
 * @returns the new list, or the reason it was refused.
 */
export declare function deleteChannel(root: string, id: unknown): ChannelDeleteResult;
