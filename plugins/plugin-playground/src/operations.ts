import { isPluginError } from '@notegen/plugin-api'
import type { PluginContext, PluginJsonValue } from '@notegen/plugin-api'

export const prefix = 'top.notegen.plugin-playground'
export const id = (name: string) => `${prefix}.${name}`
export const operations = [
  'environment', 'calendar', 'settings', 'storage-save', 'storage-read', 'storage-delete',
  'note-create', 'note-open', 'note-read', 'note-list', 'note-next', 'note-search',
  'note-write-create', 'note-write', 'note-move', 'note-delete', 'note-stale',
  'attachment-create', 'attachment-read', 'editor-read', 'editor-cursor',
  'editor-selection', 'editor-batch', 'editor-select', 'network', 'notice',
  'status-show', 'status-hide', 'status-busy', 'dialog', 'invalid-zone', 'invalid-path',
] as const
export type Operation = typeof operations[number]
export const mutations = new Set<string>([
  'storage-save', 'storage-delete', 'note-create', 'note-open', 'note-write-create',
  'note-write', 'note-move', 'note-delete', 'note-stale', 'attachment-create',
  'editor-cursor', 'editor-selection', 'editor-batch', 'editor-select', 'network',
])
export type Values = Record<string, PluginJsonValue>
export function record(value: unknown): Values {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Values : {}
}
export function display(value: unknown, limit = 8000): string {
  return (JSON.stringify(value, null, 2) ?? 'undefined').slice(0, limit)
}
export function errorText(error: unknown): string {
  return isPluginError(error) ? `${error.code}: ${error.message}` : error instanceof Error ? error.message : String(error)
}

