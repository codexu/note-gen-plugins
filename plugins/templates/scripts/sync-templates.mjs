import { readFile, writeFile } from 'node:fs/promises'
const root = new URL('../', import.meta.url)
const templates = {}
for (const locale of ['en', 'zh-CN']) {
  templates[locale] = {}
  for (const name of ['meeting', 'daily', 'reading']) {
    templates[locale][name] = await readFile(new URL(`templates/${locale}/${name}.md`, root), 'utf8')
  }
}
await writeFile(new URL('src/bundled.ts', root), '// Generated from templates/**/*.md by scripts/sync-templates.mjs.\nexport const bundledTemplates = ' + JSON.stringify(templates, null, 2) + ' as const\n')
