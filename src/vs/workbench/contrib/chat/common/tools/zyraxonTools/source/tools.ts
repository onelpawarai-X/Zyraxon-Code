/**
 * ZYRAXON X - Master Tool Registry
 * 38 real tools for ALL systems
 */

const isBrowser = typeof window !== "undefined"

export type ToolResult = { ok: boolean; data?: any; error?: string }
export type ToolCategory = "vehicle" | "space" | "robot" | "system" | "cloud" | "safety" | "sensor" | "network"

export type ToolDef = {
  name: string
  category: ToolCategory
  description: string
  execute: (...args: any[]) => Promise<ToolResult>
}

// ═══════════════════════════════════════════════════════════
// 1. TELEMETRY — GPS, speed, altitude, battery, engine, temp, fuel, signal, health
// ═══════════════════════════════════════════════════════════
export class TelemetryTool {
  private history: any[] = []
  private _onUpdate?: (data: any) => void

  onUpdate(cb: (data: any) => void) { this._onUpdate = cb }

  async read(connector: any): Promise<ToolResult> {
    try {
      const data = await connector.getTelemetry?.()
      if (!data) return { ok: false, error: "No telemetry data" }
      this.history.push({ ...data, timestamp: Date.now() })
      if (this.history.length > 10000) this.history.shift()
      this._onUpdate?.(data)
      return { ok: true, data }
    } catch (e) { return { ok: false, error: String(e) } }
  }

  getHistory(n = 100) { return this.history.slice(-n) }
  getAverage(field: string, n = 50): number {
    const recent = this.history.slice(-n)
    if (recent.length === 0) return 0
    return recent.reduce((sum, h) => sum + (h[field] || 0), 0) / recent.length
  }
  detectAnomaly(field: string, threshold = 2): any | null {
    if (this.history.length < 10) return null
    const recent = this.history.slice(-10)
    const avg = recent.reduce((s, h) => s + (h[field] || 0), 0) / recent.length
    const latest = recent[recent.length - 1]?.[field] || 0
    if (Math.abs(latest - avg) > threshold * avg) return { field, expected: avg, actual: latest }
    return null
  }
}

// ═══════════════════════════════════════════════════════════
// 2. MISSION — destination, route, checkpoint, ETA, status
// ═══════════════════════════════════════════════════════════
export type Waypoint = { lat: number; lon: number; alt: number; action: string; holdSec?: number }
export class MissionTool {
  private waypoints: Waypoint[] = []
  private idx = 0
  private _status: "idle" | "active" | "paused" | "complete" = "idle"
  private _startTime = 0

  get status() { return this._status }
  get progress() { return this.waypoints.length ? (this.idx / this.waypoints.length) * 100 : 0 }
  get eta(): number {
    if (!this.waypoints.length || !this._startTime) return 0
    const elapsed = Date.now() - this._startTime
    const perWp = elapsed / Math.max(this.idx, 1)
    return perWp * (this.waypoints.length - this.idx)
  }
  get currentWp() { return this.waypoints[this.idx] || null }

  load(wps: Waypoint[]) { this.waypoints = wps; this.idx = 0; this._status = "idle" }
  start() { this._status = "active"; this._startTime = Date.now() }
  pause() { this._status = "paused" }
  resume() { this._status = "active" }
  abort() { this._status = "idle"; this.idx = 0 }
  advance() { if (this.idx < this.waypoints.length) this.idx++; if (this.idx >= this.waypoints.length) this._status = "complete" }
  jumpTo(index: number) { if (index >= 0 && index < this.waypoints.length) this.idx = index }
  addWaypoint(wp: Waypoint) { this.waypoints.push(wp) }
  removeWaypoint(index: number) { this.waypoints.splice(index, 1) }
  reorderWaypoints(from: number, to: number) {
    const [wp] = this.waypoints.splice(from, 1)
    this.waypoints.splice(to, 0, wp)
  }
  summary() { return { status: this._status, progress: this.progress, eta: this.eta, total: this.waypoints.length, current: this.idx } }
}

// ═══════════════════════════════════════════════════════════
// 3. COMMUNICATION — control center, operator, secure comms
// ═══════════════════════════════════════════════════════════
export class CommunicationTool {
  private _log: Array<{ from: string; to: string; msg: string; time: number; channel: string }> = []
  private _channels: Map<string, WebSocket> = new Map()
  private _handlers: Map<string, (msg: any) => void> = new Map()

  async connectChannel(id: string, url: string): Promise<ToolResult> {
    if (!isBrowser) return { ok: false, error: "WebSocket requires browser environment" }
    try {
      const ws = new WebSocket(url)
      await new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = () => rej(); setTimeout(rej, 5000) })
      ws.onmessage = (e) => { const handler = this._handlers.get(id); handler?.(JSON.parse(e.data)) }
      this._channels.set(id, ws)
      return { ok: true, data: { channel: id, connected: true } }
    } catch (e) { return { ok: false, error: String(e) } }
  }

  onMessage(channelId: string, handler: (msg: any) => void) { this._handlers.set(channelId, handler) }

  async send(from: string, to: string, message: string, channel = "default"): Promise<ToolResult> {
    const entry = { from, to, msg: message, time: Date.now(), channel }
    this._log.push(entry)
    const ws = this._channels.get(channel)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "message", ...entry }))
    }
    return { ok: true, data: { delivered: true, channel } }
  }

  async broadcast(from: string, message: string, recipients: string[], channel = "default"): Promise<ToolResult> {
    for (const r of recipients) this._log.push({ from, to: r, msg: message, time: Date.now(), channel })
    return { ok: true, data: { delivered: recipients.length } }
  }

  getLog(n = 50) { return this._log.slice(-n) }
  getChannels() { return Array.from(this._channels.keys()) }
}

// ═══════════════════════════════════════════════════════════
// 4. SENSOR — camera, LiDAR, radar, IMU, weather
// ═══════════════════════════════════════════════════════════
export class SensorTool {
  private _readings: Map<string, Array<{ value: any; time: number }>> = new Map()

  async readCamera(url: string): Promise<ToolResult> {
    try {
      const r = await fetch(url + "/capture")
      if (!r.ok) throw new Error("Camera returned " + r.status)
      const blob = await r.blob()
      const dataUrl = isBrowser ? URL.createObjectURL(blob) : `data:${blob.type};base64,...`
      return { ok: true, data: { size: blob.size, type: blob.type, url: dataUrl } }
    } catch (e) { return { ok: false, error: String(e) } }
  }

  async readLiDAR(serial: any): Promise<ToolResult> {
    try {
      const resp = await serial.sendCommand("LIDAR_SCAN")
      const distances = JSON.parse(resp || "[]")
      return { ok: true, data: { distances, count: distances.length, range: Math.max(...distances, 0) } }
    } catch (e) { return { ok: false, error: String(e) } }
  }

  async readIMU(i2c: any, addr = 0x68): Promise<ToolResult> {
    try {
      const aBytes = await i2c.readBytes(addr, 0x3B, 6)
      const gBytes = await i2c.readBytes(addr, 0x43, 6)
      const accel = aBytes ? aBytes.map((b: number) => (b > 127 ? b - 256 : b) / 16384) : []
      const gyro = gBytes ? gBytes.map((b: number) => (b > 127 ? b - 256 : b) / 131) : []
      return { ok: true, data: { accel: { x: accel[0], y: accel[1], z: accel[2] }, gyro: { x: gyro[0], y: gyro[1], z: gyro[2] } } }
    } catch (e) { return { ok: false, error: String(e) } }
  }

  async readRadar(url: string): Promise<ToolResult> {
    try {
      const r = await fetch(url + "/targets")
      const targets = await r.json()
      return { ok: true, data: { targets, count: targets.length } }
    } catch (e) { return { ok: false, error: String(e) } }
  }

