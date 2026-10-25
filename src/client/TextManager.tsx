/**
 * The saved-popup-text manager: one group per enabled situation, each holding
 * that situation's templates (at most {@link TEXT_LIMIT_PER_SCENARIO}), the
 * inline editor and the delete confirmation.
 *
 * The manager owns no storage: the section injects the text store's save/delete
 * calls, so the same code path refreshes the notification cache the runner
 * reads. Only situations that are switched on are listed; the caller decides
 * which those are.
 */
import { useState } from 'react'
import {
  DEFAULT_BODY_TEMPLATE,
  DEFAULT_TITLE_TEMPLATE,
} from '../types.ts'
import {
  TEXT_BODY_LIMIT,
  TEXT_LIMIT_PER_SCENARIO,
  TEXT_NAME_LIMIT,
  TEXT_TITLE_LIMIT,
  type NotifyScenario,
  type TextLibrary,
  type TextTemplate,
} from '../scenarios.ts'
import { fmt, type NotifyKey } from './locales.ts'
import type { TextDraft, TextSaveOutcome } from './texts.ts'
import { renderBody, renderTitle, type TemplateParts } from './template.ts'

/** What one editor session needs to know. */
interface EditorState {
  readonly scenario: NotifyScenario
  /** The template being edited; absent while creating a new one. */
  readonly id?: string
  readonly name: string
  readonly title: string
  readonly body: string
}

/** Why the last save failed, as a locale key. */
const PROBLEM_KEY: Readonly<Record<string, NotifyKey>> = {
  name: 'settings.textEditor.nameRequired',
  title: 'settings.textEditor.titleRequired',
  body: 'settings.textEditor.bodyRequired',
  limit: 'settings.textLibrary.limit',
}

/** Props of {@link TextManager}. */
export interface TextManagerProps {
  /** The situations to list, in presentation order. */
  readonly scenarios: readonly NotifyScenario[]
  /** The current library snapshot. */
  readonly library: TextLibrary
  /** Locale lookup. */
  readonly t: (key: NotifyKey) => string
  /** The display label of one situation. */
  readonly labelOf: (scenario: NotifyScenario) => string
  /** The placeholder values one editor preview renders with. */
  readonly partsOf: (scenario: NotifyScenario) => TemplateParts
  /** The fallback line that situation's body uses when there is no content. */
  readonly fallbackOf: (scenario: NotifyScenario) => string
  /** Persist one draft; resolves with the store's outcome. */
  readonly onSave: (scenario: NotifyScenario, draft: TextDraft, id?: string) => Promise<TextSaveOutcome>
  /** Delete one template. */
  readonly onDelete: (scenario: NotifyScenario, id: string) => Promise<{ readonly ok: boolean }>
}

/**
 * Render the manager.
 * @param props - see {@link TextManagerProps}.
 * @returns the per-situation groups, editor and confirmations.
 */
