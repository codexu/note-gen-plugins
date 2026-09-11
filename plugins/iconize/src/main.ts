import { validatePluginResources, type PluginActivate, type PluginFileIconRule, type PluginCommandArgument, type PluginUiBlock } from '@notegen/plugin-api'
import { workbench, record, string, values } from '../../../shared/workbench'

// This catalog is deliberately limited to names supported by the public host UI.
const icons = ['file-text', 'folder', 'folder-open', 'book-open', 'bookmark', 'star', 'pin', 'tag', 'code', 'sparkles', 'calendar-days', 'clock', 'list-todo', 'list-checks', 'table-2', 'chart-no-axes-combined', 'flask-conical', 'layout-template', 'link', 'files']
type Mode = 'assignment' | 'path' | 'extension' | 'default'
interface Rule { id: string; mode: Mode; kind: 'file' | 'folder'; target: string; icon: PluginFileIconRule['icon']; follow: boolean; enabled: boolean }
const key = 'iconize-v1'
const rank = (rule: Rule) => ['assignment', 'path', 'extension', 'default'].indexOf(rule.mode)
function compile(rules: Rule[]): PluginFileIconRule[] {
  return rules.filter(rule => rule.enabled).slice().sort((a, b) => rank(a) - rank(b)).map(rule => ({
    kind: rule.kind, icon: rule.icon,
    ...(rule.mode === 'assignment' || rule.mode === 'path' ? { path: rule.target } : {}),
    ...(rule.mode === 'extension' ? { extension: rule.target } : {}),
  }))
}

