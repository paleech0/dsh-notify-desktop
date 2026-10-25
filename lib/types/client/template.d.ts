/** The live values one template is rendered with. */
export interface TemplateParts {
    /** The workspace label: the session's directory name, or its title. */
    readonly workspace: string;
    /** The localized short status, e.g. 任务完成. */
    readonly status: string;
    /** The bounded summary (the projected reply, the ask's summary, …). */
    readonly body: string;
    /** The reminder's waited-minutes; absent outside reminders. */
    readonly minutes?: string;
}
/**
 * Render the toast title from the title template.
 * @param template - the stored title template.
 * @param parts - the live values.
 * @returns the title; a template that renders empty falls back to the status.
 */
export declare function renderTitle(template: string, parts: TemplateParts): string;
/**
 * Render the toast body from the body template.
 *
 * An empty summary falls back to the whole fallback line: a template like
 * `{工作区} 需要你：{内容}` must not render its own punctuation with nothing
 * after it.
 * @param template - the stored body template.
 * @param parts - the live values.
 * @param fallback - the line to use when there is no content at all.
 * @returns the body.
 */
export declare function renderBody(template: string, parts: TemplateParts, fallback: string): string;
