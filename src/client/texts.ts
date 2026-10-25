/**
 * The client half of the saved popup texts: a tiny observable cache over the
 * host's template route.
 *
 * The notification path reads this cache synchronously while it composes a
 * toast, so the library is loaded once at start-up and refreshed after every
 * edit. Only the chosen template id lives in the settings; the wording itself
 * lives on disk and is validated by the host.
 */
import { FOCUS_HEADER, TEXT_TEMPLATES_ROUTE } from '../protocol.ts'
import {
  SCENARIO_IDS,
  TEXT_LIMIT_PER_SCENARIO,
  emptyTextLibrary,
  isTemplateId,
  type NotifyScenario,
  type TextLibrary,
  type TextTemplate,
} from '../scenarios.ts'

/** One editor draft, before the host validates it. */
export interface TextDraft {
  readonly name: string
  readonly title: string
  readonly body: string
}

/** Why a save or delete did not happen. */
export type TextStoreProblem =
  | 'limit'
  | 'invalid'
  | 'unreachable'
  | 'scenario'
  | 'missing'
  | 'io'
  | 'name'
  | 'title'
  | 'body'

/** The outcome of one save. */
export type TextSaveOutcome =
  | { readonly ok: true; readonly template: TextTemplate }
  | { readonly ok: false; readonly problem: TextStoreProblem }

/** The observable library face shared by the settings section and the runner. */
export interface TextStore {
  /** The current library; the reference is stable until an edit lands. */
  getSnapshot(): TextLibrary
  subscribe(listener: () => void): () => void
  /** Fetch the library from the host; keeps the old one when unreachable. */
  load(): Promise<TextLibrary>
  /** Save one draft; a missing id creates a new template. */
  save(scenario: NotifyScenario, draft: TextDraft, id?: string): Promise<TextSaveOutcome>
  /** Delete one template. */
  remove(scenario: NotifyScenario, id: string): Promise<{ readonly ok: boolean; readonly problem?: TextStoreProblem }>
}

/** Read one stored template defensively. */
function sanitizeTemplate(value: unknown): TextTemplate | null {
  if (value === null || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (!isTemplateId(record['id'])) return null
  const name = typeof record['name'] === 'string' ? record['name'].trim() : ''
  const title = typeof record['title'] === 'string' ? record['title'] : ''
  const body = typeof record['body'] === 'string' ? record['body'] : ''
  if (name === '' || title === '' || body === '') return null
  const updatedAt = typeof record['updatedAt'] === 'number' && Number.isFinite(record['updatedAt'])
    ? record['updatedAt']
    : 0
  return { id: record['id'], name, title, body, updatedAt }
}

/**
 * Turn an arbitrary payload into a complete library: every scenario present,
 * malformed entries dropped, the per-situation cap enforced.
 * @param value - the wire payload's `library` (or anything at all).
 * @returns a safe library, empty when the payload is unusable.
 */
export function sanitizeTextLibrary(value: unknown): TextLibrary {
  const source = (value ?? {}) as Record<string, unknown>
  const library = {} as Record<NotifyScenario, readonly TextTemplate[]>
  for (const scenario of SCENARIO_IDS) {
    const entries = source[scenario]
    const kept: TextTemplate[] = []
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        const template = sanitizeTemplate(entry)
        if (template === null) continue
        kept.push(template)
        if (kept.length >= TEXT_LIMIT_PER_SCENARIO) break
      }
    }
    library[scenario] = kept
  }
  return library
}

/** Narrow one wire problem string into the store's vocabulary. */
function asProblem(value: unknown): TextStoreProblem {
  switch (value) {
    case 'limit':
    case 'scenario':
    case 'missing':
    case 'io':
    case 'name':
    case 'title':
    case 'body':
      return value
    default:
      return 'invalid'
  }
}

/** The ambient fetch, or undefined when the embedding has none. */
function fetchImpl(): typeof fetch | undefined {
  return typeof fetch === 'undefined' ? undefined : fetch
}

/**
 * Create the library cache.
 * @returns the store; nothing is fetched until {@link TextStore.load} runs.
 */
export function createTextStore(): TextStore {
  let snapshot: TextLibrary = emptyTextLibrary()
  const listeners = new Set<() => void>()
  const emit = (): void => {
    for (const listener of [...listeners]) listener()
  }
  const apply = (library: TextLibrary): TextLibrary => {
    snapshot = library
    emit()
    return snapshot
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    load() {
      const request = fetchImpl()
      if (request === undefined) return Promise.resolve(snapshot)
      return request(TEXT_TEMPLATES_ROUTE, { headers: { [FOCUS_HEADER]: '1' } })
        .then(response => (response.ok ? response.json() : undefined))
        .then((payload: unknown) => {
          const library = (payload as { library?: unknown } | undefined)?.library
          if (library === undefined) return snapshot
          return apply(sanitizeTextLibrary(library))
        }, () => snapshot)
    },
    save(scenario, draft, id) {
      const request = fetchImpl()
      if (request === undefined) return Promise.resolve({ ok: false, problem: 'unreachable' })
      const body = JSON.stringify(id === undefined
        ? { action: 'save', scenario, template: draft }
        : { action: 'save', scenario, id, template: draft })
      return request(TEXT_TEMPLATES_ROUTE, {
        method: 'POST',
        headers: { [FOCUS_HEADER]: '1', 'content-type': 'application/json' },
        body,
      })
        .then(response => (response.ok ? response.json() : undefined))
        .then((payload: unknown): TextSaveOutcome => {
          const result = payload as { ok?: unknown; library?: unknown; template?: unknown; problem?: unknown } | undefined
          if (result?.ok !== true) return { ok: false, problem: asProblem(result?.problem) }
          const library = sanitizeTextLibrary(result.library)
          apply(library)
          const template = sanitizeTemplate(result.template)
          if (template === null) return { ok: false, problem: 'invalid' }
          return { ok: true, template }
        }, () => ({ ok: false, problem: 'unreachable' } as const))
    },
    remove(scenario, id) {
      const request = fetchImpl()
      if (request === undefined) return Promise.resolve({ ok: false, problem: 'unreachable' })
      return request(TEXT_TEMPLATES_ROUTE, {
        method: 'POST',
        headers: { [FOCUS_HEADER]: '1', 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'delete', scenario, id }),
      })
        .then(response => (response.ok ? response.json() : undefined))
        .then((payload: unknown) => {
          const result = payload as { ok?: unknown; library?: unknown; problem?: unknown } | undefined
          if (result?.ok !== true) return { ok: false, problem: asProblem(result?.problem) }
          apply(sanitizeTextLibrary(result.library))
          return { ok: true }
        }, () => ({ ok: false, problem: 'unreachable' as const }))
    },
  }
}