  async readWeather(lat: number, lon: number): Promise<ToolResult> {
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,windspeed_10m,visibility`)
      const d = await r.json()
      return { ok: true, data: { temp: d.current_weather?.temperature, windSpeed: d.current_weather?.windspeed, windDir: d.current_weather?.winddirection } }
    } catch (e) { return { ok: false, error: String(e) } }
  }

  async readSerialSensor(serial: any, cmd: string): Promise<ToolResult> {
    try {
      const resp = await serial.sendCommand(cmd)
      return { ok: true, data: { raw: resp } }
    } catch (e) { return { ok: false, error: String(e) } }
  }

  logReading(sensor: string, value: any) {
    if (!this._readings.has(sensor)) this._readings.set(sensor, [])
    this._readings.get(sensor)!.push({ value, time: Date.now() })
  }

  getReadings(sensor: string, n = 100) { return this._readings.get(sensor)?.slice(-n) || [] }
  getSensors() { return Array.from(this._readings.keys()) }
}

// ═══════════════════════════════════════════════════════════
// 5. EMERGENCY — Safe Mode, Return-to-Base, Safe Shutdown, alerts
// ═══════════════════════════════════════════════════════════
export class EmergencyTool {
  private _level: "normal" | "caution" | "warning" | "critical" = "normal"
  private _actions: Array<{ type: string; time: number; detail: string }> = []
  private _callbacks: Array<(level: string) => void> = []

  get level() { return this._level }
  onEscalation(cb: (level: string) => void) { this._callbacks.push(cb) }

  async safeMode(vehicleCtrl: any): Promise<ToolResult> {
    this._level = "caution"
    this._actions.push({ type: "safe_mode", time: Date.now(), detail: "Entering safe mode" })
    await vehicleCtrl?.setMode?.("LOITER")
    this._callbacks.forEach(cb => cb(this._level))
    return { ok: true, data: { mode: "SAFE_MODE" } }
  }

  async returnToBase(vehicleCtrl: any): Promise<ToolResult> {
    this._level = "warning"
    this._actions.push({ type: "rtb", time: Date.now(), detail: "Return to base initiated" })
    await vehicleCtrl?.returnToLaunch?.()
    this._callbacks.forEach(cb => cb(this._level))
    return { ok: true, data: { action: "RETURN_TO_BASE" } }
  }

  async safeShutdown(vehicleCtrl: any): Promise<ToolResult> {
    this._level = "critical"
    this._actions.push({ type: "shutdown", time: Date.now(), detail: "Emergency shutdown" })
    await vehicleCtrl?.emergencyStop?.()
    this._callbacks.forEach(cb => cb(this._level))
    return { ok: true, data: { action: "SAFE_SHUTDOWN" } }
  }

  async alert(message: string): Promise<ToolResult> {
    this._actions.push({ type: "alert", time: Date.now(), detail: message })
    this._callbacks.forEach(cb => cb(this._level))
    return { ok: true, data: { alerted: true } }
  }

  escalate() {
    const levels: Array<"normal" | "caution" | "warning" | "critical"> = ["normal", "caution", "warning", "critical"]
    const i = levels.indexOf(this._level)
    if (i < levels.length - 1) { this._level = levels[i + 1]; this._callbacks.forEach(cb => cb(this._level)) }
  }

  reset() { this._level = "normal"; this._actions.push({ type: "reset", time: Date.now(), detail: "Emergency cleared" }) }
  getActions(n = 50) { return this._actions.slice(-n) }
}

// ═══════════════════════════════════════════════════════════
// 6. LOGGING — decisions, commands, telemetry, events
// ═══════════════════════════════════════════════════════════
export type LogEntry = { level: "info" | "warn" | "error" | "debug" | "decision" | "command"; msg: string; data?: any; time: number }
export class LoggingTool {
  private logs: LogEntry[] = []
  private maxLogs = 50000

  log(level: LogEntry["level"], msg: string, data?: any) {
    this.logs.push({ level, msg, data, time: Date.now() })
    if (this.logs.length > this.maxLogs) this.logs.splice(0, 1000)
  }
  info(msg: string, data?: any) { this.log("info", msg, data) }
  warn(msg: string, data?: any) { this.log("warn", msg, data) }
  error(msg: string, data?: any) { this.log("error", msg, data) }
  debug(msg: string, data?: any) { this.log("debug", msg, data) }
  decision(msg: string, data?: any) { this.log("decision", msg, data) }
  command(cmd: string, result?: any) { this.log("command", cmd, result) }

  query(filter: { level?: string; since?: number; until?: number; search?: string } = {}, n = 200): LogEntry[] {
    let result = this.logs
    if (filter.level) result = result.filter(l => l.level === filter.level)
    if (filter.since) result = result.filter(l => l.time >= filter.since!)
    if (filter.until) result = result.filter(l => l.time <= filter.until!)
    if (filter.search) result = result.filter(l => l.msg.includes(filter.search!))
    return result.slice(-n)
  }

  clear() { this.logs = [] }
  exportJson(): string { return JSON.stringify(this.logs, null, 2) }
  size() { return this.logs.length }
}

// ═══════════════════════════════════════════════════════════
// 7. PERMISSION — authorization, safety policies, audit
// ═══════════════════════════════════════════════════════════
export type Permission = { resource: string; actions: string[]; granted: boolean; expiresAt?: number }
export class PermissionTool {
  private permissions: Map<string, Permission> = new Map()
  private _audit: Array<{ action: string; resource: string; allowed: boolean; time: number; user?: string }> = []

  grant(resource: string, actions: string[], expiresAt?: number) { this.permissions.set(resource, { resource, actions, granted: true, expiresAt }) }
  revoke(resource: string) { this.permissions.delete(resource) }

  check(resource: string, action: string): boolean {
    const p = this.permissions.get(resource)
    if (!p || !p.granted) { this._audit.push({ action, resource, allowed: false, time: Date.now() }); return false }
    if (p.expiresAt && Date.now() > p.expiresAt) { this._audit.push({ action, resource, allowed: false, time: Date.now() }); return false }
    const allowed = p.actions.includes(action) || p.actions.includes("*")
    this._audit.push({ action, resource, allowed, time: Date.now() })
    return allowed
  }

  requirePermission(resource: string, action: string): ToolResult {
    if (!this.check(resource, action)) return { ok: false, error: `Permission denied: ${action} on ${resource}` }
    return { ok: true }
  }

  getAudit(n = 200) { return this._audit.slice(-n) }
  listPermissions() { return Array.from(this.permissions.values()) }
}

// ═══════════════════════════════════════════════════════════
// 8. HEALTH — motor, battery, sensor, communication link monitoring
// ═══════════════════════════════════════════════════════════
export class HealthTool {
  private _components: Map<string, { status: "NOMINAL" | "DEGRADED" | "CRITICAL" | "OFFLINE"; metrics: any; lastUpdate: number }> = new Map()
  private _thresholds: Map<string, { warn: number; critical: number }> = new Map()

  setThreshold(component: string, warn: number, critical: number) { this._thresholds.set(component, { warn, critical }) }

  update(name: string, status: "NOMINAL" | "DEGRADED" | "CRITICAL" | "OFFLINE", metrics: any = {}) {
    this._components.set(name, { status, metrics, lastUpdate: Date.now() })
  }

  checkValue(name: string, value: number): "NOMINAL" | "DEGRADED" | "CRITICAL" {
    const t = this._thresholds.get(name)
    if (!t) return "NOMINAL"
    if (value <= t.critical) return "CRITICAL"
    if (value <= t.warn) return "DEGRADED"
    return "NOMINAL"
  }

  check(name: string) { return this._components.get(name) || null }

  overall(): "NOMINAL" | "DEGRADED" | "CRITICAL" {
    const statuses = [...this._components.values()].map(c => c.status)
    if (statuses.includes("CRITICAL") || statuses.includes("OFFLINE")) return "CRITICAL"
    if (statuses.includes("DEGRADED")) return "DEGRADED"
    return "NOMINAL"
  }

  getAll() { return Object.fromEntries(this._components) }
  getHealthyComponents() { return [...this._components.entries()].filter(([_, v]) => v.status === "NOMINAL").map(([k]) => k) }
  getUnhealthyComponents() { return [...this._components.entries()].filter(([_, v]) => v.status !== "NOMINAL").map(([k, v]) => ({ name: k, status: v.status })) }
}

// ═══════════════════════════════════════════════════════════
// 9. NAVIGATION — map, waypoint, geofence, route planning
// ═══════════════════════════════════════════════════════════
export class NavigationTool {
  private _route: Array<{ lat: number; lon: number; alt?: number }> = []
  private _geofence: { center: { lat: number; lon: number }; radiusM: number } | null = null
  private _currentIdx = 0

  loadRoute(positions: Array<{ lat: number; lon: number; alt?: number }>) { this._route = positions; this._currentIdx = 0 }
  setGeofence(center: { lat: number; lon: number }, radiusM: number) { this._geofence = { center, radiusM } }

  checkGeofence(pos: { lat: number; lon: number }): boolean {
    if (!this._geofence) return true
    const R = 6371000
    const dLat = (pos.lat - this._geofence.center.lat) * Math.PI / 180
    const dLon = (pos.lon - this._geofence.center.lon) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(pos.lat * Math.PI / 180) * Math.cos(this._geofence.center.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(a)) <= this._geofence.radiusM
  }

  distanceToWaypoint(pos: { lat: number; lon: number }): number {
    const wp = this._route[this._currentIdx]
    if (!wp) return 0
    const R = 6371000
    const dLat = (wp.lat - pos.lat) * Math.PI / 180
    const dLon = (wp.lon - pos.lon) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(pos.lat * Math.PI / 180) * Math.cos(wp.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(a))
  }

  headingToWaypoint(pos: { lat: number; lon: number }): number {
    const wp = this._route[this._currentIdx]
    if (!wp) return 0
    const dLon = (wp.lon - pos.lon) * Math.PI / 180
    const lat1 = pos.lat * Math.PI / 180
    const lat2 = wp.lat * Math.PI / 180
    const y = Math.sin(dLon) * Math.cos(lat2)
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
  }

  advanceWaypoint() { if (this._currentIdx < this._route.length - 1) this._currentIdx++; return this._route[this._currentIdx] }
  currentWaypoint() { return this._route[this._currentIdx] }
  getRoute() { return this._route }
  getProgress() { return this._route.length ? ((this._currentIdx + 1) / this._route.length) * 100 : 0 }
}

// ═══════════════════════════════════════════════════════════
// 10. POSITION — GPS, location, coordinates
// ═══════════════════════════════════════════════════════════
export class PositionTool {
  private _history: Array<{ lat: number; lon: number; alt: number; accuracy: number; time: number }> = []

  async readPosition(connector: any): Promise<ToolResult> {
    try {
      const pos = await connector.getPosition?.()
      if (!pos) return { ok: false, error: "No position data" }
      this._history.push({ ...pos, time: Date.now() })
      return { ok: true, data: pos }
    } catch (e) { return { ok: false, error: String(e) } }
  }

  getHistory(n = 100) { return this._history.slice(-n) }
  lastPosition() { return this._history[this._history.length - 1] || null }

  distanceTo(other: { lat: number; lon: number }): number {
    const last = this.lastPosition()
    if (!last) return 0
    const R = 6371000
    const dLat = (other.lat - last.lat) * Math.PI / 180
    const dLon = (other.lon - last.lon) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(last.lat * Math.PI / 180) * Math.cos(other.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(a))
  }

  speed(): number {
    if (this._history.length < 2) return 0
    const prev = this._history[this._history.length - 2]
    const curr = this._history[this._history.length - 1]
    const dist = this.distanceTo(prev)
    return dist / ((curr.time - prev.time) / 1000)
  }
}

// ═══════════════════════════════════════════════════════════
// 11. ORIENTATION — heading, roll, pitch, yaw
// ═══════════════════════════════════════════════════════════
export class OrientationTool {
  private _readings: Array<{ heading: number; roll: number; pitch: number; yaw: number; time: number }> = []

  async read(connector: any): Promise<ToolResult> {
    try {
      const att = await connector.getAttitude?.()
      if (!att) return { ok: false, error: "No orientation data" }
      this._readings.push({ ...att, time: Date.now() })
      return { ok: true, data: att }
    } catch (e) { return { ok: false, error: String(e) } }
  }

  lastReading() { return this._readings[this._readings.length - 1] || null }

  getStability(n = 10): number {
    const recent = this._readings.slice(-n)
    if (recent.length < 2) return 1
    const variance = recent.reduce((sum, r, i) => {
      if (i === 0) return 0
      return sum + Math.abs(r.roll - recent[i - 1].roll) + Math.abs(r.pitch - recent[i - 1].pitch) + Math.abs(r.yaw - recent[i - 1].yaw)
    }, 0) / (recent.length - 1)
    return Math.max(0, 1 - variance / 30)
  }

  getHistory(n = 50) { return this._readings.slice(-n) }
}

// ═══════════════════════════════════════════════════════════
// 12. POWER — battery, charging, power management
// ═══════════════════════════════════════════════════════════
export class PowerTool {
  private _batteries: Map<string, { voltage: number; current: number; percent: number; temp: number; cycles: number; lastUpdate: number }> = new Map()
  private _powerBudget: Map<string, number> = new Map()
  private _totalBudget = 0

  setBudget(totalWatts: number) { this._totalBudget = totalWatts }
  allocate(name: string, watts: number) { this._powerBudget.set(name, watts) }

  updateBattery(id: string, voltage: number, current: number, percent: number, temp: number) {
    const existing = this._batteries.get(id)
    const cycles = (existing?.cycles || 0) + (percent < (existing?.percent || 100) ? 0.001 : 0)
    this._batteries.set(id, { voltage, current, percent, temp, cycles: Math.floor(cycles * 1000) / 1000, lastUpdate: Date.now() })
  }

  getBattery(id: string) { return this._batteries.get(id) }
  getAllBatteries() { return Object.fromEntries(this._batteries) }

  getPowerDraw(): number {
    let total = 0
    this._batteries.forEach(b => { total += b.voltage * b.current })
    return total
  }

  getRemainingPower(): number {
    const total = this._totalBudget
    if (!total) return 1
    return Math.min(1, (total - this.getPowerDraw()) / total)
  }

  estimateTimeRemaining(id: string): number {
    const b = this._batteries.get(id)
    if (!b || b.current <= 0) return Infinity
    const energy = b.voltage * b.percent / 100
    return (energy / b.current) * 3600
  }

  async charge(id: string, connector: any): Promise<ToolResult> {
    try { await connector.startCharging?.(id); return { ok: true, data: { charging: true } } }
    catch (e) { return { ok: false, error: String(e) } }
  }
}

// ═══════════════════════════════════════════════════════════
// 13. ENGINE — motor, engine status monitoring
// ═══════════════════════════════════════════════════════════
export class EngineTool {
  private _engines: Map<string, { rpm: number; temp: number; thrust: number; status: string; lastUpdate: number }> = new Map()

  update(id: string, rpm: number, temp: number, thrust: number, status: string) {
    this._engines.set(id, { rpm, temp, thrust, status, lastUpdate: Date.now() })
  }

  getEngine(id: string) { return this._engines.get(id) }
  getAllEngines() { return Object.fromEntries(this._engines) }

  getStatus(): "NOMINAL" | "OVERHEATING" | "FAILURE" {
    for (const [_, e] of this._engines) {
      if (e.temp > 90) return "OVERHEATING"
      if (e.status === "FAILURE") return "FAILURE"
    }
    return "NOMINAL"
  }

  getTotalThrust(): number {
    let total = 0
    this._engines.forEach(e => { total += e.thrust })
    return total
  }
}

// ═══════════════════════════════════════════════════════════
// 14. WEATHER — wind, rain, temperature, visibility
// ═══════════════════════════════════════════════════════════
export class WeatherTool {
  private _cache: Map<string, { data: any; time: number }> = new Map()
  private _cacheTTL = 300000

  async getCurrent(lat: number, lon: number): Promise<ToolResult> {
    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`
    const cached = this._cache.get(key)
    if (cached && Date.now() - cached.time < this._cacheTTL) return { ok: true, data: cached.data }
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,windspeed_10m,visibility,precipitation_probability,cloudcover`)
      const d = await r.json()
      const data = {
        temp: d.current_weather?.temperature,
        windSpeed: d.current_weather?.windspeed,
        windDir: d.current_weather?.winddirection,
        condition: d.current_weather?.weathercode,
        humidity: d.hourly?.relativehumidity_2m?.[0],
        visibility: d.hourly?.visibility?.[0],
        precipProbability: d.hourly?.precipitation_probability?.[0],
        cloudCover: d.hourly?.cloudcover?.[0],
      }
      this._cache.set(key, { data, time: Date.now() })
      return { ok: true, data }
    } catch (e) { return { ok: false, error: String(e) } }
  }

  isFlyable(data: any): { flyable: boolean; reason: string } {
    if (data.windSpeed > 50) return { flyable: false, reason: "High wind" }
    if (data.visibility && data.visibility < 1000) return { flyable: false, reason: "Low visibility" }
    if (data.precipProbability && data.precipProbability > 80) return { flyable: false, reason: "High precipitation probability" }
    return { flyable: true, reason: "Conditions acceptable" }
  }
}

// ═══════════════════════════════════════════════════════════
// 15. OBSTACLE — sensor-based obstacle avoidance
// ═══════════════════════════════════════════════════════════
export class ObstacleTool {
  private _obstacles: Array<{ distance: number; angle: number; type: string; time: number }> = []
  private _safetyDistance = 5

  setSafetyDistance(meters: number) { this._safetyDistance = meters }

  async scan(sensors: any[]): Promise<ToolResult> {
    try {
      const readings: number[] = []
      for (const sensor of sensors) {
        const dist = await sensor.getDistance?.()
        if (dist !== undefined) readings.push(dist)
      }
      this._obstacles.push({ distance: Math.min(...readings, 999), angle: 0, type: readings.length > 0 ? "detected" : "clear", time: Date.now() })
      return { ok: true, data: { distance: Math.min(...readings, 999), obstacles: readings.length } }
    } catch (e) { return { ok: false, error: String(e) } }
  }

  isSafe(): boolean {
    const last = this._obstacles[this._obstacles.length - 1]
    return !last || last.distance > this._safetyDistance
  }

  getNearestObstacle() { return this._obstacles[this._obstacles.length - 1] || null }
  getHistory(n = 50) { return this._obstacles.slice(-n) }
}

// ═══════════════════════════════════════════════════════════
// 16. DOCKING — automated docking/parking
// ═══════════════════════════════════════════════════════════
export class DockingTool {
  private _target: { lat: number; lon: number; alt?: number } | null = null
  private _status: "idle" | "approaching" | "docking" | "docked" | "failed" = "idle"
  private _tolerance = 0.5

  setTarget(lat: number, lon: number, alt = 0) { this._target = { lat, lon, alt }; this._status = "approaching" }
  setTolerance(meters: number) { this._tolerance = meters }

  getStatus() { return this._status }

  async attemptDock(connector: any, currentPos: { lat: number; lon: number }): Promise<ToolResult> {
    if (!this._target) return { ok: false, error: "No target set" }
    try {
      const dist = Math.sqrt((currentPos.lat - this._target.lat) ** 2 + (currentPos.lon - this._target.lon) ** 2) * 111000
      if (dist > this._tolerance) { this._status = "approaching"; return { ok: true, data: { status: "approaching", distance: dist } } }
      this._status = "docking"
      await connector?.executeLanding?.()
      this._status = "docked"
      return { ok: true, data: { status: "docked" } }
    } catch (e) { this._status = "failed"; return { ok: false, error: String(e) } }
  }

  abort() { this._status = "failed" }
}

// ═══════════════════════════════════════════════════════════
// 17. ORBIT — orbit state, prediction
// ═══════════════════════════════════════════════════════════
export class OrbitTool {
  private _state: { altitude: number; inclination: number; period: number; eccentricity: number; argPerigee: number; raan: number; trueAnomaly: number } | null = null
  private _history: Array<{ altitude: number; time: number }> = []

  update(state: { altitude: number; inclination: number; period: number; eccentricity: number; argPerigee: number; raan: number; trueAnomaly: number }) {
    this._state = state
    this._history.push({ altitude: state.altitude, time: Date.now() })
  }

  getState() { return this._state }
  predictPosition(minutesAhead: number): { altitude: number; position: string } | null {
    if (!this._state) return null
    const angularRate = (2 * Math.PI) / this._state.period
    const anomaly = this._state.trueAnomaly + angularRate * minutesAhead * 60
    const r = (this._state.altitude + 6371000) * (1 - this._state.eccentricity ** 2) / (1 + this._state.eccentricity * Math.cos(anomaly))
    return { altitude: r - 6371000, position: `anomaly=${((anomaly * 180 / Math.PI) % 360).toFixed(1)}°` }
  }

  isStable(): boolean {
    if (this._history.length < 10) return true
    const recent = this._history.slice(-10)
    const avg = recent.reduce((s, h) => s + h.altitude, 0) / recent.length
    const drift = Math.abs(recent[recent.length - 1].altitude - avg)
    return drift < 1000
  }
}

// ═══════════════════════════════════════════════════════════
// 18. ATTITUDE — spacecraft orientation
// ═══════════════════════════════════════════════════════════
export class AttitudeTool {
  private _state: { quaternion: [number, number, number, number]; angularVelocity: [number, number, number] } | null = null

  update(quaternion: [number, number, number, number], angularVelocity: [number, number, number]) { this._state = { quaternion, angularVelocity } }
  getState() { return this._state }

  isStable(): boolean {
    if (!this._state) return true
    return this._state.angularVelocity.every(v => Math.abs(v) < 0.01)
  }

  quaternionToEuler(q: [number, number, number, number]): { roll: number; pitch: number; yaw: number } {
    const [w, x, y, z] = q
    return {
      roll: Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)) * 180 / Math.PI,
      pitch: Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x)))) * 180 / Math.PI,
      yaw: Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)) * 180 / Math.PI,
    }
  }
}

// ═══════════════════════════════════════════════════════════
// 19. TELEMETRY LINK — ground station telemetry exchange
// ═══════════════════════════════════════════════════════════
export class TelemetryLinkTool {
  private _link: WebSocket | null = null
  private _uplink: any[] = []
  private _downlink: any[] = []
  private _onData?: (data: any) => void

  onData(cb: (data: any) => void) { this._onData = cb }

  async connect(url: string): Promise<ToolResult> {
    try {
      this._link = new WebSocket(url)
      await new Promise<void>((res, rej) => { this._link!.onopen = () => res(); this._link!.onerror = () => rej(); setTimeout(rej, 5000) })
      this._link.onmessage = (e) => {
        const data = JSON.parse(e.data)
        this._downlink.push({ data, time: Date.now() })
        this._onData?.(data)
      }
      return { ok: true, data: { connected: true } }
    } catch (e) { return { ok: false, error: String(e) } }
  }

  async send(data: any): Promise<ToolResult> {
    if (!this._link || this._link.readyState !== WebSocket.OPEN) return { ok: false, error: "Not connected" }
    this._link.send(JSON.stringify(data))
    this._uplink.push({ data, time: Date.now() })
    return { ok: true }
  }

  getUplink(n = 50) { return this._uplink.slice(-n) }
  getDownlink(n = 50) { return this._downlink.slice(-n) }
  disconnect() { this._link?.close(); this._link = null }
}

// ═══════════════════════════════════════════════════════════
// 20. PAYLOAD — payload health monitoring
// ═══════════════════════════════════════════════════════════
export class PayloadTool {
  private _payloads: Map<string, { name: string; status: string; data: any; lastUpdate: number }> = new Map()

  register(id: string, name: string) { this._payloads.set(id, { name, status: "OFFLINE", data: {}, lastUpdate: Date.now() }) }
  update(id: string, status: string, data: any = {}) {
    const p = this._payloads.get(id)
    if (p) { p.status = status; p.data = data; p.lastUpdate = Date.now() }
  }
  get(id: string) { return this._payloads.get(id) }
  getAll() { return Object.fromEntries(this._payloads) }
  isHealthy(): boolean { return [...this._payloads.values()].every(p => p.status === "ONLINE" || p.status === "ACTIVE") }
}

// ═══════════════════════════════════════════════════════════
// 21. GROUND STATION — communication session management
// ═══════════════════════════════════════════════════════════
export class GroundStationTool {
  private _sessions: Array<{ id: string; start: number; end?: number; signal: number; data: any[] }> = []
  private _currentSession: string | null = null

  async startSession(stationId: string): Promise<ToolResult> {
    this._currentSession = stationId
    this._sessions.push({ id: stationId, start: Date.now(), signal: 0, data: [] })
    return { ok: true, data: { session: stationId, started: true } }
  }

  logData(data: any, signal = 100) {
    const session = this._sessions[this._sessions.length - 1]
    if (session) { session.data.push(data); session.signal = signal }
  }

  async endSession(): Promise<ToolResult> {
    const session = this._sessions[this._sessions.length - 1]
    if (session) session.end = Date.now()
    this._currentSession = null
    return { ok: true }
  }

  getSessions(n = 20) { return this._sessions.slice(-n) }
  getCurrentSession() { return this._sessions.find(s => !s.end) || null }
}

// ═══════════════════════════════════════════════════════════
// 22. CAMERA — capture, stream, image processing
// ═══════════════════════════════════════════════════════════
export class CameraTool {
  private _streams: Map<string, { url: string; active: boolean; fps: number }> = new Map()
  private _captures: Array<{ id: string; url: string; timestamp: number; size: number }> = []

  async capture(streamId: string): Promise<ToolResult> {
    const stream = this._streams.get(streamId)
    if (!stream) return { ok: false, error: `Stream not found: ${streamId}` }
    try {
      const r = await fetch(stream.url + "/capture")
      if (!r.ok) throw new Error("Capture failed: " + r.status)
      const blob = await r.blob()
      const id = `cap_${Date.now()}`
      this._captures.push({ id, url: stream.url, timestamp: Date.now(), size: blob.size })
      return { ok: true, data: { id, size: blob.size, type: blob.type } }
    } catch (e) { return { ok: false, error: String(e) } }
  }

  registerStream(id: string, url: string, fps = 30) { this._streams.set(id, { url, active: true, fps }) }
  stopStream(id: string) { const s = this._streams.get(id); if (s) s.active = false }
  getStreams() { return Object.fromEntries(this._streams) }
  getCaptures(n = 50) { return this._captures.slice(-n) }
}

// ═══════════════════════════════════════════════════════════
// 23. GPS — tracking, route recording, geofencing
// ═══════════════════════════════════════════════════════════
export class GpsTool {
  private _track: Array<{ lat: number; lon: number; alt: number; speed: number; heading: number; time: number }> = []
  private _waypoints: Array<{ lat: number; lon: number; label: string }> = []
  private _recording = false

  startRecording() { this._recording = true }
  stopRecording() { this._recording = false }

  addPoint(lat: number, lon: number, alt: number, speed: number, heading: number) {
    if (!this._recording) return
    this._track.push({ lat, lon, alt, speed, heading, time: Date.now() })
  }

  addWaypoint(lat: number, lon: number, label: string) { this._waypoints.push({ lat, lon, label }) }
  removeWaypoint(label: string) { this._waypoints = this._waypoints.filter(w => w.label !== label) }
  getWaypoints() { return this._waypoints }
  getTrack(n = 1000) { return this._track.slice(-n) }

  getTotalDistance(): number {
    let dist = 0
    for (let i = 1; i < this._track.length; i++) {
      const R = 6371000
      const dLat = (this._track[i].lat - this._track[i - 1].lat) * Math.PI / 180
      const dLon = (this._track[i].lon - this._track[i - 1].lon) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(this._track[i - 1].lat * Math.PI / 180) * Math.cos(this._track[i].lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
      dist += 2 * R * Math.asin(Math.sqrt(a))
    }
    return dist
  }

  getAverageSpeed(): number {
    if (this._track.length < 2) return 0
    return this._track.reduce((s, p) => s + p.speed, 0) / this._track.length
  }
}

// ═══════════════════════════════════════════════════════════
// 24. SERVO — servo motor control
// ═══════════════════════════════════════════════════════════
export class ServoTool {
  private _servos: Map<string, { angle: number; min: number; max: number }> = new Map()

  register(id: string, minAngle = 0, maxAngle = 180) { this._servos.set(id, { angle: 90, min: minAngle, max: maxAngle }) }

  async setAngle(id: string, angle: number, serial?: any): Promise<ToolResult> {
    const servo = this._servos.get(id)
    if (!servo) return { ok: false, error: `Servo not found: ${id}` }
    const clamped = Math.max(servo.min, Math.min(servo.max, angle))
    servo.angle = clamped
    if (serial) { try { await serial.sendCommand(`SERVO:${id}:${clamped}`) } catch (e) { return { ok: false, error: String(e) } } }
    return { ok: true, data: { id, angle: clamped } }
  }

  getAngle(id: string) { return this._servos.get(id)?.angle }
  getAll() { return Object.fromEntries(this._servos) }
}

// ═══════════════════════════════════════════════════════════
// 25. RELAY — relay/switch control
// ═══════════════════════════════════════════════════════════
export class RelayTool {
  private _relays: Map<string, { state: boolean; label: string; lastToggle: number }> = new Map()

  register(id: string, label: string, initialState = false) { this._relays.set(id, { state: initialState, label, lastToggle: Date.now() }) }

  async toggle(id: string, serial?: any): Promise<ToolResult> {
    const relay = this._relays.get(id)
    if (!relay) return { ok: false, error: `Relay not found: ${id}` }
    relay.state = !relay.state
    relay.lastToggle = Date.now()
    if (serial) { try { await serial.sendCommand(`RELAY:${id}:${relay.state ? "ON" : "OFF"}`) } catch (e) { return { ok: false, error: String(e) } } }
    return { ok: true, data: { id, state: relay.state } }
  }

  async setState(id: string, state: boolean, serial?: any): Promise<ToolResult> {
    const relay = this._relays.get(id)
    if (!relay) return { ok: false, error: `Relay not found: ${id}` }
    relay.state = state; relay.lastToggle = Date.now()
    if (serial) { try { await serial.sendCommand(`RELAY:${id}:${state ? "ON" : "OFF"}`) } catch (e) { return { ok: false, error: String(e) } } }
    return { ok: true, data: { id, state } }
  }

  getState(id: string) { return this._relays.get(id)?.state }
  getAll() { return Object.fromEntries(this._relays) }
}

// ═══════════════════════════════════════════════════════════
// 26. PWM — pulse-width modulation
// ═══════════════════════════════════════════════════════════
export class PwmTool {
  private _channels: Map<string, { duty: number; frequency: number; active: boolean }> = new Map()

  configure(channel: string, frequency: number, initialDuty = 0) { this._channels.set(channel, { duty: initialDuty, frequency, active: true }) }

  async setDuty(channel: string, duty: number, serial?: any): Promise<ToolResult> {
    const ch = this._channels.get(channel)
    if (!ch) return { ok: false, error: `PWM channel not found: ${channel}` }
    ch.duty = Math.max(0, Math.min(100, duty))
    if (serial) { try { await serial.sendCommand(`PWM:${channel}:${ch.duty}:${ch.frequency}`) } catch (e) { return { ok: false, error: String(e) } } }
    return { ok: true, data: { channel, duty: ch.duty, frequency: ch.frequency } }
  }

  stop(channel: string) { const ch = this._channels.get(channel); if (ch) ch.active = false }
  getDuty(channel: string) { return this._channels.get(channel)?.duty }
  getAll() { return Object.fromEntries(this._channels) }
}

// ═══════════════════════════════════════════════════════════
// 27. DATA LOGGER — persistent data storage
// ═══════════════════════════════════════════════════════════
export class DataLoggerTool {
  private _logs: Map<string, Array<{ value: any; time: number }>> = new Map()
  private _max = 100000

  log(series: string, value: any) {
    if (!this._logs.has(series)) this._logs.set(series, [])
    const arr = this._logs.get(series)!
    arr.push({ value, time: Date.now() })
    if (arr.length > this._max) arr.splice(0, 1000)
  }

  query(series: string, since?: number, until?: number, n = 1000) {
    let arr = this._logs.get(series) || []
    if (since) arr = arr.filter(e => e.time >= since)
    if (until) arr = arr.filter(e => e.time <= until)
    return arr.slice(-n)
  }

  getSeries() { return Array.from(this._logs.keys()) }
  count(series: string) { return this._logs.get(series)?.length || 0 }
  clear(series: string) { this._logs.delete(series) }
  exportCsv(series: string): string {
    const arr = this._logs.get(series) || []
    return "timestamp,value\n" + arr.map(e => `${e.time},${JSON.stringify(e.value)}`).join("\n")
  }
}

// ═══════════════════════════════════════════════════════════
// 28. SCHEDULER — task scheduling
// ═══════════════════════════════════════════════════════════
export class SchedulerTool {
  private _tasks: Map<string, { name: string; interval: number; lastRun: number; enabled: boolean; cb: () => Promise<void> }> = new Map()
  private _intervals: Map<string, ReturnType<typeof setInterval>> = new Map()

  schedule(id: string, name: string, intervalMs: number, callback: () => Promise<void>) {
    this._tasks.set(id, { name, interval: intervalMs, lastRun: 0, enabled: true, cb: callback })
  }
  enable(id: string) { const t = this._tasks.get(id); if (t) t.enabled = true }
  disable(id: string) { const t = this._tasks.get(id); if (t) t.enabled = false }

  start(id: string) {
    const task = this._tasks.get(id)
    if (!task || this._intervals.has(id)) return
    const iv = setInterval(async () => {
      if (!task.enabled) return
      task.lastRun = Date.now()
      try { await task.cb() } catch {}
    }, task.interval)
    this._intervals.set(id, iv)
  }

  stop(id: string) { const iv = this._intervals.get(id); if (iv) { clearInterval(iv); this._intervals.delete(id) } }
  stopAll() { this._intervals.forEach(iv => clearInterval(iv)); this._intervals.clear() }
  getTasks() { return [...this._tasks.entries()].map(([id, t]) => ({ id, name: t.name, enabled: t.enabled, lastRun: t.lastRun })) }
}

// ═══════════════════════════════════════════════════════════
// 29. ALERT — notification and alerting
// ═══════════════════════════════════════════════════════════
export class AlertTool {
  private _alerts: Array<{ id: string; severity: "info" | "warning" | "critical"; message: string; source: string; time: number; ack: boolean }> = []
  private _handlers: Array<(alert: any) => void> = []
  private _rules: Map<string, { condition: (data: any) => boolean; severity: "info" | "warning" | "critical"; message: string }> = new Map()

  onAlert(handler: (alert: any) => void) { this._handlers.push(handler) }
  addRule(id: string, condition: (data: any) => boolean, severity: "info" | "warning" | "critical", message: string) { this._rules.set(id, { condition, severity, message }) }

  trigger(severity: "info" | "warning" | "critical", message: string, source = "system") {
    const alert = { id: `alert_${Date.now()}`, severity, message, source, time: Date.now(), ack: false }
    this._alerts.push(alert)
    this._handlers.forEach(h => h(alert))
    return alert
  }

  check(data: any) {
    for (const [, rule] of this._rules) {
      if (rule.condition(data)) this.trigger(rule.severity, rule.message)
    }
  }

  acknowledge(id: string) { const a = this._alerts.find(x => x.id === id); if (a) a.ack = true }
  getAlerts(n = 50, unackOnly = false) {
    let arr = this._alerts
    if (unackOnly) arr = arr.filter(a => !a.ack)
    return arr.slice(-n)
  }
}

// ═══════════════════════════════════════════════════════════
// 30. CONFIG — configuration management
// ═══════════════════════════════════════════════════════════
export class ConfigTool {
  private _config: Map<string, any> = new Map()
  private _history: Array<{ key: string; old: any; new: any; time: number }> = []

  set(key: string, value: any) {
    const old = this._config.get(key)
    this._config.set(key, value)
    this._history.push({ key, old, new: value, time: Date.now() })
  }
  get(key: string) { return this._config.get(key) }
  has(key: string) { return this._config.has(key) }
  remove(key: string) { this._config.delete(key) }
  getAll() { return Object.fromEntries(this._config) }
  getHistory(n = 50) { return this._history.slice(-n) }
}

// ═══════════════════════════════════════════════════════════
// 31. CALIBRATION — sensor calibration
// ═══════════════════════════════════════════════════════════
export class CalibrationTool {
  private _cal: Map<string, { offset: number; scale: number; calibrated: boolean }> = new Map()
  setOffset(s: string, o: number) { this._cal.set(s, { offset: o, scale: 1, calibrated: true }) }
  setScale(s: string, sc: number) { const c = this._cal.get(s); if (c) c.scale = sc }
  calibrate(s: string, raw: number[]) {
    const avg = raw.reduce((a, b) => a + b, 0) / raw.length
    this._cal.set(s, { offset: -avg, scale: 1, calibrated: true })
  }
  apply(s: string, v: number) { const c = this._cal.get(s); return c?.calibrated ? (v + c.offset) * c.scale : v }
  isCalibrated(s: string) { return this._cal.get(s)?.calibrated || false }
  getCalibration(s: string) { return this._cal.get(s) || null }
}

// ═══════════════════════════════════════════════════════════
// 32. DIAGNOSTICS — system health checks
// ═══════════════════════════════════════════════════════════
export class DiagnosticsTool {
  private _checks: Map<string, { result: "pass" | "fail" | "warn"; detail: string; time: number }> = new Map()
  async runCheck(name: string, fn: () => Promise<{ pass: boolean; detail: string }>): Promise<ToolResult> {
    try {
      const r = await fn()
      this._checks.set(name, { result: r.pass ? "pass" : "fail", detail: r.detail, time: Date.now() })
      return { ok: true, data: { name, result: r.pass ? "pass" : "fail", detail: r.detail } }
    } catch (e) {
      this._checks.set(name, { result: "fail", detail: String(e), time: Date.now() })
      return { ok: false, error: String(e) }
    }
  }
  getCheck(n: string) { return this._checks.get(n) || null }
  getAllChecks() { return Object.fromEntries(this._checks) }
  systemReport() {
    const c = [...this._checks.values()]
    return { total: c.length, passed: c.filter(x => x.result === "pass").length, failed: c.filter(x => x.result === "fail").length, warnings: c.filter(x => x.result === "warn").length }
  }
}

// ═══════════════════════════════════════════════════════════
// 33. FIRMWARE — firmware version management
// ═══════════════════════════════════════════════════════════
export class FirmwareTool {
  private _comp: Map<string, { version: string; lastUpdate: number; status: string }> = new Map()
  register(id: string, v: string) { this._comp.set(id, { version: v, lastUpdate: Date.now(), status: "current" }) }
  async update(id: string, v: string, serial?: any): Promise<ToolResult> {
    const c = this._comp.get(id)
    if (!c) return { ok: false, error: `Component not found: ${id}` }
    if (serial) { try { await serial.sendCommand(`FW_UPDATE:${id}:${v}`) } catch (e) { return { ok: false, error: String(e) } } }
    c.version = v; c.lastUpdate = Date.now(); c.status = "updated"
    return { ok: true, data: { id, version: v } }
  }
  getVersion(id: string) { return this._comp.get(id)?.version }
  getAll() { return Object.fromEntries(this._comp) }
}

// ═══════════════════════════════════════════════════════════
// 34. NETWORK — network config and diagnostics
// ═══════════════════════════════════════════════════════════
export class NetworkTool {
  private _iface: Map<string, { ip: string; mask: string; gateway: string; dns: string; mac: string; up: boolean }> = new Map()
  private _conn: Map<string, { host: string; port: number; protocol: string; connected: number }> = new Map()
  setInterface(n: string, ip: string, mask: string, gw: string, dns: string, mac: string) { this._iface.set(n, { ip, mask, gateway: gw, dns, mac, up: true }) }
  getInterface(n: string) { return this._iface.get(n) }
  getAllInterfaces() { return Object.fromEntries(this._iface) }
  async ping(host: string): Promise<ToolResult> {
    try {
      const s = Date.now()
      await fetch(`https://${host}`, { method: "HEAD", signal: AbortSignal.timeout(5000) }).catch(() => {})
      return { ok: true, data: { host, latency: Date.now() - s } }
    } catch (e) { return { ok: false, error: String(e) } }
  }
  addConnection(id: string, h: string, p: number, proto: string) { this._conn.set(id, { host: h, port: p, protocol: proto, connected: Date.now() }) }
  removeConnection(id: string) { this._conn.delete(id) }
  getConnections() { return Object.fromEntries(this._conn) }
}

