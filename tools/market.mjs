import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'

const MAX_RELEASES_PER_PLUGIN = 100
const PERMISSIONS = new Set([
  'editor.read', 'editor.write', 'notes.read', 'notes.create', 'notes.open',
  'notes.list', 'notes.write', 'notes.move', 'notes.delete', 'network.fetch',
  'attachments.read', 'attachments.create',
])

function fail(message) {
  process.stderr.write(`market: ${message}\n`)
  process.exitCode = 1
  throw new Error(message)
}

function options(values) {
  const result = new Map()
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index]
    const value = values[index + 1]
    if (!key?.startsWith('--') || value === undefined) fail(`invalid option ${key ?? ''}`)
    result.set(key.slice(2), value)
  }
  return result
}

function required(map, key) {
  const value = map.get(key)
  if (!value) fail(`--${key} is required`)
  return value
}

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function rawPublicKey(key) {
  const jwk = key.export({ format: 'jwk' })
  if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' || !jwk.x) fail('expected an Ed25519 key')
  return Buffer.from(jwk.x, 'base64url')
}

function publicKeyObject(base64) {
  const raw = Buffer.from(base64, 'base64')
  if (raw.length !== 32 || raw.toString('base64') !== base64) fail('public key must be canonical Base64 for 32 bytes')
  return createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: raw.toString('base64url') }, format: 'jwk' })
}

function nonEmptyString(value, name) {
  if (typeof value !== 'string' || !value.trim()) fail(`${name} must be a non-empty string`)
}

function validateLocalizations(localizations) {
  if (localizations === undefined) return
  if (!localizations || typeof localizations !== 'object' || Array.isArray(localizations) || Object.keys(localizations).length > 20) fail('localizations must contain at most 20 locales')
  for (const [locale, text] of Object.entries(localizations)) {
    if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale) || locale.length > 35) fail(`Invalid localization locale: ${locale}`)
    if (!text || typeof text !== 'object' || Array.isArray(text) || Object.keys(text).some(key => !['name', 'description'].includes(key))) fail(`Invalid localization: ${locale}`)
    for (const [key, limit] of [['name', 120], ['description', 2000]]) {
      nonEmptyString(text[key], `localizations.${locale}.${key}`)
      if (/[\u0000-\u001f\u007f-\u009f]/u.test(text[key])) fail(`localizations.${locale}.${key} contains control characters`)
      if (Buffer.byteLength(text[key], 'utf8') > limit) fail(`localizations.${locale}.${key} is too long`)
    }
  }
}

function httpsUrl(value, name) {
  nonEmptyString(value, name)
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
      fail(`${name} must be a plain HTTPS URL without credentials or a fragment`)
    }
    return url.toString()
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('market:')) throw error
    fail(`${name} must be a valid HTTPS URL`)
  }
}

function validatePermissions(permissions, name) {
  if (!Array.isArray(permissions) || permissions.length > 20
    || permissions.some((permission) => !PERMISSIONS.has(permission))
    || new Set(permissions).size !== permissions.length) {
    fail(`${name} must contain at most 20 unique supported permission names`)
  }
}

function withReleasePermissions(plugin) {
  return {
    ...plugin,
    releases: plugin.releases.map((release) => ({
      ...release,
      permissions: release.permissions ?? [...plugin.permissions],
    })),
  }
}

