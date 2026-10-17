import { registerSvgRenderer } from '../../../shared/code-block-renderer'

registerSvgRenderer('worker', {
  workerAssets: ['dist/d2-wasm-0.bin', 'dist/d2-wasm-1.bin'],
  inlineStyles: true,
})
