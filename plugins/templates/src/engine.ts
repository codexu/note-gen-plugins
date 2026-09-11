import type { PluginFormField } from '@notegen/plugin-api'

export const MAX_BYTES = 65_536
export function byteLength(text: string): number {
  let bytes = 0
  for (const char of text) {
    const point = char.codePointAt(0)!
    bytes += point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4
  }
  return bytes
}
export interface Template { body: string; fields: PluginFormField[] }
const builtins = new Set(['date', 'time', 'datetime', 'title', 'selection'])
/** Only a leading JSON comment is metadata. No YAML, evaluation or recursive expansion. */
export function parseTemplate(source: string): Template {
  if (byteLength(source) > MAX_BYTES) throw new Error('Template exceeds 64 KiB / 模板超过 64 KiB')
  source = source.replace(/^\uFEFF/, '')
  const header = /^<!-- notegen-template\r?\n([\s\S]*?)\r?\n-->\r?\n?/.exec(source)
  let fields: PluginFormField[] = []
  if (source.startsWith('<!-- notegen-template') && !header) throw new Error('Invalid template header / 模板头格式不正确')
  if (header) {
    const metadata = JSON.parse(header[1]) as Record<string, unknown>
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object' || Object.keys(metadata).some(k => k !== 'fields') || !Array.isArray(metadata.fields) || metadata.fields.length > 20) throw new Error('Expected at most 20 fields / 最多支持 20 个字段')
    const ids = new Set<string>()
    fields = metadata.fields.map((raw: unknown) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid field / 字段无效')
      const f = raw as Record<string, unknown>
      if (Object.keys(f).some(k => !['id', 'label', 'type', 'required', 'default'].includes(k)) || typeof f.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(f.id) || builtins.has(f.id) || ['constructor', 'prototype', '__proto__'].includes(f.id) || ids.has(f.id) || typeof f.label !== 'string' || !f.label.trim() || f.label.length > 160 || !['text', 'textarea', 'date'].includes(String(f.type)) || (f.required !== undefined && typeof f.required !== 'boolean') || (f.default !== undefined && (typeof f.default !== 'string' || f.default.length > 4000))) throw new Error('Invalid or duplicate field / 字段无效或重复')
      ids.add(f.id)
      return { id: `field_${f.id}`, label: f.label, type: f.type as 'text' | 'textarea' | 'date', required: f.required === true, value: typeof f.default === 'string' ? f.default : '', maxLength: 4000 }
    })
  }
  const body = header ? source.slice(header[0].length) : source
  // Parse all tokens before displaying a form, including templates with no custom fields.
  renderTemplate({ body, fields }, Object.fromEntries([...builtins, ...fields.map(f => `field.${f.id.slice(6)}`)].map(k => [k, ''])))
  return { body, fields }
}
export function renderTemplate(template: Template, values: Record<string, string>): string {
  let cursor = 0
  let output = ''
  for (const match of template.body.matchAll(/\{\{\s*([A-Za-z][A-Za-z0-9_.]*)\s*\}\}/g)) {
    const literal = template.body.slice(cursor, match.index)
    if (literal.includes('{{') || literal.includes('}}') || !Object.prototype.hasOwnProperty.call(values, match[1])) throw new Error(`Invalid variable / 无效变量: ${match[0]}`)
    output += literal + values[match[1]]
    cursor = match.index! + match[0].length
  }
  const rest = template.body.slice(cursor)
  if (rest.includes('{{') || rest.includes('}}')) throw new Error('Malformed variable / 变量格式不正确')
  output += rest
  if (byteLength(output) > MAX_BYTES) throw new Error('Rendered content exceeds 64 KiB / 渲染内容超过 64 KiB')
  return output
}
