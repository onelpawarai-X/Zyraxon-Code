/**
 * ZYRAXON X - Self-Learning System
 * Observes patterns, adapts behavior over time
 */

type Observation = {
  type: string
  data: any
  timestamp: number
}

type LearnedRule = {
  pattern: string
  action: string
  confidence: number
  observations: number
}

export class ZyraxonLearn {
  private observations: Observation[] = []
  private rules: Map<string, LearnedRule> = new Map()
  private _running = false
  private _rate = 0
  private parent: any = null
  private maxObs = 1000

  start(parent: any) {
    this.parent = parent
    this._running = true
    this.loadRules()
  }

  stop() {
    this._running = false
    this.saveRules()
  }

  observe(type: string, data: any) {
    if (!this._running) return
    this.observations.push({ type, data, timestamp: Date.now() })
    if (this.observations.length > this.maxObs) this.observations.shift()
    this.analyze()
  }

  private analyze() {
    const recent = this.observations.slice(-20)
    const inputObs = recent.filter(o => o.type === "input")
    if (inputObs.length < 3) return

    const keywords = new Map<string, number>()
    for (const obs of inputObs) {
      const words = String(obs.data.text || "").toLowerCase().split(/\s+/)
      for (const w of words) {
        if (w.length > 2) keywords.set(w, (keywords.get(w) || 0) + 1)
      }
    }

    for (const [word, count] of keywords) {
      if (count >= 2) {
        const key = "word:" + word
        const existing = this.rules.get(key)
        if (existing) {
          existing.observations++
          existing.confidence = Math.min(1, existing.confidence + 0.02)
        } else {
          this.rules.set(key, {
            pattern: word,
            action: "acknowledge",
            confidence: 0.3,
            observations: count,
          })
        }
      }
    }

    this._rate = this.rules.size > 0
      ? Array.from(this.rules.values()).reduce((s, r) => s + r.confidence, 0) / this.rules.size
      : 0
  }

  rate(): number { return this._rate }
  ruleCount(): number { return this.rules.size }

  getRule(pattern: string): LearnedRule | undefined {
    return this.rules.get("word:" + pattern)
  }

  private loadRules() {
    try {
      const saved = localStorage.getItem("zyraxon-x-learn")
      if (saved) {
        const data = JSON.parse(saved)
        this.rules = new Map(Object.entries(data))
      }
    } catch {}
  }

  private saveRules() {
    try {
      localStorage.setItem("zyraxon-x-learn", JSON.stringify(Object.fromEntries(this.rules)))
    } catch {}
  }
}
