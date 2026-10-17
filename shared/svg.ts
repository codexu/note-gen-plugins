import type { CodeBlockRenderRequest } from '@notegen/plugin-api'

export function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!)
}

export function assertImageSize(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 8192 || height > 8192 || width * height > 16_777_216) throw new Error('Diagram is too large; split it into smaller blocks')
}

export function serveSvgWorker(render: (request: CodeBlockRenderRequest) => string | Promise<string>) {
  const scope = globalThis as unknown as {
    onmessage: ((event: MessageEvent<CodeBlockRenderRequest>) => void) | null
    postMessage(value: { svg: string } | { error: string }): void
  }
  scope.onmessage = ({ data }) => {
    void Promise.resolve().then(() => render(data)).then(
      svg => scope.postMessage({ svg }),
      reason => scope.postMessage({ error: reason instanceof Error ? reason.message : String(reason) }),
    )
  }
}
