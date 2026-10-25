/**
 * The user-facing toast text templates (decision: global title + body template).
 *
 * The settings store two plain-text templates; this module fills them with the
 * notification's live values. Deliberately NOT a general formatter: four known
 * placeholders are replaced, everything else — including unknown `{tokens}` —
 * passes through untouched, so a template can talk about e.g. `{内容}` in its
 * help text without that text being eaten.
 */
import { DEFAULT_BODY_TEMPLATE, DEFAULT_TITLE_TEMPLATE } from '../types.ts'
import { TITLE_NAME_LIMIT } from './summary.ts'

/** The live values one template is rendered with. */
export interface TemplateParts {
  /** The workspace label: the session's directory name, or its title. */
  readonly workspace: string
  /** The localized short status, e.g. 任务完成. */
  readonly status: string
  /** The bounded summary (the projected reply, the ask's summary, …). */
  readonly body: string
  /** The reminder's waited-minutes; absent outside reminders. */
  readonly minutes?: string
}

/** How many characters of one rendered toast body are kept (the host caps at 300). */
const BODY_LIMIT = 300

/**
 * Fill one template's known placeholders.
 *
 * Both token spellings are accepted (the Chinese product copy and the English
 * mirror), because a stored template outlives any one UI language. `{分钟}`
 * with no value renders as nothing, so a reminder-only token does not litter
 * the other toasts with an empty gap the user never typed.
 * @param template - the stored template (already clamped non-empty).
 * @param parts - the live values.
 * @returns the filled text.
 */
function fill(template: string, parts: TemplateParts): string {
  const workspace = collapse(parts.workspace, TITLE_NAME_LIMIT)
  const body = collapse(parts.body, BODY_LIMIT)
  return template
    .replaceAll('{工作区}', workspace)
    .replaceAll('{workspace}', workspace)
    .replaceAll('{状态}', parts.status)
    .replaceAll('{status}', parts.status)
    .replaceAll('{内容}', body)
    .replaceAll('{body}', body)
    .replaceAll('{分钟}', parts.minutes ?? '')
    .replaceAll('{minutes}', parts.minutes ?? '')
}

/** Collapse whitespace runs and bound the length the way the old title did. */
function collapse(text: string, limit: number): string {
  const flat = text.trim().replace(/\s+/g, ' ')
  if (flat.length <= limit) return flat
  return flat.slice(0, limit - 1) + '…'
}

/**
 * Render the toast title from the title template.
 * @param template - the stored title template.
 * @param parts - the live values.
 * @returns the title; a template that renders empty falls back to the status.
 */
export function renderTitle(template: string, parts: TemplateParts): string {
  const filled = fill(template === '' ? DEFAULT_TITLE_TEMPLATE : template, parts).trim()
  return filled === '' ? parts.status : filled
}

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
export function renderBody(template: string, parts: TemplateParts, fallback: string): string {
  if (parts.body.trim() === '') return fallback
  const filled = fill(template === '' ? DEFAULT_BODY_TEMPLATE : template, parts).trim()
  return filled === '' ? fallback : filled
}
