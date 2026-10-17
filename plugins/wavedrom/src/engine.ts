import JSON5 from 'json5'
import renderAny from 'wavedrom-render-any'
import waveSkin from 'wavedrom/skins/default.js'
import stringify from 'onml/stringify.js'
import type { CodeBlockRenderRequest } from '@notegen/plugin-api'

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
function validateSignal(items: unknown[], depth = 0): number {
  if (depth > 12) throw new Error('WaveDrom signal groups are nested too deeply')
  let count = 0
  for (const item of items) {
    if (Array.isArray(item)) {
      if (typeof item[0] !== 'string') throw new Error('Signal groups must start with a text label')
      count += validateSignal(item.slice(1), depth + 1)
    } else if (record(item)) {
      count++
      if (item.name !== undefined && typeof item.name !== 'string') throw new Error('Signal names must be plain text')
      if (item.wave !== undefined && (typeof item.wave !== 'string' || item.wave.length > 256)) throw new Error('Each signal supports at most 256 wave characters')
      if (item.node !== undefined && (typeof item.node !== 'string' || item.node.length > 256)) throw new Error('Invalid signal node markers')
      if (item.data !== undefined && typeof item.data !== 'string' && !(Array.isArray(item.data) && item.data.every(value => typeof value === 'string'))) throw new Error('Signal data labels must be plain text')
      for (const key of ['period', 'phase']) {
        const value = item[key]
        if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 16 || (key === 'period' && value <= 0))) throw new Error(`Invalid signal ${key}`)
      }
    } else throw new Error('Signals must be objects or named groups')
  }
  return count
}

export function render(request: CodeBlockRenderRequest) {
  // Parse JSON5 as data. Do not use WaveDrom's eval-based DOM convenience API.
  const source: unknown = JSON5.parse(request.source)
  if (!record(source) || !Array.isArray(source.signal)) throw new Error('Provide a WaveJSON object containing a signal array')
  if (validateSignal(source.signal) > 64) throw new Error('Preview supports at most 64 signal lanes')
  for (const key of ['head', 'foot']) if (source[key] !== undefined) {
    const value = source[key]
    if (!record(value) || (value.text !== undefined && typeof value.text !== 'string')) throw new Error('Diagram titles must be plain text')
  }
  if (source.config !== undefined) {
    if (!record(source.config)) throw new Error('Invalid WaveDrom configuration')
    const scale = source.config.hscale
    if (scale !== undefined && (typeof scale !== 'number' || scale < 1 || scale > 4)) throw new Error('Horizontal scale must be between 1 and 4')
    if (source.config.skin && source.config.skin !== 'default') throw new Error('Only the bundled default skin is supported')
  }
  if (source.edge !== undefined && !(Array.isArray(source.edge) && source.edge.every(value => typeof value === 'string'))) throw new Error('Edges must be strings')
  // Upstream mutates the skin while rendering: clone it for every diagram.
  const raw = stringify(renderAny(0, source, JSON.parse(JSON.stringify(waveSkin)) as unknown))
  const parsed = new DOMParser().parseFromString(raw, 'image/svg+xml')
  if (parsed.querySelector('parsererror')) throw new Error('WaveDrom returned invalid SVG')
  const svg = document.importNode(parsed.documentElement, true)
  const allowed = new Set(['svg', 'g', 'defs', 'style', 'symbol', 'use', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'marker', 'title', 'desc'])
  for (const element of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
    if (!allowed.has(element.localName)) { element.remove(); continue }
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name) || (attribute.localName === 'href' && !/^#[\w.:-]+$/.test(attribute.value))) element.removeAttributeNode(attribute)
    }
  }
  document.body.appendChild(svg)
  try {
    // The host intentionally drops style/class. Bake the skin into attributes.
    for (const element of Array.from(svg.querySelectorAll('*'))) {
      if (element.localName === 'style') continue
      const style = getComputedStyle(element)
      for (const property of ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'opacity']) {
        const value = style.getPropertyValue(property)
        if (value) element.setAttribute(property, value)
      }
    }
    svg.querySelectorAll('style').forEach(element => element.remove())
    return new XMLSerializer().serializeToString(svg)
  } finally { svg.remove() }
}
