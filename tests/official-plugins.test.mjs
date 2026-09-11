import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash, generateKeyPairSync } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { createPluginTestHost } from '@notegen/plugin-test'

const runFile = promisify(execFile)
const marketTool = fileURLToPath(new URL('../tools/market.mjs', import.meta.url))

async function createMarketFixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'notegen-market-contract-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await mkdir(join(directory, 'market'))
  await mkdir(join(directory, 'plugin'))
  await mkdir(join(directory, 'plugin', 'locales'))
  for (const [locale, name] of [['en', 'Market fixture'], ['zh-CN', '市场测试插件']]) {
    await writeFile(join(directory, 'plugin', 'locales', `${locale}.json`), JSON.stringify({ name, description: name }))
  }
  await mkdir(join(directory, 'artifacts'))
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const raw = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url')
  const publisher = {
    algorithm: 'Ed25519',
    publicKey: raw.toString('base64'),
    keyId: `ed25519-${createHash('sha256').update(raw).digest('hex')}`,
  }
  await writeFile(join(directory, 'publisher.json'), JSON.stringify(publisher))
  await writeFile(join(directory, 'root.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }))
  await writeFile(join(directory, 'market', 'registry.json'), JSON.stringify({
    schemaVersion: 1,
    publisherId: 'notegen',
    publisherName: 'NoteGen',
    plugins: [{ directory: 'plugin', official: true }],
  }))
  const manifest = {
    id: 'top.notegen.market-fixture',
    name: '%name%',
    description: '%description%',
    defaultLocale: 'en',
    locales: { en: 'locales/en.json', 'zh-CN': 'locales/zh-CN.json' },
    author: 'NoteGen',
    version: '1.0.0',
    minAppVersion: '0.26.0',
    apiVersion: '^1.0.0',
    platforms: ['desktop'],
    permissions: { 'notes.read': {} },
  }
  const writeVersion = async (version, permissions) => {
    manifest.version = version
    manifest.permissions = permissions
    await writeFile(join(directory, 'plugin', 'plugin.json'), JSON.stringify(manifest))
    await writeFile(join(directory, 'artifacts', `${manifest.id}-${version}.notegen-plugin`), `fixture package ${version}`)
  }
  await writeVersion(manifest.version, manifest.permissions)
  const generate = async (output, generation, previous, extra = []) => runFile(process.execPath, [
    marketTool, 'generate',
    '--registry', join(directory, 'market', 'registry.json'),
    '--publisher', join(directory, 'publisher.json'),
    '--artifacts', join(directory, 'artifacts'),
    '--base-url', 'https://example.com/plugins',
    '--generation', String(generation),
    '--output', join(directory, output),
    ...(previous ? ['--previous-index', join(directory, previous)] : []),
    ...extra,
  ])
  return { directory, writeVersion, generate }
}

test('explicit catalog reset drops old releases and removed plugins while preserving generation checks', async t => {
  const { directory, generate, writeVersion } = await createMarketFixture(t)
  await generate('old.json', 10)
  const old = JSON.parse(await readFile(join(directory, 'old.json'), 'utf8'))
  old.plugins.push({ ...old.plugins[0], id: 'top.notegen.removed' })
  await writeFile(join(directory, 'old.json'), JSON.stringify(old))
  await writeVersion('0.1.0', { 'notes.read': {} })
  await generate('reset.json', 11, 'old.json', ['--reset-catalog', 'true'])
  const reset = JSON.parse(await readFile(join(directory, 'reset.json'), 'utf8'))
  assert.equal(reset.plugins.length, 1)
  assert.deepEqual(reset.plugins[0].releases.map(release => release.version), ['0.1.0'])
  await assert.rejects(generate('rollback.json', 10, 'old.json', ['--reset-catalog', 'true']), /generation must be greater/)
  await assert.rejects(generate('missing.json', 12, undefined, ['--reset-catalog', 'true']), /requires a previous/)
})

test('market preserves historical release permissions when a newer version expands them', async (t) => {
  const fixture = await createMarketFixture(t)
  await fixture.generate('previous.json', 1)
  const previous = JSON.parse(await readFile(join(fixture.directory, 'previous.json'), 'utf8'))
  assert.deepEqual(previous.plugins[0].releases[0].permissions, ['notes.read'])
  // Simulate the earlier index schema: only the entry held the permission summary.
  delete previous.plugins[0].releases[0].permissions
  await writeFile(join(fixture.directory, 'previous.json'), JSON.stringify(previous))
  await fixture.writeVersion('1.1.0', { 'notes.read': {}, 'notes.write': {} })
  await fixture.generate('next.json', 2, 'previous.json')
  const next = JSON.parse(await readFile(join(fixture.directory, 'next.json'), 'utf8'))
  assert.deepEqual(next.plugins[0].permissions, ['notes.read', 'notes.write'])
  assert.deepEqual(next.plugins[0].releases.map(({ version, permissions }) => ({ version, permissions })), [
    { version: '1.1.0', permissions: ['notes.read', 'notes.write'] },
    { version: '1.0.0', permissions: ['notes.read'] },
  ])
  await runFile(process.execPath, [
    marketTool, 'refresh', '--previous-index', join(fixture.directory, 'previous.json'),
    '--generation', '3', '--output', join(fixture.directory, 'refreshed.json'),
  ])
  const refreshed = JSON.parse(await readFile(join(fixture.directory, 'refreshed.json'), 'utf8'))
  assert.deepEqual(refreshed.plugins[0].releases[0].permissions, ['notes.read'])
})

test('market refuses the 101st release without silently deleting compatible history', async (t) => {
  const fixture = await createMarketFixture(t)
  await fixture.generate('previous.json', 1)
  const previous = JSON.parse(await readFile(join(fixture.directory, 'previous.json'), 'utf8'))
  const release = previous.plugins[0].releases[0]
  previous.plugins[0].releases = Array.from({ length: 100 }, (_, index) => ({
    ...release, version: `1.0.${index}`,
  }))
  await writeFile(join(fixture.directory, 'previous.json'), JSON.stringify(previous))
  await fixture.writeVersion('2.0.0', { 'notes.read': {} })
  await assert.rejects(
    fixture.generate('next.json', 2, 'previous.json'),
    (error) => error.stderr.includes('client limit of 100 releases'),
  )
  await assert.rejects(readFile(join(fixture.directory, 'next.json')), { code: 'ENOENT' })

  previous.plugins[0].releases.push({ ...release, version: '2.0.0' })
  await writeFile(join(fixture.directory, 'too-many.json'), JSON.stringify(previous))
  await assert.rejects(runFile(process.execPath, [
    marketTool, 'sign', '--index', join(fixture.directory, 'too-many.json'),
    '--private-key', join(fixture.directory, 'root.pem'),
    '--output', join(fixture.directory, 'too-many.sig'),
  ]), (error) => error.stderr.includes('client limit of 100 releases'))
  await assert.rejects(readFile(join(fixture.directory, 'too-many.sig')), { code: 'ENOENT' })
})

async function loadPlugin(name) {
  const directory = new URL(`../plugins/${name}/`, import.meta.url)
  const manifest = JSON.parse(await readFile(new URL('plugin.json', directory), 'utf8'))
  const module = await import(new URL('.notegen/package/dist/main.js', directory))
  return { manifest, module }
}

function collectManifestLocaleKeys(value, keys = new Set()) {
  if (typeof value === 'string') {
    const match = value.match(/^%([^%]+)%$/u)
    if (match) keys.add(match[1])
    return keys
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectManifestLocaleKeys(entry, keys)
    return keys
  }
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) collectManifestLocaleKeys(entry, keys)
  }
  return keys
}

