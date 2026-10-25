/**
 * The client-persisted notification preferences: a tiny observable store over
 * localStorage. The host knows nothing of these preferences — the client owns
 * them, and every read is tolerant of a missing or unwritable storage.
 *
 * The stored shape grew twice: an old `soundEnabled` boolean became the
 * delivery `mode`, and the first template iteration's single title/body pair
 * became per-situation text choices. Both migrations happen here, at read time,
 * so no version bump or separate migration step is needed.
 */
import { type NotifySettings, type NotifySounds, type NotifyTexts } from '../types.ts';
/** Persist key; the version suffix lets a shape change migrate instead of crash. */
export declare const PERSIST_KEY = "dsh-notify-desktop.v1";
/** The slice of Web Storage this module needs (absent in some embeddings). */
export interface SettingsStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
/** The observable settings face shared by the runner and the settings section. */
export interface SettingsStore {
    /** The current settings; the reference is stable until {@link update}. */
    getSnapshot(): NotifySettings;
    subscribe(listener: () => void): () => void;
    update(patch: Partial<NotifySettings>): void;
}
/**
 * Clamp the stored sound map back into the settings domain, situation by
 * situation. A stored value under the new shape wins; otherwise the old
 * four-group value is inherited, which is how a pre-upgrade sound choice
 * survives.
 * @param value - whatever was persisted.
 * @returns a complete map, defaulted per situation.
 */
export declare function clampSounds(value: unknown): NotifySounds;
/**
 * Clamp the stored text choices: `default` or a template id. Unknown values
 * (including a template deleted while the settings survived) read as the
 * default text; the runner falls back the same way if a chosen id is missing.
 * @param value - whatever was persisted.
 * @returns a complete choice map.
 */
export declare function clampTexts(value: unknown): NotifyTexts;
/**
 * Read the persisted settings, layering them over the defaults so a partial or
 * older payload never yields a half-formed settings object.
 * @param storage - the storage to read (defaults to the ambient localStorage).
 * @returns the effective settings.
 */
export declare function readSettings(storage?: SettingsStorage | undefined): NotifySettings;
/**
 * Persist the settings; a storage failure is swallowed (preferences are a
 * convenience, never a correctness requirement).
 * @param settings - the settings to write.
 * @param storage - the storage to write to (defaults to the ambient localStorage).
 */
export declare function writeSettings(settings: NotifySettings, storage?: SettingsStorage | undefined): void;
/**
 * Create the settings store backing both the settings section and the
 * notification runner.
 * @param storage - the storage to persist into (defaults to the ambient localStorage).
 * @returns the observable store.
 */
export declare function createSettingsStore(storage?: SettingsStorage | undefined): SettingsStore;
