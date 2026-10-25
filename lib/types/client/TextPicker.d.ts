import { type TextTemplate } from '../scenarios.ts';
import type { NotifyKey } from './locales.ts';
/** Props of {@link TextPicker}. */
export interface TextPickerProps {
    /** The stored choice: 'default' or a template id. */
    readonly value: string;
    /** The situation's saved templates. */
    readonly options: readonly TextTemplate[];
    /** Locale lookup. */
    readonly t: (key: NotifyKey) => string;
    /** Grey the trigger out (the master switch is off); the value stays. */
    readonly disabled?: boolean;
    /** Called with the newly chosen choice id. */
    readonly onPick: (choice: string) => void;
}
/**
 * Render the picker.
 * @param props - see {@link TextPickerProps}.
 * @returns the trigger and, while open, the two-section panel.
 */
export declare function TextPicker(props: TextPickerProps): JSX.Element;
