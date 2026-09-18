/**
 * ZYRAXON X - Behavior Engine
 * State machine, decision tree, geofence, scheduling, event chains
 */

// ─── State Machine ────────────────────────────────────────
export type StateConfig = {
  id: string
  name: string
  onEnter?: () => void
  onExit?: () => void
  onUpdate?: () => void
}

export type Transition = {
  from: string
  to: string
  condition: () => boolean
  priority: number
}

export class StateMachine {
  private states: Map<string, StateConfig> = new Map()
  private transitions: Transition[] = []
  private _current: string = "idle"
  private _running = false
  private _history: Array<{ from: string; to: string; time: number }> = []

  get current() { return this._current }
  get history() { return this._history }

  addState(config: StateConfig) { this.states.set(config.id, config) }

  addTransition(from: string, to: string, condition: () => boolean, priority = 0) {
    this.transitions.push({ from, to, condition, priority })
  }

  start(initialState = "idle") {
    this._current = initialState
    this._running = true
    this.states.get(initialState)?.onEnter?.()
  }

  stop() {
    this.states.get(this._current)?.onExit?.()
    this._running = false
  }

  update() {
    if (!this._running) return
    this.states.get(this._current)?.onUpdate?.()
    const eligible = this.transitions
      .filter(t => t.from === this._current && t.condition())
      .sort((a, b) => b.priority - a.priority)
    if (eligible.length > 0) {
      const t = eligible[0]
      this.states.get(this._current)?.onExit?.()
      this._history.push({ from: this._current, to: t.to, time: Date.now() })
      this._current = t.to
      this.states.get(this._current)?.onEnter?.()
    }
  }

  forceState(id: string) {
    if (this.states.has(id)) {
      this.states.get(this._current)?.onExit?.()
      this._current = id
      this.states.get(this._current)?.onEnter?.()
    }
  }
}

// ─── Decision Tree ────────────────────────────────────────
export type DecisionNode = {
  id: string
  question?: () => boolean
  action?: () => any
  yes?: DecisionNode
  no?: DecisionNode
}

export class DecisionTree {
  private root: DecisionNode | null = null
  private _lastResult: any = null

  get lastResult() { return this._lastResult }

  setRoot(node: DecisionNode) { this.root = node }

  evaluate(): any {
    if (!this.root) return null
    this._lastResult = this.walk(this.root)
    return this._lastResult
  }

  private walk(node: DecisionNode): any {
    if (node.action) return node.action()
    if (node.question) {
      const result = node.question()
      if (result && node.yes) return this.walk(node.yes)
      if (!result && node.no) return this.walk(node.no)
    }
    return null
  }
}

// ─── Priority Queue ───────────────────────────────────────
export type PriorityTask = {
  id: string
  priority: number
  execute: () => Promise<any>
  status: "pending" | "running" | "done" | "failed"
  result?: any
  created: number
}

export class PriorityQueue {
  private tasks: PriorityTask[] = []
  private _running = false

  get tasks() { return [...this.tasks].sort((a, b) => b.priority - a.priority) }
  get pendingCount() { return this.tasks.filter(t => t.status === "pending").length }

  enqueue(id: string, priority: number, execute: () => Promise<any>) {
    this.tasks.push({ id, priority, execute, status: "pending", created: Date.now() })
  }

  async process(): Promise<void> {
    if (this._running) return
    this._running = true
    while (true) {
      const next = this.tasks
        .filter(t => t.status === "pending")
        .sort((a, b) => b.priority - a.priority)[0]
      if (!next) break
      next.status = "running"
      try {
        next.result = await next.execute()
        next.status = "done"
      } catch {
        next.status = "failed"
      }
    }
    this._running = false
  }

  cancel(id: string) {
    const task = this.tasks.find(t => t.id === id)
    if (task && task.status === "pending") task.status = "failed"
  }

  clear() { this.tasks = [] }
}

// ─── Geofence ─────────────────────────────────────────────
export type GeofenceZone = {
  id: string
  name: string
  center: { lat: number; lon: number }
  radiusM: number
  onEnter?: (position: { lat: number; lon: number }) => void
  onExit?: (position: { lat: number; lon: number }) => void
}

export class Geofence {
  private zones: Map<string, GeofenceZone> = new Map()
  private _inside: Set<string> = new Set()

  addZone(zone: GeofenceZone) { this.zones.set(zone.id, zone) }
  removeZone(id: string) { this.zones.delete(id); this._inside.delete(id) }
  get zonesInside() { return [...this._inside] }

