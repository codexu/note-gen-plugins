import { instance } from '@viz-js/viz'
import type { CodeBlockRenderRequest } from '@notegen/plugin-api'

let viz: ReturnType<typeof instance> | null = null
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<CodeBlockRenderRequest>) => void) | null
  postMessage(value: { svg: string } | { error: string }): void
}
scope.onmessage = ({ data }) => {
  void (async () => {
    // The WASM engine and layout execute in this plugin's dedicated Worker.
    // No filesystem or image assets are supplied to Graphviz.
    if (/\b(?:image|shapefile|imagepath|fontpath)\s*=/i.test(data.source) || /<\s*img\b/i.test(data.source)) {
      throw new Error(data.locale.startsWith('zh') ? '离线预览不支持外部图片或文件。' : 'External images and files are not supported in offline previews.')
    }
    viz ??= instance().catch(reason => { viz = null; throw reason })
    const dark = data.theme === 'dark'
    const color = dark ? '#e5e7eb' : '#1f2937'
    return (await viz).renderString(data.source, {
      format: 'svg', engine: 'dot',
      graphAttributes: { bgcolor: 'transparent', fontcolor: color },
      nodeAttributes: { color, fontcolor: color, fontname: 'sans-serif' },
      edgeAttributes: { color, fontcolor: color, fontname: 'sans-serif' },
    })
  })().then(svg => scope.postMessage({ svg }), reason => scope.postMessage({ error: reason instanceof Error ? reason.message : String(reason) }))
}
