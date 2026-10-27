import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createPluginTestHost } from '@notegen/plugin-test'
import { PluginError } from '@notegen/plugin-api'

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

async function htmlFixture(t, options = {}) {
  const messages = JSON.parse(await readFile(new URL('../plugins/html-exporter/locales/en.json', import.meta.url), 'utf8'))
  const result = await fixture(t, 'html-exporter', { messages, ...options })
  const { host, run } = result
  const submit = (actionId, values) => run('action', {
    dialogId: host.dialog.id,
    formId: find(host.dialog.content, 'form').id,
    actionId,
    values,
  })
  return { ...result, messages, submit, form: () => find(host.dialog.content, 'form') }
}

test('HTML templates migrate legacy configuration without overwriting it and discard edit cancellation', async t => {
  const legacy = { schemaVersion: 1, css: 'h2 { color: teal; }', javascript: 'document.title = "Saved";' }
  const jobs = []
  const { host, run, submit, form, messages } = await htmlFixture(t, {
    storage: { device: { htmlExportConfig: legacy } },
    exportHtml: async job => { jobs.push(job); job.assertCanWrite(); return { saved: true, warnings: [] } },
  })
  assert.equal(host.statusBar['top.notegen.html-exporter.status'].visible, true)
  await run('open')
  const dialogId = host.dialog.id
  assert.equal(form().id, 'output')
  assert.deepEqual(form().submitActions.map(action => action.id), ['file', 'source', 'rich-text', 'manage'])
  assert.equal(form().fields[0].value, 'legacy')
  assert.equal(form().fields[0].options.find(option => option.value === 'legacy').label, messages['template.legacy'])
  await submit('manage', { template: 'legacy' })
  assert.equal(host.dialog.id, dialogId)
  await submit('edit', { template: 'legacy' })
  assert.equal(form().id, 'edit')
  assert.deepEqual(form().fields.map(field => field.value), [messages['template.legacy'], legacy.css, legacy.javascript])
  await submit('cancel-edit', { name: 'Discarded', css: 'different', javascript: '' })
  assert.equal(form().id, 'manage')
  assert.deepEqual(host.storage.device.htmlExportConfig, legacy)
  assert.equal(host.storage.device.htmlExportTemplates, undefined)
  await submit('back', { template: 'legacy' })
  await submit('file', { template: 'legacy' })
  assert.equal(jobs[0].options.css, legacy.css)
  assert.equal(jobs[0].options.javascript, legacy.javascript)
  assert.deepEqual(host.storage.device.htmlExportConfig, legacy)
  assert.equal(host.storage.device.htmlExportTemplates.selectedId, 'legacy')
  assert.equal(host.storage.device.htmlExportTemplates.templates[0].css, legacy.css)
  assert.ok(!host.callHistory.some(call => ['editor.applyEdit', 'editor.applyEdits', 'notes.write', 'network.fetch'].includes(call.name)))
})

test('HTML templates create, rename, reject duplicates, confirm deletion and preserve the default', async t => {
  const { host, run, submit, form, messages } = await htmlFixture(t)
  await run('open')
  await submit('manage', { template: 'default' })
  assert.deepEqual(await submit('edit', { template: 'default' }), { message: messages['template.defaultImmutable'] })
  await submit('new', { template: 'default' })
  const invalid = await submit('save', { name: '', css: '', javascript: '' })
  assert.equal(invalid.fieldErrors.name, messages['error.templateName'])
  await submit('save', { name: 'Work', css: 'h1 {color:red}', javascript: 'console.log(1)' })
  assert.equal(form().id, 'manage')
  const first = host.storage.device.htmlExportTemplates.templates[0]
  assert.equal(first.name, 'Work')
  assert.equal(host.storage.device.htmlExportTemplates.selectedId, first.id)
  await submit('new', { template: first.id })
  const duplicate = await submit('save', { name: 'work', css: '', javascript: '' })
  assert.equal(duplicate.fieldErrors.name, messages['error.templateDuplicate'])
  await submit('cancel-edit', { name: '', css: '', javascript: '' })
  await submit('edit', { template: first.id })
  await submit('save', { name: 'Renamed', css: 'h1 {color:blue}', javascript: '' })
  assert.equal(host.storage.device.htmlExportTemplates.templates[0].name, 'Renamed')
  await submit('delete', { template: first.id })
  const actions = find(host.dialog.content, 'actions').actions
  await run('delete-cancel', actions.find(action => action.id === 'cancel-delete').argument)
  assert.equal(host.storage.device.htmlExportTemplates.templates.length, 1)
  await submit('delete', { template: first.id })
  await run('delete-confirm', find(host.dialog.content, 'actions').actions.find(action => action.id === 'confirm-delete').argument)
  assert.deepEqual(host.storage.device.htmlExportTemplates.templates, [])
  assert.equal(host.storage.device.htmlExportTemplates.selectedId, 'default')
  assert.equal(form().fields[0].value, 'default')
})

