/**
 * Toast copy for the completion path (decision C): a short plain-text摘要
 * instead of the raw reply.
 *
 * The projected body is the assistant's own markdown; pasted into a Windows
 * toast it shows asterisks, pipe tables and code fences across the one or two
 * lines the shell renders. This module flattens it to readable text and bounds
 * it to the three rendered lines the toast shows; the title/body composition
 * itself lives in the user-facing templates (template.ts).
 */
/**
 * How many characters of the reply reach the toast body. Budgeted from the
 * rendered toast, not from taste: a Windows toast wraps the body at roughly
 * 26 CJK characters per line and the box fits about three lines (a 120-character
 * body wrapped to four and was cut mid-word by the shell; 48 read as too sparse).
 */
export declare const SUMMARY_LIMIT = 78;
/** How many characters of the workspace name reach the toast title. */
export declare const TITLE_NAME_LIMIT = 40;
/**
 * Flatten markdown into one bounded plain-text line.
 * @param text - the projected reply text (may be markdown, may be empty).
 * @param limit - the character budget.
 * @returns the plain summary, ellipsized on overflow.
 */
export declare function plainSummary(text: string, limit?: number): string;
/**
 * The workspace name a session belongs to: the last segment of its directory.
 *
 * Sessions are named by DSH itself (a one-word summary of the first prompt),
 * which reads poorly in a toast; the workspace is what the user actually
 * recognises.
 * @param cwd - the session's working directory, when known.
 * @returns the workspace name, or an empty string.
 */
export declare function workspaceName(cwd: string | undefined): string;
