import { registerSvgRenderer } from '../../../renderers/code-block-renderer'

registerSvgRenderer('module', {
  moduleAssets: ['dist/engine-0.bin', 'dist/engine-1.bin', 'dist/engine-2.bin', 'dist/engine-3.bin'],
  inlineStyles: true,
})
