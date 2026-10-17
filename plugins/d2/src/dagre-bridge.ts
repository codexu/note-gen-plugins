import dagre from 'd2-dagre-runtime'

// Protocol adapter for the pinned D2 Go jsrunner. These are the complete command
// templates in d2dagrelayout/layout.go and object_mapper.go, not a JS interpreter.
// Only the dedicated D2 Worker receives this replacement for Go's `eval` call.
export function installDagreBridge() {
  let graph: InstanceType<typeof dagre.graphlib.Graph> | undefined
  const requireGraph = () => {
    if (!graph) throw new Error('D2 layout graph is not initialized')
    return graph
  }
  const number = (value: string) => {
    const result = Number(value)
    if (!Number.isSafeInteger(result) || result < 0 || result > 1_000_000) throw new Error('D2 layout value exceeds the preview limit')
    return result
  }
  const edgeName = (value: string) => value.replace(/\\(\\|n|r)/g, (_, escape: string) => (
    escape === 'n' ? '\n' : escape === 'r' ? '\r' : '\\'
  ))
  const dispatch = (source: unknown): unknown => {
    if (typeof source !== 'string') throw new Error('Invalid D2 layout command')
    // Match the entire pinned upstream scripts. The library is already bundled
    // as executable code; its source string is never passed to a JS evaluator.
    if (source === __D2_DAGRE_SOURCE__) return undefined
    if (source === __D2_SETUP_SOURCE__) {
      graph = new dagre.graphlib.Graph({ compound: true, multigraph: true })
      graph.setDefaultNodeLabel(() => ({}))
      graph.setDefaultEdgeLabel(() => ({}))
      return undefined
    }
    if (source.length > 2 * 1024 * 1024) throw new Error('D2 layout command exceeds the preview limit')
    const config = /^g\.setGraph\(\{\s*ranksep: (\d+),\s*edgesep: (\d+),\s*nodesep: (\d+),\s*rankdir: "(TB|BT|LR|RL)",\s*\}\);\s*$/.exec(source)
    if (config) {
      requireGraph().setGraph({ ranksep: number(config[1]), edgesep: number(config[2]), nodesep: number(config[3]), rankdir: config[4] })
      return undefined
    }
    if (source === 'dagre.layout(g)') {
      dagre.layout(requireGraph())
      return undefined
    }
    const query = /^JSON\.stringify\(g\.(node|edge)\(g\.(nodes|edges)\(\)\[(\d+)\]\)\)$/.exec(source)
    if (query) {
      const current = requireGraph()
      const index = number(query[3])
      if (query[1] === 'node' && query[2] === 'nodes') {
        const id = current.nodes()[index]
        if (id === undefined) throw new Error('Invalid D2 node index')
        return JSON.stringify(current.node(id))
      }
      if (query[1] === 'edge' && query[2] === 'edges') {
        const edge = current.edges()[index]
        if (!edge) throw new Error('Invalid D2 edge index')
        return JSON.stringify(current.edge(edge))
      }
      throw new Error('Unsupported D2 layout query')
    }
    let rest = source
    let count = 0
    while (rest.length) {
      if (++count > 1800) throw new Error('D2 layout exceeds the preview limit')
      const node = /^g\.setNode\(`(\d+)`, \{ id: `(\d+)`, width: (\d+), height: (\d+) \}\);\n/.exec(rest)
      const parent = /^g\.setParent\(`(\d+)`, `(\d+)`\);\n/.exec(rest)
      const edge = /^g\.setEdge\(\{v:`(\d+)`, w:`(\d+)`, name:`([^`]*)`\}, \{ width:(\d+), height:(\d+), labelpos: `c` \}\);\n/.exec(rest)
      if (node && node[1] === node[2]) {
        requireGraph().setNode(node[1], { id: node[1], width: number(node[3]), height: number(node[4]) })
        rest = rest.slice(node[0].length)
      } else if (parent) {
        requireGraph().setParent(parent[1], parent[2])
        rest = rest.slice(parent[0].length)
      } else if (edge) {
        requireGraph().setEdge({ v: edge[1], w: edge[2], name: edgeName(edge[3]) }, { width: number(edge[4]), height: number(edge[5]), labelpos: 'c' })
        rest = rest.slice(edge[0].length)
      } else {
        throw new Error('Unsupported D2 layout command; this preview requires the pinned D2 engine')
      }
    }
    return undefined
  }
  Object.defineProperty(globalThis, 'eval', { value: dispatch, writable: false, configurable: false })
}
