import Viewer from 'bpmn-js/lib/Viewer'
import diagramStyles from 'bpmn-js/dist/assets/diagram-js.css'
import bpmnStyles from 'bpmn-js/dist/assets/bpmn-js.css'
import type { CodeBlockRenderRequest } from '@notegen/plugin-api'
import { assertImageSize } from '../../../renderers/svg'

export async function render(request: CodeBlockRenderRequest) {
  if (/<!DOCTYPE|<!ENTITY/i.test(request.source)) throw new Error('XML DTDs and entities are unavailable')
  const xml = new DOMParser().parseFromString(request.source, 'application/xml')
  if (xml.querySelector('parsererror')) throw new Error('Provide valid BPMN 2.0 XML')
  const shapes = xml.getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/DI', 'BPMNShape')
  const edges = xml.getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/DI', 'BPMNEdge')
  if (!shapes.length) throw new Error('BPMN XML must include BPMNDiagram / BPMNPlane and shape layout coordinates')
  if (shapes.length > 300 || edges.length > 600) throw new Error('BPMN preview supports at most 300 shapes and 600 connections')
  const style = document.createElement('style')
  style.textContent = `${diagramStyles}\n${bpmnStyles}`
  document.head.appendChild(style)
  const container = document.createElement('div')
  container.style.cssText = 'width:1000px;height:720px;position:relative'
  document.body.appendChild(container)
  const dark = request.theme === 'dark'
  const viewer = new Viewer({ container, width: 1000, height: 720, bpmnRenderer: { defaultFillColor: dark ? '#1f2937' : '#ffffff', defaultStrokeColor: dark ? '#e5e7eb' : '#1f2937', defaultLabelColor: dark ? '#e5e7eb' : '#1f2937' } })
  try {
    await viewer.importXML(request.source)
    const { svg } = await viewer.saveSVG()
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml')
    const result = parsed.documentElement
    const exportedStyle = parsed.createElementNS('http://www.w3.org/2000/svg', 'style')
    exportedStyle.textContent = `${diagramStyles}\n${bpmnStyles}`
    result.prepend(exportedStyle)
    const box = result.getAttribute('viewBox')?.split(/[\s,]+/).map(Number)
    if (!box || box.length !== 4 || !box.every(Number.isFinite)) throw new Error('BPMN returned invalid diagram dimensions')
    // Preserve the unmodified viewer watermark and include its original SVG in
    // a reserved footer so it also remains visible in the static image export.
    const watermark = container.querySelector('.bjs-powered-by svg')
    if (!watermark) throw new Error('BPMN branding is missing from the viewer')
    const width = Math.max(box[2], 90)
    const height = box[3] + 40
    assertImageSize(width, height)
    result.setAttribute('viewBox', `${box[0]} ${box[1]} ${width} ${height}`)
    const group = parsed.createElementNS('http://www.w3.org/2000/svg', 'g')
    group.setAttribute('transform', `translate(${box[0] + width - 80},${box[1] + box[3] + 8})`)
    const background = parsed.createElementNS('http://www.w3.org/2000/svg', 'rect')
    background.setAttribute('width', '76')
    background.setAttribute('height', '28')
    background.setAttribute('rx', '4')
    background.setAttribute('fill', '#ffffff')
    group.appendChild(background)
    const logo = parsed.importNode(watermark, true)
    logo.setAttribute('x', '7')
    logo.setAttribute('y', '5')
    logo.setAttribute('width', '62')
    logo.setAttribute('height', '18')
    group.appendChild(logo)
    result.appendChild(group)
    return new XMLSerializer().serializeToString(result)
  } finally { viewer.destroy(); container.remove(); style.remove() }
}