// ═══════════════════════════════════════════════════════════
// 35. STORAGE — data storage management
// ═══════════════════════════════════════════════════════════
export class StorageTool {
  private _stores: Map<string, Map<string, { value: any; time: number }>> = new Map()
  createStore(n: string) { if (!this._stores.has(n)) this._stores.set(n, new Map()) }
  set(store: string, key: string, value: any) {
    let s = this._stores.get(store); if (!s) { s = new Map(); this._stores.set(store, s) }
    s.set(key, { value, time: Date.now() })
  }
  get(store: string, key: string) { return this._stores.get(store)?.get(key)?.value }
  has(store: string, key: string) { return this._stores.get(store)?.has(key) || false }
  remove(store: string, key: string) { this._stores.get(store)?.delete(key) }
  keys(store: string) { return [...(this._stores.get(store)?.keys() || [])] }
  size(store: string) { return this._stores.get(store)?.size || 0 }
  clear(store: string) { this._stores.get(store)?.clear() }
  listStores() { return Array.from(this._stores.keys()) }
}

// ═══════════════════════════════════════════════════════════
// 36. PROCESS — process management
// ═══════════════════════════════════════════════════════════
export class ProcessTool {
  private _procs: Map<string, { name: string; status: string; pid: number; started: number; cpu: number; mem: number }> = new Map()
  start(id: string, name: string) { this._procs.set(id, { name, status: "running", pid: Date.now() % 100000, started: Date.now(), cpu: 0, mem: 0 }) }
  stop(id: string) { const p = this._procs.get(id); if (p) p.status = "stopped" }
  getStatus(id: string) { return this._procs.get(id)?.status }
  updateMetrics(id: string, cpu: number, mem: number) { const p = this._procs.get(id); if (p) { p.cpu = cpu; p.mem = mem } }
  getAll() { return Object.fromEntries(this._procs) }
}

