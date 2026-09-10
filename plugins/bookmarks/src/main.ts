import type { PluginActivate } from '@notegen/plugin-api'
import { workbench, record, values, string, notePath } from '../../../shared/workbench'

interface Bookmark { path: string; label: string }


function noteDescription(markdown: string): string {
  const body = markdown.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
    .replace(/^---\n[\s\S]*?\n(?:---|\.\.\.)\s*(?:\n|$)/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[^\n]*(?:\n|$)/gm, '')
    .replace(/^ {0,3}#(?:\s+.*)?$/gm, '')
    .replace(/^[^\n]+\n {0,3}=+\s*$/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/^\s*\[[^\]]+\]:.*$/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s*(?:#{2,6}\s+|>\s*|[-+*]\s+(?:\[[ xX]\]\s*)?|\d+[.)]\s+)/gm, '')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ').trim()
  return Array.from(body).slice(0, 120).join('')
}

export const activate: PluginActivate = async ctx => {
  const w = workbench(ctx), t = w.t
  let bookmarks: Bookmark[] = [], loaded = false, generation = ''
  let renameTarget = '', renameDialog = ''
  w.onReset(() => { bookmarks = []; loaded = false; generation = ''; renameTarget = ''; renameDialog = '' })

  async function load(guard: () => Promise<void>) {
    if (loaded) return
    const saved = record(await ctx.storage.workspace.get('bookmarks-v1'))
    await guard()
    const seen = new Set<string>()
    bookmarks = Array.isArray(saved.items) ? saved.items.map(record)
      .filter(item => {
        if (typeof item.path !== 'string' || !item.path || seen.has(item.path)) return false
        seen.add(item.path)
        return true
      }).slice(0, 50).map(item => ({ path: string(item.path), label: string(item.label) || string(item.path).split('/').pop()!.replace(/\.md$/i, '') })) : []
    loaded = true
  }

  async function save(next: Bookmark[], guard: () => Promise<void>) {
    await guard()
    await ctx.storage.workspace.set('bookmarks-v1', { schemaVersion: 1, items: next.map(item => ({ ...item })) })
    await guard()
    bookmarks = next
  }

  async function show(guard: () => Promise<void>, open = true) {
    const items = await Promise.all(bookmarks.map(async item => {
      let description = ''
      let metadata = t('更新时间不可用', 'Update time unavailable')
      try {
        const note = await ctx.notes.read({ path: item.path })
        description = noteDescription(note.content)
        if (typeof note.modifiedAt === 'number' && Number.isFinite(note.modifiedAt)) {
          const modified = new Date(note.modifiedAt)
          if (!Number.isNaN(modified.getTime())) {
            const pad = (value: number) => String(value).padStart(2, '0')
            metadata = t('更新于 ', 'Updated ') + `${modified.getFullYear()}/${pad(modified.getMonth() + 1)}/${pad(modified.getDate())} ${pad(modified.getHours())}:${pad(modified.getMinutes())}`
          }
        }
      } catch {
        // A missing or inaccessible file must not hide the remaining bookmarks.
      }
      return { id: item.path, label: item.path.split('/').pop()!.replace(/\.md$/i, '').slice(0, 100), icon: 'file-text', metadata, ...(description ? { description } : {}) }
    }))
    await guard()
    generation = w.token()
    await w.render([
      { type: 'toolbar', id: 'bookmark-tools', label: t('收藏操作', 'Bookmark actions'), actions: [
        { id: 'add', label: t('收藏当前笔记', 'Bookmark current note'), icon: 'plus', iconOnly: true, command: w.command('add') },
      ] },
      { type: 'item-list', id: 'bookmarks', generation,
        label: String(ctx.settings.get('top.notegen.bookmarks.view.title') ?? '').trim() || t('收藏', 'Favorites'), emptyText: t('还没有收藏', 'No bookmarks yet'),
        reorderLabel: t('拖拽排序', 'Reorder'),
        items,
        openCommand: w.command('visit'), reorderCommand: w.command('reorder'),
        actions: [{ id: 'remove', label: t('从收藏移除', 'Remove from bookmarks'), icon: 'trash-2', command: w.command('remove') }],
      },
    ], guard, open)
  }

  async function bookmark(pathValue: string, guard: () => Promise<void>) {
    const path = notePath(pathValue)
    await load(guard)
    const existing = bookmarks.find(item => item.path === path)
    if (!existing) {
      if (bookmarks.length >= 50) throw new Error(t('收藏已达 50 篇上限。', 'Bookmark limit reached (50).'))
      await ctx.notes.read({ path })
      await save([...bookmarks, { path, label: path.split('/').pop()!.replace(/\.md$/i, '') }], guard)
    }
    await show(guard)
    await ctx.ui.showNotice(existing ? t('这篇笔记已经收藏。', 'This note is already bookmarked.') : t('已收藏：', 'Bookmarked: ') + path.split('/').pop()!)
  }

  async function bookmarkCurrent(guard: () => Promise<void>) {
    const editor = await ctx.editor.getActiveEditor()
    if (!editor) throw new Error(t('请先打开一个 Markdown 文档标签页。', 'Open a Markdown document tab first.'))
    if (!editor.path) throw new Error(t('请更新本地应用，或通过文件右键收藏。', 'Update the local app, or use the file context menu.'))
    await bookmark(editor.path, guard)
  }

  w.register('open', async (_, guard) => { await load(guard); await show(guard) })
  w.register('add', async (_, guard) => bookmarkCurrent(guard))
  w.register('add-file', async (arg, guard) => {
    const input = record(arg)
    if (!input.kind || input.kind === 'root') { await bookmarkCurrent(guard); return }
    if (input.kind !== 'file' || !string(input.relativePath)) throw new Error(t('请选择一个 Markdown 文件。', 'Select a Markdown file.'))
    await bookmark(string(input.relativePath), guard)
  })

  for (const name of ['visit', 'remove'] as const) w.register(name, async (arg, guard) => {
    const input = record(arg)
    if (!Object.keys(input).length) { await load(guard); await show(guard); return }
    if (input.generation !== generation) throw new Error(t('列表已更新，请重新操作。', 'List changed. Try again.'))
    const index = bookmarks.findIndex(item => item.path === input.itemId)
    if (index < 0) return
    if (name === 'visit') { await w.open(bookmarks[index].path, guard); return }
    await save(bookmarks.filter((_, i) => i !== index), guard)
    await show(guard)
  })

  w.register('rename', async (arg, guard) => {
    const input = record(arg)
    if (input.generation !== generation) return
    const item = bookmarks.find(item => item.path === input.itemId)
    if (!item) return
    await guard()
    renameTarget = item.path
    const dialog = await ctx.ui.openDialog({ title: t('重命名书签', 'Rename bookmark'), content: { blocks: [
      w.form('rename-save', [{ id: 'label', type: 'text', label: t('名称', 'Name'), value: item.label, required: true, maxLength: 100 }], t('保存', 'Save')),
    ] } })
    renameDialog = dialog.id
  })
  w.register('rename-save', async (arg, guard) => {
    if (!renameTarget || record(arg).dialogId !== renameDialog) return
    const label = string(values(arg).label).trim()
    if (!label || label.length > 100) throw new Error(t('请输入 1–100 字的名称。', 'Enter a name of 1–100 characters.'))
    await save(bookmarks.map(item => item.path === renameTarget ? { ...item, label } : item), guard)
    await ctx.ui.closeDialog(renameDialog)
    renameTarget = ''; renameDialog = ''
    await show(guard)
  })

  w.register('reorder', async (arg, guard) => {
    const input = record(arg)
    if (!Object.keys(input).length) { await load(guard); await show(guard); return }
    const ids = input.itemIds
    if (input.generation !== generation || !Array.isArray(ids) || ids.length !== bookmarks.length
      || ids.some(id => typeof id !== 'string') || new Set(ids).size !== bookmarks.length) {
      throw new Error(t('列表已变化，请重新拖拽。', 'List changed. Drag again.'))
    }
    const byPath = new Map(bookmarks.map(item => [item.path, item]))
    const next = ids.map(id => byPath.get(id))
    if (next.some(item => !item)) throw new Error(t('排序包含无效笔记。', 'Invalid bookmark order.'))
    await save(next as Bookmark[], guard)
    await show(guard)
  })

  // Sidebar activation does not execute the open command. Populate its initial
  // document without navigating, so startup never steals focus from the user.
  const workspace = await ctx.workspace.getCurrent()
  const guard = async () => {
    ctx.signal.throwIfAborted()
    if ((await ctx.workspace.getCurrent()).id !== workspace.id) throw new Error(t('工作区已切换，请重新打开插件。', 'Workspace changed. Reopen the plugin.'))
  }
  ctx.settings.onDidChange(() => show(guard, false))
  await load(guard)
  await show(guard, false)
}
