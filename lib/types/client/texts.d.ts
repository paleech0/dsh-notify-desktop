import { type NotifyScenario, type TextLibrary, type TextTemplate } from '../scenarios.ts';
/** One editor draft, before the host validates it. */
export interface TextDraft {
    readonly name: string;
    readonly title: string;
    readonly body: string;
}
/** Why a save or delete did not happen. */
export type TextStoreProblem = 'limit' | 'invalid' | 'unreachable' | 'scenario' | 'missing' | 'io' | 'name' | 'title' | 'body';
/** The outcome of one save. */
export type TextSaveOutcome = {
    readonly ok: true;
    readonly template: TextTemplate;
} | {
    readonly ok: false;
    readonly problem: TextStoreProblem;
};
/** The observable library face shared by the settings section and the runner. */
export interface TextStore {
    /** The current library; the reference is stable until an edit lands. */
    getSnapshot(): TextLibrary;
    subscribe(listener: () => void): () => void;
    /** Fetch the library from the host; keeps the old one when unreachable. */
    load(): Promise<TextLibrary>;
    /** Save one draft; a missing id creates a new template. */
    save(scenario: NotifyScenario, draft: TextDraft, id?: string): Promise<TextSaveOutcome>;
    /** Delete one template. */
    remove(scenario: NotifyScenario, id: string): Promise<{
        readonly ok: boolean;
        readonly problem?: TextStoreProblem;
    }>;
}
/**
 * Turn an arbitrary payload into a complete library: every scenario present,
 * malformed entries dropped, the per-situation cap enforced.
 * @param value - the wire payload's `library` (or anything at all).
 * @returns a safe library, empty when the payload is unusable.
 */
export declare function sanitizeTextLibrary(value: unknown): TextLibrary;
/**
 * Create the library cache.
 * @returns the store; nothing is fetched until {@link TextStore.load} runs.
 */
export declare function createTextStore(): TextStore;
