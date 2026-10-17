import { Transformer } from 'markmap-lib/no-plugins'
import { hierarchy, tree, type HierarchyNode } from 'd3-hierarchy'
import type { CodeBlockRenderRequest } from '@notegen/plugin-api'

interface OutlineNode { content: string; children?: OutlineNode[] }
interface Label { lines: string[]; width: number; height: number }
const transformer = new Transformer([])
transformer.md.set({ html: false })
transformer.md.disable('image')
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!)

export function render(request: CodeBlockRenderRequest) {
  if (/!\[[^\]]*\]\(/.test(request.source)) throw new Error('Static mind maps do not support images')
  // No autoloader or transformer plugins: nothing can load a CDN, scripts, fonts
  // or frontmatter-provided assets. Parse headings/lists with Markmap itself.
  const result = transformer.transform(request.source)
  const root = hierarchy<OutlineNode>(result.root)
  const nodes = root.descendants()
  if (nodes.length > 400 || root.height > 20) throw new Error('Mind maps support at most 400 nodes and 20 levels')
  const context = document.createElement('canvas').getContext('2d')
  if (!context) throw new Error('Text measurement is unavailable')
  context.font = '14px sans-serif'
  const labels = new Map<OutlineNode, Label>()
  const columns: number[] = []
  for (const node of nodes) {
    // HTML is parsed inertly and reduced to text. It is never inserted into the
    // live document, and foreignObject is never part of the returned SVG.
    const parsed = new DOMParser().parseFromString(node.data.content, 'text/html')
    parsed.querySelectorAll('br').forEach(br => br.replaceWith('\n'))
    const text = parsed.body.textContent?.trim() || (request.locale.startsWith('zh') ? '思维导图' : 'Mind map')
    if (text.length > 500) throw new Error('Mind map labels support at most 500 characters')
    const lines: string[] = []
    let line = ''
    for (const char of text) {
      if (char === '\n' || (line && context.measureText(line + char).width > 220)) {
        lines.push(line)
        line = char === '\n' ? '' : char
      } else line += char
    }
    if (line || !lines.length) lines.push(line)
    const width = Math.max(24, ...lines.map(value => context.measureText(value).width))
    const label = { lines, width, height: lines.length * 20 + 8 }
    labels.set(node.data, label)
    columns[node.depth] = Math.max(columns[node.depth] ?? 0, width)
  }
  const label = (node: HierarchyNode<OutlineNode>) => labels.get(node.data)!
  const layout = tree<OutlineNode>().nodeSize([1, 1]).separation((a, b) => (label(a).height + label(b).height) / 2 + 18)(root)
  const points = layout.descendants()
  const minY = Math.min(...points.map(node => node.x - label(node).height / 2))
  const maxY = Math.max(...points.map(node => node.x + label(node).height / 2))
  const offsets: number[] = [24]
  for (let depth = 1; depth < columns.length; depth++) offsets[depth] = offsets[depth - 1] + columns[depth - 1] + 64
  const width = Math.ceil(offsets.at(-1)! + columns.at(-1)! + 24)
  const height = Math.ceil(maxY - minY + 48)
  if (width > 8192 || height > 8192 || width * height > 16_777_216) throw new Error('Mind map is too large; split the outline into smaller maps')
  const foreground = request.theme === 'dark' ? '#e5e7eb' : '#1f2937'
  const palette = request.theme === 'dark' ? ['#93c5fd', '#86efac', '#fcd34d', '#c4b5fd', '#f9a8d4'] : ['#2563eb', '#16a34a', '#b45309', '#7c3aed', '#db2777']
  const branches = new Map((layout.children ?? []).map((node, index) => [node.data, index]))
  function color(node: HierarchyNode<OutlineNode>) {
    let branch = node
    while (branch.parent && branch.depth > 1) branch = branch.parent
    return palette[(branches.get(branch.data) ?? 0) % palette.length]
  }
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`]
  for (const { source, target } of layout.links()) {
    const x1 = offsets[source.depth] + label(source).width + 16
    const y1 = source.x - minY + 24
    const x2 = offsets[target.depth]
    const y2 = target.x - minY + 24
    const middle = (x1 + x2) / 2
    parts.push(`<path d="M${x1},${y1} C${middle},${y1} ${middle},${y2} ${x2},${y2}" fill="none" stroke="${color(target)}" stroke-width="2"/>`)
  }
  for (const node of points) {
    const item = label(node)
    const x = offsets[node.depth]
    const y = node.x - minY + 24
    parts.push(`<circle cx="${x}" cy="${y}" r="3" fill="${color(node)}"/>`)
    parts.push(`<text x="${x + 8}" y="${y - item.height / 2 + 17}" fill="${foreground}" font-family="sans-serif" font-size="14">`)
    item.lines.forEach((line, index) => parts.push(`<tspan x="${x + 8}" dy="${index ? 20 : 0}">${escape(line)}</tspan>`))
    parts.push('</text>')
  }
  parts.push('</svg>')
  return parts.join('')
}
