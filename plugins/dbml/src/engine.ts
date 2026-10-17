import { Compiler, DEFAULT_ENTRY, MemoryProjectLayout, getMultiplicities, type RefEndpoint } from '@dbml/parse'
import { Graph, layout, type GraphLabel, type NodeLabel, type EdgeLabel } from '@dagrejs/dagre'
import { assertImageSize, escapeXml, serveSvgWorker } from '../../../shared/svg'

serveSvgWorker(request => {
  const files = new MemoryProjectLayout()
  files.setSource(DEFAULT_ENTRY, request.source)
  const compiler = new Compiler(files)
  const errors = compiler.parse.errors(DEFAULT_ENTRY)
  if (errors.length) throw new Error(errors.slice(0, 3).map(error => error.message).join('\n'))
  const database = compiler.parse.rawDb(DEFAULT_ENTRY)
  if (!database?.tables.length) throw new Error('Provide DBML containing at least one table')
  const tables = database.tables
  if (tables.length > 50 || tables.reduce((count, table) => count + table.fields.length, 0) > 500) throw new Error('DBML preview supports at most 50 tables and 500 fields')
  const id = (schema: string | null, table: string) => JSON.stringify([schema ?? 'public', table])
  const graph = new Graph<GraphLabel, NodeLabel, EdgeLabel>({ multigraph: true })
  graph.setGraph({ rankdir: 'LR', nodesep: 36, ranksep: 120, marginx: 24, marginy: 24 })
  graph.setDefaultEdgeLabel(() => ({}))
  const titles = new Map<string, string>()
  const rows = new Map<string, string[]>()
  const aliases = new Map<string, string>()
  for (const table of tables) {
    if (table.partials.length) throw new Error('TablePartial expansion is unavailable in this preview; declare fields directly in each table')
    const key = id(table.schemaName, table.name)
    const title = table.schemaName ? `${table.schemaName}.${table.name}` : table.name
    const fields = table.fields.map(field => `${field.pk ? 'PK ' : ''}${field.name}: ${field.type.type_name}${field.type.args ?? ''}${field.not_null ? ' NOT NULL' : ''}`)
    if ([title, ...fields].some(text => text.length > 100)) throw new Error('Table and field labels support at most 100 characters')
    const textWidth = (text: string) => [...text].reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 14 : 8), 0)
    const width = Math.max(220, ...[title, ...fields].map(text => textWidth(text) + 24))
    graph.setNode(key, { width, height: 34 + fields.length * 22 + 10 })
    titles.set(key, title)
    rows.set(key, fields)
    if (table.alias) aliases.set(table.alias, key)
  }
  const seen = new Set<string>()
  const connect = (left: RefEndpoint, right: RefEndpoint) => {
    const resolveTable = (endpoint: RefEndpoint) => {
      const key = id(endpoint.schemaName, endpoint.tableName)
      return graph.hasNode(key) ? key : aliases.get(endpoint.tableName) ?? key
    }
    const a = resolveTable(left)
    const b = resolveTable(right)
    if (!graph.hasNode(a) || !graph.hasNode(b)) throw new Error('A relationship references a table outside this code block')
    const edgeKey = JSON.stringify([a, left.fieldNames, b, right.fieldNames])
    if (seen.has(edgeKey)) return
    seen.add(edgeKey)
    if (seen.size > 200) throw new Error('DBML preview supports at most 200 relationships')
    const label = `${left.fieldNames.join(',')} [${left.relation}] → ${right.fieldNames.join(',')} [${right.relation}]`
    graph.setEdge(a, b, { label, width: Math.min(420, label.length * 7), height: 20 }, String(seen.size))
  }
  for (const reference of database.refs) connect(...reference.endpoints)
  for (const table of tables) for (const field of table.fields) for (const reference of field.inline_refs) {
    const relations = getMultiplicities(reference.relation)
    if (!relations) throw new Error('Unsupported DBML relationship')
    connect(
      { schemaName: table.schemaName, tableName: table.name, fieldNames: [field.name], relation: relations[0], token: reference.token },
      { schemaName: reference.schemaName ?? table.schemaName, tableName: reference.tableName, fieldNames: reference.fieldNames, relation: relations[1], token: reference.token },
    )
  }
  layout(graph)
  const width = Math.ceil(graph.graph().width ?? 0)
  const height = Math.ceil(graph.graph().height ?? 0)
  assertImageSize(width, height)
  const dark = request.theme === 'dark'
  const text = dark ? '#e5e7eb' : '#1f2937'
  const border = dark ? '#94a3b8' : '#64748b'
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="sans-serif" font-size="13">`]
  for (const edge of graph.edges()) {
    const value = graph.edge(edge)
    const points = value.points ?? []
    if (points.length) parts.push(`<path d="${points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ')}" fill="none" stroke="${border}" stroke-width="1.5"/>`)
    if (value.label && typeof value.x === 'number' && typeof value.y === 'number') parts.push(`<text x="${value.x}" y="${value.y - 5}" text-anchor="middle" fill="${text}" font-size="11">${escapeXml(String(value.label))}</text>`)
  }
  for (const key of graph.nodes()) {
    const node = graph.node(key)
    const x = node.x! - node.width! / 2
    const y = node.y! - node.height! / 2
    parts.push(`<g transform="translate(${x},${y})"><rect width="${node.width}" height="${node.height}" rx="6" fill="${dark ? '#111827' : '#ffffff'}" stroke="${border}"/><rect width="${node.width}" height="32" rx="6" fill="${dark ? '#334155' : '#e2e8f0'}"/><text x="12" y="21" font-weight="bold" fill="${text}">${escapeXml(titles.get(key)!)}</text>`)
    rows.get(key)!.forEach((row, index) => parts.push(`<text x="12" y="${51 + index * 22}" fill="${text}">${escapeXml(row)}</text>`))
    parts.push('</g>')
  }
  parts.push('</svg>')
  return parts.join('')
})
