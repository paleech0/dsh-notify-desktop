/**
 * The settings-section stylesheet. The web server serves exactly one file per
 * client plugin, so the CSS ships inside the bundle and is injected once.
 */

/** Stable `<style>` id (idempotent across hot reloads). */
export const STYLE_ID = 'dsh-notify-desktop-style'

/** The section's stylesheet text. */
export const cssText = `
.dsh_notify_section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  /* Option A: follow the DSH theme font (the user's own text-font setting). */
  font-family: var(--dsw-font-family, inherit);
}
.dsh_notify_card {
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.24));
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dsh_notify_cardTitle { font-weight: 600; font-size: 13px; }
.dsh_notify_cardDesc { font-size: 12px; opacity: 0.78; line-height: 1.55; }
.dsh_notify_row { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; }
.dsh_notify_row input[type='checkbox'] { margin-top: 2px; }
.dsh_notify_rowText { display: flex; flex-direction: column; gap: 2px; }
/* Only the checkbox and this label toggle a row; the rest of the row does not. */
.dsh_notify_rowLabel { cursor: pointer; }
.dsh_notify_error { color: #e5484d; font-size: 12px; line-height: 1.5; }
.dsh_notify_note { color: #3dd68c; font-size: 12px; line-height: 1.5; }
.dsh_notify_cacheText { flex: 1 1 auto; font-size: 12px; opacity: 0.8; font-variant-numeric: tabular-nums; }
.dsh_notify_rowDesc { font-size: 12px; opacity: 0.74; line-height: 1.55; }
.dsh_notify_rowPrefix { font-size: 11px; opacity: 0.62; }
.dsh_notify_button {
  align-self: flex-start;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.35;
}
.dsh_notify_button:hover { background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12)); }

/*
 * Card 1: the test button sits directly under the master switch, then the
 * delivery modes as one radio row each.
 */
.dsh_notify_testBlock { display: flex; flex-direction: column; gap: 4px; padding-left: 0; }
.dsh_notify_modeBlock { display: flex; flex-direction: column; gap: 6px; }
.dsh_notify_modeLabel { font-weight: 600; font-size: 13px; }
.dsh_notify_modeRow { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; }
.dsh_notify_modeRow input[type='radio'] { margin-top: 3px; }
.dsh_notify_modeText { display: flex; flex-direction: column; gap: 2px; }
.dsh_notify_minutes { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.dsh_notify_minutes input {
  width: 72px;
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  background: transparent;
  color: inherit;
  font-variant-numeric: tabular-nums;
}

/*
 * Card 2: one row per situation — name, sound picker, text picker, preview.
 * The pickers shrink to 118px here so the three controls and the preview fit
 * the settings panel on one line.
 */
.dsh_notify_scenarios { display: flex; flex-direction: column; }
.dsh_notify_card .dsh_notify_scenarioRow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 118px auto 118px 64px;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  min-height: 38px;
}
.dsh_notify_card .dsh_notify_scenarioRow + .dsh_notify_scenarioRow {
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.16));
}
.dsh_notify_scenarioName { font-size: 13px; line-height: 1.4; }
.dsh_notify_card .dsh_notify_scenarioRow .dsh_notify_pickerTrigger {
  width: 118px;
  min-width: 118px;
  max-width: 118px;
}
.dsh_notify_card .dsh_notify_scenarioPreview {
  width: 64px;
  height: 30px;
  padding: 0;
  font-size: 12px;
  line-height: 28px;
  text-align: center;
  align-self: center;
}
.dsh_notify_remindLine {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0 2px;
  font-size: 12px;
  opacity: 0.85;
}
.dsh_notify_remindLine .dsh_notify_minutes input { width: 64px; }

/* The two collapsible libraries. */
.dsh_notify_card .dsh_notify_collapse {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 10px;
  margin-top: 2px;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.16));
}
.dsh_notify_collapseHeader {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  align-self: flex-start;
}
.dsh_notify_collapseLabel { font-weight: 600; font-size: 13px; }
.dsh_notify_collapseCount { font-size: 12px; opacity: 0.6; }
.dsh_notify_collapseBody { display: flex; flex-direction: column; gap: 8px; padding-left: 16px; }
.dsh_notify_cacheBlock {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 10px;
  margin-top: 4px;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.16));
}
.dsh_notify_card .dsh_notify_soundLabel { font-size: 13px; line-height: 1.4; }
.dsh_notify_card .dsh_notify_customControls { display: flex; align-items: center; gap: 8px; }
.dsh_notify_card .dsh_notify_customControls .dsh_notify_button {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  white-space: nowrap;
  flex: 0 0 auto;
}
/* The imported-sound and saved-text lists: one quiet row per entry. */
.dsh_notify_soundList {
  list-style: none;
  margin: 2px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 168px;
  overflow-y: auto;
}
.dsh_notify_card .dsh_notify_soundItem {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 5px 8px;
  border-radius: 7px;
  font-size: 12px;
  border: 1px solid transparent;
}
.dsh_notify_card .dsh_notify_soundItem:hover {
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.1));
  border-color: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
}
.dsh_notify_soundItemName { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh_notify_soundItemSize { opacity: 0.6; font-variant-numeric: tabular-nums; }
.dsh_notify_card .dsh_notify_iconButton {
  height: 24px;
  padding: 0 8px;
  font-size: 11px;
  line-height: 22px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.75;
}
.dsh_notify_card .dsh_notify_iconButton:hover { opacity: 1; background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12)); }

/* Delete is the one destructive action on the page: red, and confirmed inline. */
.dsh_notify_card .dsh_notify_iconButton.dsh_notify_danger { color: #e5484d; border-color: rgba(229, 72, 77, 0.4); opacity: 0.9; }
.dsh_notify_card .dsh_notify_iconButton.dsh_notify_danger:hover { background: rgba(229, 72, 77, 0.12); opacity: 1; }
.dsh_notify_button.dsh_notify_dangerButton { color: #e5484d; border-color: rgba(229, 72, 77, 0.55); }
.dsh_notify_button.dsh_notify_dangerButton:hover { background: rgba(229, 72, 77, 0.12); }
.dsh_notify_confirm {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 7px;
  border: 1px solid rgba(229, 72, 77, 0.35);
  background: rgba(229, 72, 77, 0.08);
  font-size: 12px;
  line-height: 1.5;
}
.dsh_notify_confirm .dsh_notify_button { height: 26px; padding: 0 10px; font-size: 12px; }

/*
 * The two-level pickers: the trigger keeps the old select's footprint, the
 * panel floats above the card with the section headers as level one.
 */
.dsh_notify_picker { position: relative; display: flex; }
.dsh_notify_card .dsh_notify_pickerTrigger {
  width: 148px;
  height: 30px;
  margin: 0;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  background-color: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.08));
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color 120ms ease, background-color 120ms ease;
}
.dsh_notify_card .dsh_notify_pickerTrigger:hover {
  border-color: var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.45));
  background-color: var(--dsw-alias-bg-layer-3, rgba(127, 127, 127, 0.14));
}
.dsh_notify_card .dsh_notify_pickerTrigger:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, rgba(77, 107, 254, 0.6));
  outline-offset: 1px;
}
.dsh_notify_pickerValue { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh_notify_pickerCaret {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  margin-top: -3px;
  border-right: 1.6px solid currentColor;
  border-bottom: 1.6px solid currentColor;
  transform: rotate(45deg);
  opacity: 0.6;
}
.dsh_notify_pickerPanel {
  position: absolute;
  z-index: 40;
  top: calc(100% + 6px);
  right: 0;
  width: 240px;
  max-height: 330px;
  overflow-y: auto;
  padding: 6px;
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  background: var(--dsw-alias-bg-layer-1, #1b1d22);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.45);
}
.dsh_notify_card .dsh_notify_pickerHeader {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.dsh_notify_card .dsh_notify_pickerHeader:hover { background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12)); }
/* The text picker's two headers are plain labels, not expanders. */
.dsh_notify_card .dsh_notify_pickerHeaderStatic { cursor: default; }
.dsh_notify_card .dsh_notify_pickerHeaderStatic:hover { background: transparent; }
.dsh_notify_pickerHeaderLabel { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh_notify_pickerCount { opacity: 0.62; font-variant-numeric: tabular-nums; }
.dsh_notify_pickerCaretSmall {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(-45deg);
  opacity: 0.65;
  transition: transform 120ms ease;
}
.dsh_notify_pickerCaretSmall[data-open='true'] { transform: rotate(45deg); }
.dsh_notify_pickerList {
  list-style: none;
  margin: 2px 0 4px;
  padding: 0 0 0 12px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.dsh_notify_card .dsh_notify_pickerOption {
  width: 100%;
  height: 26px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh_notify_card .dsh_notify_pickerOption:hover { background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.14)); }
.dsh_notify_card .dsh_notify_pickerOption.is-selected {
  color: var(--dsw-alias-brand-primary, #6b8afd);
  font-weight: 600;
}
.dsh_notify_pickerEmpty { padding: 2px 8px 8px 20px; font-size: 12px; opacity: 0.68; }
.dsh_notify_textPanel { width: 230px; }

/* The saved-text manager and its inline editor. */
.dsh_notify_textManager { display: flex; flex-direction: column; gap: 2px; }
/* One situation: a single compact header row (name + count + New text), then
   its saved rows and, while open, the inline editor. */
.dsh_notify_textGroup {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 0;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.12));
}
.dsh_notify_textGroup:first-child { border-top: 0; padding-top: 0; }
.dsh_notify_textGroupHeader { display: flex; align-items: center; gap: 8px; min-height: 24px; }
.dsh_notify_textGroupName { font-size: 13px; font-weight: 600; line-height: 20px; }
.dsh_notify_textGroupCount { font-size: 11px; opacity: 0.62; font-variant-numeric: tabular-nums; }
.dsh_notify_card .dsh_notify_textGroupAdd {
  margin-left: auto;
  height: 24px;
  padding: 0 10px;
  font-size: 11px;
  line-height: 22px;
  align-self: center;
}
.dsh_notify_textList { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.dsh_notify_card .dsh_notify_textItem {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 2px 8px;
  border-radius: 7px;
  font-size: 12px;
  line-height: 20px;
  border: 1px solid transparent;
}
.dsh_notify_card .dsh_notify_textItem:hover {
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.1));
  border-color: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
}
.dsh_notify_textItemName { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.dsh_notify_textItemBody { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.78; }
.dsh_notify_editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.06));
}
.dsh_notify_editorRow { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; align-items: center; gap: 8px; }
.dsh_notify_editorLabel { font-size: 12px; opacity: 0.82; }
.dsh_notify_editorCount {
  font-family: var(--ds-font-family-code, "Cascadia Mono", Consolas, "Noto Sans SC", monospace);
  font-size: 11px;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}
.dsh_notify_textInput {
  flex: 1 1 auto;
  min-width: 0;
  height: 28px;
  margin: 0;
  padding: 0 8px;
  font-size: 12px;
  border-radius: 7px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  background: transparent;
  color: inherit;
}
/* The template fields are half-mono: placeholders line up and braces read clearly. */
.dsh_notify_card .dsh_notify_mono,
.dsh_notify_textInput.dsh_notify_mono {
  font-family: var(--ds-font-family-code, "Cascadia Mono", Consolas, "Noto Sans SC", monospace);
  font-variant-numeric: tabular-nums;
}
.dsh_notify_textArea {
  min-width: 0;
  padding: 6px 8px;
  font-size: 12px;
  font-family: inherit;
  border-radius: 7px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  background: transparent;
  color: inherit;
  resize: vertical;
}
.dsh_notify_editorPlaceholders { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dsh_notify_chip {
  padding: 2px 8px;
  font-family: var(--ds-font-family-code, "Cascadia Mono", Consolas, "Noto Sans SC", monospace);
  font-size: 11px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.dsh_notify_chip:hover { background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12)); }
.dsh_notify_editorPreview {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 10px;
  border-radius: 7px;
  border: 1px dashed var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
}
.dsh_notify_previewTitle { font-size: 13px; font-weight: 600; }
.dsh_notify_previewBody { font-size: 12px; opacity: 0.8; line-height: 1.5; }
.dsh_notify_editorActions { display: flex; gap: 8px; }

/* Card 3: the two situation groups, each row carrying its example sentence. */
.dsh_notify_subcard {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
}
.dsh_notify_subcardTitle { font-weight: 600; font-size: 13px; }

/*
 * Greys: the master switch off disables every delivery control — disabled, not
 * hidden, so the chosen values stay visible.
 */
.dsh_notify_button[disabled],
.dsh_notify_card .dsh_notify_scenarioRow .dsh_notify_scenarioPreview[disabled],
.dsh_notify_card .dsh_notify_pickerTrigger[disabled] {
  opacity: 0.45;
  cursor: not-allowed;
}
.dsh_notify_button[disabled]:hover,
.dsh_notify_card .dsh_notify_scenarioRow .dsh_notify_scenarioPreview[disabled]:hover,
.dsh_notify_card .dsh_notify_pickerTrigger[disabled]:hover {
  background: transparent;
  border-color: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
}
.dsh_notify_modeRow input[type='radio']:disabled,
.dsh_notify_row input[type='checkbox']:disabled {
  opacity: 0.45;
}
/* Text beside a control the master switch disabled: dimmed through the label
   and the description only, so the checkbox keeps its own single dimming. */
.dsh_notify_rowDisabled .dsh_notify_rowLabel,
.dsh_notify_rowDisabled .dsh_notify_rowDesc,
.dsh_notify_modeRowDisabled .dsh_notify_rowLabel,
.dsh_notify_modeRowDisabled .dsh_notify_rowDesc {
  opacity: 0.5;
}
.dsh_notify_minutes input:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
`

/**
 * Inject the stylesheet once.
 * @param doc - the document to inject into (defaults to the ambient one).
 */
export function adoptStyles(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): void {
  if (doc === undefined) return
  if (doc.getElementById(STYLE_ID) !== null) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = cssText
  doc.head.appendChild(style)
}
