import { registerCodeBlockRenderer, type CodeBlockRenderRequest, type CodeBlockRendererContext } from '@notegen/plugin-api'

type Render = (request: CodeBlockRenderRequest) => string | Promise<string>

function message(reason: unknown) { return reason instanceof Error ? reason.message : String(reason) }

/** Every installed package receives its own bundled copy; no cross-plugin runtime dependency. */
export function registerSvgRenderer(mode: 'module' | 'worker' = 'module', options: { workerAssets?: string[]; moduleAssets?: string[]; inlineStyles?: boolean } = {}) {
  let engine: Promise<Render> | null = null
  let worker: Worker | null = null
  let workerUrl: string | null = null
  let pending: { resolve(value: string): void; reject(reason: Error): void } | null = null
  const urls = new Set<string>()
  const resetWorker = () => {
    worker?.terminate()
    worker = null
    engine = null
    if (workerUrl) { URL.revokeObjectURL(workerUrl); urls.delete(workerUrl); workerUrl = null }
  }
  window.addEventListener('pagehide', () => {
    resetWorker()
    pending?.reject(new Error('Renderer closed'))
    urls.forEach(url => URL.revokeObjectURL(url))
  }, { once: true })

  async function initialize(context: CodeBlockRendererContext): Promise<Render> {
    let bytes: Uint8Array
    if (options.moduleAssets?.length) {
      if (typeof DecompressionStream === 'undefined') throw new Error('This WebView does not support compressed offline renderer assets')
      const parts: Uint8Array<ArrayBuffer>[] = []
      for (const path of options.moduleAssets) parts.push(new Uint8Array(await context.readAsset(path)))
      const stream = new Blob(parts).stream().pipeThrough(new DecompressionStream('gzip'))
      bytes = new Uint8Array(await new Response(stream).arrayBuffer())
      if (bytes.length > 32 * 1024 * 1024) throw new Error('Decompressed rendering engine exceeds the limit')
    } else bytes = await context.readAsset('dist/engine.js')
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'text/javascript' }))
    urls.add(url)
    try {
      if (mode === 'worker') {
        worker = new Worker(url, { type: 'module' })
        workerUrl = url
        worker.onmessage = ({ data }: MessageEvent<unknown>) => {
          if (!data || typeof data !== 'object') return
          if ('svg' in data && typeof data.svg === 'string') pending?.resolve(data.svg)
          else pending?.reject(new Error('error' in data ? String(data.error) : 'Invalid renderer response'))
        }
        worker.onerror = event => { event.preventDefault(); pending?.reject(new Error(event.message || 'Rendering worker failed')); resetWorker() }
        if (options.workerAssets?.length) {
          const assets: Uint8Array<ArrayBuffer>[] = []
          for (const path of options.workerAssets) assets.push(new Uint8Array(await context.readAsset(path)))
          worker.postMessage({ type: 'init', assets }, assets.map(asset => asset.buffer))
        }
        return request => new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => { resetWorker(); pending?.reject(new Error('Diagram rendering timed out')) }, 12_000)
          pending = {
            resolve: svg => { clearTimeout(timer); pending = null; resolve(svg) },
            reject: reason => { clearTimeout(timer); pending = null; reject(reason) },
          }
          worker?.postMessage(request)
        })
      }
      const module: unknown = await import(/* webpackIgnore: true */ url)
      if (!module || typeof module !== 'object' || !('render' in module) || typeof module.render !== 'function') throw new Error('Bundled rendering engine is unavailable')
      return module.render as Render
    } finally {
      // A Worker may still be fetching its entry after its constructor returns.
      if (mode !== 'worker' || workerUrl !== url) {
        URL.revokeObjectURL(url)
        urls.delete(url)
      }
    }
  }

  registerCodeBlockRenderer(async (request, context) => {
    if (new TextEncoder().encode(request.source).length > 32 * 1024 || request.source.split(/\r\n|\r|\n/).length > 1000) {
      throw new Error(request.locale.startsWith('zh') ? '预览最多支持 32 KiB、1,000 行源码。' : 'Preview is limited to 32 KiB and 1,000 lines.')
    }
    engine ??= initialize(context).catch(reason => { engine = null; throw reason })
    const render = await engine
    try { return { type: 'svg', svg: normalizeSvg(await render(request), options.inlineStyles) } }
    catch (reason) { throw new Error(message(reason)) }
  })
}

/** Normalize generated SVG dimensions and omit Graphviz's XML declaration/DTD.
 * The host still independently rebuilds the result using its SVG allowlist.
 */
function normalizeSvg(source: string, inlineStyles = false) {
  if (new TextEncoder().encode(source).length > 2 * 1024 * 1024) throw new Error('Diagram output exceeds 2 MiB')
  if (/<!ENTITY/i.test(source)) throw new Error('SVG entities are not supported')
  const parsed = new DOMParser().parseFromString(source.replace(/<!DOCTYPE[^>]*>/gi, ''), 'image/svg+xml')
  const svg = parsed.documentElement
  if (parsed.querySelector('parsererror') || svg.localName !== 'svg') throw new Error('Rendering engine returned invalid SVG')
  const box = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (box?.length === 4 && box.every(Number.isFinite)) {
    svg.setAttribute('width', String(Math.ceil(box[2])))
    svg.setAttribute('height', String(Math.ceil(box[3])))
  }
  if (inlineStyles) {
    // Only generator output is attached, inside the isolated rendering iframe.
    // Remove active/HTML/external content before measuring CSS presentation.
    const allowed = new Set(['svg', 'g', 'defs', 'style', 'symbol', 'use', 'title', 'desc', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'clipPath', 'mask', 'marker', 'linearGradient', 'radialGradient', 'stop', 'pattern', 'filter', 'feGaussianBlur', 'feOffset', 'feBlend', 'feColorMatrix', 'feFlood', 'feComposite', 'feMerge', 'feMergeNode'])
    for (const element of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
      if (!allowed.has(element.localName)) { element.remove(); continue }
      for (const attribute of Array.from(element.attributes)) {
        if (/^on/i.test(attribute.name) || (attribute.localName === 'href' && !/^#[\w.:-]+$/.test(attribute.value))) element.removeAttributeNode(attribute)
      }
    }
    const live = document.importNode(svg, true)
    document.body.appendChild(live)
    try {
      for (const element of [live, ...Array.from(live.querySelectorAll('*'))]) {
        if (element.localName === 'style') continue
        const style = getComputedStyle(element)
        for (const property of ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'opacity']) {
          const value = style.getPropertyValue(property)
          if (value) element.setAttribute(property, value)
        }
      }
      live.querySelectorAll('style').forEach(element => element.remove())
      return new XMLSerializer().serializeToString(live)
    } finally { live.remove() }
  }
  return new XMLSerializer().serializeToString(svg)
}
