declare module 'd2-go-runtime'
declare module 'd2-dagre-runtime' {
  interface Graph {
    setDefaultNodeLabel(factory: () => object): Graph
    setDefaultEdgeLabel(factory: () => object): Graph
    setGraph(attributes: object): Graph
    setNode(id: string, attributes: object): Graph
    setParent(child: string, parent: string): Graph
    setEdge(edge: { v: string; w: string; name: string }, attributes: object): Graph
    nodes(): string[]
    edges(): object[]
    node(id: string): unknown
    edge(edge: object): unknown
  }
  const dagre: { graphlib: { Graph: new (options: object) => Graph }; layout(graph: Graph): void }
  export default dagre
}
declare const __D2_DAGRE_SOURCE__: string
declare const __D2_SETUP_SOURCE__: string