function validateIndex(index, { requireCurrent = true } = {}) {
  if (!index || typeof index !== 'object' || Array.isArray(index)) fail('index must be an object')
  if (index.schemaVersion !== 1) fail('schemaVersion must be 1')
  if (!Number.isSafeInteger(index.generation) || index.generation < 1) fail('generation must be a positive safe integer')
  const generatedAt = Date.parse(index.generatedAt)
  if (!Number.isFinite(generatedAt)) fail('generatedAt must be an ISO date')
  if (!Number.isSafeInteger(index.expiresAt)) fail('expiresAt must be epoch milliseconds')
  if (index.expiresAt <= generatedAt || index.expiresAt - generatedAt > 14 * 86_400_000) {
    fail('expiresAt must be after generatedAt and no more than 14 days later')
  }
  if (requireCurrent && index.expiresAt <= Date.now()) fail('index has already expired')
  if (!Array.isArray(index.publishers) || index.publishers.length < 1) fail('publishers must not be empty')
  if (index.publishers.length > 100) fail('publishers must contain at most 100 entries')
  if (!Array.isArray(index.plugins)) fail('plugins must be an array')
  if (index.plugins.length > 10_000) fail('plugins must contain at most 10000 entries')

  const publishers = new Set()
  for (const publisher of index.publishers) {
    nonEmptyString(publisher.id, 'publisher.id')
    nonEmptyString(publisher.name, 'publisher.name')
    if (publishers.has(publisher.id)) fail(`duplicate publisher ${publisher.id}`)
    publishers.add(publisher.id)
    const raw = rawPublicKey(publicKeyObject(publisher.publicKey))
    const keyId = `ed25519-${createHash('sha256').update(raw).digest('hex')}`
    if (publisher.keyId !== keyId) fail(`publisher ${publisher.id} has a mismatched keyId`)
    if (publisher.previousKeys !== undefined && (!Array.isArray(publisher.previousKeys) || publisher.previousKeys.length > 16)) fail('previousKeys must contain at most 16 keys')
    const keys = new Set([publisher.keyId])
    for (const key of publisher.previousKeys ?? []) {
      const digest = `ed25519-${createHash('sha256').update(rawPublicKey(publicKeyObject(key.publicKey))).digest('hex')}`
      if (key.keyId !== digest || keys.has(key.keyId)) fail('Invalid or duplicate previous publisher key')
      keys.add(key.keyId)
    }
  }

  const pluginIds = new Set()
  for (const plugin of index.plugins) {
    nonEmptyString(plugin.id, 'plugin.id')
    nonEmptyString(plugin.name, `${plugin.id}.name`)
    nonEmptyString(plugin.description, `${plugin.id}.description`)
    validateLocalizations(plugin.localizations)
    nonEmptyString(plugin.author, `${plugin.id}.author`)
    if (pluginIds.has(plugin.id)) fail(`duplicate plugin ${plugin.id}`)
    pluginIds.add(plugin.id)
    if (!publishers.has(plugin.publisherId)) fail(`${plugin.id} references an unknown publisher`)
    if (!Array.isArray(plugin.categories) || !Array.isArray(plugin.permissions)) {
      fail(`${plugin.id} categories and permissions must be arrays`)
    }
    if (plugin.categories.length > 20 || plugin.permissions.length > 20) {
      fail(`${plugin.id} has too many categories or permissions`)
    }
    validatePermissions(plugin.permissions, `${plugin.id}.permissions`)
    if (!Array.isArray(plugin.releases) || plugin.releases.length < 1) fail(`${plugin.id} must have releases`)
    if (plugin.releases.length > MAX_RELEASES_PER_PLUGIN) {
      fail(`${plugin.id} exceeds the client limit of ${MAX_RELEASES_PER_PLUGIN} releases; publish an explicit reviewed retention change before adding another version`)
    }
    const releaseVersions = new Set()
    for (const release of plugin.releases) {
      if (release.revoked !== undefined && (typeof release.revoked !== 'string' || !release.revoked.trim() || release.revoked.length > 500)) fail('revoked must be a reason of at most 500 characters')
      const publisher = index.publishers.find(entry => entry.id === plugin.publisherId)
      if (release.publisherKeyId !== undefined && ![publisher.keyId, ...(publisher.previousKeys ?? []).map(key => key.keyId)].includes(release.publisherKeyId)) fail('Release references an unknown publisher key')
      nonEmptyString(release.version, `${plugin.id}.release.version`)
      if (releaseVersions.has(release.version)) fail(`${plugin.id} has duplicate release ${release.version}`)
      releaseVersions.add(release.version)
      nonEmptyString(release.minAppVersion, `${plugin.id}.release.minAppVersion`)
      nonEmptyString(release.apiVersion, `${plugin.id}.release.apiVersion`)
      if (release.permissions !== undefined) {
        validatePermissions(release.permissions, `${plugin.id}@${release.version}.permissions`)
      }
      if (!Array.isArray(release.platforms) || release.platforms.length < 1) fail(`${plugin.id} release platforms must not be empty`)
      const primary = httpsUrl(release.packageUrl, `${plugin.id}.packageUrl`)
      if (release.packageUrls !== undefined) {
        if (!Array.isArray(release.packageUrls)
          || release.packageUrls.length < 1
          || release.packageUrls.length > 3) {
          fail(`${plugin.id} packageUrls must contain between 1 and 3 URLs`)
        }
        const urls = release.packageUrls.map((url, index) => (
          httpsUrl(url, `${plugin.id}.packageUrls[${index}]`)
        ))
        if (new Set(urls).size !== urls.length || urls[0] !== primary) {
          fail(`${plugin.id} packageUrls must be unique and begin with packageUrl`)
        }
      }
      if (!/^[a-f0-9]{64}$/u.test(release.packageSha256)) fail(`${plugin.id} packageSha256 is invalid`)
      if (!Number.isFinite(Date.parse(release.publishedAt))) fail(`${plugin.id} publishedAt must be an ISO date`)
    }
  }
}