export function TextManager(props: TextManagerProps): JSX.Element {
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [problem, setProblem] = useState<NotifyKey | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState<{ scenario: NotifyScenario; template: TextTemplate } | null>(null)
  const [note, setNote] = useState<string | null>(null)

  /** Start a new template, pre-filled with the built-in wording. */
  const startNew = (scenario: NotifyScenario): void => {
    setProblem(null)
    setNote(null)
    setEditor({
      scenario,
      name: fmt(props.t('settings.textEditor.defaultName'), { n: String(props.library[scenario].length + 1) }),
      title: DEFAULT_TITLE_TEMPLATE,
      body: DEFAULT_BODY_TEMPLATE,
    })
  }

  /** Edit one existing template. */
  const startEdit = (scenario: NotifyScenario, template: TextTemplate): void => {
    setProblem(null)
    setNote(null)
    setEditor({ scenario, id: template.id, name: template.name, title: template.title, body: template.body })
  }

  /** Validate locally, then hand the draft to the store. */
  const save = async (): Promise<void> => {
    if (editor === null || saving) return
    const name = editor.name.trim()
    const title = editor.title.trim()
    const body = editor.body.trim()
    if (name === '' || name.length > TEXT_NAME_LIMIT) {
      setProblem('settings.textEditor.nameRequired')
      return
    }
    if (title === '' || title.length > TEXT_TITLE_LIMIT) {
      setProblem('settings.textEditor.titleRequired')
      return
    }
    if (body === '' || body.length > TEXT_BODY_LIMIT) {
      setProblem('settings.textEditor.bodyRequired')
      return
    }
    setSaving(true)
    const outcome = await props.onSave(editor.scenario, { name, title, body }, editor.id)
    setSaving(false)
    if (!outcome.ok) {
      setProblem(PROBLEM_KEY[outcome.problem] ?? 'settings.textLibrary.saveFailed')
      return
    }
    setEditor(null)
    setProblem(null)
    setNote(null)
  }

  /** Delete one template after the inline confirmation. */
  const remove = async (scenario: NotifyScenario, id: string): Promise<void> => {
    const result = await props.onDelete(scenario, id)
    setConfirming(null)
    setNote(result.ok ? props.t('settings.soundLibrary.removed') : props.t('settings.textLibrary.deleteFailed'))
  }

  return (
    <div className="dsh_notify_textManager">
      {props.scenarios.map(scenario => {
        const templates = props.library[scenario]
        const editing = editor !== null && editor.scenario === scenario ? editor : null
        return (
          <div className="dsh_notify_textGroup" key={scenario}>
            <div className="dsh_notify_textGroupHeader">
              <span className="dsh_notify_textGroupName">{props.labelOf(scenario)}</span>
              <span className="dsh_notify_textGroupCount">
                {String(templates.length) + '/' + String(TEXT_LIMIT_PER_SCENARIO)}
              </span>
              {editing === null ? (
                <button
                  type="button"
                  className="dsh_notify_button dsh_notify_textGroupAdd"
                  disabled={templates.length >= TEXT_LIMIT_PER_SCENARIO}
                  {...(templates.length >= TEXT_LIMIT_PER_SCENARIO
                    ? { title: props.t('settings.textLibrary.limit') }
                    : {})}
                  onClick={() => {
                    startNew(scenario)
                  }}
                >
                  {props.t('settings.textLibrary.add')}
                </button>
              ) : null}
            </div>
            {templates.length === 0 ? null : (
              <ul className="dsh_notify_textList">
                {templates.map(template => (
                  <li className="dsh_notify_textItem" key={template.id}>
                    <span className="dsh_notify_textItemName" title={template.name}>{template.name}</span>
                    <span className="dsh_notify_textItemBody" title={template.body}>{renderBody(template.body, props.partsOf(scenario), '')}</span>
                    <button
                      type="button"
                      className="dsh_notify_iconButton"
                      onClick={() => {
                        startEdit(scenario, template)
                      }}
                    >
                      {props.t('settings.textLibrary.edit')}
                    </button>
                    <button
                      type="button"
                      className="dsh_notify_iconButton dsh_notify_danger"
                      onClick={() => {
                        setProblem(null)
                        setConfirming({ scenario, template })
                      }}
                    >
                      {props.t('settings.textLibrary.delete')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {confirming !== null && confirming.scenario === scenario ? (
              <div className="dsh_notify_confirm">
                <span>{fmt(props.t('settings.textLibrary.deleteConfirm'), { name: confirming.template.name })}</span>
                <button
                  type="button"
                  className="dsh_notify_button dsh_notify_dangerButton"
                  onClick={() => {
                    void remove(confirming.scenario, confirming.template.id)
                  }}
                >
                  {props.t('settings.textLibrary.delete')}
                </button>
                <button
                  type="button"
                  className="dsh_notify_button"
                  onClick={() => {
                    setConfirming(null)
                  }}
                >
                  {props.t('settings.textEditor.cancel')}
                </button>
              </div>
            ) : null}
            {editing === null ? null : (
              <TextEditor
                key={editing.id ?? 'new'}
                state={editing}
                t={props.t}
                parts={props.partsOf(editing.scenario)}
                fallback={props.fallbackOf(editing.scenario)}
                problem={problem}
                saving={saving}
                onChange={next => {
                  setEditor({ ...editing, ...next })
                }}
                onCancel={() => {
                  setEditor(null)
                  setProblem(null)
                }}
                onSave={() => {
                  void save()
                }}
              />
            )}
          </div>
        )
      })}
      {note === null ? null : <div className="dsh_notify_note">{note}</div>}
    </div>
  )
}

/** Props of the inline editor. */
interface TextEditorProps {
  readonly state: EditorState
  readonly t: (key: NotifyKey) => string
  readonly parts: TemplateParts
  readonly fallback: string
  readonly problem: NotifyKey | null
  readonly saving: boolean
  readonly onChange: (patch: Partial<Pick<EditorState, 'name' | 'title' | 'body'>>) => void
  readonly onCancel: () => void
  readonly onSave: () => void
}

/** One input field of the editor. */
function Field(props: {
  label: string
  value: string
  limit: number
  multiline?: boolean
  /** Render the value in the half-mono template font (placeholders line up). */
  mono?: boolean
  onChange: (value: string) => void
}): JSX.Element {
  const count = String(props.value.length) + '/' + String(props.limit)
  const mono = props.mono === true ? ' dsh_notify_mono' : ''
  return (
    <label className="dsh_notify_editorRow">
      <span className="dsh_notify_editorLabel">{props.label}</span>
      {props.multiline === true ? (
        <textarea
          className={'dsh_notify_textArea' + mono}
          value={props.value}
          maxLength={props.limit}
          rows={3}
          onChange={event => {
            props.onChange(event.target.value)
          }}
        />
      ) : (
        <input
          type="text"
          className={'dsh_notify_textInput' + mono}
          value={props.value}
          maxLength={props.limit}
          onChange={event => {
            props.onChange(event.target.value)
          }}
        />
      )}
      <span className="dsh_notify_editorCount">{count}</span>
    </label>
  )
}

/** The inline editor for one template. */
function TextEditor(props: TextEditorProps): JSX.Element {
  const title = props.state.title === '' ? DEFAULT_TITLE_TEMPLATE : props.state.title
  const body = props.state.body === '' ? DEFAULT_BODY_TEMPLATE : props.state.body
  const previewTitle = renderTitle(title, props.parts)
  const previewBody = renderBody(body, props.parts, props.fallback)
  return (
    <div className="dsh_notify_editor">
      <Field
        label={props.t('settings.textEditor.name')}
        value={props.state.name}
        limit={TEXT_NAME_LIMIT}
        onChange={value => {
          props.onChange({ name: value })
        }}
      />
      <Field
        label={props.t('settings.textEditor.titleField')}
        value={props.state.title}
        limit={TEXT_TITLE_LIMIT}
        mono
        onChange={value => {
          props.onChange({ title: value })
        }}
      />
      <Field
        label={props.t('settings.textEditor.bodyField')}
        value={props.state.body}
        limit={TEXT_BODY_LIMIT}
        multiline
        mono
        onChange={value => {
          props.onChange({ body: value })
        }}
      />
      <div className="dsh_notify_editorPlaceholders">
        <span className="dsh_notify_rowDesc">{props.t('settings.textEditor.placeholders')}</span>
        {['{工作区}', '{状态}', '{内容}', '{分钟}'].map(token => (
          <button
            key={token}
            type="button"
            className="dsh_notify_chip"
            onClick={() => {
              props.onChange({ body: props.state.body + token })
            }}
          >
            {token}
          </button>
        ))}
      </div>
      <div className="dsh_notify_editorPreview">
        <div className="dsh_notify_rowDesc">{props.t('settings.textEditor.preview')}</div>
        <div className="dsh_notify_previewTitle">{previewTitle}</div>
        <div className="dsh_notify_previewBody">{previewBody}</div>
      </div>
      {props.problem === null ? null : <div className="dsh_notify_error">{props.t(props.problem)}</div>}
      <div className="dsh_notify_editorActions">
        <button
          type="button"
          className="dsh_notify_button"
          disabled={props.saving}
          onClick={props.onSave}
        >
          {props.saving ? props.t('settings.textLibrary.saving') : props.t('settings.textEditor.save')}
        </button>
        <button type="button" className="dsh_notify_button" onClick={props.onCancel}>
          {props.t('settings.textEditor.cancel')}
        </button>
      </div>
    </div>
  )
}
