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
export const SUMMARY_LIMIT = 78

/** How many characters of the workspace name reach the toast title. */
export const TITLE_NAME_LIMIT = 40

/**
 * Flatten markdown into one bounded plain-text line.
 * @param text - the projected reply text (may be markdown, may be empty).
 * @param limit - the character budget.
 * @returns the plain summary, ellipsized on overflow.
 */
export function plainSummary(text: string, limit: number = SUMMARY_LIMIT): string {
  let out = text
  out = out.replace(/```[\s\S]*?```/g, ' ')
  out = out.replace(/`([^`]*)`/g, '$1')
  out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  out = out.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  out = out.replace(/^\s{0,3}#{1,6}\s+/gm, '')
  out = out.replace(/^\s{0,3}>\s?/gm, '')
  out = out.replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, '')
  out = out.replace(/^\s*\|.*\|\s*$/gm, ' ')
  out = out.replace(/\*\*(.+?)\*\*/g, '$1')
  out = out.replace(/(?:\*|_)([^*_]+)(?:\*|_)/g, '$1')
  out = out.replace(/<[^>]+>/g, ' ')
  out = out.replace(/\s+/g, ' ').trim()
  if (out.length <= limit) return out
  // The toast is asked to fill exactly three lines with the ellipsis sitting
  // where the last two characters would be, so the cut is positional rather
  // than sentence-driven (a sentence stop often left the box at two lines).
  let cut = Math.max(1, limit - 2)
  // Never slice an ASCII word in half ("…Windows 直" is fine, "…Wi…" is not).
  const wordChar = (ch: string | undefined): boolean => ch !== undefined && /[A-Za-z0-9]/.test(ch)
  while (cut > 1 && wordChar(out[cut - 1]) && wordChar(out[cut])) cut -= 1
  return out.slice(0, cut).trimEnd() + '…'
}

/**
 * The workspace name a session belongs to: the last segment of its directory.
 *
 * Sessions are named by DSH itself (a one-word summary of the first prompt),
 * which reads poorly in a toast; the workspace is what the user actually
 * recognises.
 * @param cwd - the session's working directory, when known.
 * @returns the workspace name, or an empty string.
 */
export function workspaceName(cwd: string | undefined): string {
  if (cwd === undefined) return ''
  const parts = cwd.split(/[\\/]+/).filter(part => part !== '')
  return parts.at(-1) ?? ''
}
