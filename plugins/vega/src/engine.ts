import { View, loader, parse, type Spec } from 'vega'
import { compile, type TopLevelSpec } from 'vega-lite'
import { expressionInterpreter } from 'vega-interpreter'
import type { CodeBlockRenderRequest } from '@notegen/plugin-api'

function validate(value: unknown, depth = 0) {
  if (depth > 32) throw new Error('Chart specification is nested too deeply')
  if (Array.isArray(value)) {
    if (value.length > 5000) throw new Error('Charts support at most 5,000 entries per array')
    value.forEach(item => validate(item, depth + 1))
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (['url', 'href', 'baseURL'].includes(key) || (['type', 'mark'].includes(key) && item === 'image')) {
        throw new Error('Offline charts support inline data only; URLs, links and image marks are unavailable')
      }
      validate(item, depth + 1)
    }
  }
}

export async function render(request: CodeBlockRenderRequest) {
  const source: unknown = JSON.parse(request.source)
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Provide a Vega or Vega-Lite JSON object')
  validate(source)
  const foreground = request.theme === 'dark' ? '#e5e7eb' : '#1f2937'
  const config = {
    background: 'transparent',
    axis: { labelColor: foreground, titleColor: foreground, domainColor: foreground, tickColor: foreground, gridColor: request.theme === 'dark' ? '#374151' : '#e5e7eb' },
    legend: { labelColor: foreground, titleColor: foreground },
    title: { color: foreground }, text: { color: foreground },
  }
  const spec = request.language === 'vega'
    ? source as Spec
    : compile(source as TopLevelSpec, { config }).spec
  validate(spec)
  const offline = loader()
  offline.load = () => Promise.reject(new Error('External data loading is disabled'))
  offline.sanitize = () => Promise.reject(new Error('External resources and links are disabled'))
  // CSP does not permit Function/eval. Parse expression ASTs and interpret them.
  const runtime = parse(spec, config, { ast: true })
  const view = new View(runtime, { renderer: 'none', loader: offline, expr: expressionInterpreter })
  try {
    await view.runAsync()
    return await view.toSVG()
  } finally { view.finalize() }
}
