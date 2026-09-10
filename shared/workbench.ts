import type { PluginContext, PluginCommandArgument, PluginUiBlock, PluginFormField, PluginJsonValue } from '@notegen/plugin-api'

export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
export function values(argument: PluginCommandArgument) { return record(record(argument).values) }
export function string(value: unknown) { return typeof value === 'string' ? value : '' }
export function folderOf(path: string) { return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '.' }
export function notePath(value: string): string {
  const path = value.trim().normalize('NFC')
  if (!path || path.length > 500 || !/\.md$/i.test(path) || path.split('/').some(segment =>
    !segment || segment === '.' || segment === '..' || segment.startsWith('.') || /[<>:"\\|?*\u0000-\u001f\u007f]/.test(segment)
    || /[. ]$/.test(segment) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment))) {
    throw new Error('请输入安全的工作区相对 Markdown 路径，例如 Notes/example.md / Invalid Markdown path')
  }
  return path
}
export function textField(id: string, label: string, value = '', multiline = false): PluginFormField {
  return { id, label, type: multiline ? 'textarea' : 'text', value, maxLength: multiline ? 10000 : 500, required: true }
}
export function workbench(ctx: PluginContext) {
  const prefix = ctx.plugin.id
  const view = `${prefix}.view`
  const t = (zh: string, en: string) => ctx.i18n.t('language') === 'zh-CN' ? zh : en
  let epoch = 0
  let serial = 0
  let busy = false
  let disposed = false
  const subscriptions: { dispose(): void }[] = []
  const drafts = new Map<string, Record<string, unknown>>()
  let reset: () => void = () => {}
  subscriptions.push(ctx.workspace.onDidChange(event => {
    // The host also announces the initial workspace after activation. That is not a switch.
    if (!event.previous || event.previous.id === event.current.id) return
    epoch++; drafts.clear(); reset()
  }))
  ctx.signal.addEventListener('abort', () => { disposed = true; epoch++; subscriptions.forEach(s => s.dispose()) })
  const command = (name: string) => `${prefix}.${name}`
  function register(name: string, operation: (arg: PluginCommandArgument, guard: () => Promise<void>) => Promise<PluginJsonValue | void>) {
    subscriptions.push(ctx.commands.handle(command(name), async arg => {
      if (busy) return { message: t('正在处理，请稍候。', 'Please wait for the current operation.') }
      busy = true
      const started = epoch
      try {
        const workspace = await ctx.workspace.getCurrent()
        const guard = async () => {
          ctx.signal.throwIfAborted()
          if (disposed || started !== epoch || (await ctx.workspace.getCurrent()).id !== workspace.id) throw new Error(t('工作区已切换，请重新打开插件。', 'Workspace changed. Reopen the plugin.'))
        }
        await guard()
        if (record(arg).values) drafts.set(name, values(arg))
        return await operation(arg, guard)
      } catch (error) {
        const e = record(error)
        const message = (error instanceof Error ? error.message : String(error)).slice(0, 500)
        const code = string(e.code)
        const friendly = record(e.details).committed === true ? t('文件已经写入，但界面更新未完成；请先检查目标文件：', 'The file was written but UI reconciliation failed. Inspect the destination first: ') + string(record(e.details).path)
          : code === 'EditorBusy' ? t('请关闭源笔记的所有编辑窗口后重试。', 'Close all editors for the source note and retry.')
          : code === 'StaleRevision' ? t('笔记已变化，请刷新或重新预览。', 'Note changed. Refresh or preview again.') : message
        if (!disposed && started === epoch) await ctx.ui.showNotice(friendly).catch(() => {})
        return { message: friendly }
      } finally { busy = false }
    }))
  }
  async function render(blocks: PluginUiBlock[], guard: () => Promise<void>, open = true) {
    await guard()
    const compact: PluginUiBlock[] = []
    for (const block of blocks) {
      const previous = compact[compact.length - 1]
      if (block.type === 'actions' && previous?.type === 'actions' && previous.actions.length + block.actions.length <= 20) {
        compact[compact.length - 1] = { ...previous, actions: [...previous.actions, ...block.actions] }
      } else compact.push(block)
    }
    await ctx.ui.views.update(view, { blocks: compact })
    if (open) await ctx.ui.views.open(view)
  }
  function form(name: string, fields: PluginFormField[], submit: string, remember = false): PluginUiBlock {
    return { type: 'form', id: name, resetKey: String(++serial), fields: fields.map(field => {
      const saved = remember ? drafts.get(name)?.[field.id] : undefined
      if (saved === undefined || ((field.type === 'select' || field.type === 'note-picker') && !field.options.some(option => option.value === saved))) return field
      return { ...field, value: saved } as PluginFormField
    }), command: command(name), submitLabel: submit }
  }
  function action(name: string, label: string, argument?: PluginCommandArgument): PluginUiBlock {
    return { type: 'actions', actions: [{ id: name, label, variant: name === 'save' ? 'default' : 'secondary', command: command(name), ...(argument === undefined ? {} : { argument }) }] }
  }
  async function open(path: string, guard: () => Promise<void>) {
    // Read first for a missing-file error; create: false also prevents creation after a concurrent deletion.
    await ctx.notes.read({ path })
    const workspace = await ctx.workspace.getCurrent()
    await guard()
    const result = await ctx.notes.openOrCreate({ workspaceId: workspace.id, path, initialContent: '', create: false, conflict: 'open-existing', open: true, idempotencyKey: `${prefix}:open:${Date.now()}:${++serial}` })
    if (!result.opened) throw new Error(t('笔记存在，但未能打开。', 'The note exists but could not be opened.'))
  }
  async function create(path: string, content: string, guard: () => Promise<void>) {
    if (content.length > 100000) throw new Error(t('内容过大，请拆成较小的笔记。', 'Content too large. Use smaller notes.'))
    await guard()
    // Missing expectedRevision is intentional: the host rejects an existing destination.
    await ctx.notes.write({ path: notePath(path), content, create: true })
  }
  async function page(folder: string, cursor: string | undefined, guard: () => Promise<void>) {
    await guard()
    return ctx.notes.list({ folder: folder.trim() || '.', recursive: true, limit: 20, ...(cursor ? { cursor } : {}) })
  }
  function preview(content: string): PluginUiBlock {
    const text = content.slice(0, 12000) + (content.length > 12000 ? t('\n\n…预览已截断，保存使用完整内容。', '\n\n…Preview truncated; saving uses the full content.') : '')
    return { type: 'tabs', id: 'preview', label: t('内容预览', 'Content preview'), tabs: [
      { id: 'rendered', label: t('预览', 'Preview'), blocks: [{ type: 'markdown', text: text || ' ' }] },
      { id: 'source', label: 'Markdown', blocks: [{ type: 'text', text: text || ' ' }] },
    ] }
  }
  function section(id: string, title: string, blocks: PluginUiBlock[]): PluginUiBlock {
    return { type: 'section', id, title, collapsible: true, defaultOpen: false, blocks }
  }
  async function activePath() {
    try { return (await ctx.editor.getActiveEditor())?.path ?? '' } catch { return '' }
  }

  return { t, clearDrafts: () => drafts.clear(), section, activePath, command, register, render, form, action, open, create, page, preview, onReset(fn: () => void) { reset = fn }, token: () => `${epoch}:${++serial}` }
}
