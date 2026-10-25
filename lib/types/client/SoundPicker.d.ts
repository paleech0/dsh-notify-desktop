import { type SoundId, type SoundLibrary } from '../types.ts';
import type { NotifyKey } from './locales.ts';
/** Props of {@link SoundPicker}. */
export interface SoundPickerProps {
    /** The chosen sound. */
    readonly value: SoundId;
    /** The library folders' current contents. */
    readonly library: SoundLibrary;
    /** Resolve a sound id to its display label. */
    readonly labelOf: (id: SoundId) => string;
    /** Locale lookup. */
    readonly t: (key: NotifyKey) => string;
    /** Grey the trigger out (the master switch is off); the value stays. */
    readonly disabled?: boolean;
    /** Called with the newly chosen sound. */
    readonly onPick: (id: SoundId) => void;
}
/**
 * Render the picker.
 * @param props - see {@link SoundPickerProps}.
 * @returns the trigger and, while open, the grouped panel.
 */
export declare function SoundPicker(props: SoundPickerProps): JSX.Element;