// ═══════════════════════════════════════════════════════════
// 37. TIMER — stopwatch and countdown
// ═══════════════════════════════════════════════════════════
export class TimerTool {
  private _timers: Map<string, { start: number; end?: number; type: string; duration?: number; laps: number[] }> = new Map()
  startStopwatch(id: string) { this._timers.set(id, { start: Date.now(), type: "stopwatch", laps: [] }) }
  startCountdown(id: string, ms: number) { this._timers.set(id, { start: Date.now(), type: "countdown", duration: ms, laps: [] }) }
  stop(id: string) { const t = this._timers.get(id); if (t) t.end = Date.now() }
  lap(id: string) { const t = this._timers.get(id); if (t) t.laps.push(Date.now() - t.start) }
  elapsed(id: string): number { const t = this._timers.get(id); return t ? (t.end || Date.now()) - t.start : 0 }
  remaining(id: string): number {
    const t = this._timers.get(id)
    if (!t || t.type !== "countdown" || !t.duration) return 0
    return Math.max(0, t.duration - (Date.now() - t.start))
  }
  isComplete(id: string): boolean {
    const t = this._timers.get(id)
    if (!t || t.type !== "countdown" || !t.duration) return false
    return (Date.now() - t.start) >= t.duration
  }
  getLaps(id: string) { return this._timers.get(id)?.laps || [] }
  getAll() { return Object.fromEntries(this._timers) }
}

