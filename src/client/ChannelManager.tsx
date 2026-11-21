/**
 * The "external push" card's body: list configured channels, add/edit/delete
 * them, toggle each on/off, and send a test to one channel or all.
 *
 * The channels (and their tokens) live on the host; this component only edits
 * them through {@link listChannels} / {@link saveChannel} / {@link deleteChannel}
 * and asks the host to deliver the test through {@link testPush}. It renders the
 * per-type form from {@link CHANNEL_FIELDS}, so adding a channel type never
 * needs a hand-written form here.
 */
import { useEffect, useState } from 'react'
import {
  CHANNEL_FIELDS,
  CHANNEL_TYPES,
  channelTypeKey,
  detectChannelValue,
  type ChannelConfig,
  type ChannelType,
} from '../channels.ts'
import type { ChannelReceipt } from '../channels.ts'
import { SCENARIO_IDS } from '../scenarios.ts'
import { deleteChannel, listChannels, saveChannel, testPush, type ChannelDraft } from './channels.ts'

/** The translator the card needs (string keys keep the catalogue decoupled). */
type Translate = (key: string, params?: Record<string, string>) => string

/** The locale key of each scenario's display name. */
const SCENARIO_LABEL: Readonly<Record<string, string>> = {
  completed: 'settings.scenario.completed',
  error: 'settings.scenario.error',
  aborted: 'settings.scenario.aborted',
  blocked: 'settings.scenario.blocked',
  'max-tokens': 'settings.scenario.maxTokens',
  approval: 'settings.scenario.approval',
  question: 'settings.scenario.question',
  'plan-review': 'settings.scenario.planReview',
  reminder: 'settings.scenario.reminder',
}

/** A fresh empty draft for a given type. */
function emptyDraft(type: ChannelType): ChannelDraft {
  return { id: '', type, enabled: true, label: '', fields: {}, scenarios: [], titleTemplate: '', bodyTemplate: '', markdown: false }
}

/** How many receipts are failing. */
function failures(receipts: readonly ChannelReceipt[]): number {
  return receipts.filter(entry => !entry.ok).length
}

/**
 * The external-push channel manager.
 * @param props - the plugin translator.
 * @returns the rendered card body.
 */
