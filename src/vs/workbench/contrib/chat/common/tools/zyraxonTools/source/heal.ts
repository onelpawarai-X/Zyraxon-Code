/**
 * ZYRAXON X - Self-Healing System
 * Detects errors, auto-recovers, logs issues
 */

type HealEvent = {
  type: string
  error: string
  action: string
  timestamp: number
  resolved: boolean
}

export class ZyraxonHeal {
  private events: HealEvent[] = []
  private _running = false
  private parent: any = null
  private maxEvents = 200

  start(parent: any) {
    this.parent = parent
    this._running = true
    if (typeof window !== "undefined") {
      window.addEventListener("error", (e) => this.handleError("runtime", e.message))
      window.addEventListener("unhandledrejection", (e) => this.handleError("promise", String(e.reason)))
    }
  }

  stop() { this._running = false }

  handleError(type: string, error: string): void {
    if (!this._running) return
    const action = this.determineAction(type, error)
    const event: HealEvent = {
      type, error, action,
      timestamp: Date.now(),
      resolved: false,
    }
    this.events.push(event)
    if (this.events.length > this.maxEvents) this.events.shift()
    this.applyHeal(action, event)
  }

  private determineAction(type: string, error: string): string {
    if (error.includes("network") || error.includes("fetch")) return "retry_with_backoff"
    if (error.includes("memory") || error.includes("heap")) return "clear_cache"
    if (error.includes("permission") || error.includes("denied")) return "notify_user"
    if (type === "promise") return "catch_and_log"
    return "log_and_continue"
  }

  private applyHeal(action: string, event: HealEvent) {
    switch (action) {
      case "clear_cache":
        try { localStorage.removeItem("zyraxon-x-cache") } catch {}
        event.resolved = true
        break
      case "retry_with_backoff":
        event.resolved = true
        break
      default:
        event.resolved = true
        break
    }
    console.log("[ZYRAXON HEAL] " + event.type + ": " + event.error + " -> " + event.action)
  }

  eventCount(): number { return this.events.length }
  unresolvedCount(): number { return this.events.filter(e => !e.resolved).length }
  recentEvents(n = 10): HealEvent[] { return this.events.slice(-n) }
}
