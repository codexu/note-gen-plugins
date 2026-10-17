import { registerCodeBlockRenderer, type CodeBlockRendererContext } from '@notegen/plugin-api'

interface PlantUmlEngine {
  renderToString(lines: string[], success: (svg: string) => void, failure: (error: string) => void, options: { dark: boolean; maxSvgSize: number }): void
}
interface PlantUmlGlobals {
  PLANTUML_STDLIB_LOADER?: (name: string, success: () => void, failure: (error: string) => void) => boolean
}
const globals = globalThis as typeof globalThis & PlantUmlGlobals
let enginePromise: Promise<PlantUmlEngine> | null = null
const urls: string[] = []
window.addEventListener('pagehide', () => urls.forEach(url => URL.revokeObjectURL(url)), { once: true })

async function assetUrl(context: CodeBlockRendererContext, path: string) {
  const bytes = await context.readAsset(path)
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'text/javascript' }))
  urls.push(url)
  return url
}
async function loadClassic(context: CodeBlockRendererContext, path: string) {
  const url = await assetUrl(context, path)
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = url
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Unable to load bundled PlantUML resource: ${path}`))
    document.head.appendChild(script)
  })
}
function loadEngine(context: CodeBlockRendererContext): Promise<PlantUmlEngine> {
  if (!enginePromise) enginePromise = (async () => {
    // The official browser engine uses SVG DOM measurements and runs in the
    // host's shared opaque iframe.
    // No CDN, server, Java, arbitrary includes or filesystem bridge is used.
    globals.PLANTUML_STDLIB_LOADER = (_name, _success, failure) => { failure('This standard library is not bundled in the offline PlantUML plugin'); return true }
    await loadClassic(context, 'dist/viz-global.js')
    await loadClassic(context, 'dist/themes.js')
    await loadClassic(context, 'dist/emoji.js')
    await loadClassic(context, 'dist/openiconic.js')
    const url = await assetUrl(context, 'dist/plantuml.js')
    const module: unknown = await import(/* webpackIgnore: true */ url)
    if (!module || typeof module !== 'object' || !('renderToString' in module) || typeof module.renderToString !== 'function') throw new Error('Bundled PlantUML engine is unavailable')
    return module as PlantUmlEngine
  })()
  return enginePromise
}

registerCodeBlockRenderer(async (request, context) => {
  const chinese = request.locale.startsWith('zh')
  const fail = (en: string, zh: string): never => { throw new Error(chinese ? zh : en) }
  if (new TextEncoder().encode(request.source).length > 32 * 1024 || request.source.split(/\r\n|\r|\n/).length > 1000) {
    fail('PlantUML preview is limited to 32 KiB and 1,000 lines.', 'PlantUML 预览最多支持 32 KiB、1,000 行源码。')
  }
  if (!/^\s*@start\w+/im.test(request.source) || !/^\s*@end\w+/im.test(request.source)) {
    fail('Provide a complete diagram, including @startuml and @enduml (or the matching diagram markers).', '请提供完整图表，包含 @startuml 和 @enduml（或对应图表的起止标记）。')
  }
  if (/^\s*!(?:include\w*|import)\b/im.test(request.source) || /^\s*!theme\s+\S+\s+from\b/im.test(request.source)) {
    fail('File, network and external library includes are not supported in this offline preview.', '当前离线预览不支持文件、网络或外部标准库引用。')
  }
  const engine = await loadEngine(context)
  const svg = await new Promise<string>((resolve, reject) => {
    engine.renderToString(request.source.split(/\r\n|\r|\n/), resolve, error => reject(new Error(error)), { dark: request.theme === 'dark', maxSvgSize: 8192 })
  })
  return { type: 'svg', svg }
})