test('HTML dialog captures the chosen template and supports file, source and rich-text output', async t => {
  const output = []
  const legacy = { schemaVersion: 1, css: 'h1 { color: navy; }', javascript: 'document.title = "Export";' }
  const unsaved = '# First — unsaved\n\nCurrent editor content.'
  const { host, run, submit, messages } = await htmlFixture(t, {
    editor: { active: editor, text: unsaved },
    storage: { device: { htmlExportConfig: legacy } },
    exportHtml: async job => { output.push(job); job.assertCanWrite(); return { saved: true, warnings: [] } },
    copyHtml: async job => {
      output.push(job); job.assertCanWrite()
      return { copied: true, warnings: job.options.format === 'rich-text'
        ? [{ code: 'rich-text-script-omitted', message: 'JavaScript omitted' }] : [] }
    },
  })
  await run('open')
  await submit('file', { template: 'legacy' })
  await submit('source', { template: 'default' })
  await submit('rich-text', { template: 'legacy' })
  assert.deepEqual(output.map(job => job.options.format ?? 'file'), ['file', 'source', 'rich-text'])
  assert.deepEqual(output.map(job => job.options.css), [legacy.css, '', legacy.css])
  assert.equal(output[0].snapshot.text, unsaved)
  assert.equal(output[2].options.javascript, legacy.javascript)
  assert.equal(host.storage.device.htmlExportTemplates.selectedId, 'legacy')
  assert.equal(find(host.dialog.content, 'callout').title, messages.copyComplete)
  assert.ok(find(host.dialog.content, 'list').items[0].startsWith(messages['warning.rich-text-script-omitted']))
})

test('HTML dialog freezes the clicked template and prevents concurrent output', async t => {
  let exportStarted
  let finishExport
  const started = new Promise(resolve => { exportStarted = resolve })
  const saving = new Promise(resolve => { finishExport = resolve })
  const jobs = []
  const legacy = { schemaVersion: 1, css: 'h1 { color: navy; }', javascript: '' }
  const { host, run, submit } = await htmlFixture(t, {
    storage: { device: { htmlExportConfig: legacy } },
    exportHtml: async job => { jobs.push(job); exportStarted(); await saving; job.assertCanWrite(); return { saved: true, warnings: [] } },
  })
  await run('open')
  const operation = submit('file', { template: 'legacy' })
  await started
  await submit('file', { template: 'default' })
  assert.equal(jobs.length, 1)
  const secondEditor = { ...editor, editorId: 'second-editor', documentId: 'second', path: notes[1].path, revision: 3 }
  await host.setActiveEditor(secondEditor, { text: '# Second changed' })
  finishExport()
  await operation
  assert.equal(jobs[0].options.css, legacy.css)
  assert.equal(jobs[0].snapshot.documentId, 'first')
  assert.equal(jobs[0].snapshot.revision, 1)
  assert.match(host.notices.at(-1), /First/)
})

