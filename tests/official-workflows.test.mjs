import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createPluginTestHost } from '@notegen/plugin-test'

const notes = [{ path: 'Notes/First.md', content: '# First\n\n- [ ] Pending\n- [x] Completed\n\n[Second](Second.md)\n' }, { path: 'Notes/Second.md', content: '# Second\n\n[First](First.md)\n' }]
const editor = { windowId: 'main', editorId: 'editor', documentId: 'first', path: notes[0].path, kind: 'markdown', mode: 'source', revision: 1, composing: false, size: { utf16Length: notes[0].content.length, bytes: notes[0].content.length, lines: 7 } }
async function fixture(t, slug, options = {}) {
  const root = new URL(`../plugins/${slug}/`, import.meta.url)
  const manifest = JSON.parse(await readFile(new URL('plugin.json', root), 'utf8'))
  const host = createPluginTestHost({ manifest, notes, editor: { active: editor, text: notes[0].content }, messages: { language: 'zh-CN' }, ...options })
  await host.activate(await import(new URL('.notegen/package/dist/main.js', root)))
  t.after(() => host.deactivate())
  return { host, run: (name, arg) => host.executeCommand(`${manifest.id}.${name}`, arg), view: () => host.views[`${manifest.id}.view`] }
}
function blocks(doc) { return (doc?.blocks ?? []).flatMap(b => [b, ...blocks(b), ...(b.tabs ?? []).flatMap(blocks)]) }
const find = (doc, type, id) => blocks(doc).find(b => b.type === type && (!id || b.id === id))
const args = (list, itemId = list.items[0]?.id) => ({ generation: list.generation, itemId })

test('bookmarks activation reads saved items without opening or adding a note', async t => {
  const items = [{ path: notes[1].path, label: 'Saved bookmark' }, { path: notes[0].path, label: 'First bookmark' }]
  const { host, view } = await fixture(t, 'bookmarks', { storage: { workspace: { 'bookmarks-v1': { schemaVersion: 1, items } } } })
  assert.deepEqual(find(view(), 'item-list').items.map(({ id, label }) => ({ path: id, label })), items.map(item => ({ ...item, label: item.path.split('/').pop().replace(/\.md$/, '') })))
  assert.ok(!host.callHistory.some(call => ['ui.views.open', 'notes.openOrCreate', 'storage.workspace.set'].includes(call.name)))
})

test('bookmarks add active note, rename, reorder, reject stale events and remove without deleting', async t => {
  const { host, run, view } = await fixture(t, 'bookmarks')
  await run('add'); await run('add-file', { kind: 'file', relativePath: notes[1].path })
  let list = find(view(), 'item-list')
  assert.equal(list.items.length, 2)
  await run('reorder', { generation: list.generation, itemIds: list.items.map(i => i.id).reverse() })
  assert.equal(find(view(), 'item-list').items[0].id, notes[1].path)
  await run('remove', args(list)); assert.equal(find(view(), 'item-list').items.length, 2)
  list = find(view(), 'item-list'); await run('rename', args(list))
  assert.ok(host.dialog)
  await run('rename-save', { dialogId: host.dialog.id, values: { label: 'My bookmark' } })
  assert.equal(find(view(), 'item-list').items[0].label, 'Second')
  list = find(view(), 'item-list'); await run('remove', args(list))
  assert.equal(find(view(), 'item-list').items.length, 1); assert.equal(host.notes.length, 2)
})

test('bookmarks show filename and body excerpt excluding the level-one heading', async t => {
  const { run, view } = await fixture(t, 'bookmarks')
  await run('add')
  const item = find(view(), 'item-list').items[0]
  assert.equal(item.label, 'First')
  assert.equal(item.description, 'Pending Completed Second')
})
