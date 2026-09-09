import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createPluginTestHost } from '@notegen/plugin-test'
import * as plugin from '../plugins/plugin-playground/.notegen/package/dist/main.js'

const manifest = JSON.parse(await readFile(new URL('../plugins/plugin-playground/plugin.json', import.meta.url), 'utf8'))
const command = name => `${manifest.id}.${name}`
async function setup(t, permissions) {
  const host = createPluginTestHost({ manifest, ...(permissions ? { permissions } : {}) })
  await host.activate(plugin)
  t.after(() => host.deactivate())
  return host
}
function run(host, operation, extra = {}) {
  return host.executeCommand(command('run'), { values: { operation, text: 'fixture body', limit: 10, consent: true, ...extra } })
}

test('Playground activates without optional grants and keeps the UI usable after denied operations', async t => {
  const host = await setup(t, Object.fromEntries(Object.keys(manifest.permissions).map(key => [key, false])))
  await host.executeCommand(command('open'))
  assert.equal(Object.keys(host.views).length, 3)
  const denied = await run(host, 'note-create')
  assert.match(denied.message, /PermissionDenied/)
  assert.equal(host.notes.length, 0)
  await run(host, 'environment')
  assert.ok(host.active)
})

test('Playground requires consent and mutates only its session-created fixture', async t => {
  const host = await setup(t)
  const blocked = await run(host, 'note-create', { consent: false })
  assert.ok(blocked.fieldErrors.consent)
  assert.equal(host.notes.length, 0)
  await run(host, 'note-create')
  assert.equal(host.notes.length, 1)
  const before = host.notes[0]
  await run(host, 'note-stale')
  assert.match(host.notes[0].content, /revision probe/)
  assert.notEqual(host.notes[0].revision, before.revision)
  const deniedDelete = await run(host, 'note-delete', { confirm: 'no' })
  assert.ok(deniedDelete.fieldErrors.confirm)
  assert.equal(host.notes.length, 1)
  await run(host, 'note-move')
  assert.match(host.notes[0].path, /-moved\.md$/)
  await run(host, 'note-delete', { confirm: 'DELETE' })
  assert.equal(host.notes.length, 0)
})

test('Playground validates dialog fields and closes only after valid submission', async t => {
  const host = await setup(t)
  await host.executeCommand(command('dialog'))
  const dialogId = host.dialog.id
  const invalid = await host.executeCommand(command('dialog-submit'), { dialogId, values: { name: 'x' } })
  assert.ok(invalid.fieldErrors.name)
  assert.equal(host.dialog.id, dialogId)
  await host.executeCommand(command('dialog-submit'), { dialogId, values: { name: 'NoteGen' } })
  assert.equal(host.dialog, null)
})
