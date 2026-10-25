import { type NotifyScenario, type TextLibrary } from '../scenarios.ts';
import { type NotifyKey } from './locales.ts';
import type { TextDraft, TextSaveOutcome } from './texts.ts';
import { type TemplateParts } from './template.ts';
/** Props of {@link TextManager}. */
export interface TextManagerProps {
    /** The situations to list, in presentation order. */
    readonly scenarios: readonly NotifyScenario[];
    /** The current library snapshot. */
    readonly library: TextLibrary;
    /** Locale lookup. */
    readonly t: (key: NotifyKey) => string;
    /** The display label of one situation. */
    readonly labelOf: (scenario: NotifyScenario) => string;
    /** The placeholder values one editor preview renders with. */
    readonly partsOf: (scenario: NotifyScenario) => TemplateParts;
    /** The fallback line that situation's body uses when there is no content. */
    readonly fallbackOf: (scenario: NotifyScenario) => string;
    /** Persist one draft; resolves with the store's outcome. */
    readonly onSave: (scenario: NotifyScenario, draft: TextDraft, id?: string) => Promise<TextSaveOutcome>;
    /** Delete one template. */
    readonly onDelete: (scenario: NotifyScenario, id: string) => Promise<{
        readonly ok: boolean;
    }>;
}
/**
 * Render the manager.
 * @param props - see {@link TextManagerProps}.
 * @returns the per-situation groups, editor and confirmations.
 */
export declare function TextManager(props: TextManagerProps): JSX.Element;
