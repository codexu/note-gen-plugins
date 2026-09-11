import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createPluginTestHost } from '@notegen/plugin-test'
import * as plugin from '../.notegen/package/dist/main.js'

const manifest = JSON.parse(await readFile(new URL('../plugin.json', import.meta.url), 'utf8'))
const messages = JSON.parse(await readFile(new URL('../locales/zh-CN.json', import.meta.url), 'utf8'))
const command = name => `${manifest.id}.${name}`
const editor = { windowId: 'main', editorId: 'editor', documentId: 'doc', path: 'Notes/original.md', kind: 'markdown', mode: 'source', revision: 1, composing: false, size: { utf16Length: 8, bytes: 8, lines: 1 } }
const selection = { editorId: 'editor', revision: 1, from: 0, to: 4, offsetsAvailable: true, empty: false, text: 'KEEP' }
async function setup(t, options = {}) {
  const host = createPluginTestHost({ manifest, messages, folders: ['Templates', 'Notes'], editor: { active: editor, selection, text: 'KEEPtail' }, ...options })
  await host.activate(plugin)
  t.after(() => host.deactivate())
  return host
}
function submission(host, values) {
  assert.ok(host.dialog, host.notices.join('\n'))
  const form = host.dialog.content.blocks.find(b => b.type === 'form')
  assert.ok(form)
  return { command: form.command, argument: { formId: form.id, dialogId: host.dialog.id, values } }
}
async function submit(host, values) {
  const call = submission(host, values)
  return host.executeCommand(call.command, call.argument)
}
async function preview(host, mode = 'create', template = 'builtin:meeting', values = {}) {
  await host.executeCommand(command(mode))
  await submit(host, { template })
  await submit(host, { title: 'Test meeting', field_topic: 'Release review', field_people: 'Alice', ...values })
  assert.match(host.dialog.content.blocks.find(b => b.type === 'form').id, /^preview-/)
}
const mutations = host => host.callHistory.filter(c => ['notes.openOrCreate', 'editor.applyEdits'].includes(c.name))

test('new note renders localized fields and retains same-name content on a second run', async t => {
  const h = await setup(t)
  await preview(h)
  await submit(h, { confirm: true })
  const created = h.notes.find(n => n.path === 'Notes/Test meeting.md')
  assert.ok(created)
  assert.match(created.content, /主题：Release review/)
  assert.match(created.content, /参会人员：Alice/)
  assert.match(created.content, /KEEP/)
  assert.doesNotMatch(created.content, /notegen-template|\{\{/)
  await preview(h, 'create', 'builtin:meeting', { field_topic: 'MUST NOT REPLACE' })
  await submit(h, { confirm: true })
  assert.equal(h.notes.find(n => n.path === created.path).content, created.content)
  assert.ok(h.notices.some(n => n.includes('同名笔记')))
})

test('fixed-position insert preserves selection even if cursor moves; stale resubmit is ignored', async t => {
  const h = await setup(t)
  await preview(h, 'insert')
  h.setEditorSelection({ ...selection, from: 8, to: 8, empty: true, text: '' })
  const call = submission(h, { confirm: true })
  await h.executeCommand(call.command, call.argument)
  const e = await h.context.editor.getActiveEditor()
  const snapshot = await h.context.editor.getTextSnapshot({ editorId: e.editorId, expectedRevision: e.revision, format: 'markdown' })
  assert.ok(snapshot.text.startsWith('KEEP# original'))
  assert.ok(snapshot.text.endsWith('tail'))
  assert.equal((snapshot.text.match(/KEEP/g) ?? []).length, 2)
  await h.executeCommand(call.command, call.argument)
  assert.equal(mutations(h).length, 1)
})

test('changed revision prevents insertion', async t => {
  const h = await setup(t)
  await preview(h, 'insert')
  await h.setActiveEditor({ ...editor, revision: 2 }, { text: 'CHANGED', selection: { ...selection, revision: 2 } })
  await submit(h, { confirm: true })
  assert.equal(mutations(h).length, 0)
  assert.ok(h.notices.some(n => n.includes('编辑器已变化')))
})

test('dialog cancellation invalidates a pending confirmation', async t => {
  const h = await setup(t)
  await preview(h)
  const call = submission(h, { confirm: true })
  await h.context.ui.closeDialog(h.dialog.id)
  await h.executeCommand(call.command, call.argument)
  assert.equal(mutations(h).length, 0)
})

test('workspace switch invalidates the dialog', async t => {
  const h = await setup(t)
  await preview(h)
  const call = submission(h, { confirm: true })
  const previous = await h.context.workspace.getCurrent()
  await h.emitWorkspaceChange({ previous, current: { id: 'other', name: 'Other' } })
  await h.executeCommand(call.command, call.argument)
  assert.equal(mutations(h).length, 0)
})

test('custom Markdown fields substitute once, preserving braces supplied as a value', async t => {
  const source = '<!-- notegen-template\n{"fields":[{"id":"topic","label":"Topic","type":"text","required":true}]}\n-->\n{{field.topic}}\n{{selection}}'
  const h = await setup(t, { notes: [{ path: 'Templates/custom.md', content: source }] })
  await preview(h, 'create', 'file:Templates/custom.md', { field_topic: '{{unknown}}' })
  await submit(h, { confirm: true })
  assert.equal(h.notes.find(n => n.path === 'Notes/Test meeting.md').content, '{{unknown}}\nKEEP')
})

test('unknown variable is rejected before any note write', async t => {
  const h = await setup(t, { notes: [{ path: 'Templates/bad.md', content: '{{unknown}}' }] })
  await h.executeCommand(command('create'))
  await submit(h, { template: 'file:Templates/bad.md' })
  assert.ok(h.notices.some(n => n.includes('无效变量')))
  assert.equal(mutations(h).length, 0)
})

test('required fields and unsafe note titles block preview', async t => {
  const h = await setup(t)
  await h.executeCommand(command('create'))
  await submit(h, { template: 'builtin:meeting' })
  await submit(h, { title: '../escape', field_topic: 'Topic', field_people: '' })
  await submit(h, { title: 'Safe', field_topic: '', field_people: '' })
  assert.match(h.dialog.content.blocks.find(b => b.type === 'form').id, /^fields-/)
  assert.equal(mutations(h).length, 0)
  assert.equal(h.notices.length, 2)
})

test('visual mode insertion is rejected before presenting a form', async t => {
  const h = await setup(t, { editor: { active: { ...editor, mode: 'visual' }, selection, text: 'KEEPtail' } })
  await h.executeCommand(command('insert'))
  assert.equal(h.dialog, null)
  assert.equal(mutations(h).length, 0)
  assert.ok(h.notices.some(n => n.includes('源码模式')))
})

test('built-ins are available when the template folder does not yet exist', async t => {
  const h = await setup(t, { folders: [] })
  await preview(h)
  await submit(h, { confirm: true })
  assert.ok(h.notes.find(n => n.path === 'Notes/Test meeting.md'))
})