// ═══════════════════════════════════════════════════════════
// 38. MATH — mathematical calculations
// ═══════════════════════════════════════════════════════════
export class MathTool {
  distance3d(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
    return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2)
  }
  lerp(a: number, b: number, t: number): number { return a + (b - a) * Math.max(0, Math.min(1, t)) }
  clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)) }
  normalize(value: number, min: number, max: number): number { return max === min ? 0 : (value - min) / (max - min) }
  mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin)
  }
  movingAverage(data: number[], window: number): number[] {
    const result: number[] = []
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - window + 1)
      const slice = data.slice(start, i + 1)
      result.push(slice.reduce((a, b) => a + b, 0) / slice.length)
    }
    return result
  }
  exponentialSmooth(data: number[], alpha: number): number[] {
    if (data.length === 0) return []
    const result = [data[0]]
    for (let i = 1; i < data.length; i++) {
      result.push(alpha * data[i] + (1 - alpha) * result[i - 1])
    }
    return result
  }
  pid(error: number, prev: number, integral: number, kp: number, ki: number, kd: number, dt: number): number {
    return kp * error + ki * integral * dt + kd * (error - prev) / dt
  }
  wrapAngle(deg: number): number { return ((deg % 360) + 360) % 360 }
  degToRad(deg: number): number { return deg * Math.PI / 180 }
  radToDeg(rad: number): number { return rad * 180 / Math.PI }
}

export class AutopilotTool {
  private _modes = { heading: false, altitude: false, speed: false, nav: false, approach: false }
  private _targets = { heading: 0, altitude: 1000, speed: 0, vs: 0 }
  private _kp = 1.2; private _ki = 0.05; private _kd = 0.3
  private _integral = { heading: 0, altitude: 0 }
  private _prevError = { heading: 0, altitude: 0 }
  private _lastUpdate = 0
  engageHeading(heading: number) { this._modes.heading = true; this._targets.heading = heading }
  disengageHeading() { this._modes.heading = false; this._integral.heading = 0; this._prevError.heading = 0 }
  engageAltitude(alt: number) { this._modes.altitude = true; this._targets.altitude = alt }
  disengageAltitude() { this._modes.altitude = false; this._integral.altitude = 0; this._prevError.altitude = 0 }
  engageSpeed(spd: number) { this._modes.speed = true; this._targets.speed = spd }
  engageNav() { this._modes.nav = true }
  engageApproach() { this._modes.approach = true }
  disengageAll() { this._modes = { heading: false, altitude: false, speed: false, nav: false, approach: false }; this._integral = { heading: 0, altitude: 0 }; this._prevError = { heading: 0, altitude: 0 } }
  setPID(kp: number, ki: number, kd: number) { this._kp = kp; this._ki = ki; this._kd = kd }
  getModes() { return { ...this._modes } }
  getTargets() { return { ...this._targets } }
  compute(currentHeading: number, currentAlt: number, currentSpeed: number) {
    const now = Date.now(); const dt = this._lastUpdate ? (now - this._lastUpdate) / 1000 : 0.1; this._lastUpdate = now
    const active: string[] = []; let pitch = 0, roll = 0, throttle = 50
    if (this._modes.heading) {
      let err = this._targets.heading - currentHeading
      if (err > 180) err -= 360; if (err < -180) err += 360
      this._integral.heading = Math.max(-50, Math.min(50, this._integral.heading + err * dt))
      const deriv = (err - this._prevError.heading) / (dt || 0.01)
      roll = this._kp * err + this._ki * this._integral.heading + this._kd * deriv
      this._prevError.heading = err; active.push('HDG')
    }
    if (this._modes.altitude) {
      const err = this._targets.altitude - currentAlt
      this._integral.altitude = Math.max(-50, Math.min(50, this._integral.altitude + err * dt))
      const deriv = (err - this._prevError.altitude) / (dt || 0.01)
      pitch = this._kp * err * 0.1 + this._ki * this._integral.altitude + this._kd * deriv * 0.5
      this._prevError.altitude = err; active.push('ALT')
    }
    if (this._modes.speed) { throttle = Math.max(0, Math.min(100, 50 + (this._targets.speed - currentSpeed) * 2)); active.push('SPD') }
    if (this._modes.nav) active.push('NAV')
    if (this._modes.approach) active.push('APR')
    return { pitch, roll, throttle, activeModes: active }
  }
}

export class FlightDirectorTool {
  private _latMode: 'off' | 'roll' | 'heading' | 'nav' | 'loc' | 'app' = 'off'
  private _vrtMode: 'off' | 'pitch' | 'alt' | 'vs' | 'flc' | 'glide' = 'off'
  private _latVal = 0; private _vrtVal = 0
  private _enabled = false
  private _rollLimit = 30; private _pitchLimit = 25
  enable() { this._enabled = true }
  disable() { this._enabled = false; this._latMode = 'off'; this._vrtMode = 'off' }
  setLateral(mode: typeof this._latMode, val?: number) { this._latMode = mode; if (val !== undefined) this._latVal = val }
  setVertical(mode: typeof this._vrtMode, val?: number) { this._vrtMode = mode; if (val !== undefined) this._vrtVal = val }
  isEnabled() { return this._enabled }
  getModes() { return { lateral: this._latMode, vertical: this._vrtMode } }
  compute(c: { hdg: number; pitch: number; roll: number; alt: number; ias: number; vs: number; locDev: number; gsDev: number }) {
    if (!this._enabled) return { cmdPitch: 0, cmdRoll: 0, latMode: 'OFF', vrtMode: 'OFF' }
    let cmdRoll = 0, cmdPitch = 0
    if (this._latMode === 'roll') cmdRoll = Math.max(-this._rollLimit, Math.min(this._rollLimit, this._latVal))
    else if (this._latMode === 'heading') { let e = this._latVal - c.hdg; if (e > 180) e -= 360; if (e < -180) e += 360; cmdRoll = Math.max(-this._rollLimit, Math.min(this._rollLimit, e * 2)) }
    else if (this._latMode === 'nav' || this._latMode === 'loc') cmdRoll = Math.max(-this._rollLimit, Math.min(this._rollLimit, c.locDev * 4))
    else if (this._latMode === 'app') { cmdRoll = Math.max(-this._rollLimit, Math.min(this._rollLimit, c.locDev * 3)); cmdPitch = Math.max(-this._pitchLimit, Math.min(this._pitchLimit, c.gsDev * -2)) }
    if (this._vrtMode === 'pitch') cmdPitch = Math.max(-this._pitchLimit, Math.min(this._pitchLimit, this._vrtVal))
    else if (this._vrtMode === 'alt') cmdPitch = Math.max(-this._pitchLimit, Math.min(this._pitchLimit, (this._vrtVal - c.alt) * 0.01))
    else if (this._vrtMode === 'vs') cmdPitch = Math.max(-this._pitchLimit, Math.min(this._pitchLimit, (this._vrtVal - c.vs) * 0.5))
    else if (this._vrtMode === 'flc') cmdPitch = Math.max(-this._pitchLimit, Math.min(this._pitchLimit, (this._vrtVal - c.ias) * 0.3))
    else if (this._vrtMode === 'glide') cmdPitch = Math.max(-this._pitchLimit, Math.min(this._pitchLimit, c.gsDev * -3))
    return { cmdPitch, cmdRoll, latMode: this._latMode.toUpperCase(), vrtMode: this._vrtMode.toUpperCase() }
  }
}

export class NavigationDisplayTool {
  private _waypoints: Array<{ id: string; lat: number; lon: number; alt: number; spd: number; type: string; eta: number }> = []
  private _currentIdx = 0
  private _flightPlanId = ''
  private _visibleRange = 200
  loadFlightPlan(id: string, waypoints: Array<{ id: string; lat: number; lon: number; alt: number; spd: number; type: string }>) { this._flightPlanId = id; this._waypoints = waypoints.map(w => ({ ...w, eta: 0 })); this._currentIdx = 0 }
  setVisibleRange(nm: number) { this._visibleRange = nm }
  getCurrentWaypoint() { return this._waypoints[this._currentIdx] || null }
  getNextWaypoint() { return this._waypoints[this._currentIdx + 1] || null }
  advance() { if (this._currentIdx < this._waypoints.length - 1) this._currentIdx++ }
  jumpTo(idx: number) { if (idx >= 0 && idx < this._waypoints.length) this._currentIdx = idx }
  insertWaypoint(idx: number, wp: { id: string; lat: number; lon: number; alt: number; spd: number; type: string }) { this._waypoints.splice(idx, 0, { ...wp, eta: 0 }) }
  removeWaypoint(idx: number) { this._waypoints.splice(idx, 1); this._currentIdx = Math.min(this._currentIdx, Math.max(0, this._waypoints.length - 1)) }
  getRemainingDistance(): number {
    let total = 0
    for (let i = this._currentIdx; i < this._waypoints.length - 1; i++) {
      const a = this._waypoints[i], b = this._waypoints[i + 1]
      const R = 3440.065; const dLat = (b.lat - a.lat) * Math.PI / 180; const dLon = (b.lon - a.lon) * Math.PI / 180
      total += 2 * R * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2))
    }
    return total
  }
  getFlightPlan() { return { id: this._flightPlanId, waypoints: this._waypoints, currentIdx: this._currentIdx, total: this._waypoints.length, visibleRange: this._visibleRange } }
}

