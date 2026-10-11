/**
 * The settings-section stylesheet. The web server serves exactly one file per
 * client plugin, so the CSS ships inside the bundle and is injected once.
 */

/** Stable `<style>` id (idempotent across hot reloads). */
export const STYLE_ID = 'dsh-notify-desktop-style'

/** The section's stylesheet text. */
export const cssText = `
.dsh_notify_section { display: flex; flex-direction: column; gap: 16px; }
.dsh_notify_card {
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.24));
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dsh_notify_cardTitle { font-weight: 600; font-size: 13px; }
.dsh_notify_cardDesc { font-size: 12px; opacity: 0.72; line-height: 1.5; }
.dsh_notify_row { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; }
.dsh_notify_row input[type='checkbox'] { margin-top: 2px; }
.dsh_notify_rowText { display: flex; flex-direction: column; gap: 2px; }
/* Only the checkbox and this label toggle a row; the rest of the row does not. */
.dsh_notify_rowLabel { cursor: pointer; }
.dsh_notify_error { color: #e5484d; font-size: 12px; line-height: 1.5; }
.dsh_notify_note { color: #3dd68c; font-size: 12px; line-height: 1.5; }
.dsh_notify_cacheText { flex: 1 1 auto; font-size: 12px; opacity: 0.75; }
/* The imported-sound list: one quiet row per file, hover to reveal the action. */
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
.dsh_notify_rowDesc { font-size: 12px; opacity: 0.66; }
.dsh_notify_minutes { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.dsh_notify_minutes input {
  width: 72px;
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  background: transparent;
  color: inherit;
}
.dsh_notify_button {
  align-self: flex-start;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 13px;
}
.dsh_notify_button:hover { background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12)); }
/*
 * The sound rows are a fixed three-column grid, and every control is sized
 * explicitly: the surrounding settings theme gives a select element a full
 * width and its own height, which turned each row into three stacked lines.
 * The selectors below are written long enough to win against those theme rules
 * without needing an important flag.
 */
.dsh_notify_sounds { display: flex; flex-direction: column; gap: 2px; }
.dsh_notify_card .dsh_notify_soundRow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 148px 68px;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  min-height: 38px;
}
.dsh_notify_card .dsh_notify_soundRow + .dsh_notify_soundRow {
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.16));
}
.dsh_notify_card .dsh_notify_soundLabel { font-size: 13px; line-height: 1.4; }
/*
 * The select is drawn by hand: the native one (grey hairline, system arrow,
 * square focus ring) looked nothing like the rest of the section. appearance is
 * none with an inline chevron, and the surface matches the row's own layer.
 */
.dsh_notify_card .dsh_notify_soundRow .dsh_notify_select {
  width: 148px;
  min-width: 148px;
  max-width: 148px;
  height: 30px;
  margin: 0;
  padding: 0 24px 0 10px;
  font-size: 12px;
  line-height: 28px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  background-color: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.08));
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6'><path d='M1 1l4 4 4-4' fill='none' stroke='%23909aa8' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  background-repeat: no-repeat;
  background-position: right 9px center;
  background-size: 10px 6px;
  appearance: none;
  -webkit-appearance: none;
  color: inherit;
  cursor: pointer;
  transition: border-color 120ms ease, background-color 120ms ease;
}
.dsh_notify_card .dsh_notify_soundRow .dsh_notify_select:hover {
  border-color: var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.45));
  background-color: var(--dsw-alias-bg-layer-3, rgba(127, 127, 127, 0.14));
}
.dsh_notify_card .dsh_notify_soundRow .dsh_notify_select:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, rgba(77, 107, 254, 0.6));
  outline-offset: 1px;
  border-color: transparent;
}
.dsh_notify_card .dsh_notify_customRow {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 10px;
  margin-top: 2px;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.16));
}
.dsh_notify_card .dsh_notify_customControls { display: flex; align-items: center; gap: 8px; }
.dsh_notify_card .dsh_notify_customControls .dsh_notify_pathInput {
  flex: 1 1 auto;
  width: auto;
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
.dsh_notify_card .dsh_notify_customControls .dsh_notify_button {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  white-space: nowrap;
  flex: 0 0 auto;
}
/*
 * The two-level picker: the trigger keeps the old select's footprint, the panel
 * floats above the card with the section headers as level one.
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
.dsh_notify_pickerHeaderLabel { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh_notify_pickerCount { opacity: 0.55; font-variant-numeric: tabular-nums; }
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
.dsh_notify_pickerEmpty { padding: 2px 8px 8px 20px; font-size: 12px; opacity: 0.6; }
/* The preview button is the picker trigger's twin: same height, radius and surface. */
.dsh_notify_card .dsh_notify_soundRow .dsh_notify_preview {
  width: 68px;
  height: 30px;
  margin: 0;
  padding: 0;
  font-size: 12px;
  line-height: 28px;
  text-align: center;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
  background-color: transparent;
  align-self: center;
  transition: border-color 120ms ease, background-color 120ms ease;
}
.dsh_notify_card .dsh_notify_soundRow .dsh_notify_preview:hover {
  border-color: var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.45));
  background-color: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12));
}
.dsh_notify_card .dsh_notify_soundRow .dsh_notify_preview:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, rgba(77, 107, 254, 0.6));
  outline-offset: 1px;
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
