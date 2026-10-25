/**
 * The one piece of wire vocabulary both halves must agree on: the same-origin
 * route a toast click posts to, and the header that keeps drive-by requests out.
 * It lives alone so the browser bundle never has to import the host entry (and
 * with it node:child_process and the host's zod schemas).
 */

/** The same-origin route the client posts to when a toast is clicked. */
export const FOCUS_ROUTE = '/dsh-notify/focus'

/** Header the client sets; keeps drive-by requests from other origins out. */
export const FOCUS_HEADER = 'x-dsh-notify'

/**
 * The route the client posts one-line diagnostics to. The desktop shell cannot
 * show a plugin's renderer console to anyone but a human with DevTools open, so
 * the client reports what it decided and what the platform answered, and the
 * host keeps the last few lines for the debug route to serve.
 */
export const REPORT_ROUTE = '/dsh-notify/report'

/** How many client report lines the host keeps. */
export const REPORT_LIMIT = 40

/**
 * The route the client posts a toast to when its own renderer cannot present
 * one. Measured on 0.2.0-rc.2: while the app window is minimized/hidden the
 * renderer constructs the Notification but the platform never shows it (no
 * `show`, no `error`), so the host raises the toast through the shell's own
 * Windows notification channel instead.
 */
export const HOST_TOAST_ROUTE = '/dsh-notify/toast'

/**
 * The sound-only route: play one catalog sound without raising a toast.
 *
 * Every sound used to ride on the toast that showed it, which made
 * "sound without a toast" impossible. The host resolves the id exactly as it
 * does for a toast — catalog id only, never a path — and plays it in its own
 * child, so the silence route and the 8-second cap apply here too.
 */
export const SOUND_ROUTE = '/dsh-notify/sound'

/**
 * The route the client polls for questions the host observed on the
 * `user-questions/request` waterfall.
 *
 * Questions cannot be read from any projection (a service-level ask such as
 * the plan review never reaches the session log), and a global client plugin
 * cannot subscribe to the agent-scoped waterfall either (measured: the
 * subscription registers and then receives nothing). The host can: it fires
 * that waterfall itself, so a `{ global: true }` listener sees every question.
 */
export const QUESTIONS_ROUTE = '/dsh-notify/questions'

/**
 * Stop whatever notification sound is playing right now.
 *
 * The host plays file sounds in a child PowerShell process (`PlaySync`), which
 * keeps going even after the user switches sounds off; the client posts here on
 * that switch so the sound stops immediately instead of finishing its file.
 */
export const SILENCE_ROUTE = '/dsh-notify/silence'

/**
 * Ask the host whether this app's window is the OS foreground window.
 *
 * The renderer's own `document.hasFocus()` reports false in situations where the
 * user is plainly looking at the window (measured: the question view takes
 * document focus), so the client defers to the host's OS-level answer whenever
 * its own signal says "unfocused".
 */
export const FOREGROUND_ROUTE = '/dsh-notify/foreground'

/**
 * The sound library the settings section offers: the sounds shipped with the
 * plugin (`author`) and the ones the user imported (`custom`).
 */
export const SOUND_LIBRARY_ROUTE = '/dsh-notify/sound-library'

/** Copy one picked audio file into the user's custom-sound folder. */
export const IMPORT_SOUND_ROUTE = '/dsh-notify/import-sound'

/** Remove one imported custom sound. */
export const DELETE_SOUND_ROUTE = '/dsh-notify/delete-sound'

/** Ask the host to open a Windows file picker and return the chosen wav path. */
export const PICK_FILE_ROUTE = '/dsh-notify/pick-file'

/**
 * The transcoded-wav cache: GET reports its size, POST empties it.
 *
 * Custom sounds in any format other than wav are transcoded once into this
 * folder; the settings section shows the占用 and offers to clear it.
 */
export const SOUND_CACHE_ROUTE = '/dsh-notify/sound-cache'

/**
 * The user's saved popup texts: GET returns every situation's library, POST
 * saves or deletes one entry. The templates live on disk (next to the custom
 * sounds) so hand-written wording survives a storage clear and can be copied
 * between machines; only the chosen id stays in the client settings.
 */
export const TEXT_TEMPLATES_ROUTE = '/dsh-notify/text-templates'
