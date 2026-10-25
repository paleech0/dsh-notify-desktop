/**
 * The host-side store for the user's saved popup texts.
 *
 * One JSON file under `%LOCALAPPDATA%\dsh-notify\templates\` holds every
 * situation's small library (at most {@link TEXT_LIMIT_PER_SCENARIO} entries
 * each). It sits next to the custom-sound folder, so a user can back the
 * wording up or copy it to another machine like the sounds themselves. Writes
 * go through a temp file plus a rename, so a crash mid-write never leaves a
 * half-written file that the next read would reject.
 *
 * Everything here takes the `root` directory explicitly: the tests point it at
 * a temp folder, the routes pass `LOCALAPPDATA`.
 */
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  SCENARIO_IDS,
  TEMPLATE_ID_PREFIX,
  TEXT_LIMIT_PER_SCENARIO,
  emptyTextLibrary,
  isTemplateId,
  normalizeTextDraft,
  type NotifyScenario,
  type TextDraftProblem,
  type TextLibrary,
  type TextTemplate,
} from './scenarios.ts'

/** The folder the template file lives in. */
export function textTemplateDir(root: string): string {
  return join(root, 'dsh-notify', 'templates')
}

/** The template file itself. */
export function textTemplateFile(root: string): string {
  return join(textTemplateDir(root), 'templates.json')
}

/** Whether a value names a known situation. */
export function isNotifyScenario(value: unknown): value is NotifyScenario {
  return typeof value === 'string' && (SCENARIO_IDS as readonly string[]).includes(value)
}

/** One line of the stored file. */
interface StoredTemplate {
  readonly id: string
  readonly name: string
  readonly title: string
  readonly body: string
  readonly updatedAt: number
}

/** The stored file's shape. */
interface StoredFile {
  readonly version: number
  readonly scenarios: Readonly<Record<string, readonly StoredTemplate[]>>
}

/** The version this build writes. */
export const TEXT_STORE_VERSION = 1

/** Read one stored entry, dropping anything malformed. */
function readStoredTemplate(value: unknown): StoredTemplate | null {
  if (value === null || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (!isTemplateId(record['id'])) return null
  const draft = normalizeTextDraft(record)
  if (!draft.ok) return null
  const updatedAt = typeof record['updatedAt'] === 'number' && Number.isFinite(record['updatedAt'])
    ? record['updatedAt']
    : 0
  return { id: record['id'], ...draft.value, updatedAt }
}

/**
 * Read the whole library. A missing, unreadable or malformed file reads as an
 * empty library rather than an error: the caller always has something usable.
 * @param root - the app-data root (the folder that holds `dsh-notify`).
 * @returns every situation's templates, capped and validated.
 */
export function readTextLibrary(root: string): TextLibrary {
  const library = {} as Record<NotifyScenario, readonly TextTemplate[]>
  for (const scenario of SCENARIO_IDS) library[scenario] = []
  let raw = ''
  try {
    raw = readFileSync(textTemplateFile(root), 'utf8')
  } catch {
    return emptyTextLibrary()
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return emptyTextLibrary()
  }
  const scenarios = (parsed as Partial<StoredFile> | null)?.scenarios
  if (scenarios === null || typeof scenarios !== 'object') return emptyTextLibrary()
  const record = scenarios as Record<string, unknown>
  for (const scenario of SCENARIO_IDS) {
    const entries = record[scenario]
    if (!Array.isArray(entries)) continue
    const kept: TextTemplate[] = []
    for (const entry of entries) {
      const template = readStoredTemplate(entry)
      if (template === null) continue
      kept.push(template)
      if (kept.length >= TEXT_LIMIT_PER_SCENARIO) break
    }
    library[scenario] = kept
  }
  return library
}

/**
 * Write the whole library back, atomically.
 * @param root - the app-data root.
 * @param library - the complete library to store.
 * @returns true when the file was replaced.
 */
export function writeTextLibrary(root: string, library: TextLibrary): boolean {
  const directory = textTemplateDir(root)
  const target = textTemplateFile(root)
  const temporary = target + '.' + randomUUID().slice(0, 8) + '.tmp'
  const payload: StoredFile = { version: TEXT_STORE_VERSION, scenarios: library }
  try {
    mkdirSync(directory, { recursive: true })
    writeFileSync(temporary, JSON.stringify(payload, null, 2), 'utf8')
    renameSync(temporary, target)
    return true
  } catch {
    try {
      if (existsSync(temporary)) writeFileSync(temporary, '', 'utf8')
    } catch {
      // Nothing left to clean up.
    }
    return false
  }
}

/** Why a save or delete was refused. */
export type TextStoreProblem = TextDraftProblem | 'scenario' | 'limit' | 'missing' | 'io'

/** The outcome of one save. */
export type TextSaveResult =
  | { readonly ok: true; readonly library: TextLibrary; readonly template: TextTemplate }
  | { readonly ok: false; readonly problem: TextStoreProblem }

/** The outcome of one delete. */
export type TextDeleteResult =
  | { readonly ok: true; readonly library: TextLibrary }
  | { readonly ok: false; readonly problem: TextStoreProblem }

/**
 * Save one template: replace an existing entry by id, or add a new one while
 * the situation still has room.
 * @param root - the app-data root.
 * @param scenario - the situation the template belongs to.
 * @param draft - the editor's name/title/body.
 * @param id - the existing template's id, or undefined to create one.
 * @returns the new library, or the reason it was refused.
 */
export function saveTextTemplate(
  root: string,
  scenario: unknown,
  draft: unknown,
  id: unknown,
): TextSaveResult {
  if (!isNotifyScenario(scenario)) return { ok: false, problem: 'scenario' }
  const normalized = normalizeTextDraft(draft)
  if (!normalized.ok) return { ok: false, problem: normalized.problem }
  const library = readTextLibrary(root)
  const existing = library[scenario]
  const now = Date.now()
  let next: TextTemplate[] = [...existing]
  let template: TextTemplate
  if (id !== undefined) {
    if (!isTemplateId(id)) return { ok: false, problem: 'missing' }
    const index = next.findIndex(entry => entry.id === id)
    if (index < 0) return { ok: false, problem: 'missing' }
    template = { id, ...normalized.value, updatedAt: now }
    next[index] = template
  } else {
    if (next.length >= TEXT_LIMIT_PER_SCENARIO) return { ok: false, problem: 'limit' }
    template = {
      id: TEMPLATE_ID_PREFIX + randomUUID().replace(/-/g, '').slice(0, 12),
      ...normalized.value,
      updatedAt: now,
    }
    next = [...next, template]
  }
  const updated: TextLibrary = { ...library, [scenario]: next }
  if (!writeTextLibrary(root, updated)) return { ok: false, problem: 'io' }
  return { ok: true, library: updated, template }
}

/**
 * Delete one template.
 * @param root - the app-data root.
 * @param scenario - the situation the template belongs to.
 * @param id - the template's id.
 * @returns the new library, or the reason it was refused.
 */
export function deleteTextTemplate(root: string, scenario: unknown, id: unknown): TextDeleteResult {
  if (!isNotifyScenario(scenario)) return { ok: false, problem: 'scenario' }
  if (!isTemplateId(id)) return { ok: false, problem: 'missing' }
  const library = readTextLibrary(root)
  const existing = library[scenario]
  if (!existing.some(entry => entry.id === id)) return { ok: false, problem: 'missing' }
  const updated: TextLibrary = { ...library, [scenario]: existing.filter(entry => entry.id !== id) }
  if (!writeTextLibrary(root, updated)) return { ok: false, problem: 'io' }
  return { ok: true, library: updated }
}