async function generate(args) {
  const registryPath = resolve(args.get('registry') ?? 'market/registry.json')
  const publisherPath = resolve(required(args, 'publisher'))
  const artifacts = resolve(required(args, 'artifacts'))
  const baseUrl = required(args, 'base-url').replace(/\/$/, '')
  const mirrorBaseUrl = args.get('mirror-base-url')?.replace(/\/$/, '')
  httpsUrl(`${baseUrl}/package.notegen-plugin`, 'base-url')
  if (mirrorBaseUrl) httpsUrl(`${mirrorBaseUrl}/package.notegen-plugin`, 'mirror-base-url')
  const output = resolve(args.get('output') ?? join(artifacts, 'index.json'))
  const generation = Number(required(args, 'generation'))
  const validityDays = Number(args.get('validity-days') ?? '7')
  if (!Number.isSafeInteger(generation) || generation < 1) fail('generation must be a positive safe integer')
  if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 14) fail('validity-days must be between 1 and 14')
  const previousPath = args.get('previous-index')
  let previous = null
  if (previousPath) {
    previous = await json(resolve(previousPath))
    validateIndex(previous, { requireCurrent: false })
    if (generation <= previous.generation) {
      fail(`generation must be greater than the published generation ${previous.generation}`)
    }
  }

  const resetCatalog = args.get('reset-catalog') === 'true'
  // A reset discards releases, but still requires a verified previous generation.
  if (resetCatalog && !previous) fail('Catalog reset requires a previous signed index')
  const history = resetCatalog ? null : previous
  const registry = await json(registryPath)
  const publisher = await json(publisherPath)
  if (publisher.algorithm !== 'Ed25519') fail('publisher key must use Ed25519')
  const publicRaw = rawPublicKey(publicKeyObject(publisher.publicKey))
  const expectedKeyId = `ed25519-${createHash('sha256').update(publicRaw).digest('hex')}`
  if (publisher.keyId !== expectedKeyId) fail('publisher keyId does not match publicKey')
  const now = new Date()
  const plugins = []
  for (const registration of registry.plugins) {
    validateLocalizations(registration.localizations)
    if (registration.revocations !== undefined) {
      if (!registration.revocations || Array.isArray(registration.revocations) || typeof registration.revocations !== 'object') fail('revocations must be a version-to-reason object')
      for (const reason of Object.values(registration.revocations)) {
        if (typeof reason !== 'string' || !reason.trim() || reason.length > 500) fail('Every revocation must have a reason of at most 500 characters')
      }
    }
    const directory = resolve(dirname(registryPath), '..', registration.directory)
    const manifest = await json(join(directory, 'plugin.json'))
    const assetName = `${manifest.id}-${manifest.version}.notegen-plugin`
    const asset = await readFile(join(artifacts, assetName))
    const packageSha256 = createHash('sha256').update(asset).digest('hex')
    const previousPlugin = history?.plugins.find((plugin) => plugin.id === manifest.id)
    const previousRelease = previousPlugin?.releases.find((release) => release.version === manifest.version)
    const previousPublisher = history?.publishers.find(entry => entry.id === previousPlugin?.publisherId)
    const previousReleases = previousPlugin ? withReleasePermissions(previousPlugin).releases.map(release => ({
      ...release, publisherKeyId: release.publisherKeyId ?? previousPublisher?.keyId,
    })) : []
    if (previousRelease && previousRelease.packageSha256 !== packageSha256) {
      fail(`${manifest.id}@${manifest.version} was already published with different bytes; bump its version`)
    }
    const releases = previousRelease
      ? previousReleases
      : [{
          version: manifest.version,
          publisherKeyId: publisher.keyId,
          minAppVersion: manifest.minAppVersion,
          apiVersion: manifest.apiVersion,
          platforms: manifest.platforms,
          permissions: Object.keys(manifest.permissions).sort(),
          packageUrl: `${baseUrl}/${assetName}`,
          ...(mirrorBaseUrl
            ? { packageUrls: [`${baseUrl}/${assetName}`, `${mirrorBaseUrl}/${assetName}`] }
            : {}),
          packageSha256,
          publishedAt: now.toISOString(),
          ...(registration.changelog ? { changelog: registration.changelog } : {}),
        }, ...previousReleases]
    plugins.push({
      id: manifest.id,
      name: manifest.name,
      description: manifest.description ?? manifest.name,
      ...(args.get('localized-metadata') === 'true' && registration.localizations
        ? { localizations: registration.localizations }
        : previousPlugin?.localizations ? { localizations: previousPlugin.localizations } : {}),
      author: typeof manifest.author === 'string' ? manifest.author : manifest.author?.name ?? registry.publisherName,
      publisherId: registry.publisherId,
      ...(manifest.repository ? { repository: manifest.repository } : {}),
      ...(manifest.author?.url ? { homepage: manifest.author.url } : {}),
      ...(manifest.license ? { license: manifest.license } : {}),
      categories: registration.categories ?? [],
      featured: registration.featured === true,
      official: registration.official === true,
      permissions: Object.keys(manifest.permissions).sort(),
      releases: releases.map(release => ({
        ...release,
        ...(registration.revocations?.[release.version] ? { revoked: registration.revocations[release.version] } : {}),
      })),
    })
    for (const version of Object.keys(registration.revocations ?? {})) {
      if (!releases.some(release => release.version === version)) fail(`Cannot revoke unknown release ${manifest.id}@${version}`)
    }
  }
  // Removing a registry row must not erase authenticated withdrawal information.
  for (const plugin of history?.plugins ?? []) {
    if (!plugins.some(entry => entry.id === plugin.id)) plugins.push(withReleasePermissions(plugin))
  }
  const index = {
    schemaVersion: 1,
    generation,
    generatedAt: now.toISOString(),
    expiresAt: now.getTime() + validityDays * 86_400_000,
    publishers: [{
      id: registry.publisherId,
      name: registry.publisherName,
      keyId: publisher.keyId,
      publicKey: publisher.publicKey,
      ...(registry.previousPublisherKeys ? { previousKeys: registry.previousPublisherKeys } : {}),
      verified: true,
    }],
    plugins,
  }
  validateIndex(index)
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(index, null, 2)}\n`, { flag: 'wx' })
  process.stdout.write(`${output}\n`)
}

async function refresh(args) {
  const previous = await json(resolve(required(args, 'previous-index')))
  validateIndex(previous, { requireCurrent: false })
  const generation = Number(required(args, 'generation'))
  const validityDays = Number(args.get('validity-days') ?? '7')
  if (!Number.isSafeInteger(generation) || generation <= previous.generation) {
    fail(`generation must be greater than the published generation ${previous.generation}`)
  }
  if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 14) {
    fail('validity-days must be between 1 and 14')
  }
  const now = new Date()
  const index = {
    ...previous,
    plugins: previous.plugins.map(withReleasePermissions),
    generation,
    generatedAt: now.toISOString(),
    expiresAt: now.getTime() + validityDays * 86_400_000,
  }
  validateIndex(index)
  const output = resolve(args.get('output') ?? 'release-assets/index.json')
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(index, null, 2)}\n`, { flag: 'wx' })
  process.stdout.write(`${output}\n`)
}

