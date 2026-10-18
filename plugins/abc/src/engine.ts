import renderAbc from 'abcjs/src/api/abc_tunebook_svg'
import type { CodeBlockRenderRequest } from '@notegen/plugin-api'
import { assertImageSize } from '../../../renderers/svg'

export function render(request: CodeBlockRenderRequest) {
  if ((request.source.match(/^X\s*:/gm)?.length ?? 0) !== 1 || !/^K\s*:/m.test(request.source)) throw new Error('Provide one ABC tune with X: and K: headers')
  if (/^\s*%%(?:abc-include|include|beginps|begintext|beginhtml)\b/im.test(request.source)) throw new Error('External includes and embedded markup are unavailable')
  const container = document.createElement('div')
  container.style.cssText = 'width:780px;position:relative'
  document.body.appendChild(container)
  try {
    const tunes = renderAbc(container, request.source, { staffwidth: 720, paddingtop: 16, paddingbottom: 16, paddingleft: 16, paddingright: 16, foregroundColor: request.theme === 'dark' ? '#e5e7eb' : '#1f2937', add_classes: false, selectTypes: false, oneSvgPerLine: false })
    const warnings = tunes.flatMap(tune => tune.warnings ?? [])
    if (warnings.length) {
      const warning = new DOMParser().parseFromString(warnings[0], 'text/html').body.textContent
      throw new Error(warning || 'ABC syntax is not supported')
    }
    const images = container.querySelectorAll('svg')
    if (images.length !== 1) throw new Error('Preview supports one tune on one SVG page; split longer music into separate blocks')
    const svg = images[0]
    const width = Number.parseFloat(svg.getAttribute('width') ?? '')
    const height = Number.parseFloat(svg.getAttribute('height') ?? '')
    assertImageSize(width, height)
    if (!svg.hasAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    return new XMLSerializer().serializeToString(svg)
  } finally { container.remove() }
}
