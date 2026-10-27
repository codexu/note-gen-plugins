import type { PluginJsonValue } from '@notegen/plugin-api'

export const CODE_CHARACTER_LIMIT = 10_000
export const TEMPLATE_NAME_LIMIT = 80
export const TEMPLATE_LIMIT = 20
export const TEMPLATE_STORAGE_BYTES = 512 * 1024
export const LEGACY_CONFIG_KEY = 'htmlExportConfig'
export const TEMPLATE_STORAGE_KEY = 'htmlExportTemplates'
export const DEFAULT_TEMPLATE_ID = 'default'

export interface HtmlTemplate {
  id: string
  name: string
  css: string
  javascript: string
}

export interface TemplateConfig {
  schemaVersion: 2
  selectedId: string
  templates: HtmlTemplate[]
}

export function emptyConfig(): TemplateConfig {
  return { schemaVersion: 2, selectedId: DEFAULT_TEMPLATE_ID, templates: [] }
}

export function asRecord(value: PluginJsonValue | undefined): Record<string, PluginJsonValue> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, PluginJsonValue> : {}
}

function validCode(value: unknown): value is string {
  return typeof value === 'string' && value.length <= CODE_CHARACTER_LIMIT
}

function fitsStorage(value: TemplateConfig): boolean {
  let bytes = 0
  for (const character of JSON.stringify(value)) {
    const code = character.codePointAt(0) ?? 0
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4
    if (bytes > TEMPLATE_STORAGE_BYTES) return false
  }
  return true
}

/** Never overwrite a malformed or future-version value with an empty collection. */
export function readTemplates(value: PluginJsonValue | undefined): TemplateConfig | null {
  if (value === undefined) return emptyConfig()
  const stored = asRecord(value)
  if (stored.schemaVersion !== 2 || typeof stored.selectedId !== 'string' || !Array.isArray(stored.templates) || stored.templates.length > TEMPLATE_LIMIT) return null
  const templates: HtmlTemplate[] = []
  const ids = new Set<string>()
  const names = new Set<string>()
  for (const entry of stored.templates) {
    const item = asRecord(entry)
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || item.id === DEFAULT_TEMPLATE_ID || ids.has(item.id)
      || typeof item.name !== 'string' || !item.name.trim() || item.name.length > TEMPLATE_NAME_LIMIT
      || names.has(item.name.trim().toLowerCase()) || !validCode(item.css) || !validCode(item.javascript)) return null
    ids.add(item.id)
    names.add(item.name.trim().toLowerCase())
    templates.push({ id: item.id, name: item.name, css: item.css, javascript: item.javascript })
  }
  if (stored.selectedId !== DEFAULT_TEMPLATE_ID && !ids.has(stored.selectedId)) return null
  const config: TemplateConfig = { schemaVersion: 2, selectedId: stored.selectedId, templates }
  return fitsStorage(config) ? config : null
}

/** The previous key is retained; persist this result under the new key only on save. */
export function migrateLegacy(value: PluginJsonValue | undefined, legacyName: string): TemplateConfig | null {
  if (value === undefined) return emptyConfig()
  const stored = asRecord(value)
  if (stored.schemaVersion !== 1 || !validCode(stored.css) || !validCode(stored.javascript)) return null
  if (!stored.css && !stored.javascript) return emptyConfig()
  const config: TemplateConfig = {
    schemaVersion: 2,
    selectedId: 'legacy',
    templates: [{ id: 'legacy', name: legacyName, css: stored.css, javascript: stored.javascript }],
  }
  return fitsStorage(config) ? config : null
}

export function serializeConfig(config: TemplateConfig): PluginJsonValue | null {
  const value: PluginJsonValue = {
    schemaVersion: 2,
    selectedId: config.selectedId,
    templates: config.templates.map(item => ({ ...item })),
  }
  return readTemplates(value) ? value : null
}
