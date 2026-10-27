import {
  createDisposables,
  isPluginError,
  registerView,
  type ActiveEditorContext,
  type PluginActivate,
  type PluginCommandResult,
  type PluginDialogOptions,
  type PluginUiBlock,
} from '@notegen/plugin-api'
import {
  asRecord,
  CODE_CHARACTER_LIMIT,
  DEFAULT_TEMPLATE_ID,
  emptyConfig,
  LEGACY_CONFIG_KEY,
  migrateLegacy,
  readTemplates,
  serializeConfig,
  TEMPLATE_LIMIT,
  TEMPLATE_NAME_LIMIT,
  TEMPLATE_STORAGE_KEY,
  type HtmlTemplate,
  type TemplateConfig,
} from './config'

type DialogPage = 'export' | 'manage' | 'edit' | 'delete'
type OutputAction = 'file' | 'source' | 'rich-text'

interface Feedback {
  title: string
  message: string
  destructive: boolean
  warnings: string[]
}

interface DialogSession {
  token: number
  pageVersion: number
  id?: string
  page: DialogPage
  selectedId: string
  editId?: string
  editor: ActiveEditorContext | null
  clipboardGranted: boolean
  busy: boolean
  feedback?: Feedback
}

export const activate: PluginActivate = async context => {
  const id = context.plugin.id
  const statusId = `${id}.status`
  const settingsId = `${id}.settings`
  const command = (name: string) => `${id}.${name}`
  const t = context.i18n.t
  const subscriptions = createDisposables()
  let config = emptyConfig()
  let configLoadFailed = false
  let dialog: DialogSession | undefined
  const closedWhileOpening = new Set<string>()
  let dialogSerial = 0
  let templateSerial = 0

  try {
    const stored = await context.storage.device.get(TEMPLATE_STORAGE_KEY)
    const loaded = stored === undefined
      ? migrateLegacy(await context.storage.device.get(LEGACY_CONFIG_KEY), t('template.legacy'))
      : readTemplates(stored)
    if (loaded) config = loaded
    else configLoadFailed = true
  } catch {
    configLoadFailed = true
  }
  context.signal.throwIfAborted()

  const fileSupported = context.plugin.capabilities?.includes('html-export') === true
    && typeof context.documents.exportHtml === 'function'
  const copySupported = context.plugin.capabilities?.includes('html-copy') === true
    && typeof context.documents.copyHtml === 'function'
  const noteTitle = (editor: ActiveEditorContext) => editor.path?.split('/').pop()?.replace(/\.md$/i, '') || t('untitled')
  const defaultTemplate = (): HtmlTemplate => ({ id: DEFAULT_TEMPLATE_ID, name: t('template.default'), css: '', javascript: '' })
  const findTemplate = (templateId: string): HtmlTemplate | undefined => templateId === DEFAULT_TEMPLATE_ID
    ? defaultTemplate()
    : config.templates.find(item => item.id === templateId)
  const options = () => [defaultTemplate(), ...config.templates].map(item => ({ value: item.id, label: item.name }))
  const describeError = (error: unknown): string => {
    if (isPluginError(error)) {
      if (error.code === 'StaleRevision') return t('error.stale')
      if (error.code === 'EditorBusy') return t('error.editorBusy')
      if (error.code === 'PermissionDenied') return t('error.permission')
      if (error.code === 'WorkspaceChanged' || error.code === 'Cancelled') return t('error.cancelled')
      if (error.code === 'UnavailableOnPlatform') return t('error.platform')
      if (error.code === 'QuotaExceeded') return t('error.quota')
      if (error.code === 'Timeout') return t('error.timeout')
    }
    return t('error.export', { detail: (error instanceof Error ? error.message : String(error)).slice(0, 1_000) })
  }

  const settingsView = subscriptions.add(registerView(context, {
    id: settingsId,
    render: () => ({ blocks: [
      { type: 'heading', text: t('configuration') },
      { type: 'text', text: t('configurationHelp'), tone: 'muted' },
      ...(configLoadFailed ? [{ type: 'callout' as const, title: t('configurationLoadFailed'), text: t('configurationLoadHelp'), tone: 'destructive' as const }] : []),
      { type: 'actions', actions: [{ id: 'open', label: t('command.open'), command: command('open') }] },
      { type: 'text', text: t('settingsHelp'), tone: 'muted' },
    ] }),
  }))

  const dialogOptions = (session: DialogSession): PluginDialogOptions => {
    const selected = findTemplate(session.selectedId) ?? defaultTemplate()
    const feedback: PluginUiBlock[] = session.feedback ? [
      { type: 'callout', title: session.feedback.title, text: session.feedback.message, tone: session.feedback.destructive ? 'destructive' : 'default' },
      ...(session.feedback.warnings.length ? [{ type: 'list' as const, items: session.feedback.warnings.slice(0, 100) }] : []),
    ] : []
    let blocks: PluginUiBlock[]
    if (session.page === 'export') {
      const disabled = session.busy || configLoadFailed || !session.editor || session.editor.composing
      blocks = [
        { type: 'heading', text: t('currentNote') },
        { type: 'text', text: session.editor ? noteTitle(session.editor) : t('noNote'), tone: session.editor ? 'default' : 'muted' },
        ...(session.editor?.composing ? [{ type: 'text' as const, text: t('error.editorBusy'), tone: 'muted' as const }] : []),
        ...(configLoadFailed ? [{ type: 'callout' as const, title: t('configurationLoadFailed'), text: t('configurationLoadHelp'), tone: 'destructive' as const }] : []),
        ...(!fileSupported || !copySupported ? [{ type: 'callout' as const, title: t('capabilityMissing'), text: t('capabilityHelp'), tone: 'destructive' as const }] : []),
        ...(!session.clipboardGranted ? [{ type: 'text' as const, text: t('clipboardPermissionHelp'), tone: 'muted' as const }] : []),
        { type: 'form', id: 'output', resetKey: `${session.token}:${session.pageVersion}`, submitLabel: t('command.export'), command: command('action'),
          fields: [{ type: 'select', id: 'template', label: t('template.select'), value: selected.id, options: options(), required: true }],
          submitActions: [
            { id: 'file', label: t('command.export'), command: command('action'), disabled: disabled || !fileSupported },
            { id: 'source', label: t('command.copy-source'), command: command('action'), variant: 'secondary', disabled: disabled || !copySupported || !session.clipboardGranted },
            { id: 'rich-text', label: t('command.copy-rich'), command: command('action'), variant: 'secondary', disabled: disabled || !copySupported || !session.clipboardGranted },
            { id: 'manage', label: t('template.manage'), command: command('action'), variant: 'secondary', disabled: session.busy || configLoadFailed },
          ] },
        { type: 'text', text: t('outputHelp'), tone: 'muted' },
        ...feedback,
      ]
    } else if (session.page === 'manage') {
      blocks = [
        { type: 'text', text: t('template.manageHelp'), tone: 'muted' },
        { type: 'form', id: 'manage', resetKey: `${session.token}:${session.pageVersion}`, submitLabel: t('template.edit'), command: command('action'),
          fields: [{ type: 'select', id: 'template', label: t('template.select'), value: selected.id, options: options(), required: true }],
          submitActions: [
            { id: 'new', label: t('template.new'), command: command('action'), disabled: session.busy || config.templates.length >= TEMPLATE_LIMIT },
            { id: 'edit', label: t('template.edit'), command: command('action'), variant: 'secondary', disabled: session.busy },
            { id: 'delete', label: t('template.delete'), command: command('action'), variant: 'destructive', disabled: session.busy },
            { id: 'back', label: t('back'), command: command('action'), variant: 'secondary', disabled: session.busy },
          ] },
        ...feedback,
      ]
    } else if (session.page === 'edit') {
      const draft = session.editId ? findTemplate(session.editId) : undefined
      blocks = [
        { type: 'text', text: t('dialogHelp'), tone: 'muted' },
        { type: 'form', id: 'edit', resetKey: `${session.token}:${session.pageVersion}`, submitLabel: t('save'), command: command('action'),
          fields: [
            { type: 'text', id: 'name', label: t('template.name'), value: draft?.name ?? '', maxLength: TEMPLATE_NAME_LIMIT },
            { type: 'textarea', id: 'css', label: t('css'), description: t('cssHelp'), value: draft?.css ?? '', maxLength: CODE_CHARACTER_LIMIT, placeholder: 'body.notegen-export { max-width: 960px; }' },
            { type: 'textarea', id: 'javascript', label: t('javascript'), description: t('javascriptHelp'), value: draft?.javascript ?? '', maxLength: CODE_CHARACTER_LIMIT, placeholder: 'document.querySelectorAll("h2").forEach(heading => {\n  heading.title = heading.textContent || "";\n});' },
          ],
          submitActions: [
            { id: 'save', label: t('save'), command: command('action'), disabled: session.busy },
            { id: 'cancel-edit', label: t('cancel'), command: command('action'), variant: 'secondary', disabled: session.busy },
          ] },
        ...feedback,
      ]
    } else {
      blocks = [
        { type: 'text', text: t('template.deleteQuestion', { name: selected.name }) },
        { type: 'actions', actions: [
          { id: 'confirm-delete', label: t('template.delete'), command: command('delete-confirm'), argument: { token: session.token }, variant: 'destructive', disabled: session.busy },
          { id: 'cancel-delete', label: t('cancel'), command: command('delete-cancel'), argument: { token: session.token }, variant: 'secondary', disabled: session.busy },
        ] },
        ...feedback,
      ]
    }
    const title = session.page === 'manage' ? t('template.manage')
      : session.page === 'edit' ? t(session.editId ? 'template.edit' : 'template.new')
        : session.page === 'delete' ? t('template.delete') : t('configuration')
    return { title, description: t('dialogDescription'), closeLabel: t('cancel'), content: { blocks } }
  }

  const updateDialog = async (session: DialogSession) => {
    if (dialog !== session || !session.id || context.signal.aborted) return
    try { await context.ui.updateDialog(session.id, dialogOptions(session)) }
    catch (error) { if (dialog === session && !context.signal.aborted) throw error }
  }
  const changePage = async (session: DialogSession, page: DialogPage) => {
    session.page = page
    session.pageVersion++
    session.feedback = undefined
    await updateDialog(session)
  }
  const saveConfig = async (next: TemplateConfig) => {
    const value = serializeConfig(next)
    if (!value) throw new Error(t('error.templateLimit'))
    try { await context.storage.device.set(TEMPLATE_STORAGE_KEY, value) }
    catch (error) { throw new Error(t('error.save', { detail: error instanceof Error ? error.message : String(error) })) }
    context.signal.throwIfAborted()
    config = next
  }
  const notifyFailure = async (session: DialogSession, message: string) => {
    session.feedback = { title: t('errorTitle'), message, destructive: true, warnings: [] }
    await updateDialog(session)
  }
  const updateEditor = async (session: DialogSession) => {
    if (dialog !== session || session.page !== 'export' || session.busy) return
    try {
      const editor = await context.editor.getActiveEditor()
      if (dialog !== session || session.page !== 'export' || session.busy || context.signal.aborted) return
      session.editor = editor
      await updateDialog(session)
    } catch { /* The action rechecks and reports editor errors before writing. */ }
  }

  subscriptions.add(context.commands.handle(command('open'), async () => {
    if (dialog) return
    const session: DialogSession = {
      token: ++dialogSerial, pageVersion: 0, page: 'export', selectedId: config.selectedId,
      editor: null, clipboardGranted: false, busy: false,
    }
    dialog = session
    try {
      const [editor, clipboard] = await Promise.all([
        context.editor.getActiveEditor(),
        context.permissions.query('clipboard.write'),
      ])
      context.signal.throwIfAborted()
      if (dialog !== session) return
      session.editor = editor
      session.clipboardGranted = clipboard.granted
      const opened = await context.ui.openDialog(dialogOptions(session))
      session.id = opened.id
      if (closedWhileOpening.delete(opened.id)) {
        if (dialog === session) dialog = undefined
        return
      }
      closedWhileOpening.clear()
      if (dialog !== session || context.signal.aborted) await context.ui.closeDialog(opened.id).catch(() => undefined)
    } catch (error) {
      if (dialog === session) dialog = undefined
      throw error
    }
  }))

  subscriptions.add(context.commands.handle(command('action'), async (argument): Promise<PluginCommandResult> => {
    const session = dialog
    const payload = asRecord(argument)
    if (!session?.id || payload.dialogId !== session.id || session.busy || typeof payload.actionId !== 'string') return
    const values = asRecord(payload.values)
    const action = payload.actionId
    if (session.page === 'export' || session.page === 'manage') {
      if (typeof values.template !== 'string' || !findTemplate(values.template)) return { fieldErrors: { template: t('error.templateMissing') } }
      session.selectedId = values.template
    }
    if (session.page === 'export' && action === 'manage') return changePage(session, 'manage')
    if (session.page === 'manage') {
      if (action === 'back') return changePage(session, 'export')
      if (action === 'new') {
        if (config.templates.length >= TEMPLATE_LIMIT) return { message: t('error.templateCount') }
        session.editId = undefined
        return changePage(session, 'edit')
      }
      if (action === 'edit' || action === 'delete') {
        if (session.selectedId === DEFAULT_TEMPLATE_ID) return { message: t('template.defaultImmutable') }
        session.editId = session.selectedId
        return changePage(session, action === 'edit' ? 'edit' : 'delete')
      }
      return
    }
    if (session.page === 'edit') {
      if (action === 'cancel-edit') return changePage(session, 'manage')
      if (action !== 'save') return
      const name = typeof values.name === 'string' ? values.name.trim() : ''
      const css = values.css
      const javascript = values.javascript
      const fieldErrors: Record<string, string> = {}
      if (!name || name.length > TEMPLATE_NAME_LIMIT) fieldErrors.name = t('error.templateName')
      else if (name.toLowerCase() === t('template.default').toLowerCase() || config.templates.some(item => item.id !== session.editId && item.name.trim().toLowerCase() === name.toLowerCase())) fieldErrors.name = t('error.templateDuplicate')
      if (typeof css !== 'string' || css.length > CODE_CHARACTER_LIMIT) fieldErrors.css = t('error.codeLimit')
      if (typeof javascript !== 'string' || javascript.length > CODE_CHARACTER_LIMIT) fieldErrors.javascript = t('error.codeLimit')
      if (Object.keys(fieldErrors).length) return { fieldErrors }
      const editId = session.editId
      if (editId && !config.templates.some(item => item.id === editId)) return { message: t('error.templateMissing') }
      let nextId = editId ?? `template-${Date.now()}-${++templateSerial}`
      while (config.templates.some(item => item.id === nextId) && nextId !== editId) nextId = `template-${Date.now()}-${++templateSerial}`
      const template: HtmlTemplate = { id: nextId, name, css: String(css), javascript: String(javascript) }
      const templates = editId ? config.templates.map(item => item.id === editId ? template : item) : [...config.templates, template]
      const next: TemplateConfig = { schemaVersion: 2, selectedId: nextId, templates }
      if (!serializeConfig(next)) return { message: t('error.templateLimit') }
      session.busy = true
      try {
        await saveConfig(next)
        session.selectedId = nextId
        session.editId = undefined
        session.busy = false
        await changePage(session, 'manage')
      } catch (error) {
        session.busy = false
        return { message: error instanceof Error ? error.message : String(error) }
      }
      return
    }
    if (session.page !== 'export' || !['file', 'source', 'rich-text'].includes(action)) return
    const selected = findTemplate(session.selectedId)
    if (!selected || configLoadFailed) return
    const snapshot = { ...selected }
    const operation = action as OutputAction
    if (operation === 'file' && !fileSupported || operation !== 'file' && (!copySupported || !session.clipboardGranted)) return
    session.busy = true
    session.feedback = undefined
    try {
      await updateDialog(session)
      const editor = await context.editor.getActiveEditor()
      context.signal.throwIfAborted()
      if (!editor) { await notifyFailure(session, t('noNote')); return }
      if (editor.composing) { await notifyFailure(session, t('error.editorBusy')); return }
      await saveConfig({ ...config, selectedId: snapshot.id })
      const request = { editorId: editor.editorId, expectedRevision: editor.revision, css: snapshot.css, javascript: snapshot.javascript }
      const result = operation === 'file'
        ? await context.documents.exportHtml(request)
        : await context.documents.copyHtml({ ...request, format: operation })
      context.signal.throwIfAborted()
      const completed = operation === 'file' ? 'saved' in result && result.saved : 'copied' in result && result.copied
      const warnings = completed ? result.warnings.map(warning => `${t(`warning.${warning.code}`)}${warning.source ? `\n${warning.source}` : ''}`.slice(0, 2_000)) : []
      const name = noteTitle(editor)
      const message = !completed ? t('cancelled')
        : operation === 'file' ? t(warnings.length ? 'savedWithWarnings' : 'saved', { name, count: warnings.length })
          : t(warnings.length ? 'copiedWithWarnings' : 'copied', { name, count: warnings.length })
      session.feedback = { title: t(completed ? operation === 'file' ? 'exportComplete' : 'copyComplete' : 'cancelledTitle'), message, destructive: false, warnings }
      await context.ui.showNotice(message)
    } catch (error) {
      if (context.signal.aborted) return
      const message = describeError(error)
      session.feedback = { title: t('errorTitle'), message, destructive: true, warnings: [] }
      await context.ui.showNotice(message)
    } finally {
      session.busy = false
      if (!context.signal.aborted) await updateDialog(session)
    }
  }))

  subscriptions.add(context.commands.handle(command('delete-confirm'), async argument => {
    const session = dialog
    const payload = asRecord(argument)
    if (!session?.id || payload.token !== session.token || session.page !== 'delete' || session.busy || session.selectedId === DEFAULT_TEMPLATE_ID) return
    const templates = config.templates.filter(item => item.id !== session.selectedId)
    if (templates.length === config.templates.length) return
    session.busy = true
    try {
      await updateDialog(session)
      await saveConfig({ schemaVersion: 2, selectedId: DEFAULT_TEMPLATE_ID, templates })
      session.selectedId = DEFAULT_TEMPLATE_ID
      session.editId = undefined
      session.busy = false
      await changePage(session, 'manage')
    } catch (error) {
      session.busy = false
      await notifyFailure(session, error instanceof Error ? error.message : String(error))
    }
  }))
  subscriptions.add(context.commands.handle(command('delete-cancel'), async argument => {
    const session = dialog
    if (!session?.id || asRecord(argument).token !== session.token || session.page !== 'delete' || session.busy) return
    await changePage(session, 'manage')
  }))
  subscriptions.add(context.ui.onDidCloseDialog(event => {
    if (dialog?.id === event.id) dialog = undefined
    else if (dialog && !dialog.id) closedWhileOpening.add(event.id)
  }))
  subscriptions.add(context.editor.onDidChangeActiveEditor(() => {
    if (dialog) return updateEditor(dialog)
  }))
  context.signal.addEventListener('abort', () => subscriptions.dispose(), { once: true })
  await context.ui.statusBar.update(statusId, { visible: true, text: t('statusBarTitle'), tooltip: t('command.open'), accessibleLabel: t('statusBarTitle') })
  await settingsView.refresh()
}