async function signIndex(args) {
  const input = resolve(required(args, 'index'))
  const output = resolve(args.get('output') ?? join(dirname(input), 'index.sig'))
  const bytes = await readFile(input)
  validateIndex(JSON.parse(bytes.toString('utf8')))
  const privateKey = createPrivateKey({
    key: await readFile(resolve(required(args, 'private-key'))),
    format: 'pem',
    ...(args.get('passphrase-env') ? { passphrase: process.env[args.get('passphrase-env')] } : {}),
  })
  if (privateKey.asymmetricKeyType !== 'ed25519') fail('root private key must use Ed25519')
  const signature = sign(null, bytes, privateKey)
  await writeFile(output, `${signature.toString('base64')}\n`, { flag: 'wx' })
  process.stdout.write(`${output}\nrootPublicKey=${rawPublicKey(createPublicKey(privateKey)).toString('base64')}\n`)
}

async function verifyIndex(args) {
  const input = resolve(required(args, 'index'))
  const bytes = await readFile(input)
  const signatureText = (await readFile(resolve(required(args, 'signature')), 'utf8')).trim()
  const signature = Buffer.from(signatureText, 'base64')
  if (signature.length !== 64 || signature.toString('base64') !== signatureText) {
    fail('index signature must be canonical Base64 for 64 bytes')
  }
  const publicText = (await readFile(resolve(required(args, 'public-key')), 'utf8')).trim()
  const publicKey = publicKeyObject(publicText.startsWith('{') ? JSON.parse(publicText).publicKey : publicText)
  if (!verify(null, bytes, publicKey, signature)) fail('index signature is invalid')
  validateIndex(JSON.parse(bytes.toString('utf8')), {
    requireCurrent: args.get('allow-expired') !== 'true',
  })
  process.stdout.write(`verified ${basename(input)}\n`)
}

const [command, ...values] = process.argv.slice(2)
const args = options(values)
if (command === 'generate') await generate(args)
else if (command === 'refresh') await refresh(args)
else if (command === 'sign') await signIndex(args)
else if (command === 'verify') await verifyIndex(args)
else fail('expected generate, refresh, sign, or verify')
