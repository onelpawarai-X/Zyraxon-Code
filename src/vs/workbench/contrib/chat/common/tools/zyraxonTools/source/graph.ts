/**
 * ZYRAXON X - Knowledge Graph
 * Nodes + edges, relationship tracking, query
 */

type GraphNode = {
  id: string
  type: string
  data: any
  edges: string[]
  created: number
}

export class ZyraxonGraph {
  private nodes: Map<string, GraphNode> = new Map()
  private edgeIndex: Map<string, Set<string>> = new Map()

  init() {
    try {
      const saved = localStorage.getItem("zyraxon-x-graph")
      if (saved) {
        const data = JSON.parse(saved)
        this.nodes = new Map(Object.entries(data))
        for (const [id, node] of this.nodes) {
          for (const edge of (node as GraphNode).edges) {
            if (!this.edgeIndex.has(edge)) this.edgeIndex.set(edge, new Set())
            this.edgeIndex.get(edge)!.add(id)
          }
        }
      }
    } catch {}
  }

  addNode(id: string, type: string, data: any): void {
    const existing = this.nodes.get(id)
    if (existing) {
      existing.data = { ...existing.data, ...data }
    } else {
      this.nodes.set(id, { id, type, data, edges: [], created: Date.now() })
    }
  }

  addEdge(from: string, to: string): void {
    const node = this.nodes.get(from)
    if (node && !node.edges.includes(to)) {
      node.edges.push(to)
      if (!this.edgeIndex.has(to)) this.edgeIndex.set(to, new Set())
      this.edgeIndex.get(to)!.add(from)
    }
  }

  addObservation(type: string, data: any): void {
    const id = type + "_" + Date.now()
    this.addNode(id, type, data)
    const recent = this.findRecent(type, 1)
    if (recent.length >= 2) this.addEdge(recent[0].id, id)
    if (this.nodes.size % 10 === 0) this.save()
  }

  findRecent(type: string, limit = 5): GraphNode[] {
    return Array.from(this.nodes.values())
      .filter(n => n.type === type)
      .sort((a, b) => b.created - a.created)
      .slice(0, limit)
  }

  findByType(type: string): GraphNode[] {
    return Array.from(this.nodes.values()).filter(n => n.type === type)
  }

  findById(id: string): GraphNode | undefined { return this.nodes.get(id) }

  findConnected(id: string): GraphNode[] {
    const node = this.nodes.get(id)
    if (!node) return []
    return node.edges.map(e => this.nodes.get(e)).filter(Boolean) as GraphNode[]
  }

  search(query: string): GraphNode[] {
    const q = query.toLowerCase()
    return Array.from(this.nodes.values())
      .filter(n => JSON.stringify(n.data).toLowerCase().includes(q))
  }

  nodeCount(): number { return this.nodes.size }

  private save() {
    try {
      localStorage.setItem("zyraxon-x-graph", JSON.stringify(Object.fromEntries(this.nodes)))
    } catch {}
  }
}
