import type { ChannelConfig, ChannelReceipt, ChannelType, PushMessage } from '../channels.ts';
/** One channel being edited in the settings form (`id` is '' for a new one). */
export interface ChannelDraft {
    readonly id: string;
    readonly type: ChannelType;
    readonly enabled: boolean;
    readonly label: string;
    readonly fields: Record<string, string>;
    /** Scenario ids this channel receives; empty = all. */
    readonly scenarios: readonly string[];
    /** Title override template; '' inherits the situation text. */
    readonly titleTemplate: string;
    /** Body override template; '' inherits the situation text. */
    readonly bodyTemplate: string;
    /** Send markdown where supported. */
    readonly markdown: boolean;
}
/** The outcome of saving one channel. */
export type ChannelSaveOutcome = {
    readonly ok: true;
    readonly channels: readonly ChannelConfig[];
    readonly channel: ChannelConfig;
} | {
    readonly ok: false;
    readonly problem: string;
    readonly missing?: readonly string[];
};
/** The outcome of deleting one channel. */
export type ChannelDeleteOutcome = {
    readonly ok: true;
    readonly channels: readonly ChannelConfig[];
} | {
    readonly ok: false;
    readonly problem: string;
};
/**
 * Read every configured channel from the host.
 * @returns the list, or [] when the host is unreachable.
 */
export declare function listChannels(): Promise<ChannelConfig[]>;
/**
 * Save one channel (upsert by id) on the host.
 * @param draft - the channel to save.
 * @returns the new list and saved channel, or the reason it was refused.
 */
export declare function saveChannel(draft: ChannelDraft): Promise<ChannelSaveOutcome>;
/**
 * Delete one channel on the host.
 * @param id - the channel id.
 * @returns the new list, or the reason it was refused.
 */
export declare function deleteChannel(id: string): Promise<ChannelDeleteOutcome>;
/**
 * Fire-and-forget: deliver one notification to every enabled channel.
 * @param message - the message to push.
 */
export declare function pushNotification(message: PushMessage): void;
/**
 * Send a fixed test message to one channel (or every enabled one when id '').
 * @param id - the channel id, or '' for all enabled channels.
 * @returns the per-channel receipts.
 */
export declare function testPush(id: string): Promise<ChannelReceipt[]>;
