import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

export const REQUIRED_LOCALES = ['en', 'zh-CN']

// Official plugin policy, shared by source validation and market generation.
export async function loadOfficialLocalizations(directory, manifest) {
  const fail = message => { throw new Error(`${manifest.id}: ${message}`) }
  if (manifest.defaultLocale !== 'en') fail('defaultLocale must be en')
  if (manifest.name !== '%name%' || manifest.description !== '%description%') {
    fail('name and description must reference %name% and %description%')
  }
  const dictionaries = {}
  for (const locale of REQUIRED_LOCALES) {
    const file = manifest.locales?.[locale]
    if (typeof file !== 'string' || !file.trim()) fail(`missing locales.${locale}`)
    const path = resolve(directory, file)
    if (!path.startsWith(resolve(directory) + sep)) fail(`locale path escapes plugin: ${file}`)
    const messages = JSON.parse(await readFile(path, 'utf8'))
    if (!messages || typeof messages !== 'object' || Array.isArray(messages)) fail(`${locale} must be a message dictionary`)
    for (const [key, value] of Object.entries(messages)) {
      if (typeof value !== 'string' || !value.trim()) fail(`${locale}.${key} must be a non-empty string`)
    }
    dictionaries[locale] = messages
  }
  const keys = new Set(['name', 'description', ...REQUIRED_LOCALES.flatMap(locale => Object.keys(dictionaries[locale]))])
  function collect(value) {
    if (typeof value === 'string') {
      const key = value.match(/^%(.+)%$/)?.[1]
      if (key) keys.add(key)
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(collect)
    }
  }
  collect(manifest)
  for (const locale of REQUIRED_LOCALES) {
    for (const key of keys) {
      if (!Object.hasOwn(dictionaries[locale], key)) fail(`missing ${locale}.${key}`)
    }
  }
  // These fields are translated by the host; paths, IDs and default values are not.
  function requireReferences(value) {
    if (!value || typeof value !== 'object') return
    for (const [key, text] of Object.entries(value)) {
      if (['title', 'description', 'label'].includes(key) && typeof text === 'string' && !/^%.+%$/.test(text)) {
        fail(`contribution ${key} must reference a locale key: ${text}`)
      }
      requireReferences(text)
    }
  }
  requireReferences(manifest.contributes)
  requireReferences(manifest.permissions)
  return Object.fromEntries(REQUIRED_LOCALES.map(locale => [locale, {
    name: dictionaries[locale].name,
    description: dictionaries[locale].description,
  }]))
}