test('HTML dialog handles save cancellation, stale snapshots and optional clipboard permission', async t => {
  let attempt = 0
  const { host, run, submit, form, messages } = await htmlFixture(t, {
    permissions: { 'clipboard.write': false },
    exportHtml: async job => {
      attempt++
      if (attempt === 1) return { saved: false, warnings: [] }
      if (attempt === 2) throw new PluginError('StaleRevision', 'Changed before capture')
      job.assertCanWrite()
      return { saved: true, warnings: [] }
    },
  })
  await run('open')
  assert.equal(form().submitActions.find(action => action.id === 'file').disabled, false)
  assert.equal(form().submitActions.find(action => action.id === 'source').disabled, true)
  assert.equal(form().submitActions.find(action => action.id === 'rich-text').disabled, true)
  await submit('source', { template: 'default' })
  assert.ok(!host.callHistory.some(call => call.name === 'documents.copyHtml'))
  await submit('file', { template: 'default' })
  assert.equal(host.notices.at(-1), messages.cancelled)
  await submit('file', { template: 'default' })
  assert.equal(host.notices.at(-1), messages['error.stale'])
  host.setPermission('files.export', false)
  await submit('file', { template: 'default' })
  assert.equal(host.notices.at(-1), messages['error.permission'])
  assert.equal(attempt, 2)
  host.setPermission('files.export', true)
  await submit('file', { template: 'default' })
  assert.equal(attempt, 3)
  assert.equal(find(host.dialog.content, 'callout').title, messages.exportComplete)
})

test('HTML dialog preserves malformed storage and permits template management without a note', async t => {
  const broken = { schemaVersion: 2, css: 'keep this value', javascript: '' }
  const invalid = await htmlFixture(t, { editor: { active: null }, storage: { device: { htmlExportConfig: broken } } })
  await invalid.run('open')
  assert.deepEqual(invalid.host.storage.device.htmlExportConfig, broken)
  assert.equal(find(invalid.host.dialog.content, 'callout').title, invalid.messages.configurationLoadFailed)
  assert.ok(invalid.form().submitActions.every(action => action.disabled))
  await invalid.submit('file', { template: 'default' })
  assert.ok(!invalid.host.callHistory.some(call => call.name === 'documents.exportHtml'))
  assert.equal(invalid.host.storage.device.htmlExportTemplates, undefined)

  const empty = await htmlFixture(t, { editor: { active: null } })
  await empty.run('open')
  assert.equal(empty.form().submitActions.find(action => action.id === 'file').disabled, true)
  assert.equal(empty.form().submitActions.find(action => action.id === 'manage').disabled, false)
  await empty.submit('manage', { template: 'default' })
  assert.equal(empty.form().id, 'manage')
})

test('HTML rich-text copy stops without writing when clipboard permission is revoked', async t => {
  let copyStarted
  let finishCopy
  let written = false
  const started = new Promise(resolve => { copyStarted = resolve })
  const pending = new Promise(resolve => { finishCopy = resolve })
  const { host, run, submit, messages } = await htmlFixture(t, {
    copyHtml: async job => {
      copyStarted()
      await pending
      job.assertCanWrite()
      written = true
      return { copied: true, warnings: [] }
    },
  })
  await run('open')
  const operation = submit('rich-text', { template: 'default' })
  await started
  host.setPermission('clipboard.write', false)
  finishCopy()
  await operation
  assert.equal(written, false)
  assert.equal(host.notices.at(-1), messages['error.permission'])
})

test('HTML template storage quota failure preserves all existing templates', async t => {
  const large = '字'.repeat(10000)
  const templates = Array.from({ length: 17 }, (_, index) => ({ id: `existing-${index}`, name: `Existing ${index}`, css: large, javascript: '' }))
  const existing = { schemaVersion: 2, selectedId: 'default', templates }
  const { host, run, submit, messages } = await htmlFixture(t, { storage: { device: { htmlExportTemplates: existing } } })
  await run('open')
  await submit('manage', { template: 'default' })
  await submit('new', { template: 'default' })
  const result = await submit('save', { name: 'Too large', css: large, javascript: '' })
  assert.equal(result.message, messages['error.templateLimit'])
  assert.deepEqual(host.storage.device.htmlExportTemplates, existing)
  assert.ok(!host.callHistory.some(call => call.name === 'storage.device.set'))
})
