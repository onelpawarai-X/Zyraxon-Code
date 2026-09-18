/**
 * ZYRAXON X - Quantum-Inspired Reasoning
 * Probabilistic decision making, superposition of ideas
 */

type QuantumState = {
  possibilities: Array<{ idea: string; probability: number }>
  collapsed: boolean
  result: string | null
}

export class ZyraxonQuantum {
  private states: QuantumState[] = []
  private maxStates = 100

  async reason(
    input: string,
    context: { graph: any; memory: any; learn: any }
  ): Promise<string> {
    const ideas = this.generateIdeas(input, context)
    const weighted = this.applyWeights(ideas, context)
    const collapsed = this.collapse(weighted)
    return collapsed
  }

  private generateIdeas(input: string, context: any): string[] {
    const ideas: string[] = []
    const keywords = input.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    for (const kw of keywords) {
      const related = context.graph.search(kw)
      for (const r of related.slice(0, 3)) {
        if (r.data?.text) ideas.push(r.data.text)
      }
    }
    if (ideas.length === 0) ideas.push(input)
    return ideas
  }

  private applyWeights(ideas: string[], context: any): QuantumState["possibilities"] {
    return ideas.map(idea => {
      let prob = 0.5
      const rule = context.learn.getRule(idea.split(/\s+/)[0])
      if (rule) prob += rule.confidence * 0.3
      return { idea, probability: Math.min(1, prob) }
    }).sort((a, b) => b.probability - a.probability)
  }

  private collapse(possibilities: QuantumState["possibilities"]): string {
    if (possibilities.length === 0) return ""
    const total = possibilities.reduce((s, p) => s + p.probability, 0)
    let rand = Math.random() * total
    for (const p of possibilities) {
      rand -= p.probability
      if (rand <= 0) return p.idea
    }
    return possibilities[0].idea
  }

  getStates(): QuantumState[] { return [...this.states] }
}
