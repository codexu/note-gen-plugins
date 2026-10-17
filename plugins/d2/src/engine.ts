// Bundle the official Go browser runtime as code, rather than evaluating strings.
import 'd2-go-runtime'
import { installDagreBridge } from './dagre-bridge'
import type { CodeBlockRenderRequest } from '@notegen/plugin-api'

interface D2Runtime {
  compile(input: string): Promise<string>
  render(input: string): Promise<string>
}
interface GoRuntime { importObject: WebAssembly.Imports; run(instance: WebAssembly.Instance): Promise<void> }
const scope = globalThis as unknown as {
  Go: new () => GoRuntime
  d2?: D2Runtime
  elkLayoutSync?: () => never
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  postMessage(value: { svg: string } | { error: string }): void
}
let runtime: Promise<D2Runtime> | null = null
const errorText = (reason: unknown) => reason instanceof Error ? reason.message : String(reason)

async function initialize(assets: Uint8Array[]) {
  if (typeof DecompressionStream === 'undefined') throw new Error('This WebView does not support offline D2 decompression')
  const parts = assets.map(asset => new Uint8Array(asset))
  const compressed = new Blob(parts)
  const bytes = await new Response(compressed.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
  const go = new scope.Go()
  // The WASM's fixed JS commands use a static Dagre bridge, never string evaluation.
  installDagreBridge()
  scope.elkLayoutSync = () => { throw new Error('Only the Dagre layout is available in this offline D2 preview') }
  const instance = await WebAssembly.instantiate(bytes, go.importObject)
  void go.run(instance.instance).catch(reason => scope.postMessage({ error: errorText(reason) }))
  if (!scope.d2) throw new Error('The D2 runtime did not initialize')
  return scope.d2
}

function unwrap(source: string): unknown {
  const response: unknown = JSON.parse(source)
  if (!response || typeof response !== 'object') throw new Error('Invalid D2 engine response')
  if ('error' in response && response.error) {
    const reason = response.error
    throw new Error(typeof reason === 'object' && 'message' in reason ? String(reason.message) : String(reason))
  }
  if (!('data' in response)) throw new Error('Missing D2 result')
  return response.data
}

function validateDiagram(value: unknown, depth = 0) {
  if (depth > 40) throw new Error('D2 diagram nesting exceeds the preview limit')
  if (Array.isArray(value)) {
    if (value.length > 600) throw new Error('D2 preview supports at most 600 entries per collection')
    value.forEach(item => validateDiagram(item, depth + 1))
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if ((['icon', 'link'].includes(key) && item) || (key === 'type' && item === 'image') || (key === 'language' && item && item !== 'text')) {
        throw new Error('D2 preview supports plain text only; images, links, Markdown and LaTeX labels are unavailable')
      }
      if (['layers', 'scenarios', 'steps'].includes(key) && Array.isArray(item) && item.length) throw new Error('D2 preview supports a single static board')
      validateDiagram(item, depth + 1)
    }
  }
}

async function render(request: CodeBlockRenderRequest) {
  if (!runtime) throw new Error('D2 engine assets are not initialized')
  // Compile against a single in-memory file; no note directory or import loader.
  const d2 = await runtime
  const options = { layout: 'dagre', themeID: request.theme === 'dark' ? 200 : 0, pad: 24, scale: 1, noXMLTag: true, sketch: false, animateInterval: 0 }
  const compiled = unwrap(await d2.compile(JSON.stringify({ fs: { index: request.source }, inputPath: 'index', options })))
  if (!compiled || typeof compiled !== 'object' || !('diagram' in compiled)) throw new Error('D2 compilation returned no diagram')
  validateDiagram(compiled.diagram)
  const svg = unwrap(await d2.render(JSON.stringify({ diagram: compiled.diagram, options })))
  if (typeof svg !== 'string') throw new Error('D2 returned invalid SVG data')
  return new TextDecoder().decode(Uint8Array.from(atob(svg), char => char.charCodeAt(0)))
}

scope.onmessage = ({ data }) => {
  if (data && typeof data === 'object' && 'type' in data && data.type === 'init' && 'assets' in data && Array.isArray(data.assets)) {
    runtime = initialize(data.assets as Uint8Array[])
    void runtime.catch(() => {}) // Report initialization failures through the render response.
    return
  }
  if (!data || typeof data !== 'object' || !('source' in data) || typeof data.source !== 'string') return
  void render(data as CodeBlockRenderRequest).then(svg => scope.postMessage({ svg }), reason => scope.postMessage({ error: errorText(reason) }))
}
