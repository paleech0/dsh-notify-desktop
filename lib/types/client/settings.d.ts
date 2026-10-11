/**
 * The client-persisted notification preferences: a tiny observable store over
 * localStorage. The host knows nothing of these preferences — the client owns
 * them, and every read is tolerant of a missing or unwritable storage.
 */
import { type NotifySettings, type NotifySounds } from '../types.ts';
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
 * Clamp the stored sound map back into the settings domain, group by group.
 * @param value - whatever was persisted.
 * @returns a complete map, defaulted per group.
 */
export declare function clampSounds(value: unknown): NotifySounds;
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