  check(lat: number, lon: number): string[] {
    const nowInside = new Set<string>()
    const events: string[] = []
    for (const [id, zone] of this.zones) {
      const dist = this.haversine(lat, lon, zone.center.lat, zone.center.lon)
      if (dist <= zone.radiusM) {
        nowInside.add(id)
        if (!this._inside.has(id)) {
          zone.onEnter?.({ lat, lon })
          events.push("enter:" + id)
        }
      } else {
        if (this._inside.has(id)) {
          zone.onExit?.({ lat, lon })
          events.push("exit:" + id)
        }
      }
    }
    this._inside = nowInside
    return events
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }
}

// ─── Scheduler (Cron-like) ────────────────────────────────
export type ScheduledTask = {
  id: string
  intervalMs: number
  action: () => void | Promise<void>
  enabled: boolean
  lastRun: number
  timer?: ReturnType<typeof setInterval>
}

export class Scheduler {
  private tasks: Map<string, ScheduledTask> = new Map()
  get tasksList() { return Array.from(this.tasks.values()) }

  add(id: string, intervalMs: number, action: () => void | Promise<void>) {
    this.tasks.set(id, { id, intervalMs, action, enabled: true, lastRun: 0 })
  }

  enable(id: string) { this.tasks.get(id).enabled = true }
  disable(id: string) { this.tasks.get(id).enabled = false }
  remove(id: string) { this.stop(id); this.tasks.delete(id) }

  start(id: string) {
    const task = this.tasks.get(id)
    if (!task || task.timer) return
    task.timer = setInterval(async () => {
      if (task.enabled) {
        task.lastRun = Date.now()
        await task.action()
      }
    }, task.intervalMs)
  }

  stop(id: string) {
    const task = this.tasks.get(id)
    if (task?.timer) { clearInterval(task.timer); task.timer = undefined }
  }

  startAll() { for (const id of this.tasks.keys()) this.start(id) }
  stopAll() { for (const id of this.tasks.keys()) this.stop(id) }
}

// ─── Watchdog (Dead-man Switch) ───────────────────────────
export class Watchdog {
  private _lastHeartbeat = 0
  private _timeoutMs: number
  private _timer?: ReturnType<typeof setInterval>
  onTimeout?: () => void

  constructor(timeoutMs = 30000) { this._timeoutMs = timeoutMs }

  get alive() { return Date.now() - this._lastHeartbeat < this._timeoutMs }

  heartbeat() { this._lastHeartbeat = Date.now() }

  start() {
    this._lastHeartbeat = Date.now()
    this._timer = setInterval(() => {
      if (!this.alive) this.onTimeout?.()
    }, this._timeoutMs / 2)
  }

  stop() { if (this._timer) clearInterval(this._timer) }
}

// ─── Event Chain ──────────────────────────────────────────
export type ChainStep = {
  id: string
  action: (prevResult: any) => Promise<any>
  condition?: (prevResult: any) => boolean
}

export class EventChain {
  private steps: ChainStep[] = []
  private _running = false
  private _results: any[] = []

  get results() { return this._results }
  get running() { return this._running }

  addStep(step: ChainStep) { this.steps.push(step) }

  async execute(): Promise<any[]> {
    if (this._running) return []
    this._running = true
    this._results = []
    let prev: any = null
    for (const step of this.steps) {
      if (step.condition && !step.condition(prev)) break
      try {
        prev = await step.action(prev)
        this._results.push({ step: step.id, result: prev })
      } catch (e) {
        this._results.push({ step: step.id, error: String(e) })
        break
      }
    }
    this._running = false
    return this._results
  }
}

// ─── Master Behavior Engine ───────────────────────────────
export class ZyraxonBehavior {
  readonly stateMachine = new StateMachine()
  readonly decisionTree = new DecisionTree()
  readonly queue = new PriorityQueue()
  readonly geofence = new Geofence()
  readonly scheduler = new Scheduler()
  readonly watchdog = new Watchdog()
  readonly eventChain = new EventChain()

  private _tickTimer?: ReturnType<typeof setInterval>

  startTick(intervalMs = 100) {
    this._tickTimer = setInterval(() => {
      this.stateMachine.update()
    }, intervalMs)
  }

  stopTick() {
    if (this._tickTimer) clearInterval(this._tickTimer)
  }
}
