/** Where the click lands. */
export interface ActivationDeps {
    /** Raise the application window (host route -> shell protocol handler). */
    readonly focusWindow: () => Promise<unknown> | unknown;
    /** Open one session in the UI (absent when the workspace service is missing). */
    readonly openSession?: ((sessionId: string) => void) | undefined;
}
/**
 * Post the focus request to the host route.
 * @param fetchImpl - the fetch implementation (defaults to the ambient fetch).
 * @returns a promise that settles when the request was dispatched.
 */
export declare function focusWindowRequest(fetchImpl?: typeof fetch | undefined): Promise<unknown>;
/**
 * Run a toast click: raise the window first, then select the session.
 * @param deps - the injected window and workspace faces.
 * @param sessionId - the session the toast was about.
 */
export declare function activateSession(deps: ActivationDeps, sessionId: string): Promise<void>;
