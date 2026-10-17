import { init } from 'echarts'
import type { CodeBlockRenderRequest } from '@notegen/plugin-api'

function validate(value: unknown, depth = 0) {
  if (depth > 32) throw new Error('Chart configuration is nested too deeply')
  if (typeof value === 'string' && /(?:image:\/\/|url\s*\(|(?:https?|file|data|blob):)/i.test(value)) throw new Error('External resources and image symbols are unavailable')
  if (Array.isArray(value)) {
    if (value.length > 5000) throw new Error('Charts support at most 5,000 entries per array')
    value.forEach(item => validate(item, depth + 1))
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsupported chart property')
      if (['animation', 'universalTransition'].includes(key) && item !== false) throw new Error('Animations are unavailable in static previews; remove this option or set it to false')
      if (['href', 'link', 'url', 'image', 'renderItem'].includes(key)) throw new Error('Links, images and custom callbacks are not supported')
      validate(item, depth + 1)
    }
  }
}

export function render(request: CodeBlockRenderRequest) {
  const source: unknown = JSON.parse(request.source)
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Provide an ECharts option JSON object, not JavaScript')
  validate(source)
  const series = 'series' in source ? source.series : []
  for (const item of Array.isArray(series) ? series : [series]) {
    if (item && typeof item === 'object' && 'type' in item && ['custom', 'map', 'lines', 'effectScatter'].includes(String(item.type))) throw new Error('Custom, map, lines and effectScatter series are unavailable in this preview')
  }
  const chart = init(null, request.theme === 'dark' ? 'dark' : undefined, { renderer: 'svg', ssr: true, width: 720, height: 420 })
  try {
    chart.setOption({ backgroundColor: 'transparent', ...source, animation: false }, { notMerge: true })
    return chart.renderToSVGString()
  } finally { chart.dispose() }
}
