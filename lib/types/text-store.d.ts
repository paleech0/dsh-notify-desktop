import { type NotifyScenario, type TextDraftProblem, type TextLibrary, type TextTemplate } from './scenarios.ts';
/** The folder the template file lives in. */
export declare function textTemplateDir(root: string): string;
/** The template file itself. */
export declare function textTemplateFile(root: string): string;
/** Whether a value names a known situation. */
export declare function isNotifyScenario(value: unknown): value is NotifyScenario;
/** The version this build writes. */
export declare const TEXT_STORE_VERSION = 1;
/**
 * Read the whole library. A missing, unreadable or malformed file reads as an
 * empty library rather than an error: the caller always has something usable.
 * @param root - the app-data root (the folder that holds `dsh-notify`).
 * @returns every situation's templates, capped and validated.
 */
export declare function readTextLibrary(root: string): TextLibrary;
/**
 * Write the whole library back, atomically.
 * @param root - the app-data root.
 * @param library - the complete library to store.
 * @returns true when the file was replaced.
 */
export declare function writeTextLibrary(root: string, library: TextLibrary): boolean;
/** Why a save or delete was refused. */
export type TextStoreProblem = TextDraftProblem | 'scenario' | 'limit' | 'missing' | 'io';
/** The outcome of one save. */
export type TextSaveResult = {
    readonly ok: true;
    readonly library: TextLibrary;
    readonly template: TextTemplate;
} | {
    readonly ok: false;
    readonly problem: TextStoreProblem;
};
/** The outcome of one delete. */
export type TextDeleteResult = {
    readonly ok: true;
    readonly library: TextLibrary;
} | {
    readonly ok: false;
    readonly problem: TextStoreProblem;
};
/**
 * Save one template: replace an existing entry by id, or add a new one while
 * the situation still has room.
 * @param root - the app-data root.
 * @param scenario - the situation the template belongs to.
 * @param draft - the editor's name/title/body.
 * @param id - the existing template's id, or undefined to create one.
 * @returns the new library, or the reason it was refused.
 */
export declare function saveTextTemplate(root: string, scenario: unknown, draft: unknown, id: unknown): TextSaveResult;
/**
 * Delete one template.
 * @param root - the app-data root.
 * @param scenario - the situation the template belongs to.
 * @param id - the template's id.
 * @returns the new library, or the reason it was refused.
 */
export declare function deleteTextTemplate(root: string, scenario: unknown, id: unknown): TextDeleteResult;