function collectLiteralRuntimeLocaleKeys(source) {
  return new Set(
    [...source.matchAll(/\.i18n\.t\(\s*(['"])([^'"]+)\1/gu)]
      .map((match) => match[2]),
  )
}

async function createEditorHost(text) {
  const { manifest, module } = await loadPlugin('editor-statistics')
  const host = createPluginTestHost({
    manifest,
    editor: {
      active: {
        windowId: 'window-1',
        editorId: 'editor-1',
        documentId: 'note-1',
        kind: 'markdown',
        mode: 'source',
        revision: 1,
        composing: false,
        size: {
          utf16Length: text.length,
          bytes: Buffer.byteLength(text),
          lines: text.split('\n').length,
        },
      },
      text,
    },
  })
  await host.activate(module)
  return host
}

test('Daily Notes creates and opens one deterministic daily note', async () => {
  const { manifest, module } = await loadPlugin('daily-notes')
  const host = createPluginTestHost({
    manifest,
    now: () => new Date('2026-09-08T02:03:00.000Z'),
  })

  await host.activate(module)
  const result = await host.executeCommand('top.notegen.daily-notes.open-today')

  assert.equal(result.status, 'created')
  assert.equal(result.path, 'Daily/2026/09/2026-09-08.md')
  assert.equal(host.notes.length, 1)
  assert.match(host.notes[0].content, /^# /u)

  const existing = await host.executeCommand('top.notegen.daily-notes.open-today')
  assert.equal(existing.status, 'opened-existing')
  assert.equal(host.notes.length, 1)
  await host.deactivate()
})

test('Daily Notes uses its inline template without the optional read permission', async () => {
  const { manifest, module } = await loadPlugin('daily-notes')
  const host = createPluginTestHost({
    manifest,
    permissions: { 'notes.read': false },
    now: () => new Date('2026-09-08T02:03:00.000Z'),
  })
  await host.activate(module)
  try {
    const result = await host.executeCommand('top.notegen.daily-notes.open-today')
    assert.equal(result.status, 'created')
    assert.equal(host.callHistory.some((call) => call.name === 'notes.read'), false)
  } finally {
    await host.deactivate()
  }
})

test('Daily Notes fails safely when a configured template file is not authorized', async () => {
  const { manifest, module } = await loadPlugin('daily-notes')
  const host = createPluginTestHost({
    manifest,
    permissions: { 'notes.read': false },
    notes: [{ path: 'Templates/daily.md', content: '# Template' }],
    settings: {
      'top.notegen.daily-notes.templateFile': 'Templates/daily.md',
    },
    now: () => new Date('2026-09-08T02:03:00.000Z'),
  })
  await host.activate(module)
  try {
    await assert.rejects(
      () => host.executeCommand('top.notegen.daily-notes.open-today'),
      (error) => {
        assert.equal(error?.code, 'PermissionDenied')
        return true
      },
    )
    assert.equal(host.notes.some((note) => note.path.startsWith('Daily/')), false)
  } finally {
    await host.deactivate()
  }
})

test('Daily Notes rejects host-invalid paths before invoking the note API', async () => {
  const cases = [
    ['reserved segment', '.cache'],
    ['sensitive environment segment', '.env.backup'],
    ['extended Windows device name', 'CONIN$'],
    ['more than twelve total segments', Array.from({ length: 12 }, (_, index) => `d${index}`).join('/')],
    ['a rendered segment over 240 UTF-8 bytes', '{{date}}'.repeat(25)],
  ]

  for (const [description, folder] of cases) {
    const { manifest, module } = await loadPlugin('daily-notes')
    const host = createPluginTestHost({
      manifest,
      now: () => new Date('2026-09-08T02:03:00.000Z'),
      settings: {
        'top.notegen.daily-notes.folder': folder,
      },
    })
    await host.activate(module)
    try {
      await assert.rejects(
        () => host.executeCommand('top.notegen.daily-notes.open-today'),
        (error) => {
          assert.equal(error?.code, 'InvalidPath', description)
          return true
        },
      )
      assert.equal(
        host.callHistory.some((call) => call.name === 'notes.openOrCreate'),
        false,
        description,
      )
    } finally {
      await host.deactivate()
    }
  }
})

test('Editor Statistics calculates Markdown statistics and updates its status item', async () => {
  const { manifest, module } = await loadPlugin('editor-statistics')
  const text = '# 标题\n\nHello plugin world.'
  let clock = 0
  const host = createPluginTestHost({
    manifest,
    now: () => new Date(clock),
    editor: {
      active: {
        windowId: 'window-1',
        editorId: 'editor-1',
        documentId: 'note-1',
        kind: 'markdown',
        mode: 'source',
        revision: 1,
        composing: false,
        size: { utf16Length: text.length, bytes: Buffer.byteLength(text), lines: 3 },
      },
      text,
    },
  })

  await host.activate(module)
  clock = 200
  const statistics = await host.executeCommand('top.notegen.editor-statistics.refresh')

  assert.ok(statistics.charactersWithWhitespace > 0)
  assert.equal(statistics.nonCjkWords, 3)
  assert.equal(host.statusBar['top.notegen.editor-statistics.summary'].visible, true)
  assert.ok(host.notices.length > 0)
  await host.deactivate()
})

test('Editor Statistics keeps math excluded across Markdown inline tokens', async () => {
  const host = await createEditorHost([
    'Visible$*hidden formula*$and \\(*more hidden*\\) tail',
    '<div>$*hidden in raw HTML*$</div>',
  ].join('\n\n'))
  try {
    const statistics = await host.executeCommand('top.notegen.editor-statistics.refresh')
    assert.equal(statistics.nonCjkWords, 3)
  } finally {
    await host.deactivate()
  }
})

test('Editor Statistics preserves escaped dollar currency as readable text', async () => {
  const host = await createEditorHost('Price \\$5 and \\$10')
  try {
    const statistics = await host.executeCommand('top.notegen.editor-statistics.refresh')
    assert.equal(statistics.nonCjkWords, 4)
    assert.equal(statistics.charactersWithoutWhitespace, 13)
  } finally {
    await host.deactivate()
  }
})

test('Editor Statistics counts combining, flag, skin-tone, and family sequences as graphemes', async () => {
  const host = await createEditorHost('e\u0301 🇨🇳 👩🏽‍💻 👨‍👩‍👧‍👦')
  try {
    const statistics = await host.executeCommand('top.notegen.editor-statistics.refresh')
    assert.equal(statistics.charactersWithWhitespace, 7)
    assert.equal(statistics.charactersWithoutWhitespace, 4)
  } finally {
    await host.deactivate()
  }
})

test('Official plugin locale files are symmetric and cover manifest and runtime keys', async () => {
  const dynamicRuntimeKeys = {
    'daily-notes': [
      ...Array.from({ length: 12 }, (_, index) => `month.${String(index + 1).padStart(2, '0')}`),
      ...Array.from({ length: 7 }, (_, index) => `weekday.${index}`),
    ],
    'editor-statistics': [],
  }

  for (const name of ['daily-notes', 'editor-statistics']) {
    const directory = new URL(`../plugins/${name}/`, import.meta.url)
    const manifest = JSON.parse(await readFile(new URL('plugin.json', directory), 'utf8'))
    const source = await readFile(new URL('src/main.ts', directory), 'utf8')
    const requiredKeys = new Set([
      ...collectManifestLocaleKeys(manifest),
      ...collectLiteralRuntimeLocaleKeys(source),
      ...dynamicRuntimeKeys[name],
    ])
    const messagesByLocale = await Promise.all(
      Object.entries(manifest.locales).map(async ([locale, path]) => [
        locale,
        JSON.parse(await readFile(new URL(path, directory), 'utf8')),
      ]),
    )
    const defaultMessages = messagesByLocale.find(([locale]) => locale === manifest.defaultLocale)?.[1]
    assert.ok(defaultMessages, `${name} default locale must exist`)
    const expectedKeys = Object.keys(defaultMessages).sort()

    for (const [locale, messages] of messagesByLocale) {
      assert.deepEqual(Object.keys(messages).sort(), expectedKeys, `${name} ${locale} keys`)
      for (const key of requiredKeys) {
        assert.equal(typeof messages[key], 'string', `${name} ${locale} is missing ${key}`)
        assert.ok(messages[key].length > 0, `${name} ${locale} has an empty ${key}`)
      }
    }
  }
})
