import { readdir, readFile } from 'node:fs/promises'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadOfficialLocalizations, REQUIRED_LOCALES } from './localizations.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const registry = JSON.parse(await readFile(join(root, 'market/registry.json'), 'utf8'))
const entries = await readdir(join(root, 'plugins'), { withFileTypes: true })
for (const entry of entries.filter(entry => entry.isDirectory())) {
  const directory = join(root, 'plugins', entry.name)
  const manifest = JSON.parse(await readFile(join(directory, 'plugin.json'), 'utf8'))
  const localizations = await loadOfficialLocalizations(directory, manifest)
  for (const filename of ['README.md', 'README.en.md', 'USAGE.zh-CN.md', 'USAGE.md']) {
    if (!(await readFile(join(directory, filename), 'utf8')).trim()) {
      throw new Error(`${manifest.id}: ${filename} must not be empty`)
    }
  }
  const registration = registry.plugins.find(plugin => plugin.directory === `plugins/${entry.name}`)
  if (registration) {
    for (const locale of REQUIRED_LOCALES) {
      for (const field of ['name', 'description']) {
        if (registration.localizations?.[locale]?.[field] !== localizations[locale][field]) {
          throw new Error(`${manifest.id}: registry ${locale}.${field} must match the plugin locale`)
        }
      }
    }
  }
}
console.log('Official plugins include English and Simplified Chinese metadata, locale keys and documentation.')
