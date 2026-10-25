/** One resolved sound: the event name and the wav the scheme points at. */
export interface EventWav {
    /** The event name the sound id names, e.g. `Notification.IM`. */
    readonly event: string;
    /** The absolute wav path the scheme maps it to. */
    readonly wav: string;
}
/**
 * Resolve the notification events in one `reg query` output.
 * @param output - the child's stdout, decoded as text.
 * @param exists - file-existence probe (injected so this stays a pure function).
 * @returns one entry per notification event whose wav exists, in output order.
 */
export declare function parseEventWavs(output: string, exists: (path: string) => boolean): EventWav[];
