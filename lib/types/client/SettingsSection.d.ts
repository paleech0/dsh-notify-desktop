import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { NotifySettings, SoundLibrary } from '../types.ts';
import { type NotifyScenario } from '../scenarios.ts';
import type { SoundCacheInfo } from './notifier.ts';
import type { SettingsStore } from './settings.ts';
import type { TextStore } from './texts.ts';
/** Injected business face of the section. */
export interface NotifySectionInjected {
    /** The live settings store. */
    store: SettingsStore;
    /** Persist one patch. */
    set: (patch: Partial<NotifySettings>) => void;
    /** Show the test notification: fixed copy, fixed default sound. */
    sendTest: () => void;
    /** Audition one situation the way the current delivery mode would. */
    previewScenario: (scenario: NotifyScenario) => void;
    /** The saved popup texts, loaded from the host. */
    texts: TextStore;
    /** Open the Windows file picker and return the chosen wav path ('' = cancelled). */
    pickFile: () => Promise<string>;
    /** Read the sound library: the plugin's sounds and the user's imports. */
    loadLibrary: () => Promise<SoundLibrary>;
    /** Copy one picked file into the custom-sound folder; its name, or null. */
    importSound: (file: string) => Promise<string | null>;
    /** Delete one imported custom sound. */
    deleteSound: (id: string) => Promise<boolean>;
    /** Read the transcoded-wav cache size (null when the host is unreachable). */
    cacheInfo: () => Promise<SoundCacheInfo | null>;
    /** Empty the transcoded-wav cache. */
    clearCache: () => Promise<SoundCacheInfo | null>;
}
/** Full section props: runtime share + injected face + the locale seat. */
export type NotifySectionProps = PropsRuntime<'settings.section'> & InjectFace<NotifySectionInjected> & PropsLocale<'notify'>;
/**
 * The notification settings section.
 * @param props - section props supplied by the settings slot.
 * @returns the rendered section.
 */
export declare function NotifySettingsSection(props: NotifySectionProps): JSX.Element;