export function ChannelManager(props: { readonly t: Translate }): JSX.Element {
  const t = props.t
  const [channels, setChannels] = useState<ChannelConfig[]>([])
  const [draft, setDraft] = useState<ChannelDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = async (): Promise<void> => {
    setChannels(await listChannels())
  }

  useEffect(() => {
    void reload()
  }, [])

  const typeName = (type: string): string => t(channelTypeKey(type as ChannelType))

  const labelOf = (channel: ChannelConfig): string => (channel.label !== '' ? channel.label : typeName(channel.type))

  const beginAdd = (): void => {
    setError(null)
    setNote(null)
    setDraft(emptyDraft('auto'))
  }

  const beginEdit = (channel: ChannelConfig): void => {
    setError(null)
    setNote(null)
    setDraft({
      id: channel.id,
      type: channel.type,
      enabled: channel.enabled,
      label: channel.label,
      fields: { ...channel.fields },
      scenarios: [...channel.scenarios],
      titleTemplate: channel.titleTemplate,
      bodyTemplate: channel.bodyTemplate,
      markdown: channel.markdown,
    })
  }

  const updateDraft = (patch: Partial<ChannelDraft>): void => {
    setDraft(current => (current === null ? current : { ...current, ...patch }))
  }

  const setField = (key: string, value: string): void => {
    setDraft(current => (current === null ? current : { ...current, fields: { ...current.fields, [key]: value } }))
  }

  const commit = async (): Promise<void> => {
    if (draft === null || busy) return
    setBusy(true)
    const outcome = await saveChannel(draft)
    setBusy(false)
    if (outcome.ok) {
      setChannels([...outcome.channels])
      setDraft(null)
      setError(null)
      setNote(t('settings.push.saved'))
      return
    }
    setError(outcome.problem === 'fields' && outcome.missing !== undefined
      ? t('settings.push.missingFields') + ' ' + outcome.missing.join(', ')
      : t('settings.push.saveFailed') + ' (' + outcome.problem + ')')
  }

  const toggle = async (channel: ChannelConfig): Promise<void> => {
    const outcome = await saveChannel({
      id: channel.id,
      type: channel.type,
      enabled: !channel.enabled,
      label: channel.label,
      fields: { ...channel.fields },
      scenarios: [...channel.scenarios],
      titleTemplate: channel.titleTemplate,
      bodyTemplate: channel.bodyTemplate,
      markdown: channel.markdown,
    })
    if (outcome.ok) setChannels([...outcome.channels])
    else setError(t('settings.push.saveFailed') + ' (' + outcome.problem + ')')
  }

  const remove = async (id: string): Promise<void> => {
    setConfirmId(null)
    const outcome = await deleteChannel(id)
    if (outcome.ok) {
      setChannels([...outcome.channels])
      setNote(t('settings.push.deleted'))
    } else {
      setError(t('settings.push.deleteFailed') + ' (' + outcome.problem + ')')
    }
  }

  const runTest = async (id: string): Promise<void> => {
    if (busy) return
    setBusy(true)
    setNote(null)
    const receipts = await testPush(id)
    setBusy(false)
    if (receipts.length === 0) {
      setError(t('settings.push.noChannel'))
      return
    }
    setError(null)
    const failed = failures(receipts)
    setNote(failed === 0
      ? t('settings.push.testOk')
      : t('settings.push.testFail') + ' ' + receipts.filter(entry => !entry.ok).map(entry => labelOf({ ...emptyDraft(entry.type as ChannelType), label: entry.label, type: entry.type as ChannelType }) + (entry.error !== undefined ? ' (' + entry.error + ')' : '')).join('; '))
  }

  const draftType = draft === null ? null : draft.type

  return (
    <div className="dsh_notify_push">
      <div className="dsh_notify_customControls">
        <button type="button" className="dsh_notify_button" disabled={busy} onClick={beginAdd}>{t('settings.push.add')}</button>
        <button type="button" className="dsh_notify_button" disabled={busy || channels.length === 0} onClick={() => { void runTest('') }}>{t('settings.push.testAll')}</button>
      </div>

      {error === null ? null : <div className="dsh_notify_error">{error}</div>}
      {note === null ? null : <div className="dsh_notify_note">{note}</div>}

      {channels.length === 0 && draft === null ? (
        <div className="dsh_notify_rowDesc">{t('settings.push.empty')}</div>
      ) : null}

      <ul className="dsh_notify_pushList">
        {channels.map(channel => (
          <li key={channel.id} className="dsh_notify_pushItem">
            <input
              id={'dsh-notify-push-' + channel.id}
              type="checkbox"
              checked={channel.enabled}
              disabled={busy}
              onChange={() => { void toggle(channel) }}
            />
            <label className="dsh_notify_rowLabel" htmlFor={'dsh-notify-push-' + channel.id}>{labelOf(channel)}</label>
            <span className="dsh_notify_rowDesc">{typeName(channel.type)}</span>
            <span className="dsh_notify_pushActions">
              <button type="button" className="dsh_notify_iconButton" disabled={busy} onClick={() => { void runTest(channel.id) }}>{t('settings.push.test')}</button>
              <button type="button" className="dsh_notify_iconButton" disabled={busy} onClick={() => { beginEdit(channel) }}>{t('settings.push.edit')}</button>
              <button type="button" className="dsh_notify_iconButton dsh_notify_danger" disabled={busy} onClick={() => { setConfirmId(channel.id) }}>{t('settings.push.remove')}</button>
            </span>
            {confirmId === channel.id ? (
              <span className="dsh_notify_confirm">
                <span>{t('settings.push.removeConfirm')}</span>
                <button type="button" className="dsh_notify_button dsh_notify_dangerButton" onClick={() => { void remove(channel.id) }}>{t('settings.push.remove')}</button>
                <button type="button" className="dsh_notify_button" onClick={() => { setConfirmId(null) }}>{t('settings.push.cancel')}</button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {draft === null ? null : (
        <div className="dsh_notify_pushForm">
          <div className="dsh_notify_pushFormRow">
            <span className="dsh_notify_pushFormLabel">{t('settings.push.typeLabel')}</span>
            {draft.id === '' ? (
              <select
                className="dsh_notify_select"
                value={draft.type}
                disabled={busy}
                onChange={event => { updateDraft({ type: event.target.value as ChannelType, fields: {} }) }}
              >
                {CHANNEL_TYPES.map(type => <option key={type} value={type}>{typeName(type)}</option>)}
              </select>
            ) : (
              <span className="dsh_notify_rowLabel">{draftType === null ? '' : typeName(draftType)}</span>
            )}
          </div>
          <div className="dsh_notify_pushFormRow">
            <span className="dsh_notify_pushFormLabel">{t('settings.push.nameLabel')}</span>
            <input
              className="dsh_notify_renameInput"
              type="text"
              maxLength={60}
              value={draft.label}
              placeholder={t('settings.push.namePlaceholder')}
              disabled={busy}
              onChange={event => { updateDraft({ label: event.target.value }) }}
            />
          </div>
          {draftType === null ? null : CHANNEL_FIELDS[draftType].map(field => (
            <div key={field.key} className="dsh_notify_pushFormRow">
              <span className="dsh_notify_pushFormLabel">{t(field.labelKey)}{field.required ? ' *' : ''}</span>
              {field.kind === 'select' ? (
                <select
                  className="dsh_notify_select"
                  value={draft.fields[field.key] ?? (field.options?.[0] ?? '')}
                  disabled={busy}
                  onChange={event => { setField(field.key, event.target.value) }}
                >
                  {(field.options ?? []).map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input
                  className={field.kind === 'number' ? 'dsh_notify_number' : 'dsh_notify_renameInput'}
                  type={field.kind === 'number' ? 'number' : field.secret === true ? 'password' : 'text'}
                  value={draft.fields[field.key] ?? ''}
                  placeholder={field.placeholder ?? ''}
                  disabled={busy}
                  onChange={event => { setField(field.key, event.target.value) }}
                />
              )}
            </div>
          ))}
          {draftType === 'auto' ? (() => {
            const raw = draft.fields['value'] ?? ''
            if (raw.trim() === '') return null
            const det = detectChannelValue(raw)
            if (det === null) return <div className="dsh_notify_rowDesc">{t('settings.push.detectedUnknown')}</div>
            if (det.missing.length > 0) {
              return <div className="dsh_notify_rowDesc">{t('settings.push.detectedMissing', { type: typeName(det.type), fields: det.missing.join(', ') })}</div>
            }
            return <div className="dsh_notify_rowDesc">{t('settings.push.detected', { type: typeName(det.type) })}</div>
          })() : null}
          <div className="dsh_notify_pushFormRow">
            <span className="dsh_notify_pushFormLabel">{t('settings.push.scenariosLabel')}</span>
            <span className="dsh_notify_pushScenarios">
              {SCENARIO_IDS.map(scenario => (
                <label key={scenario} className="dsh_notify_pushScenario">
                  <input
                    type="checkbox"
                    checked={draft.scenarios.includes(scenario)}
                    disabled={busy}
                    onChange={event => {
                      updateDraft({
                        scenarios: event.target.checked
                          ? [...draft.scenarios, scenario]
                          : draft.scenarios.filter(id => id !== scenario),
                      })
                    }}
                  />
                  <span>{t(SCENARIO_LABEL[scenario] ?? scenario)}</span>
                </label>
              ))}
            </span>
          </div>
          <div className="dsh_notify_pushFormRow">
            <span className="dsh_notify_pushFormLabel">{t('settings.push.titleTemplateLabel')}</span>
            <input
              className="dsh_notify_renameInput"
              type="text"
              maxLength={400}
              value={draft.titleTemplate}
              placeholder={t('settings.push.templatePlaceholder')}
              disabled={busy}
              onChange={event => { updateDraft({ titleTemplate: event.target.value }) }}
            />
          </div>
          <div className="dsh_notify_pushFormRow">
            <span className="dsh_notify_pushFormLabel">{t('settings.push.bodyTemplateLabel')}</span>
            <input
              className="dsh_notify_renameInput"
              type="text"
              maxLength={1000}
              value={draft.bodyTemplate}
              placeholder={t('settings.push.templatePlaceholder')}
              disabled={busy}
              onChange={event => { updateDraft({ bodyTemplate: event.target.value }) }}
            />
          </div>
          {draftType === 'wecom' || draftType === 'dingtalk' || draftType === 'feishu' ? (
            <div className="dsh_notify_pushFormRow">
              <span className="dsh_notify_pushFormLabel">{t('settings.push.markdownLabel')}</span>
              <input
                type="checkbox"
                checked={draft.markdown}
                disabled={busy}
                onChange={event => { updateDraft({ markdown: event.target.checked }) }}
              />
              <span className="dsh_notify_rowDesc">{t('settings.push.markdownHint')}</span>
            </div>
          ) : null}
          <div className="dsh_notify_customControls">
            <button type="button" className="dsh_notify_button" disabled={busy} onClick={() => { void commit() }}>{t('settings.push.save')}</button>
            <button type="button" className="dsh_notify_button" disabled={busy} onClick={() => { setDraft(null); setError(null) }}>{t('settings.push.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
