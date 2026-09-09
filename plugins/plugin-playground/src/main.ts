import type {
  PluginActivate, PluginCommandArgument, PluginCommandResult, PluginDeactivate,
  PluginDisposable, PluginFormBlock, PluginUiDocument,
} from '@notegen/plugin-api'
import { createOperations, display, errorText, id, mutations, operations, record } from './operations.js'

let cleanup: (() => void) | undefined

export const activate: PluginActivate = async ctx => {
  cleanup?.()
  const t = (key: string) => ctx.i18n.t(key)
  const disposables: PluginDisposable[] = []
  let stopped = false
  let epoch = 0
  let formReset = 0
  let dialogId: string | undefined
  let result = t('ready')
  let preview = ''
  let sequence = 0
  let queue = Promise.resolve()
  const events: { number: number; name: string; detail: string }[] = []
  const passed = new Set<string>()
  const failed = new Map<string, string>()
  function log(name: string, detail: unknown) {
    if (stopped || ctx.signal.aborted) return
    const configured = Number(ctx.settings.get(id('eventLimit')) ?? 20)
    const limit = Math.max(5, Math.min(50, Number.isFinite(configured) ? configured : 20))
    events.unshift({ number: ++sequence, name, detail: display(detail, 500) })
    events.splice(limit)
  }
  const lab = createOperations(ctx, t, openDialog)
  function form(view = 'tab'): PluginFormBlock {
    return {
      type: 'form', id: `runner-${view}`, resetKey: String(formReset), changeCommand: id('form-change'),
      command: id('run'), submitLabel: t('run'), fields: [
        { id: 'operation', type: 'select', label: t('operation'), value: 'environment', options: operations.map(value => ({ value, label: `${mutations.has(value) ? '⚠ ' : ''}${t(`op.${value}`)}` })) },
        { id: 'text', type: 'textarea', label: t('input'), value: 'NoteGen Plugin Playground', maxLength: 2000 },
        { id: 'limit', type: 'number', label: t('limit'), value: 10, min: 1, max: 100 },
        { id: 'consent', type: 'checkbox', label: t('consent'), value: false },
        { id: 'confirm', type: 'text', label: t('confirm'), placeholder: 'DELETE', maxLength: 6, visibleWhen: { field: 'operation', equals: 'note-delete' } },
        { id: 'readonly', type: 'text', label: t('readonly'), value: ctx.plugin.id, disabled: true },
      ],
    }
  }
  function document(): PluginUiDocument {
    const paths = lab.paths()
    return { blocks: [
      { type: 'heading', text: t('title') },
      { type: 'callout', title: t('scope.title'), text: t('scope.text') },
      { type: 'key-value', items: [
        { label: 'Plugin / API', value: `${ctx.plugin.version} / ${ctx.plugin.apiVersion}` },
        { label: t('note'), value: paths.note }, { label: t('attachment'), value: paths.attachment },
      ] },
      form(),
      { type: 'text', text: preview || t('form.hint'), tone: 'muted' },
      { type: 'actions', actions: [
        { id: 'refresh', label: t('refresh'), command: id('refresh'), variant: 'secondary' },
        { id: 'reset', label: t('reset'), command: id('reset-form'), variant: 'secondary' },
        { id: 'dialog', label: t('dialog'), command: id('dialog') },
        { id: 'clear', label: t('clear'), command: id('clear'), variant: 'secondary' },
      ] },
      { type: 'separator' },
      { type: 'heading', text: t('result') },
      { type: 'text', text: result, tone: ctx.settings.get(id('tone')) === 'warning' ? 'warning' : 'default' },
      { type: 'progress', label: `${t('coverage')}: ${passed.size}/${operations.length}`, value: passed.size / operations.length * 100 },
      { type: 'table', id: 'coverage', rowIds: [...operations], columns: [t('operation'), t('state')], rows: operations.map(operation => [
        { text: t(`op.${operation}`), command: id('describe'), argument: operation },
        passed.has(operation) ? t('passed') : failed.has(operation) ? `${t('failed')}: ${failed.get(operation)}`.slice(0, 1900) : t('pending'),
      ]) },
      { type: 'heading', text: t('events') },
      { type: 'table', id: 'events', rowIds: events.map(event => String(event.number)), columns: ['#', t('event'), t('detail')], rows: events.map(event => [String(event.number), event.name, event.detail]) },
      { type: 'list', items: [t('events.hint'), t('permissions.hint'), t('cleanup.hint')] },
      { type: 'tree', items: [
        { id: 'views', label: t('views') },
        ...['left', 'right', 'tab'].map(view => ({ id: view, parentId: 'views', label: t(`view.${view}`), command: id('view'), argument: { action: 'open', view } })),
        { id: 'host', label: t('host') },
        ...['app.openSearch', 'app.openSettings', 'app.openPluginSettings'].map(command => ({ id: command, parentId: 'host', label: t(command), command: id('host'), argument: command })),
      ] },
    ] }
  }
  function sidebar(view: string): PluginUiDocument {
    return { blocks: [
      { type: 'heading', text: t('title') },
      { type: 'callout', title: t('scope.title'), text: t('scope.text') },
      form(view),
      { type: 'text', text: preview || t('form.hint'), tone: 'muted' },
      { type: 'text', text: result },
      { type: 'actions', actions: [
        { id: 'open', label: t('open'), command: id('open') },
        ...['focus', 'state', 'close'].map(action => ({ id: action, label: t(`view.${action}`), command: id('view'), argument: { action, view } })),
      ] },
    ] }
  }
  async function render() {
    if (stopped || ctx.signal.aborted) return
    await ctx.ui.views.update(id('tab'), document())
    await ctx.ui.views.update(id('left'), sidebar('left'))
    await ctx.ui.views.update(id('right'), sidebar('right'))
  }
  function dialogContent(): PluginUiDocument {
    return { blocks: [
      { type: 'callout', title: t('dialog'), text: t('dialog.hint') },
      { type: 'form', id: 'dialog-form', command: id('dialog-submit'), submitLabel: t('save'), fields: [
        { id: 'name', type: 'text', label: t('name'), required: true, maxLength: 80 },
        { id: 'details', type: 'checkbox', label: t('details'), value: false },
        { id: 'body', type: 'textarea', label: t('input'), visibleWhen: { field: 'details', equals: true }, maxLength: 1000 },
      ] },
      { type: 'actions', actions: ['update', 'replace', 'close'].map(action => ({ id: action, label: t(`dialog.${action}`), command: id(`dialog-${action}`) })) },
    ] }
  }
  async function openDialog() {
    const handle = await ctx.ui.openDialog({ title: t('dialog'), content: dialogContent(), closeLabel: t('close') })
    dialogId = handle.id
    return handle
  }
  function handle(name: string, action: (argument: PluginCommandArgument) => PluginCommandResult | Promise<PluginCommandResult>) {
    disposables.push(ctx.commands.handle(id(name), argument => {
      const submittedEpoch = epoch
      const task = queue.then(async () => {
        if (stopped || ctx.signal.aborted || submittedEpoch !== epoch) return
        try { return await action(argument) } catch (error) {
          if (!stopped && !ctx.signal.aborted) {
            result = errorText(error)
            log(`command.${name}`, result)
            await render()
            await ctx.ui.showNotice(result.slice(0, 500))
          }
          throw error
        }
      })
      queue = task.then(() => {}, () => {})
      return task
    }))
  }
  handle('open', async () => { await render(); await ctx.ui.views.open(id('tab')); await ctx.ui.views.focus(id('tab')) })
  handle('refresh', async () => { subscribeOptionalEvents(); await render() })
  handle('clear', async () => { events.length = 0; passed.clear(); failed.clear(); result = t('ready'); await render() })
  handle('reset-form', async () => { formReset++; preview = ''; await render() })
  handle('describe', async argument => {
    if (typeof argument !== 'string' || !operations.some(operation => operation === argument)) return
    await ctx.ui.showNotice(`${t(`op.${argument}`)} — ${mutations.has(argument) ? t('consent') : t('readOnlyOperation')}`)
  })
  handle('run', async (argument): Promise<PluginCommandResult> => {
    const values = record(record(argument).values)
    const operation = operations.find(candidate => candidate === values.operation)
    if (!operation) return { fieldErrors: { operation: t('error.operation') } }
    if (mutations.has(operation) && values.consent !== true) return { fieldErrors: { consent: t('consent') } }
    if (operation === 'note-delete' && values.confirm !== 'DELETE') return { fieldErrors: { confirm: t('error.delete') } }
    if (typeof values.limit !== 'number' || !Number.isInteger(values.limit) || values.limit < 1 || values.limit > 100) return { fieldErrors: { limit: t('error.limit') } }
    if (typeof values.text !== 'string' || values.text.length > 2000) return { fieldErrors: { text: t('error.input') } }
    const startedEpoch = epoch
    try {
      const output = await lab.run(operation, values)
      if (ctx.signal.aborted || startedEpoch !== epoch) return
      result = `${t(`op.${operation}`)}\n${display(output)}`
      passed.add(operation); failed.delete(operation)
      log(operation, t('passed'))
      await render()
      return { message: t('passed') }
    } catch (error) {
      if (ctx.signal.aborted || startedEpoch !== epoch) return
      const message = errorText(error)
      result = `${t(`op.${operation}`)}\n${message}`
      failed.set(operation, message); passed.delete(operation)
      log(operation, message)
      await render()
      return { message }
    }
  })
  // Apply debounced previews only to the form generation that emitted them.
  handle('form-change', async argument => {
    const data = record(argument)
    const view = ['tab', 'left', 'right'].find(candidate => data.formId === `runner-${candidate}`)
    if (!view || typeof data.formId !== 'string' || typeof data.generation !== 'string' || typeof data.revision !== 'number') return
    const operation = record(data.values).operation
    if (typeof operation !== 'string' || !operations.some(candidate => candidate === operation)) return
    preview = `${t('operation')}: ${t(`op.${operation}`)}${mutations.has(operation) ? ` · ${t('consent')}` : ''}`
    log('form.change', { fieldId: data.fieldId ?? null, revision: data.revision })
    try {
      await ctx.ui.views.update(id(view), { ...(view === 'tab' ? document() : sidebar(view)), expectedForm: { formId: data.formId, generation: data.generation, revision: data.revision } })
    } catch (error) {
      // A newer edit/reset can legitimately supersede this debounced callback.
      if (record(error).code !== 'StaleRevision') throw error
    }
  })
  handle('dialog', async () => { await openDialog() })
  handle('dialog-submit', async (argument): Promise<PluginCommandResult> => {
    const data = record(argument)
    const values = record(data.values)
    if (typeof values.name !== 'string' || values.name.trim().length < 2) return { fieldErrors: { name: t('error.name') }, message: t('error.name') }
    if (typeof data.dialogId !== 'string' || data.dialogId !== dialogId) return
    result = display(values)
    await ctx.ui.closeDialog(data.dialogId)
    await render()
    return { message: t('passed') }
  })
  handle('dialog-update', async () => {
    if (!dialogId) return
    await ctx.ui.updateDialog(dialogId, { title: t('dialog.updated'), content: dialogContent(), description: new Date().toISOString() })
  })
  handle('dialog-replace', async () => {
    if (!dialogId) return
    const handle = await ctx.ui.openDialog({ replaceId: dialogId, title: t('dialog.replaced'), content: dialogContent() })
    dialogId = handle.id
  })
  handle('dialog-close', async () => { if (dialogId) await ctx.ui.closeDialog(dialogId) })
  handle('view', async argument => {
    const { view, action } = record(argument)
    if (typeof view !== 'string' || !['left', 'right', 'tab'].includes(view)) return
    const viewId = id(view)
    if (action === 'open') { await render(); await ctx.ui.views.open(viewId) }
    else if (action === 'close') await ctx.ui.views.close(viewId)
    else if (action === 'focus') await ctx.ui.views.focus(viewId)
    else if (action !== 'state') return
    const state = await ctx.ui.views.getState(viewId)
    result = display(state)
    log('view.state', state)
    await render()
  })
  handle('host', async argument => {
    if (argument === 'app.openSearch' || argument === 'app.openSettings' || argument === 'app.openPluginSettings') await ctx.commands.executeHost(argument)
  })
  // Deliberately outside the friendly error wrapper: exercise host command error reporting.
  disposables.push(ctx.commands.handle(id('throw'), () => { throw new Error('Plugin Playground: intentional RuntimeFailure example') }))
  disposables.push(
    ctx.settings.onDidChange((key, value) => {
      log('settings.change', { key, value })
      if (key === id('showStatus')) return ctx.ui.statusBar.update(id('status'), { visible: value === true, text: t('title'), compactText: 'Lab', busy: false })
    }),
    ctx.workspace.onDidChange(event => {
      epoch++; formReset++; lab.reset(); events.length = 0; passed.clear(); failed.clear(); result = t('ready'); preview = ''
      log('workspace.change', event)
      // Queue after in-flight work, without allowing its results to leak into the new workspace.
      queue = queue.then(render, render).catch(error => { log('render.error', errorText(error)) })
    }),
    ctx.ui.views.onDidChange(state => { log('view.change', state) }),
    ctx.ui.onDidCloseDialog(event => { if (event.id === dialogId) dialogId = undefined; log('dialog.close', event) }),
  )
  // Some development hosts reject subscriptions immediately when optional grants are missing.
  const optionalSubscriptions = new Set<string>()
  function subscribeOptionalEvents() {
    const listeners: [string, () => PluginDisposable][] = [
      ['notes.change', () => ctx.notes.onDidChange(event => { log('notes.change', event) })],
      ['editor.active', () => ctx.editor.onDidChangeActiveEditor(event => { log('editor.active', event.current) })],
      ['editor.content', () => ctx.editor.onDidChangeContent(event => { log('editor.content', event) })],
    ]
    for (const [name, subscribe] of listeners) {
      if (optionalSubscriptions.has(name)) continue
      try { disposables.push(subscribe()); optionalSubscriptions.add(name) }
      catch (error) { log(`${name}.subscription`, errorText(error)) }
    }
  }
  subscribeOptionalEvents()
  const abort = () => { stopped = true; epoch++ }
  ctx.signal.addEventListener('abort', abort, { once: true })
  cleanup = () => {
    stopped = true; epoch++
    ctx.signal.removeEventListener('abort', abort)
    for (const disposable of disposables.splice(0).reverse()) disposable.dispose()
    lab.reset()
  }
  log('activate', ctx.plugin)
  await ctx.ui.statusBar.update(id('status'), { visible: ctx.settings.get(id('showStatus')) !== false, text: t('title'), compactText: 'Lab', accessibleLabel: t('title'), busy: false })
  await render()
}

export const deactivate: PluginDeactivate = () => { cleanup?.(); cleanup = undefined }
