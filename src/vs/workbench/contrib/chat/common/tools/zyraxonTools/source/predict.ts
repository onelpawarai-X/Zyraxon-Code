/**
 * ZYRAXON X - Predictive Intelligence
 * Pattern recognition + next-action prediction
 */

type Pattern = {
  id: string
  input: string
  output: string
  weight: number
  hits: number
}

export class ZyraxonPredict {
  private patterns: Map<string, Pattern> = new Map()
  private sequence: string[] = []
  private maxSequence = 50

  predictNext(input: string): { action: string; confidence: number } | null {
    this.sequence.push(input)
    if (this.sequence.length > this.maxSequence) this.sequence.shift()

    const matches = this.findMatches(input)
    if (matches.length === 0) return null

    const best = matches.reduce((a, b) => (b.weight > a.weight ? b : a))
    return { action: best.output, confidence: Math.min(best.weight, 1) }
  }

  private findMatches(input: string): Pattern[] {
    const results: Pattern[] = []
    const words = input.toLowerCase().split(/\s+/)
    for (const p of this.patterns.values()) {
      const pWords = p.input.toLowerCase().split(/\s+/)
      const overlap = words.filter(w => pWords.includes(w)).length
      if (overlap > 0) {
        results.push({ ...p, weight: (overlap / Math.max(words.length, pWords.length)) * p.weight })
      }
    }
    return results
  }

  train(input: string, output: string): void {
    const key = input.toLowerCase().trim()
    const existing = this.patterns.get(key)
    if (existing) {
      existing.hits++
      existing.weight = Math.min(1, existing.weight + 0.05)
    } else {
      this.patterns.set(key, {
        id: key,
        input, output,
        weight: 0.5,
        hits: 1,
      })
    }
  }

  size(): number { return this.patterns.size }
}
