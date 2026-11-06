/**
 * The plugin's own language, independent of the DSH interface language.
 *
 * Both dictionaries ship with the plugin, so switching costs nothing: the
 * settings section and every popup text read one resolved language, and the
 * section's toggle pins it. `auto` follows DSH (Chinese when DSH runs in
 * Chinese, English for every other DSH locale, since only these two exist
 * here).
 */
import type { PluginLanguage } from '../types.ts';
import { type NotifyKey } from './locales.ts';
/** The two languages the plugin actually ships. */
export type ResolvedLanguage = 'zh' | 'en';
/**
 * Resolve the effective language.
 * @param setting - the stored choice.
 * @param activeLocale - the DSH interface locale id (e.g. `zh`, `en`, `ja`).
 * @returns the dictionary to read.
 */
export declare function resolveLanguage(setting: PluginLanguage, activeLocale: string): ResolvedLanguage;
/**
 * Build the translate function the section and the toast composer share.
 *
 * The language is read on every call rather than captured, so a toggle takes
 * effect on the next render (and on the next toast) without rebuilding
 * anything.
 * @param getLanguage - reads the current resolved language.
 * @returns a `t(key, params)` lookup with `{name}` placeholders filled.
 */
export declare function createTranslator(getLanguage: () => ResolvedLanguage): (key: NotifyKey, params?: Record<string, string>) => string;
