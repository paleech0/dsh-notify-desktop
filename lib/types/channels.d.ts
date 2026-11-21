/**
 * The external-push channel catalogue, shared by both halves.
 *
 * DSH's own notification surface (a Windows toast) only reaches the desktop;
 * these channels carry the same signals out to a phone / chat app / mailbox the
 * way 青龙 / MAA / 三月七小助手 do. The data model is deliberately plain: every
 * channel is a `{ id, type, enabled, label, fields }` record, and each type
 * declares which string fields its form shows. The host validates and stores
 * them; the settings UI renders the form from {@link CHANNEL_FIELDS}.
 *
 * The secrets live only in the host-side file (`%LOCALAPPDATA%\dsh-notify\
 * channels.json`), never in the browser's localStorage.
 */
/** Every channel kind this build can deliver to, in catalogue order. */
export declare const CHANNEL_TYPES: readonly ["auto", "webhook", "bark", "serverchan", "pushplus", "wecom", "dingtalk", "feishu", "telegram", "ntfy", "gotify", "slack", "discord", "wxpusher", "pushdeer", "qmsg", "meow", "kook", "onebot", "matrix", "pushover", "smtp"];
/** One channel kind. */
export type ChannelType = (typeof CHANNEL_TYPES)[number];
/** Whether a value names a known channel type. */
export declare function isChannelType(value: unknown): value is ChannelType;
/** One editable field in a channel's form. */
export interface ChannelField {
    /** The key inside {@link ChannelConfig.fields}. */
    readonly key: string;
    /** The locale key for the field label. */
    readonly labelKey: string;
    /** Whether the field must be non-empty before the channel can be saved. */
    readonly required: boolean;
    /** Render the input as a password box (tokens, passwords). */
    readonly secret?: boolean;
    /** Input kind; `text` when omitted. */
    readonly kind?: 'text' | 'password' | 'number' | 'select';
    /** Allowed values for a `select` field. */
    readonly options?: readonly string[];
    /** Placeholder text. */
    readonly placeholder?: string;
}
export declare const CHANNEL_FIELDS: Readonly<Record<ChannelType, readonly ChannelField[]>>;
/** The locale key for one channel type's display name. */
export declare function channelTypeKey(type: ChannelType): string;
/** One configured channel. */
export interface ChannelConfig {
    /** Stable id (`ch_...`), used to edit/delete/test one channel. */
    readonly id: string;
    /** Which kind of channel. */
    readonly type: ChannelType;
    /** Whether this channel currently receives pushes. */
    readonly enabled: boolean;
    /** A user label; empty means "show the type name". */
    readonly label: string;
    /** Every field value, keyed by {@link ChannelField.key}. */
    readonly fields: Readonly<Record<string, string>>;
    /**
     * Which situations this channel receives (the scenario ids). Empty means all
     * of them; a non-empty list narrows it, so e.g. an errors-only channel only
     * gets errors.
     */
    readonly scenarios: readonly string[];
    /** Title template override for this channel; empty inherits the situation text. */
    readonly titleTemplate: string;
    /** Body template override for this channel; empty inherits the situation text. */
    readonly bodyTemplate: string;
    /** Send markdown where the channel supports it (企业微信 / 钉钉 / 飞书). */
    readonly markdown: boolean;
}
/** One message to push out through the channels. */
export interface PushMessage {
    /** Short title (the toast title). */
    readonly title: string;
    /** Body text (the toast body / turn summary). */
    readonly body: string;
    /** Rough severity, used for channel priorities. */
    readonly level: 'info' | 'warning' | 'error';
    /** The situation that raised it (completed / approval / reminder / ...). */
    readonly scenario: string;
    /** The workspace/session label for the source line. */
    readonly source: string;
    /** When the signal fired (ms). */
    readonly timestamp: number;
    /**
     * Raw placeholder values a per-channel template can use: `工作区`, `状态`,
     * `内容`, `分钟`. The host renders a channel's title/body override against
     * these, so one message can be re-worded per channel.
     */
    readonly vars: Readonly<Record<string, string>>;
}
/** The outcome of delivering one message to one channel. */
export interface ChannelReceipt {
    readonly id: string;
    readonly type: string;
    readonly label: string;
    readonly ok: boolean;
    /** HTTP status when the channel is HTTP-based. */
    readonly status?: number;
    /** Human-readable failure reason when `ok` is false. */
    readonly error?: string;
}
/** Prefix every channel id carries. */
export declare const CHANNEL_ID_PREFIX = "ch_";
/** The most channels a profile may hold. */
export declare const CHANNEL_LIMIT = 50;
/** Whether a value is a well-formed channel id. */
export declare function isChannelId(value: unknown): value is string;
/** The trimmed string value of one field ('' when absent). */
export declare function fieldValue(channel: ChannelConfig, key: string): string;
/**
 * Which required fields a channel is still missing, by key.
 * @param channel - the candidate channel.
 * @returns the keys whose required field is blank (empty when complete).
 */
export declare function missingRequiredFields(channel: ChannelConfig): string[];
/**
 * Validate and normalize one channel value (from disk or the renderer). Unknown
 * fields are dropped, non-string fields become '', and a structurally invalid
 * record reads as null. Required fields are NOT enforced here — the store's
 * save path enforces them so an in-progress draft can round-trip.
 * @param value - whatever was stored or posted.
 * @returns the clean channel, or null when it is not usable.
 */
export declare function normalizeChannel(value: unknown): ChannelConfig | null;
/** One auto-detection result: the channel type a pasted value looks like. */
export interface ChannelDetection {
    readonly type: ChannelType;
    readonly fields: Record<string, string>;
    /** Required fields the pasted value does not provide (empty = usable as-is). */
    readonly missing: string[];
}
/**
 * Guess which channel a pasted value belongs to.
 *
 * The "auto" channel lets the user paste one string — a group-bot webhook, a
 * Server酱 key, a Bark device key, an ntfy topic URL, or any https URL — and
 * this decides the concrete channel. URLs are matched by host; bare values only
 * by an unmistakable prefix (`SCT…` / `sctp…` / `AT_…` / a Telegram bot token).
 * A non-empty `missing` means the type was recognized but the paste cannot
 * supply every required field (for example a Telegram bot token with no chat
 * id). The console URLs (`sct.ftqq.com`, `sc3.ft07.com`) are not endpoints and
 * read as unrecognized.
 * @param raw - whatever the user pasted.
 * @returns the detection, or null when nothing matches.
 */
export declare function detectChannelValue(raw: string): ChannelDetection | null;
