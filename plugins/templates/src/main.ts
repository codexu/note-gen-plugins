import { PluginError, type PluginActivate, type PluginCommandArgument, type ActiveEditorContext, type EditorSelection, type PluginFormField, type PluginUiBlock } from '@notegen/plugin-api'
import { record, string, notePath } from '../../../shared/workbench'
import { parseTemplate, renderTemplate, type Template } from './engine'
import { bundledTemplates } from './bundled'
import { templateDesigner } from './designer'

export const activate: PluginActivate = async (ctx) => {
  const id = (name: string) => `${ctx.plugin.id}.${name}`
  const t = (key: string) => ctx.i18n.t(key)
  let serial = 0
  let busy = false
  type Session = { token: string; workspace: string; mode: 'insert' | 'create'; dialog?: string; editor: ActiveEditorContext | null; selection: EditorSelection | null; template?: Template; stage: 'choose' | 'fields' | 'preview' | 'done'; choices: Map<string, string>; cursor?: string; folder: string; destination: string; text?: string; path?: string; committing?: boolean }
  let session: Session | undefined
  const designer = templateDesigner(ctx)
  function alive(s: Session) {
    ctx.signal.throwIfAborted()
    if (session !== s) throw new PluginError('Cancelled', t('cancelled'))
  }
  async function guard(s: Session) {
    alive(s)
    if ((await ctx.workspace.getCurrent()).id !== s.workspace) throw new PluginError('WorkspaceChanged', t('workspaceChanged'))
    alive(s)
  }
  async function display(s: Session, blocks: PluginUiBlock[]) {
    await guard(s)
    const options = { title: t(s.mode), closeLabel: t('cancel'), content: { blocks } }
    if (s.dialog) await ctx.ui.updateDialog(s.dialog, options)
    else {
      const handle = await ctx.ui.openDialog(options)
      s.dialog = handle.id
      if (session !== s || ctx.signal.aborted) await ctx.ui.closeDialog(handle.id).catch(() => {})
    }
  }
  function submitSession(arg: PluginCommandArgument, stage: Session['stage']): Session {
    const a = record(arg)
    const s = session
    if (!s || s.stage !== stage || a.dialogId !== s.dialog || a.formId !== `${stage}-${s.token}`) throw new PluginError('Cancelled', t('expired'))
    return s
  }
  async function choose(s: Session, next = false) {
    await guard(s)
    const list = await ctx.notes.list({ folder: s.folder, recursive: true, limit: 50, ...(next && s.cursor ? { cursor: s.cursor } : {}) }).catch(error => {
      if (record(error).code !== 'NotFound') throw error
      return { entries: [], truncated: false, nextCursor: undefined }
    })
    await guard(s)
    s.cursor = list.nextCursor
    s.choices = new Map(list.entries.filter(e => /\.md$/i.test(e.path)).map(e => [`file:${e.path}`, e.path]))
    const builtinOptions = Object.keys(bundledTemplates.en).map(key => ({ value: `builtin:${key}`, label: t(`builtin.${key}`) }))
    await display(s, [
      { type: 'text', text: t('chooseHelp') },
      { type: 'actions', actions: [{ id: 'new-template', label: t('designer.open'), command: id('new-template') }] },
      { type: 'form', id: `choose-${s.token}`, resetKey: String(++serial), command: id('choose'), submitLabel: t('continue'), fields: [{ id: 'template', type: 'select', label: t('template'), value: builtinOptions[0].value, options: [...builtinOptions, ...[...s.choices].map(([value, label]) => ({ value, label }))], required: true }] },
      ...(list.truncated ? [{ type: 'text' as const, text: t(s.cursor ? 'moreHelp' : 'truncated') }] : []),
      ...(s.cursor ? [{ type: 'actions' as const, actions: [{ id: 'next', label: t('next'), command: id('next'), argument: s.token }] }] : []),
    ])
  }
  async function start(mode: Session['mode']) {
    if (session?.dialog) await ctx.ui.closeDialog(session.dialog)
    session = undefined
    const workspace = await ctx.workspace.getCurrent()
    const editor = await ctx.editor.getActiveEditor()
    const selection = editor ? await ctx.editor.getSelection() : null
    if (mode === 'insert' && (!editor || editor.mode !== 'source' || editor.composing || !selection?.offsetsAvailable || selection.to === undefined)) throw new Error(t('sourceRequired'))
    if (editor && (!selection || selection.editorId !== editor.editorId || selection.revision !== editor.revision)) throw new PluginError('StaleRevision', t('stale'))
    const folder = string(ctx.settings.get(id('folder'))).trim() || 'Templates'
    const destination = string(ctx.settings.get(id('destination'))).trim() || 'Notes'
    // Reuse the existing portable Markdown path validator for both directory settings.
    notePath(`${folder}/template.md`); notePath(`${destination}/note.md`)
    const s: Session = { token: String(++serial), workspace: workspace.id, mode, editor, selection, stage: 'choose', choices: new Map(), folder, destination }
    session = s
    await choose(s)
  }
  function register(name: string, fn: (arg: PluginCommandArgument) => Promise<void>) {
    return ctx.commands.handle(id(name), async arg => {
      if (busy) return { message: t('busy') }
      busy = true
      const started = session
      try { await fn(arg) }
      catch (error) {
        const code = record(error).code
        if (ctx.signal.aborted || code === 'Cancelled') return
        const detail = code === 'StaleRevision' ? t('stale') : error instanceof Error ? error.message : String(error)
        const message = started?.committing ? `${t('submissionFailed')} ${detail}` : detail
        await ctx.ui.showNotice(message.slice(0, 500)).catch(() => {})
        return { message: message.slice(0, 500) }
      } finally { busy = false }
    })
  }
  const subscriptions = [
    register('new-template', async () => {
      const old = session
      session = undefined
      if (old?.dialog) await ctx.ui.closeDialog(old.dialog)
      await designer.open()
    }),
    register('insert', async () => start('insert')),
    register('create', async () => start('create')),
    register('next', async arg => {
      const s = session
      if (!s || s.token !== arg || s.stage !== 'choose' || !s.cursor) return
      await choose(s, true)
    }),
    register('choose', async arg => {
      const s = submitSession(arg, 'choose')
      await guard(s)
      const key = string(record(record(arg).values).template)
      let source: string
      if (key.startsWith('builtin:')) {
        const language = t('language') === 'zh-CN' ? 'zh-CN' : 'en'
        const templates: Record<string, string> = bundledTemplates[language]
        if (!Object.prototype.hasOwnProperty.call(templates, key.slice(8))) throw new Error(t('expired'))
        source = templates[key.slice(8)]
      } else {
        const path = s.choices.get(key)
        if (!path) throw new Error(t('expired'))
        source = (await ctx.notes.read({ path })).content
      }
      await guard(s)
      const template = parseTemplate(source)
      const fields: PluginFormField[] = [...(s.mode === 'create' ? [{ type: 'text' as const, id: 'title', label: t('title'), value: '', required: true, maxLength: 120 }] : []), ...template.fields]
      // The form can have zero custom fields; a disabled context field keeps it valid and informative.
      if (!fields.length) fields.push({ type: 'text', id: 'context', label: t('template'), value: key.slice(0, 160), disabled: true })
      s.template = template
      s.stage = 'fields'
      await display(s, [{ type: 'form', id: `fields-${s.token}`, fields, submitLabel: t('preview'), command: id('preview') }])
    }),
    register('preview', async arg => {
      const s = submitSession(arg, 'fields')
      await guard(s)
      const submitted = record(record(arg).values)
      const title = s.mode === 'create' ? string(submitted.title).trim() : (s.editor?.path?.split('/').pop() ?? '').replace(/\.md$/i, '')
      if (s.mode === 'create') {
        if (!title || title.length > 120 || /[/\\]/.test(title)) throw new Error(t('invalidTitle'))
        s.path = notePath(`${s.destination}/${title}.md`)
      }
      const day = await ctx.calendar.resolveDay({ timeZone: 'system', dayStartsAt: '00:00' })
      const variables: Record<string, string> = { date: day.logicalDate, time: day.localDateTime.split('T')[1] ?? '', datetime: day.localDateTime, title, selection: s.selection?.text ?? '' }
      for (const field of s.template!.fields) {
        const value = submitted[field.id]
        if (typeof value !== 'string' || value.length > 4000 || (field.required && !value.trim()) || (field.type === 'date' && value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value))) throw new Error(`${t('invalidField')}: ${field.label}`)
        variables[`field.${field.id.slice(6)}`] = value
      }
      s.text = renderTemplate(s.template!, variables)
      if (!s.text) throw new Error(t('empty'))
      s.stage = 'preview'
      await display(s, [
        { type: 'text', text: s.path ?? t('insertHelp') },
        { type: 'text', text: s.text.slice(0, 12000) },
        ...(s.text.length > 12000 ? [{ type: 'text' as const, text: t('previewTruncated') }] : []),
        { type: 'form', id: `preview-${s.token}`, fields: [{ id: 'confirm', label: t('confirm'), type: 'checkbox', value: false, required: true }], command: id('apply'), submitLabel: t(s.mode) },
      ])
    }),
    register('apply', async arg => {
      const s = submitSession(arg, 'preview')
      if (record(record(arg).values).confirm !== true) throw new Error(t('confirm'))
      await guard(s)
      if (s.mode === 'insert') {
        const editor = await ctx.editor.getActiveEditor()
        if (!editor || editor.editorId !== s.editor!.editorId || editor.documentId !== s.editor!.documentId || editor.revision !== s.editor!.revision || editor.mode !== 'source' || editor.composing) throw new PluginError('StaleRevision', t('stale'))
        await guard(s)
        // Insert after the captured selection; never remove or replace selected content.
        s.committing = true
        s.stage = 'done'
        await ctx.editor.applyEdits({ editorId: editor.editorId, expectedRevision: editor.revision, edits: [{ from: s.selection!.to!, to: s.selection!.to!, text: s.text! }] })
        await ctx.ui.showNotice(t('inserted')).catch(() => {})
      } else {
        s.committing = true
        s.stage = 'done'
        const result = await ctx.notes.openOrCreate({ workspaceId: s.workspace, path: s.path!, initialContent: s.text!, conflict: 'open-existing', open: true, idempotencyKey: `${ctx.plugin.id}:${Date.now()}:${s.token}` })
        await ctx.ui.showNotice(`${t(result.status === 'created' ? 'created' : 'existing')}: ${result.path}${result.opened ? '' : ` — ${t('notOpened')}`}`).catch(() => {})
      }
      if (session === s) session = undefined
      if (s.dialog) await ctx.ui.closeDialog(s.dialog).catch(() => {})
    }),
    ctx.ui.onDidCloseDialog(event => {
      if (session?.dialog === event.id) session = undefined
    }),
    ctx.workspace.onDidChange(event => {
      if (!event.previous || event.previous.id === event.current.id) return
      const old = session
      session = undefined
      if (old?.dialog) void ctx.ui.closeDialog(old.dialog).catch(() => {})
    }),
  ]
  ctx.signal.addEventListener('abort', () => { session = undefined; subscriptions.forEach(s => s.dispose()) }, { once: true })
  await ctx.ui.views.update(id('settings'), { blocks: [
    { type: 'text', text: t('designer.methods') },
    { type: 'text', text: t('designer.permissionHelp') },
    { type: 'actions', actions: [{ id: 'new-template', label: t('designer.open'), command: id('new-template') }] },
  ] })
}