/** A session owns only files it successfully created. Never adopt pre-existing notes. */
export function createOperations(ctx: PluginContext, t: (key: string) => string, showDialog: () => Promise<unknown>) {
  let fixture: { workspaceId: string; path: string } | undefined
  let attachment: { workspaceId: string; path: string } | undefined
  let page: { workspaceId: string; folder: string; cursor: string } | undefined
  let serial = 0
  const session = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  const marker = `<!-- playground:${session} -->`
  const setting = (name: string) => ctx.settings.get(id(name))
  const folder = () => {
    const value = String(setting('folder') ?? 'PluginPlayground').trim().replace(/\/$/, '')
    if (!value || value.startsWith('/') || value.includes('\\') || value.includes(':') || value.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new Error(t('error.folder'))
    }
    return value
  }
  async function current() { ctx.signal.throwIfAborted(); return ctx.workspace.getCurrent() }
  async function assertWorkspace(workspaceId: string) {
    if ((await current()).id !== workspaceId) throw new Error(t('error.workspace'))
  }
  async function owned() {
    const target = fixture
    if (!target) throw new Error(t('error.fixture'))
    await assertWorkspace(target.workspaceId)
    return target
  }
  async function editor(demo: boolean) {
    const active = await ctx.editor.getActiveEditor()
    if (!active || active.composing) throw new Error(t('error.editor'))
    if (demo) {
      await owned()
      const snapshot = await ctx.editor.getTextSnapshot({ editorId: active.editorId, expectedRevision: active.revision, format: 'markdown' })
      if (!snapshot.text.includes(marker)) throw new Error(t('error.demoEditor'))
    }
    return active
  }
  async function expectCode(code: string, action: () => Promise<unknown>) {
    try { await action() } catch (error) {
      if (isPluginError(error) && error.code === code) return { expected: code, observed: error.code, passed: true }
      throw error
    }
    throw new Error(`${t('error.expected')}: ${code}`)
  }
  return {
    reset() { fixture = undefined; attachment = undefined; page = undefined },
    paths() { return { note: fixture?.path ?? '—', attachment: attachment?.path ?? '—' } },
    async run(operation: Operation, values: Values): Promise<unknown> {
      ctx.signal.throwIfAborted()
      const text = typeof values.text === 'string' ? values.text : 'NoteGen Plugin Playground'
      const limit = Math.min(100, Math.max(1, Math.floor(Number(values.limit) || 10)))
      switch (operation) {
        case 'environment': return { plugin: ctx.plugin, workspace: await current(), aborted: ctx.signal.aborted, abortReason: ctx.signal.reason === undefined ? null : display(ctx.signal.reason), translated: ctx.i18n.t('welcome', { name: 'NoteGen' }) }
        case 'calendar': return ctx.calendar.resolveDay({ timeZone: String(setting('timeZone') ?? 'system'), dayStartsAt: '04:00' })
        case 'settings': return Object.fromEntries(['folder', 'sampleFile', 'timeZone', 'eventLimit', 'showStatus', 'tone'].map(key => [key, setting(key) ?? null]))
        case 'storage-save': {
          const workspace = await current()
          const value = { text, savedAt: new Date().toISOString(), nested: { example: true }, items: [1, null, 'JSON'] }
          await ctx.storage.device.set('sample', value)
          await assertWorkspace(workspace.id)
          await ctx.storage.workspace.set('sample', value)
          return { device: await ctx.storage.device.get('sample'), workspace: await ctx.storage.workspace.get('sample') }
        }
        case 'storage-read': return { device: (await ctx.storage.device.get('sample')) ?? null, workspace: (await ctx.storage.workspace.get('sample')) ?? null }
        case 'storage-delete': {
          const workspace = await current()
          await ctx.storage.device.delete('sample')
          await assertWorkspace(workspace.id)
          await ctx.storage.workspace.delete('sample')
          return { deleted: 'sample', areas: ['device', 'workspace'] }
        }
        case 'note-create':
        case 'note-write-create': {
          const workspace = await current()
          const path = `${folder()}/fixture-${session}-${++serial}.md`
          if (operation === 'note-write-create') {
            const result = await ctx.notes.write({ path, content: `# Plugin Playground\n\n${text}\n${marker}\n`, create: true })
            if (result.created) { await assertWorkspace(workspace.id); fixture = { workspaceId: workspace.id, path } }
            return result
          }
          const result = await ctx.notes.openOrCreate({ workspaceId: workspace.id, path, initialContent: `# Plugin Playground\n\n${text}\n${marker}\n`, conflict: 'open-existing', open: false, idempotencyKey: `${session}-${serial}` })
          if (result.status === 'created') { await assertWorkspace(workspace.id); fixture = { workspaceId: workspace.id, path } }
          else throw new Error(t('error.existing'))
          return result
        }
        case 'note-open': {
          const target = await owned()
          return ctx.notes.openOrCreate({ ...target, initialContent: '', conflict: 'open-existing', open: true, idempotencyKey: `${session}-open-${++serial}` })
        }
        case 'note-read': {
          const selected = values.demo === true ? '' : String(setting('sampleFile') ?? '').trim()
          const path = selected || (await owned()).path
          return ctx.notes.read({ path })
        }
        case 'note-list':
        case 'note-next': {
          const workspace = await current()
          const root = folder()
          const previous = page
          if (operation === 'note-next' && (!previous || previous.workspaceId !== workspace.id || previous.folder !== root)) throw new Error(t('error.page'))
          const result = await ctx.notes.list({ folder: root, recursive: true, limit, ...(operation === 'note-next' ? { cursor: previous!.cursor } : {}) })
          await assertWorkspace(workspace.id)
          page = result.nextCursor ? { workspaceId: workspace.id, folder: root, cursor: result.nextCursor } : undefined
          return result
        }
        case 'note-search': return ctx.notes.search({ folder: folder(), query: text || 'Plugin', caseSensitive: false, limit })
        case 'note-write': {
          const target = await owned()
          const note = await ctx.notes.read({ path: target.path })
          await assertWorkspace(target.workspaceId)
          return ctx.notes.write({ path: target.path, content: `${note.content}\n${text}\n`, expectedRevision: note.revision })
        }
        case 'note-move': {
          const target = await owned()
          const to = `${target.path.slice(0, -3)}-moved.md`
          await ctx.notes.move({ from: target.path, to, overwrite: false })
          await assertWorkspace(target.workspaceId)
          fixture = { ...target, path: to }
          return { from: target.path, to }
        }
        case 'note-delete': {
          if (values.confirm !== 'DELETE') throw new Error(t('error.delete'))
          const target = await owned()
          const note = await ctx.notes.read({ path: target.path })
          await assertWorkspace(target.workspaceId)
          await ctx.notes.delete({ path: target.path, expectedRevision: note.revision })
          if (fixture === target) fixture = undefined
          return { deleted: target.path }
        }
        case 'note-stale': {
          const target = await owned()
          const before = await ctx.notes.read({ path: target.path })
          await assertWorkspace(target.workspaceId)
          const content = `${before.content}\n<!-- revision probe -->\n`
          const written = await ctx.notes.write({ path: target.path, content, expectedRevision: before.revision })
          await assertWorkspace(target.workspaceId)
          const result = await expectCode('StaleRevision', () => ctx.notes.write({ path: target.path, content, expectedRevision: before.revision }))
          await assertWorkspace(target.workspaceId)
          const after = await ctx.notes.read({ path: target.path })
          if (after.revision !== written.revision || after.content !== content) throw new Error(t('error.changed'))
          return result
        }
        case 'attachment-create': {
          const workspace = await current()
          const path = `${folder()}/attachment-${session}-${++serial}.txt`
          const result = await ctx.attachments.create({ path, base64: 'Tm90ZUdlbiBQbHVnaW4gUGxheWdyb3VuZAo=' })
          await assertWorkspace(workspace.id)
          attachment = { workspaceId: workspace.id, path }
          return result
        }
        case 'attachment-read': {
          const target = attachment
          if (!target) throw new Error(t('error.attachment'))
          await assertWorkspace(target.workspaceId)
          return ctx.attachments.read({ path: target.path })
        }
        case 'editor-read': {
          const active = await editor(values.demo === true)
          return { active, selection: await ctx.editor.getSelection(), snapshot: await ctx.editor.getTextSnapshot({ editorId: active.editorId, expectedRevision: active.revision, format: 'markdown' }) }
        }
        case 'editor-cursor':
        case 'editor-selection': {
          const active = await editor(values.demo === true)
          return ctx.editor.applyEdit({ editorId: active.editorId, expectedRevision: active.revision, text, target: operation === 'editor-cursor' ? 'cursor' : 'selection' })
        }
        case 'editor-batch':
        case 'editor-select': {
          const active = await editor(values.demo === true)
          if (active.mode !== 'source') throw new Error(t('error.source'))
          const snapshot = await ctx.editor.getTextSnapshot({ editorId: active.editorId, expectedRevision: active.revision, format: 'markdown' })
          const base = { editorId: active.editorId, expectedRevision: snapshot.revision }
          if (operation === 'editor-select') {
            await ctx.editor.setSelection({ ...base, from: 0, to: Math.min(text.length || 8, snapshot.text.length) })
            return ctx.editor.getSelection()
          }
          return ctx.editor.applyEdits({ ...base, edits: snapshot.text.length ? [{ from: 0, to: 0, text: '<!-- Playground start -->\n' }, { from: snapshot.text.length, to: snapshot.text.length, text: '\n<!-- Playground end -->' }] : [{ from: 0, to: 0, text: '<!-- Playground -->\n' }] })
        }
        case 'network': {
          // Fixed public endpoint; never send workspace content or user form values.
          const result = await ctx.network.fetch({ url: 'https://notegen.top/', method: 'GET', headers: { Accept: 'text/html' }, timeoutMs: 10000 })
          return { url: result.url, status: result.status, headers: result.headers, preview: result.body.slice(0, 1500) }
        }
        case 'notice': await ctx.ui.showNotice(text || t('welcome')); return { shown: true }
        case 'status-show':
        case 'status-hide':
        case 'status-busy':
          await ctx.ui.statusBar.update(id('status'), { visible: operation !== 'status-hide', text: t('title'), compactText: 'Lab', tooltip: text, accessibleLabel: t('title'), busy: operation === 'status-busy' })
          return { visible: operation !== 'status-hide' }
        case 'dialog': return showDialog()
        case 'invalid-zone': return expectCode('InvalidTimeZone', () => ctx.calendar.resolveDay({ timeZone: 'Playground/Invalid_Zone', dayStartsAt: '00:00' }))
        case 'invalid-path': return expectCode('InvalidPath', () => ctx.notes.read({ path: '../outside.md' }))
      }
    },
  }
}