export class EngineMonitorTool {
  private _engines: Map<string, { n1: number; n2: number; egt: number; fuelFlow: number; oilTemp: number; oilPressure: number; vibration: number; status: string; lastUpdate: number }> = new Map()
  private _limits: Map<string, { warn: number; critical: number }> = new Map()
  private _history: Array<{ engines: any; time: number }> = []
  register(id: string) { this._engines.set(id, { n1: 0, n2: 0, egt: 0, fuelFlow: 0, oilTemp: 0, oilPressure: 0, vibration: 0, status: 'OFF', lastUpdate: Date.now() }) }
  setLimits(param: string, warn: number, critical: number) { this._limits.set(param, { warn, critical }) }
  update(id: string, data: Partial<{ n1: number; n2: number; egt: number; fuelFlow: number; oilTemp: number; oilPressure: number; vibration: number; status: string }>) {
    const eng = this._engines.get(id); if (eng) { Object.assign(eng, data, { lastUpdate: Date.now() }); this._history.push({ engines: Object.fromEntries(this._engines), time: Date.now() }) }
  }
  getEngine(id: string) { return this._engines.get(id) }
  getAllEngines() { return Object.fromEntries(this._engines) }
  getTotalFuelFlow(): number { let t = 0; this._engines.forEach(e => { t += e.fuelFlow }); return t }
  getTotalThrust(): number { let t = 0; this._engines.forEach(e => { t += e.n1 }); return t }
  checkLimits(id: string): string[] {
    const eng = this._engines.get(id); if (!eng) return []; const w: string[] = []
    this._limits.forEach((lim, param) => { const val = (eng as any)[param]; if (val !== undefined) { if (val >= lim.critical) w.push('CRITICAL:' + param); else if (val >= lim.warn) w.push('WARN:' + param) } })
    return w
  }
  getHistory(n = 100) { return this._history.slice(-n) }
}

export class HydraulicsTool {
  private _systems: Map<string, { pressure: number; quantity: number; temp: number; pumpOn: boolean; filterOk: boolean; lastUpdate: number }> = new Map()
  private _nominalPressure = 3000
  registerSystem(id: string, nominalPressure = 3000) { this._systems.set(id, { pressure: 0, quantity: 100, temp: 20, pumpOn: false, filterOk: true, lastUpdate: Date.now() }); this._nominalPressure = nominalPressure }
  update(id: string, data: Partial<{ pressure: number; quantity: number; temp: number; pumpOn: boolean; filterOk: boolean }>) { const s = this._systems.get(id); if (s) Object.assign(s, data, { lastUpdate: Date.now() }) }
  getSystem(id: string) { return this._systems.get(id) }
  getAllSystems() { return Object.fromEntries(this._systems) }
  isPressureOk(id: string): boolean { const s = this._systems.get(id); return s ? s.pressure >= this._nominalPressure * 0.85 : false }
  getOverallStatus(): 'NOMINAL' | 'DEGRADED' | 'CRITICAL' {
    let c = false, d = false
    this._systems.forEach(s => { if (s.pressure < this._nominalPressure * 0.6 || s.quantity < 20) c = true; else if (s.pressure < this._nominalPressure * 0.85 || s.quantity < 50) d = true })
    return c ? 'CRITICAL' : d ? 'DEGRADED' : 'NOMINAL'
  }
  setPump(id: string, on: boolean) { const s = this._systems.get(id); if (s) s.pumpOn = on }
}

export class ElectricalTool {
  private _buses: Map<string, { voltage: number; current: number; load: number; breakerOk: boolean }> = new Map()
  private _generators: Map<string, { voltage: number; frequency: number; online: boolean; load: number }> = new Map()
  private _batteries: Map<string, { voltage: number; soc: number; temp: number; charging: boolean }> = new Map()
  registerBus(id: string) { this._buses.set(id, { voltage: 0, current: 0, load: 0, breakerOk: true }) }
  registerGenerator(id: string) { this._generators.set(id, { voltage: 0, frequency: 0, online: false, load: 0 }) }
  registerBattery(id: string) { this._batteries.set(id, { voltage: 0, soc: 0, temp: 20, charging: false }) }
  updateBus(id: string, voltage: number, current: number, load: number) { const b = this._buses.get(id); if (b) { b.voltage = voltage; b.current = current; b.load = load } }
  updateGenerator(id: string, voltage: number, frequency: number, online: boolean, load: number) { const g = this._generators.get(id); if (g) { g.voltage = voltage; g.frequency = frequency; g.online = online; g.load = load } }
  updateBattery(id: string, voltage: number, soc: number, temp: number, charging: boolean) { const b = this._batteries.get(id); if (b) { b.voltage = voltage; b.soc = soc; b.temp = temp; b.charging = charging } }
  tripBreaker(busId: string) { const b = this._buses.get(busId); if (b) b.breakerOk = false }
  resetBreaker(busId: string) { const b = this._buses.get(busId); if (b) b.breakerOk = true }
  getTotalLoad(): number { let t = 0; this._buses.forEach(b => { t += b.load }); return t }
  getBus(id: string) { return this._buses.get(id) }
  getGenerator(id: string) { return this._generators.get(id) }
  getBattery(id: string) { return this._batteries.get(id) }
  getAllBuses() { return Object.fromEntries(this._buses) }
  getAllGenerators() { return Object.fromEntries(this._generators) }
  getAllBatteries() { return Object.fromEntries(this._batteries) }
}

export class FuelSystemTool {
  private _tanks: Map<string, { quantity: number; capacity: number; temperature: number; density: number; pumpActive: boolean }> = new Map()
  private _transferLog: Array<{ from: string; to: string; amount: number; time: number }> = []
  registerTank(id: string, capacity: number) { this._tanks.set(id, { quantity: 0, capacity, temperature: 15, density: 0.8, pumpActive: false }) }
  setQuantity(id: string, qty: number) { const t = this._tanks.get(id); if (t) t.quantity = Math.max(0, Math.min(t.capacity, qty)) }
  getTank(id: string) { return this._tanks.get(id) }
  getAllTanks() { return Object.fromEntries(this._tanks) }
  getTotalQuantity(): number { let t = 0; this._tanks.forEach(tank => { t += tank.quantity }); return t }
  getTotalCapacity(): number { let t = 0; this._tanks.forEach(tank => { t += tank.capacity }); return t }
  getBalance(): { left: number; right: number; imbalance: number } {
    let left = 0, right = 0
    this._tanks.forEach((t, id) => { if (id.includes('LEFT') || id.includes('L')) left += t.quantity; else right += t.quantity })
    return { left, right, imbalance: Math.abs(left - right) }
  }
  async transfer(fromId: string, toId: string, amount: number): Promise<ToolResult> {
    const from = this._tanks.get(fromId), to = this._tanks.get(toId)
    if (!from || !to) return { ok: false, error: 'Tank not found' }
    if (from.quantity < amount) return { ok: false, error: 'Insufficient fuel' }
    const actual = Math.min(amount, to.capacity - to.quantity)
    from.quantity -= actual; to.quantity += actual
    this._transferLog.push({ from: fromId, to: toId, amount: actual, time: Date.now() })
    return { ok: true, data: { transferred: actual, from: fromId, to: toId } }
  }
  consumeFuel(id: string, amount: number) { const t = this._tanks.get(id); if (t) t.quantity = Math.max(0, t.quantity - amount) }
  getTransferLog(n = 50) { return this._transferLog.slice(-n) }
}

export class PressurizationTool {
  private _cabinAlt = 0
  private _differential = 0
  private _outflowValve = 0
  private _targetCabinAlt = 0
  private _maxDiff = 8.5
  private _history: Array<{ cabinAlt: number; differential: number; time: number }> = []
  setTargetCabinAlt(alt: number) { this._targetCabinAlt = alt }
  setMaxDifferential(max: number) { this._maxDiff = max }
  update(cabinAlt: number, differential: number) { this._cabinAlt = cabinAlt; this._differential = differential; this._history.push({ cabinAlt, differential, time: Date.now() }); if (this._history.length > 10000) this._history.shift() }
  getCabinAltitude() { return this._cabinAlt }
  getDifferential() { return this._differential }
  isOverpressure(): boolean { return this._differential > this._maxDiff }
  getOutflowValve(): number { const err = this._cabinAlt - this._targetCabinAlt; this._outflowValve = Math.max(0, Math.min(100, 50 + err * 0.5)); return this._outflowValve }
  getHistory(n = 100) { return this._history.slice(-n) }
}

export class AntiIceTool {
  private _wingOn = false
  private _engineOn: Map<string, boolean> = new Map()
  private _probeHeat = false
  private _windowHeat: Map<string, boolean> = new Map()
  setWingAntiIce(on: boolean) { this._wingOn = on }
  getWingAntiIce() { return this._wingOn }
  setEngineAntiIce(id: string, on: boolean) { this._engineOn.set(id, on) }
  getEngineAntiIce(id: string) { return this._engineOn.get(id) || false }
  getAllEngineAntiIce() { return Object.fromEntries(this._engineOn) }
  setProbeHeat(on: boolean) { this._probeHeat = on }
  getProbeHeat() { return this._probeHeat }
  setWindowHeat(id: string, on: boolean) { this._windowHeat.set(id, on) }
  getWindowHeat(id: string) { return this._windowHeat.get(id) || false }
  isAnyActive(): boolean { return this._wingOn || this._probeHeat || [...this._engineOn.values()].some(v => v) || [...this._windowHeat.values()].some(v => v) }
  getAll() { return { wing: this._wingOn, engines: Object.fromEntries(this._engineOn), probeHeat: this._probeHeat, windowHeat: Object.fromEntries(this._windowHeat) } }
}

export class LandingGearTool {
  private _gear: Map<string, { position: 'UP' | 'DOWN' | 'TRANSIT'; doorOpen: boolean; brakeTemp: number; tirePressure: number }> = new Map()
  private _weightOnWheels = false
  registerGear(id: string) { this._gear.set(id, { position: 'UP', doorOpen: false, brakeTemp: 20, tirePressure: 180 }) }
  update(id: string, data: Partial<{ position: 'UP' | 'DOWN' | 'TRANSIT'; doorOpen: boolean; brakeTemp: number; tirePressure: number }>) { const g = this._gear.get(id); if (g) Object.assign(g, data) }
  getGear(id: string) { return this._gear.get(id) }
  getAllGear() { return Object.fromEntries(this._gear) }
  setWeightOnWheels(wow: boolean) { this._weightOnWheels = wow }
  isWeightOnWheels() { return this._weightOnWheels }
  isGearDown(): boolean { return [...this._gear.values()].every(g => g.position === 'DOWN') }
  isGearUp(): boolean { return [...this._gear.values()].every(g => g.position === 'UP') }
  getHighestBrakeTemp(): number { let max = 0; this._gear.forEach(g => { max = Math.max(max, g.brakeTemp) }); return max }
}

export class AutoBrakeTool {
  private _level: 0 | 1 | 2 | 3 | 4 | 5 = 0
  private _armed = false
  private _active = false
  private _rejected = false
  setLevel(level: 0 | 1 | 2 | 3 | 4 | 5) { this._level = level; this._armed = level > 0 }
  getLevel() { return this._level }
  isArmed() { return this._armed }
  isActive() { return this._active }
  getDecelRate(): number { return [0, 2, 4, 6, 8, 10][this._level] }
  activate() { if (this._armed) this._active = true }
  deactivate() { this._active = false; this._armed = false }
  reject() { this._rejected = true; this._active = true }
  isRejected() { return this._rejected }
  resetRejected() { this._rejected = false }
  getStatus() { return { level: this._level, armed: this._armed, active: this._active, rejected: this._rejected, decelRate: this.getDecelRate() } }
}

export class TCASTool {
  private _targets: Array<{ id: string; alt: number; distance: number; bearing: number; vs: number }> = []
  private _advisory: 'NONE' | 'TA' | 'RA' = 'NONE'
  private _raCommand: { verticalSpeed: number; response: string } = { verticalSpeed: 0, response: 'CLEAR' }
  private _taRange = 5
  private _raRange = 2
  setTARange(nm: number) { this._taRange = nm }
  setRARange(nm: number) { this._raRange = nm }
  updateTargets(targets: Array<{ id: string; alt: number; distance: number; bearing: number; vs: number }>) { this._targets = targets }
  getTargets() { return this._targets }
  evaluate(): { advisory: string; response: string; target?: any } {
    let closest: any = null, closestDist = Infinity
    this._targets.forEach(t => { if (t.distance < closestDist) { closestDist = t.distance; closest = t } })
    if (closest && closestDist < this._raRange) {
      this._advisory = 'RA'
      this._raCommand = closest.alt > 0 ? { verticalSpeed: -2000, response: 'DESCEND' } : { verticalSpeed: 2000, response: 'CLIMB' }
      return { advisory: 'RA', response: this._raCommand.response, target: closest }
    }
    if (closest && closestDist < this._taRange) { this._advisory = 'TA'; return { advisory: 'TA', response: 'MONITOR', target: closest } }
    this._advisory = 'NONE'; this._raCommand = { verticalSpeed: 0, response: 'CLEAR' }
    return { advisory: 'NONE', response: 'CLEAR' }
  }
  getAdvisory() { return this._advisory }
  getRACommand() { return this._raCommand }
}

