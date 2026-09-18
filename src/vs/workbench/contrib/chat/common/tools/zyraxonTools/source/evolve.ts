/**
 * ZYRAXON X - Self-Evolution System
 * Tracks improvements, version upgrades, capability growth
 */

type EvolutionStep = {
  version: string
  changes: string[]
  timestamp: number
  metrics: Record<string, number>
}

export class ZyraxonEvolve {
  private steps: EvolutionStep[] = []
  private _step = 0
  private capabilities: Map<string, number> = new Map()

  step(): number { return this._step }

  addCapability(name: string, level = 0.1) {
    this.capabilities.set(name, Math.min(1, level))
  }

  improveCapability(name: string, delta = 0.05) {
    const current = this.capabilities.get(name) || 0
    this.capabilities.set(name, Math.min(1, current + delta))
  }

  recordStep(changes: string[], metrics: Record<string, number> = {}) {
    this._step++
    const version = "1.0." + this._step
    this.steps.push({
      version, changes, metrics,
      timestamp: Date.now(),
    })
    this.save()
  }

  getCapabilities(): Record<string, number> {
    return Object.fromEntries(this.capabilities)
  }

  getHistory(): EvolutionStep[] { return [...this.steps] }

  private save() {
    try {
      localStorage.setItem("zyraxon-x-evolve", JSON.stringify({
        step: this._step,
        steps: this.steps.slice(-50),
        caps: Object.fromEntries(this.capabilities),
      }))
    } catch {}
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem("zyraxon-x-evolve") || "{}")
      if (data.step) this._step = data.step
      if (data.steps) this.steps = data.steps
      if (data.caps) this.capabilities = new Map(Object.entries(data.caps))
    } catch {}
  }
}
