import { exportToSvg } from '@excalidraw/utils'
import type { CodeBlockRenderRequest } from '@notegen/plugin-api'

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function validateData(value: unknown, depth = 0) {
  if (depth > 32) throw new Error('Scene JSON is nested too deeply')
  if (Array.isArray(value)) {
    if (value.length > 5000) throw new Error('Scene arrays support at most 5,000 entries')
    value.forEach(item => validateData(item, depth + 1))
  } else if (record(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsupported scene property')
      validateData(item, depth + 1)
    }
  }
}

export async function render(request: CodeBlockRenderRequest) {
  const scene: unknown = JSON.parse(request.source)
  validateData(scene)
  if (!record(scene) || scene.type !== 'excalidraw' || !Array.isArray(scene.elements)) throw new Error('Provide a complete Excalidraw JSON scene with type and elements')
  if (scene.files !== undefined && scene.files !== null && (!record(scene.files) || Object.keys(scene.files).length)) throw new Error('Image files and attachments are unavailable in static offline scenes')
  if (scene.elements.length > 400) throw new Error('Excalidraw preview supports at most 400 elements')
  const allowed = new Set(['rectangle', 'ellipse', 'diamond', 'line', 'arrow', 'freedraw', 'text'])
  const elements: Record<string, unknown>[] = []
  const ids = new Set<string>()
  for (const input of scene.elements) {
    if (!record(input)) throw new Error('Invalid scene element')
    if (input.isDeleted === true) continue
    if (typeof input.type !== 'string' || !allowed.has(input.type)) throw new Error('Only basic shapes, arrows, freehand strokes and text are supported')
    if (typeof input.id !== 'string' || ids.has(input.id)) throw new Error('Scene elements must have unique IDs')
    ids.add(input.id)
    if (input.link || input.fileId) throw new Error('Links, images and embedded content are unavailable')
    for (const property of ['x', 'y', 'width', 'height', 'angle']) {
      const value = input[property]
      if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 100_000 || (['width', 'height'].includes(property) && value < 0)) throw new Error(`Invalid element ${property}`)
    }
    if (typeof input.seed !== 'number' || !Number.isFinite(input.seed)) throw new Error('Import a complete exported scene with deterministic element seeds')
    for (const property of ['strokeColor', 'backgroundColor']) {
      const value = input[property]
      if (typeof value !== 'string' || !CSS.supports('color', value)) throw new Error(`Invalid element ${property}`)
    }
    if (input.type === 'text' && (typeof input.text !== 'string' || typeof input.fontSize !== 'number' || input.fontSize < 1 || input.fontSize > 256)) throw new Error('Text elements require text and a font size between 1 and 256')
    if (['line', 'arrow', 'freedraw'].includes(input.type)) {
      if (!Array.isArray(input.points) || input.points.length > 5000 || !input.points.every(point => Array.isArray(point) && point.length === 2 && point.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 100_000))) throw new Error('Invalid drawing points')
    }
    // Helvetica maps to a system sans-serif font; no bundled/custom font fetches.
    elements.push({ ...input, isDeleted: false, ...(input.type === 'text' ? { fontFamily: 2 } : {}) })
  }
  if (!elements.length) throw new Error('The scene has no supported visible elements')
  // Utilities accept fully exported elements; this is a viewer, not a scene
  // migration/editor API. Image/embeddable elements are rejected before export.
  const svg = await exportToSvg({
    data: { elements: elements as unknown as Parameters<typeof exportToSvg>[0]['data']['elements'], files: null },
    config: { padding: 16, canvasBackgroundColor: false, theme: request.theme, renderEmbeddables: false, skipInliningFonts: true },
  })
  return new XMLSerializer().serializeToString(svg)
}