export class WeatherRadarTool {
  private _tilt = 0
  private _gain = 50
  private _mode: 'WX' | 'MAP' | 'TURB' | 'GCC' = 'WX'
  private _range = 80
  private _returns: Array<{ distance: number; bearing: number; intensity: number; type: string }> = []
  private _stormCells: Array<{ intensity: number; tops: number }> = []
  setTilt(deg: number) { this._tilt = Math.max(-30, Math.min(30, deg)) }
  setGain(pct: number) { this._gain = Math.max(0, Math.min(100, pct)) }
  setMode(mode: typeof this._mode) { this._mode = mode }
  setRange(nm: number) { this._range = Math.max(10, Math.min(320, nm)) }
  getTilt() { return this._tilt }
  getGain() { return this._gain }
  getMode() { return this._mode }
  processReturns(returns: Array<{ distance: number; bearing: number; intensity: number }>) {
    this._returns = returns.map(r => ({ ...r, type: r.intensity > 70 ? 'SEVERE' : r.intensity > 40 ? 'MODERATE' : 'LIGHT' }))
    this._stormCells = this._returns.filter(r => r.intensity > 60).map(r => ({ intensity: r.intensity, tops: r.intensity * 200 }))
  }
  getReturns() { return this._returns }
  getStormCells() { return this._stormCells }
  hasSevereWeather(): boolean { return this._returns.some(r => r.intensity > 70) }
}

export class GPWSTool {
  private _modes = { terrain: true, sinkRate: true, pullUp: true, terrainClearance: true, glideslope: true, baro: true }
  private _warnings: Array<{ mode: string; message: string; time: number; priority: number }> = []
  private _radioAlt = 0
  private _terrainAlt = 0
  private _glidePathDev = 0
  setModes(modes: Partial<typeof this._modes>) { Object.assign(this._modes, modes) }
  update(radioAlt: number, terrainAlt: number, glidePathDev?: number) {
    this._radioAlt = radioAlt; this._terrainAlt = terrainAlt; if (glidePathDev !== undefined) this._glidePathDev = glidePathDev
    this._warnings = []
    if (this._modes.terrain && this._radioAlt < 500 && this._terrainAlt > this._radioAlt * 0.8) this._warnings.push({ mode: 'TERRAIN', message: 'TERRAIN, TERRAIN', time: Date.now(), priority: 3 })
    if (this._modes.pullUp && this._radioAlt < 200) this._warnings.push({ mode: 'PULL_UP', message: 'PULL UP', time: Date.now(), priority: 4 })
    if (this._modes.sinkRate && this._radioAlt < 1000) this._warnings.push({ mode: 'SINK_RATE', message: 'SINK RATE', time: Date.now(), priority: 2 })
    if (this._modes.glideslope && Math.abs(this._glidePathDev) > 1.5) this._warnings.push({ mode: 'GLIDESLOPE', message: 'GLIDESLOPE', time: Date.now(), priority: 1 })
  }
  getWarnings() { return this._warnings }
  hasWarning(): boolean { return this._warnings.length > 0 }
  getMostSevere(): string { if (!this._warnings.length) return 'NONE'; return this._warnings.sort((a, b) => b.priority - a.priority)[0].message }
  getModes() { return { ...this._modes } }
}

export class RadioAltimeterTool {
  private _height = 0
  private _decisionHeight = 200
  private _minimums = 100
  private _history: Array<{ height: number; time: number }> = []
  private _onDecision?: () => void
  setDecisionHeight(feet: number) { this._decisionHeight = feet }
  setMinimums(feet: number) { this._minimums = feet }
  onDecision(cb: () => void) { this._onDecision = cb }
  update(height: number) { this._height = height; this._history.push({ height, time: Date.now() }); if (this._history.length > 5000) this._history.shift(); if (height <= this._decisionHeight) this._onDecision?.() }
  getHeight() { return this._height }
  isAtDecisionHeight(): boolean { return this._height <= this._decisionHeight }
  isBelowMinimums(): boolean { return this._height <= this._minimums }
  getDescentRate(): number {
    if (this._history.length < 2) return 0
    const prev = this._history[this._history.length - 2]; const curr = this._history[this._history.length - 1]
    return (curr.height - prev.height) / ((curr.time - prev.time) / 1000)
  }
}

export class TransmissionTool {
  private _currentGear = 1
  private _totalGears = 6
  private _ratios = [3.8, 2.4, 1.65, 1.2, 0.9, 0.72]
  private _mode: 'auto' | 'manual' | 'sport' | 'eco' = 'auto'
  private _clutchEngaged = true
  private _oilTemp = 80
  private _shiftPoints = [25, 45, 65, 85, 100]
  setTotalGears(n: number) { this._totalGears = n; while (this._ratios.length < n) this._ratios.push(0.7) }
  setRatio(gear: number, ratio: number) { this._ratios[gear] = ratio }
  setMode(mode: typeof this._mode) { this._mode = mode }
  getMode() { return this._mode }
  getGear() { return this._currentGear }
  getRatio() { return this._ratios[this._currentGear - 1] || 1 }
  getRPM(wheelRPM: number): number { return wheelRPM * this.getRatio() }
  updateOilTemp(temp: number) { this._oilTemp = temp }
  getOilTemp() { return this._oilTemp }
  setClutch(engaged: boolean) { this._clutchEngaged = engaged }
  isClutchEngaged() { return this._clutchEngaged }
  shouldShiftUp(speed: number): boolean { return this._currentGear < this._totalGears && speed > (this._shiftPoints[this._currentGear - 1] || 100) }
  shouldShiftDown(speed: number): boolean { return this._currentGear > 1 && speed < (this._shiftPoints[this._currentGear - 2] || 20) }
  shiftUp() { if (this._currentGear < this._totalGears) this._currentGear++ }
  shiftDown() { if (this._currentGear > 1) this._currentGear-- }
  setGear(gear: number) { this._currentGear = Math.max(1, Math.min(this._totalGears, gear)) }
}

export class BrakeSystemTool {
  private _absActive = false
  private _brakePressure = 0
  private _padWear: Map<string, number> = new Map()
  private _brakeTemps: Map<string, number> = new Map()
  private _parkingBrake = false
  setBrakePressure(psi: number) { this._brakePressure = Math.max(0, Math.min(3000, psi)) }
  getBrakePressure() { return this._brakePressure }
  setABS(active: boolean) { this._absActive = active }
  isABSActive() { return this._absActive }
  setParkingBrake(on: boolean) { this._parkingBrake = on }
  isParkingBrakeOn() { return this._parkingBrake }
  updatePadWear(position: string, pct: number) { this._padWear.set(position, Math.max(0, Math.min(100, pct))) }
  getPadWear(position: string) { return this._padWear.get(position) }
  updateBrakeTemp(position: string, temp: number) { this._brakeTemps.set(position, temp) }
  getBrakeTemp(position: string) { return this._brakeTemps.get(position) }
  getAllTemps() { return Object.fromEntries(this._brakeTemps) }
  getAllPadWear() { return Object.fromEntries(this._padWear) }
  isBrakeOverheating(): boolean { return [...this._brakeTemps.values()].some(t => t > 500) }
  needsPadReplacement(): boolean { return [...this._padWear.values()].some(w => w < 10) }
}

export class SteeringTool {
  private _angle = 0
  private _maxAngle = 45
  private _torque = 0
  private _mode: 'normal' | 'sport' | 'comfort' | 'offroad' = 'normal'
  private _ratio = 16
  setMaxAngle(deg: number) { this._maxAngle = deg }
  setRatio(ratio: number) { this._ratio = ratio }
  setMode(mode: typeof this._mode) { this._mode = mode }
  getMode() { return this._mode }
  setAngle(deg: number) { this._angle = Math.max(-this._maxAngle, Math.min(this._maxAngle, deg)) }
  getAngle() { return this._angle }
  setTorque(nm: number) { this._torque = nm }
  getTorque() { return this._torque }
  getWheelAngle(): number { return this._angle * this._ratio }
  isStraight(): boolean { return Math.abs(this._angle) < 1 }
}

export class SuspensionTool {
  private _corners: Map<string, { rideHeight: number; damping: number; springRate: number; load: number }> = new Map()
  private _rideMode: 'comfort' | 'normal' | 'sport' | 'offroad' = 'normal'
  private _leveling = false
  registerCorner(id: string) { this._corners.set(id, { rideHeight: 0, damping: 50, springRate: 100, load: 0 }) }
  updateCorner(id: string, data: Partial<{ rideHeight: number; damping: number; springRate: number; load: number }>) { const c = this._corners.get(id); if (c) Object.assign(c, data) }
  getCorner(id: string) { return this._corners.get(id) }
  getAllCorners() { return Object.fromEntries(this._corners) }
  setRideMode(mode: typeof this._rideMode) { this._rideMode = mode; this._corners.forEach(c => { if (mode === 'sport') c.damping = 80; else if (mode === 'comfort') c.damping = 30; else c.damping = 50 }) }
  getRideMode() { return this._rideMode }
  setLeveling(on: boolean) { this._leveling = on }
  isLeveling() { return this._leveling }
  getAverageHeight(): number { if (this._corners.size === 0) return 0; let t = 0; this._corners.forEach(c => { t += c.rideHeight }); return t / this._corners.size }
  getLevelDifference(): number { const h = [...this._corners.values()].map(c => c.rideHeight); return h.length ? Math.max(...h) - Math.min(...h) : 0 }
}

export class TireMonitorTool {
  private _tires: Map<string, { pressure: number; temp: number; treadDepth: number; sensorOk: boolean }> = new Map()
  private _nominalPressure = 32
  private _tempWarning = 80
  registerTire(id: string, nominalPressure = 32) { this._tires.set(id, { pressure: 0, temp: 25, treadDepth: 8, sensorOk: true }); this._nominalPressure = nominalPressure }
  update(id: string, data: Partial<{ pressure: number; temp: number; treadDepth: number }>) { const t = this._tires.get(id); if (t) Object.assign(t, data) }
  getTire(id: string) { return this._tires.get(id) }
  getAllTires() { return Object.fromEntries(this._tires) }
  isLowPressure(id: string): boolean { const t = this._tires.get(id); return t ? t.pressure < this._nominalPressure * 0.8 : false }
  isOverheating(id: string): boolean { const t = this._tires.get(id); return t ? t.temp > this._tempWarning : false }
  needsReplacement(id: string): boolean { const t = this._tires.get(id); return t ? t.treadDepth < 1.6 : false }
  getLowPressureTires(): string[] { const r: string[] = []; this._tires.forEach((t, id) => { if (t.pressure < this._nominalPressure * 0.8) r.push(id) }); return r }
  getOverallStatus(): 'OK' | 'WARNING' | 'CRITICAL' {
    for (const [id, t] of this._tires) { if (t.pressure < this._nominalPressure * 0.6 || t.temp > 100) return 'CRITICAL'; if (this.isLowPressure(id) || this.isOverheating(id)) return 'WARNING' }
    return 'OK'
  }
}

export class ClimateControlTool {
  private _zones: Map<string, { targetTemp: number; currentTemp: number; fanSpeed: number; mode: string; acOn: boolean; auto: boolean }> = new Map()
  private _extTemp = 25
  registerZone(id: string) { this._zones.set(id, { targetTemp: 22, currentTemp: 25, fanSpeed: 3, mode: 'auto', acOn: true, auto: true }) }
  setTargetTemp(id: string, temp: number) { const z = this._zones.get(id); if (z) z.targetTemp = Math.max(16, Math.min(30, temp)) }
  setFanSpeed(id: string, speed: number) { const z = this._zones.get(id); if (z) z.fanSpeed = Math.max(0, Math.min(7, speed)) }
  setMode(id: string, mode: string) { const z = this._zones.get(id); if (z) z.mode = mode }
  setAC(id: string, on: boolean) { const z = this._zones.get(id); if (z) z.acOn = on }
  setAuto(id: string, on: boolean) { const z = this._zones.get(id); if (z) z.auto = on }
  updateCurrentTemp(id: string, temp: number) { const z = this._zones.get(id); if (z) z.currentTemp = temp }
  setExtTemp(temp: number) { this._extTemp = temp }
  getZone(id: string) { return this._zones.get(id) }
  getAllZones() { return Object.fromEntries(this._zones) }
  getExtTemp() { return this._extTemp }
  isCooling(id: string): boolean { const z = this._zones.get(id); return z ? z.currentTemp > z.targetTemp + 0.5 : false }
  isHeating(id: string): boolean { const z = this._zones.get(id); return z ? z.currentTemp < z.targetTemp - 0.5 : false }
}