export const activate: PluginActivate = async ctx => {
  const w = workbench(ctx), t = w.t
  const workspace = await ctx.workspace.getCurrent()
  let rules: Rule[] = [], editing = '', generation = '', serial = 0, stopped = false
  let queue: Promise<unknown> = Promise.resolve()
  const guard = async () => {
    ctx.signal.throwIfAborted()
    if (stopped || (await ctx.workspace.getCurrent()).id !== workspace.id) throw new Error(t('工作区已切换，请重新打开插件。', 'Workspace changed. Reopen the plugin.'))
  }
  w.onReset(() => { stopped = true; rules = []; editing = ''; generation = '' })
  function enqueue(operation: () => Promise<void>) {
    const result = queue.then(async () => { await guard(); await operation() })
    queue = result.catch(() => {})
    return result
  }
  const freshId = () => `${Date.now().toString(36)}-${++serial}`
  function validate(rule: Rule) {
    if (!['assignment', 'path', 'extension', 'default'].includes(rule.mode) || !['file', 'folder'].includes(rule.kind)) throw new Error(t('请选择规则类型。', 'Select a rule type.'))
    if (rule.mode === 'extension' && rule.kind !== 'file') throw new Error(t('扩展名规则只能用于文件。', 'Extension rules only apply to files.'))
    if ((rule.mode === 'assignment' || rule.mode === 'path') && !rule.target) throw new Error(t('请输入工作区相对路径。', 'Enter a workspace-relative path.'))
    if ('name' in rule.icon && !icons.includes(rule.icon.name)) throw new Error(t('请选择内置图标。', 'Select a built-in icon.'))
    validatePluginResources({ fileIcons: compile([{ ...rule, enabled: true }]) })
  }
  async function load() {
    const saved = await ctx.storage.workspace.get(key)
    await guard()
    if (saved === undefined || saved === null) { rules = []; return }
    const data = record(saved)
    if (data.version !== 1 || !Array.isArray(data.rules) || data.rules.length > 100) throw new Error(t('图标配置格式无法识别，未覆盖原数据。', 'Unrecognized icon settings; original data was preserved.'))
    const next = data.rules.map(raw => {
      const item = record(raw)
      if (!string(item.id) || typeof item.enabled !== 'boolean' || typeof item.follow !== 'boolean' || typeof item.target !== 'string') throw new Error('Invalid icon rule')
      const rule = item as unknown as Rule
      validate(rule)
      return rule
    })
    if (new Set(next.map(rule => rule.id)).size !== next.length) throw new Error('Duplicate icon rule ID')
    rules = next
  }
  async function apply() { await guard(); await ctx.fileIcons.setRules(compile(rules)); await guard() }
  async function save(next: Rule[]) {
    if (next.length > 100) throw new Error(t('最多保存 100 条规则。', 'Maximum 100 rules.'))
    next.forEach(validate)
    await guard()
    await ctx.storage.workspace.set(key, { version: 1, rules: next.map(rule => ({ ...rule, icon: { ...rule.icon } })) })
    await guard()
    rules = next
    await apply()
  }
  function title(rule: Rule) {
    const mode = rule.mode === 'assignment' ? t('指定', 'Assignment') : rule.mode === 'path' ? t('路径', 'Path') : rule.mode === 'extension' ? t('扩展名', 'Extension') : t('默认', 'Default')
    return `${rule.enabled ? '' : t('[停用] ', '[Disabled] ')}${mode} · ${rule.target || rule.kind}`
  }
  async function show(open = true, draft?: Rule) {
    generation = w.token()
    const current = draft ?? rules.find(rule => rule.id === editing)
    const blocks: PluginUiBlock[] = [
      { type: 'text', text: t('指定图标 → 精确路径 → 扩展名 → 默认图标；同组按列表顺序，首条匹配生效。拖拽只调整同组优先级。', 'Assignment → exact path → extension → default; the first match in each group wins. Drag to reorder within a group.') },
      { type: 'text', text: t('当前接口不支持图标颜色。可使用 🟥 🟧 🟨 🟩 🟦 🟪 等彩色 Emoji；不会给内置图标染色。', 'The current API has no icon color property. Use colored Emoji such as 🟥 🟧 🟨 🟩 🟦 🟪; built-in icons cannot be tinted.') },
      { type: 'toolbar', id: 'rule-tools', label: t('规则操作', 'Rule actions'), actions: [
        { id: 'new', label: t('新增规则', 'New rule'), command: w.command('new'), icon: 'plus' },
        { id: 'refresh', label: t('重新载入并应用', 'Reload and apply'), command: w.command('open'), icon: 'refresh-cw' },
      ] },
      { type: 'form', id: `rule-${generation}`, resetKey: generation, command: w.command('save'), submitLabel: current?.id ? t('更新规则', 'Update rule') : t('添加规则', 'Add rule'), fields: [
        { id: 'mode', type: 'select', label: t('匹配方式', 'Match'), value: current?.mode ?? 'assignment', options: [
          { value: 'assignment', label: t('指定文件或文件夹', 'Assign to file or folder') }, { value: 'path', label: t('固定路径规则', 'Fixed path rule') },
          { value: 'extension', label: t('扩展名规则', 'Extension rule') }, { value: 'default', label: t('默认图标', 'Default icon') },
        ] },
        { id: 'kind', type: 'select', label: t('对象', 'Kind'), value: current?.kind ?? 'file', options: [{ value: 'file', label: t('文件', 'File') }, { value: 'folder', label: t('文件夹', 'Folder') }] },
        { id: 'target', type: 'text', label: t('相对路径 / 扩展名（默认规则留空）', 'Relative path / extension (empty for default)'), value: current?.target ?? '', placeholder: 'Notes/Example.md / md', maxLength: 240 },
        { id: 'icon', type: 'select', label: t('内置图标', 'Built-in icon'), value: current && 'name' in current.icon ? current.icon.name : 'file-text', options: icons.map(name => ({ value: name, label: name })) },
        { id: 'emoji', type: 'text', label: t('Emoji（填写后覆盖内置图标）', 'Emoji (overrides built-in icon when filled)'), value: current && 'emoji' in current.icon ? current.icon.emoji : '', placeholder: '📚', maxLength: 16 },
        { id: 'follow', type: 'checkbox', visibleWhen: { field: 'kind', equals: 'file' }, label: t('指定图标跟随可观察的笔记移动（需授予可选权限）', 'Follow observable note moves for assignments (optional permission required)'), value: current?.follow ?? false },
        { id: 'enabled', type: 'checkbox', label: t('启用规则', 'Enable rule'), value: current?.enabled ?? true },
      ] },
      { type: 'item-list', id: 'rules', generation, label: t('规则（按生效优先级排列）', 'Rules (precedence order)'), emptyText: t('尚未设置图标。', 'No icons assigned.'), reorderLabel: t('拖拽排序', 'Drag to reorder'), reorderCommand: w.command('reorder'),
        items: rules.map(rule => ({ id: rule.id, label: title(rule), description: `${rule.kind} · ${'emoji' in rule.icon ? rule.icon.emoji : rule.icon.name}${rule.mode === 'assignment' && rule.follow ? t(' · 跟随移动', ' · follows moves') : ''}`, ...('name' in rule.icon ? { icon: rule.icon.name } : {}) })),
        actions: [
          { id: 'edit', label: t('编辑', 'Edit'), icon: 'pencil', command: w.command('edit') },
          { id: 'toggle', label: t('启用 / 停用', 'Enable / disable'), icon: 'check', command: w.command('toggle') },
          { id: 'remove', label: t('删除规则', 'Delete rule'), icon: 'trash-2', command: w.command('remove') },
        ],
      },
    ]
    await w.render(blocks, guard, open)
  }
  function register(name: string, fn: (arg: PluginCommandArgument) => Promise<void>) { w.register(name, arg => enqueue(() => fn(arg))) }
  register('open', async () => { await load(); await apply(); editing = ''; await show() })
  register('new', async () => { editing = ''; await show() })
  register('assign', async arg => {
    const input = record(arg)
    if (!['file', 'folder'].includes(string(input.kind)) || !string(input.relativePath)) { await load(); await show(); return }
    await load()
    const existing = rules.find(rule => rule.mode === 'assignment' && rule.kind === input.kind && rule.target === input.relativePath)
    editing = existing?.id ?? ''
    await show(true, existing ?? { id: '', mode: 'assignment', kind: input.kind as Rule['kind'], target: string(input.relativePath), icon: { name: input.kind === 'folder' ? 'folder' : 'file-text' }, follow: false, enabled: true })
  })
  register('save', async arg => {
    if (record(arg).formId !== `rule-${generation}`) throw new Error(t('表单已更新，请重新操作。', 'Form changed. Try again.'))
    const data = values(arg), mode = string(data.mode) as Mode
    const emoji = string(data.emoji).trim()
    const rule: Rule = { id: editing || freshId(), mode, kind: string(data.kind) as Rule['kind'], target: mode === 'default' ? '' : mode === 'extension' ? string(data.target).trim().replace(/^\./, '').toLowerCase() : string(data.target).trim().normalize('NFC'), icon: emoji ? { emoji } : { name: string(data.icon) }, follow: data.follow === true && mode === 'assignment' && data.kind === 'file', enabled: data.enabled === true }
    validate(rule)
    await load()
    if (editing && !rules.some(item => item.id === editing)) throw new Error(t('规则已删除，请重新载入。', 'Rule was deleted. Reload settings.'))
    await save((editing ? rules.map(item => item.id === editing ? rule : item) : [...rules, rule]).sort((a, b) => rank(a) - rank(b)))
    editing = ''; await show()
  })
  for (const name of ['edit', 'toggle', 'remove', 'reorder'] as const) register(name, async arg => {
    const input = record(arg)
    if (input.generation !== generation) throw new Error(t('列表已更新，请重新操作。', 'List changed. Try again.'))
    await load()
    if (name === 'reorder') {
      const ids = input.itemIds
      if (!Array.isArray(ids) || ids.length !== rules.length || new Set(ids).size !== rules.length || ids.some(id => !rules.some(rule => rule.id === id))) throw new Error(t('规则已变化，请重新载入。', 'Rules changed. Reload settings.'))
      await save(ids.map(id => rules.find(rule => rule.id === id)!).sort((a, b) => rank(a) - rank(b)))
    } else {
      const rule = rules.find(item => item.id === input.itemId)
      if (!rule) throw new Error(t('规则已删除。', 'Rule was deleted.'))
      if (name === 'edit') editing = rule.id
      else { await save(name === 'remove' ? rules.filter(item => item.id !== rule.id) : rules.map(item => item.id === rule.id ? { ...item, enabled: !item.enabled } : item)); editing = '' }
    }
    await show()
  })
  const events = ctx.notes.onDidChange(event => enqueue(async () => {
    if (event.type !== 'moved' && event.type !== 'deleted') return
    await load()
    const source = event.type === 'moved' ? event.previousPath : event.path
    if (!source) return
    const affected = (rule: Rule) => rule.mode === 'assignment' && rule.kind === 'file' && rule.follow && rule.target === source
    if (!rules.some(affected)) return
    // Replayed move events are idempotent: after replacement no source assignment remains.
    const next = event.type === 'deleted' ? rules.filter(rule => !affected(rule)) : rules.map(rule => affected(rule) ? { ...rule, target: event.path } : rule)
    await save(next)
    editing = ''; await show(false)
  }).catch(async error => { if (!ctx.signal.aborted && !stopped) await ctx.ui.showNotice(String(error)).catch(() => {}) }))
  ctx.signal.addEventListener('abort', () => { stopped = true; events.dispose(); rules = []; generation = '' })
  await enqueue(async () => { await load(); await apply(); await show(false) })
  // The host owns runtime icon disposal, including failed activation and disable.
}
