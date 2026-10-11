/**
 * What a toast click does: raise the DSH window and jump to the session the
 * toast was about. The window raise goes through the desktop shell (the
 * renderer cannot raise its own window — verified on 0.2.0-rc.2), and the jump
 * goes through the workspace service. Both halves are injected so the flow is
 * testable without a browser.
 */
import { FOCUS_HEADER, FOCUS_ROUTE } from '../protocol.ts'

/** Where the click lands. */
export interface ActivationDeps {
  /** Raise the application window (host route -> shell protocol handler). */
  readonly focusWindow: () => Promise<unknown> | unknown
  /** Open one session in the UI (absent when the workspace service is missing). */
  readonly openSession?: ((sessionId: string) => void) | undefined
}

/**
 * Post the focus request to the host route.
 * @param fetchImpl - the fetch implementation (defaults to the ambient fetch).
 * @returns a promise that settles when the request was dispatched.
 */
export function focusWindowRequest(fetchImpl: typeof fetch | undefined = globalThis.fetch): Promise<unknown> {
  if (fetchImpl === undefined) return Promise.resolve()
  return fetchImpl(FOCUS_ROUTE, {
    method: 'POST',
    headers: { [FOCUS_HEADER]: '1' },
  }).catch(() => undefined)
}

/**
 * Run a toast click: raise the window first, then select the session.
 * @param deps - the injected window and workspace faces.
 * @param sessionId - the session the toast was about.
 */
export async function activateSession(deps: ActivationDeps, sessionId: string): Promise<void> {
  try {
    await deps.focusWindow()
  } catch {
    // Focus is best-effort; the session jump still helps.
  }
  try {
    deps.openSession?.(sessionId)
  } catch {
    // A missing workspace service must not break the click handler.
  }
}