export class LightingTool {
  private _lights: Map<string, { on: boolean; brightness: number; color: string; mode: string }> = new Map()
  registerLight(id: string) { this._lights.set(id, { on: false, brightness: 100, color: '#FFFFFF', mode: 'manual' }) }
  setOn(id: string, on: boolean) { const l = this._lights.get(id); if (l) l.on = on }
  toggle(id: string) { const l = this._lights.get(id); if (l) l.on = !l.on }
  setBrightness(id: string, pct: number) { const l = this._lights.get(id); if (l) l.brightness = Math.max(0, Math.min(100, pct)) }
  setColor(id: string, color: string) { const l = this._lights.get(id); if (l) l.color = color }
  setMode(id: string, mode: string) { const l = this._lights.get(id); if (l) l.mode = mode }
  getLight(id: string) { return this._lights.get(id) }
  getAllLights() { return Object.fromEntries(this._lights) }
  setHeadlights(on: boolean) { this.setOn('headlights', on) }
  setFogLights(on: boolean) { this.setOn('fog', on) }
  setIndicator(left: boolean, right: boolean) { this.setOn('indicator_l', left); this.setOn('indicator_r', right) }
  setInteriorBrightness(pct: number) { this.setBrightness('interior', pct) }
}

export class SeatControlTool {
  private _seats: Map<string, { position: { x: number; y: number; z: number }; heating: number; memory: Array<{ x: number; y: number; z: number }>; occupied: boolean }> = new Map()
  registerSeat(id: string) { this._seats.set(id, { position: { x: 0, y: 0, z: 0 }, heating: 0, memory: [], occupied: false }) }
  setPosition(id: string, x: number, y: number, z: number) { const s = this._seats.get(id); if (s) s.position = { x, y, z } }
  getPosition(id: string) { return this._seats.get(id)?.position }
  setHeating(id: string, level: number) { const s = this._seats.get(id); if (s) s.heating = Math.max(0, Math.min(3, level)) }
  getHeating(id: string) { return this._seats.get(id)?.heating || 0 }
  saveMemory(id: string) { const s = this._seats.get(id); if (s) s.memory.push({ ...s.position }) }
  loadMemory(id: string, slot: number) { const s = this._seats.get(id); if (s && s.memory[slot]) s.position = { ...s.memory[slot] } }
  setOccupied(id: string, occ: boolean) { const s = this._seats.get(id); if (s) s.occupied = occ }
  isOccupied(id: string) { return this._seats.get(id)?.occupied || false }
  getSeat(id: string) { return this._seats.get(id) }
  getAllSeats() { return Object.fromEntries(this._seats) }
}

export class MirrorControlTool {
  private _mirrors: Map<string, { hAngle: number; vAngle: number; heated: boolean; folded: boolean }> = new Map()
  registerMirror(id: string) { this._mirrors.set(id, { hAngle: 0, vAngle: 0, heated: false, folded: false }) }
  setAngles(id: string, h: number, v: number) { const m = this._mirrors.get(id); if (m) { m.hAngle = Math.max(-30, Math.min(30, h)); m.vAngle = Math.max(-15, Math.min(15, v)) } }
  getAngles(id: string) { const m = this._mirrors.get(id); return m ? { h: m.hAngle, v: m.vAngle } : null }
  setHeated(id: string, on: boolean) { const m = this._mirrors.get(id); if (m) m.heated = on }
  isHeated(id: string) { return this._mirrors.get(id)?.heated || false }
  setFolded(id: string, folded: boolean) { const m = this._mirrors.get(id); if (m) m.folded = folded }
  isFolded(id: string) { return this._mirrors.get(id)?.folded || false }
  foldAll() { this._mirrors.forEach(m => { m.folded = true }) }
  unfoldAll() { this._mirrors.forEach(m => { m.folded = false }) }
  getAllMirrors() { return Object.fromEntries(this._mirrors) }
}

export class WindowControlTool {
  private _windows: Map<string, { position: number; locked: boolean; autoUp: boolean }> = new Map()
  registerWindow(id: string) { this._windows.set(id, { position: 0, locked: false, autoUp: false }) }
  setPosition(id: string, pct: number) { const w = this._windows.get(id); if (w && !w.locked) w.position = Math.max(0, Math.min(100, pct)) }
  getPosition(id: string) { return this._windows.get(id)?.position || 0 }
  open(id: string, pct = 100) { this.setPosition(id, pct) }
  close(id: string) { this.setPosition(id, 0) }
  setLocked(id: string, locked: boolean) { const w = this._windows.get(id); if (w) w.locked = locked }
  isLocked(id: string) { return this._windows.get(id)?.locked || false }
  setAutoUp(id: string, on: boolean) { const w = this._windows.get(id); if (w) w.autoUp = on }
  openAll(pct = 100) { this._windows.forEach((w, id) => { if (!w.locked) w.position = pct }) }
  closeAll() { this._windows.forEach(w => { w.position = 0 }) }
  getAllWindows() { return Object.fromEntries(this._windows) }
}

export class WiperControlTool {
  private _speed: 0 | 1 | 2 | 3 | 4 = 0
  private _interval = 0
  private _rainSensor = false
  private _washerActive = false
  private _autoMode = false
  setSpeed(speed: 0 | 1 | 2 | 3 | 4) { this._speed = speed }
  getSpeed() { return this._speed }
  setInterval(ms: number) { this._interval = Math.max(0, Math.min(10000, ms)) }
  getInterval() { return this._interval }
  setRainSensor(on: boolean) { this._rainSensor = on }
  isRainSensorActive() { return this._rainSensor }
  setAutoMode(on: boolean) { this._autoMode = on }
  isAutoMode() { return this._autoMode }
  activateWasher(ms = 2000) { this._washerActive = true; setTimeout(() => { this._washerActive = false }, ms) }
  isWasherActive() { return this._washerActive }
  autoAdjust(rainIntensity: number) {
    if (!this._autoMode) return
    if (rainIntensity > 80) this._speed = 4; else if (rainIntensity > 50) this._speed = 3; else if (rainIntensity > 20) this._speed = 2; else if (rainIntensity > 5) this._speed = 1; else this._speed = 0
  }
  getStatus() { return { speed: this._speed, interval: this._interval, rainSensor: this._rainSensor, washer: this._washerActive, auto: this._autoMode } }
}

export class CruiseControlTool {
  private _active = false
  private _setSpeed = 0
  private _followDistance = 3
  private _mode: 'standard' | 'adaptive' | 'sport' | 'limiter' = 'standard'
  private _limiterMax = 0
  activate(speed: number) { this._active = true; this._setSpeed = speed }
  deactivate() { this._active = false }
  isActive() { return this._active }
  setSpeed(speed: number) { this._setSpeed = Math.max(30, Math.min(200, speed)) }
  getSetSpeed() { return this._setSpeed }
  setMode(mode: typeof this._mode) { this._mode = mode }
  getMode() { return this._mode }
  setFollowDistance(distance: number) { this._followDistance = Math.max(1, Math.min(5, distance)) }
  getFollowDistance() { return this._followDistance }
  setLimiterMax(max: number) { this._limiterMax = max }
  resume() { this._active = true }
  coast() { this._active = false }
  accelBy(amount: number) { this._setSpeed += amount }
  decelBy(amount: number) { this._setSpeed = Math.max(30, this._setSpeed - amount) }
  getStatus() { return { active: this._active, setSpeed: this._setSpeed, mode: this._mode, followDistance: this._followDistance } }
}

export class StabilityControlTool {
  private _escEnabled = true
  private _tractionControl = true
  private _yawRate = 0
  private _lateralAccel = 0
  private _intervening = false
  private _mode: 'normal' | 'sport' | 'off' | 'track' = 'normal'
  setMode(mode: typeof this._mode) { this._mode = mode; if (mode === 'off') { this._escEnabled = false; this._tractionControl = false } else { this._escEnabled = true; this._tractionControl = true } }
  getMode() { return this._mode }
  enableESC(on: boolean) { this._escEnabled = on }
  enableTractionControl(on: boolean) { this._tractionControl = on }
  isESCEnabled() { return this._escEnabled }
  isTractionControlEnabled() { return this._tractionControl }
  update(yawRate: number, lateralAccel: number) { this._yawRate = yawRate; this._lateralAccel = lateralAccel; this._intervening = this._escEnabled && (Math.abs(yawRate) > 30 || Math.abs(lateralAccel) > 0.8) }
  isIntervening() { return this._intervening }
  getYawRate() { return this._yawRate }
  getLateralAccel() { return this._lateralAccel }
  getStatus() { return { mode: this._mode, esc: this._escEnabled, tc: this._tractionControl, yawRate: this._yawRate, lateralAccel: this._lateralAccel, intervening: this._intervening } }
}

export class EmissionMonitorTool {
  private _o2Sensors: Map<string, { voltage: number; trim: number }> = new Map()
  private _catalyticEfficiency = 0
  private _dpfLevel = 0
  private _noxLevel = 0
  private _history: Array<{ data: any; time: number }> = []
  updateO2Sensor(id: string, voltage: number, trim: number) { this._o2Sensors.set(id, { voltage, trim }) }
  updateCatalyticEfficiency(pct: number) { this._catalyticEfficiency = Math.max(0, Math.min(100, pct)) }
  updateDPF(level: number) { this._dpfLevel = Math.max(0, Math.min(100, level)) }
  updateNOx(level: number) { this._noxLevel = Math.max(0, Math.min(100, level)) }
  getO2Sensor(id: string) { return this._o2Sensors.get(id) }
  getAllO2Sensors() { return Object.fromEntries(this._o2Sensors) }
  getCatalyticEfficiency() { return this._catalyticEfficiency }
  getDPFLevel() { return this._dpfLevel }
  getNOxLevel() { return this._noxLevel }
  isCatalyticHealthy(): boolean { return this._catalyticEfficiency > 80 }
  needsDPFRegen(): boolean { return this._dpfLevel > 70 }
  record() { this._history.push({ data: { o2: Object.fromEntries(this._o2Sensors), cat: this._catalyticEfficiency, dpf: this._dpfLevel, nox: this._noxLevel }, time: Date.now() }) }
  getHistory(n = 100) { return this._history.slice(-n) }
}

export class OBDTool {
  private _dtcCodes: Array<{ code: string; description: string; severity: string; time: number }> = []
  private _liveData: Map<string, number> = new Map()
  private _freezeFrame: Map<string, any> = new Map()
  private _supportedPids = new Set<string>()
  setLiveData(pid: string, value: number) { this._liveData.set(pid, value) }
  getLiveData(pid: string) { return this._liveData.get(pid) }
  getAllLiveData() { return Object.fromEntries(this._liveData) }
  addDTC(code: string, description: string, severity = 'warning') { this._dtcCodes.push({ code, description, severity, time: Date.now() }) }
  clearDTCs() { this._dtcCodes = [] }
  getDTCs() { return this._dtcCodes }
  captureFreezeFrame() { this._freezeFrame = new Map(this._liveData) }
  getFreezeFrame() { return Object.fromEntries(this._freezeFrame) }
  setSupportedPids(pids: string[]) { pids.forEach(p => this._supportedPids.add(p)) }
  isPidSupported(pid: string) { return this._supportedPids.has(pid) }
  async queryLiveData(pid: string, connector: any): Promise<ToolResult> {
    try { const val = await connector?.sendCommand?.('OBD:PID:' + pid); this._liveData.set(pid, parseFloat(val) || 0); return { ok: true, data: { pid, value: this._liveData.get(pid) } } }
    catch (e) { return { ok: false, error: String(e) } }
  }
}
