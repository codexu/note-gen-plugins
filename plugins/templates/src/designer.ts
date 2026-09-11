import { PluginError, type PluginContext, type PluginCommandArgument, type PluginFormField, type PluginUiBlock } from '@notegen/plugin-api'
import { record, string, notePath } from '../../../shared/workbench'
import { parseTemplate } from './engine'

type Field = { id: string; label: string; type: 'text' | 'textarea' | 'date'; required: boolean; default: string }
type Draft = { token: string; workspace: string; folder: string; dialog?: string; step: string; name: string; body: string; fields: Field[]; page: number; source: string; path: string; committed: boolean }

export function templateDesigner(ctx: PluginContext) {
  const t = (key: string) => ctx.i18n.t(key)
  const command = (name: string) => `${ctx.plugin.id}.${name}`
  let draft: Draft | undefined
  let serial = 0
  let busy = false
  const subscriptions: { dispose(): void }[] = []
  async function guard(d: Draft) {
    ctx.signal.throwIfAborted()
    if (draft !== d || (await ctx.workspace.getCurrent()).id !== d.workspace || draft !== d) throw new PluginError('Cancelled', t('expired'))
    ctx.signal.throwIfAborted()
  }
  async function show(d: Draft, blocks: PluginUiBlock[]) {
    await guard(d)
    const options = { title: t('designer.open'), closeLabel: t('cancel'), content: { blocks } }
    if (d.dialog) await ctx.ui.updateDialog(d.dialog, options)
    else {
      d.dialog = (await ctx.ui.openDialog(options)).id
      if (draft !== d || ctx.signal.aborted) await ctx.ui.closeDialog(d.dialog).catch(() => {})
    }
  }
  function form(d: Draft, fields: PluginFormField[], submitLabel: string): PluginUiBlock {
    return { type: 'form', id: `designer-${d.token}-${d.step}`, fields, submitLabel, command: command('designer-submit') }
  }
  function encode(d: Draft) {
    return d.fields.length ? `<!-- notegen-template\n${JSON.stringify({ fields: d.fields }, null, 2)}\n-->\n${d.body}` : d.body
  }
  async function details(d: Draft) {
    d.step = 'body'
    await show(d, [
      { type: 'text', text: t('designer.bodyHelp') },
      form(d, [
        { type: 'text', id: 'name', label: t('designer.name'), value: d.name, required: true, maxLength: 120 },
        { type: 'textarea', id: 'body', label: t('designer.body'), value: d.body, required: true, maxLength: 16000 },
      ], t('continue')),
    ])
  }
  async function fieldPage(d: Draft) {
    d.step = `fields-${d.page}`
    const fields: PluginFormField[] = []
    for (const f of d.fields.slice(d.page * 6, d.page * 6 + 6)) {
      fields.push(
        { type: 'text', id: `${f.id}_label`, label: `{{field.${f.id}}} — ${t('designer.label')}`, value: f.label, required: true, maxLength: 160 },
        { type: 'select', id: `${f.id}_type`, label: `${f.id} — ${t('designer.type')}`, value: f.type, options: ['text', 'textarea', 'date'].map(value => ({ value, label: t(`designer.${value}`) })) },
        { type: 'checkbox', id: `${f.id}_required`, label: `${f.id} — ${t('designer.required')}`, value: f.required },
        { type: 'textarea', id: `${f.id}_default`, label: `${f.id} — ${t('designer.default')}`, value: f.default, maxLength: 4000 },
      )
    }
    await show(d, [{ type: 'text', text: t('designer.fieldsHelp') }, form(d, fields, t('continue'))])
  }
  async function preview(d: Draft) {
    d.source = encode(d)
    parseTemplate(d.source)
    d.step = 'preview'
    await show(d, [
      { type: 'text', text: d.path },
      { type: 'text', text: d.source.slice(0, 12000) },
      ...(d.source.length > 12000 ? [{ type: 'text' as const, text: t('previewTruncated') }] : []),
      form(d, [{ type: 'checkbox', id: 'confirm', label: t('designer.confirm'), value: false, required: true }], t('designer.save')),
      { type: 'actions', actions: [{ id: 'back', label: t('designer.back'), command: command('designer-back'), argument: d.token }] },
    ])
  }
  async function run(action: () => Promise<void>) {
    if (busy) return { message: t('busy') }
    busy = true
    try { await action() }
    catch (error) {
      if (ctx.signal.aborted || record(error).code === 'Cancelled') return
      const detail = error instanceof Error ? error.message : String(error)
      const message = (draft?.committed ? `${t('submissionFailed')} ${detail}` : detail).slice(0, 500)
      await ctx.ui.showNotice(message).catch(() => {})
      return { message }
    } finally { busy = false }
  }
  async function open() {
    return run(async () => {
      const old = draft
      draft = undefined
      if (old?.dialog) await ctx.ui.closeDialog(old.dialog)
      const workspace = await ctx.workspace.getCurrent()
      const folder = string(ctx.settings.get(command('folder'))).trim() || 'Templates'
      notePath(`${folder}/template.md`)
      const d: Draft = { token: String(++serial), workspace: workspace.id, folder, step: 'body', name: '', body: t('designer.example'), fields: [], page: 0, source: '', path: '', committed: false }
      draft = d
      await details(d)
    })
  }
  subscriptions.push(ctx.commands.handle(command('designer-submit'), (arg: PluginCommandArgument) => run(async () => {
    const d = draft
    const a = record(arg)
    if (!d || d.committed || a.dialogId !== d.dialog || a.formId !== `designer-${d.token}-${d.step}`) throw new PluginError('Cancelled', t('expired'))
    await guard(d)
    const values = record(a.values)
    if (d.step === 'body') {
      const name = string(values.name).trim()
      const body = string(values.body)
      if (!name || name.length > 120 || /[/\\]/.test(name) || !body.trim() || body.length > 16000) throw new Error(t('designer.invalidBody'))
      if (body.replace(/^\uFEFF/, '').startsWith('<!-- notegen-template')) throw new Error(t('designer.noHeader'))
      const ids = [...new Set([...body.matchAll(/\{\{\s*field\.([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g)].map(match => match[1]))]
      const fields: Field[] = ids.map(id => d.fields.find(f => f.id === id) ?? { id, label: id, type: 'text', required: false, default: '' })
      // Validate before mutating the draft so invalid input remains editable.
      parseTemplate(encode({ ...d, body, fields }))
      d.name = name; d.body = body; d.fields = fields; d.page = 0
      d.path = notePath(`${d.folder}/${name}.md`)
      if (fields.length) await fieldPage(d)
      else await preview(d)
    } else if (d.step.startsWith('fields-')) {
      const fields = d.fields.map(f => ({ ...f }))
      for (const f of fields.slice(d.page * 6, d.page * 6 + 6)) {
        const type = string(values[`${f.id}_type`])
        const label = string(values[`${f.id}_label`]).trim()
        const value = string(values[`${f.id}_default`])
        if (!['text', 'textarea', 'date'].includes(type) || !label || label.length > 160 || value.length > 4000 || (type === 'date' && value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value))) throw new Error(`${t('invalidField')}: ${f.id}`)
        f.type = type as Field['type']; f.label = label; f.default = value; f.required = values[`${f.id}_required`] === true
      }
      parseTemplate(encode({ ...d, fields }))
      d.fields = fields
      if ((d.page + 1) * 6 < fields.length) { d.page++; await fieldPage(d) }
      else await preview(d)
    } else if (d.step === 'preview') {
      if (values.confirm !== true) throw new Error(t('designer.confirm'))
      await guard(d)
      // No expectedRevision: the host rejects an existing file, even if created concurrently.
      d.committed = true
      await ctx.notes.write({ path: d.path, content: d.source, create: true })
      await ctx.ui.showNotice(`${t('designer.saved')}: ${d.path}`).catch(() => {})
      if (draft === d) draft = undefined
      if (d.dialog) await ctx.ui.closeDialog(d.dialog).catch(() => {})
    }
  })))
  subscriptions.push(ctx.commands.handle(command('designer-back'), arg => run(async () => {
    const d = draft
    if (!d || d.token !== arg || d.step !== 'preview' || d.committed) return
    await guard(d)
    await details(d)
  })))
  subscriptions.push(ctx.ui.onDidCloseDialog(event => { if (draft?.dialog === event.id) draft = undefined }))
  subscriptions.push(ctx.workspace.onDidChange(event => {
    if (!event.previous || event.previous.id === event.current.id) return
    const old = draft; draft = undefined
    if (old?.dialog) void ctx.ui.closeDialog(old.dialog).catch(() => {})
  }))
  ctx.signal.addEventListener('abort', () => { draft = undefined; subscriptions.forEach(s => s.dispose()) }, { once: true })
  return { open }
}
