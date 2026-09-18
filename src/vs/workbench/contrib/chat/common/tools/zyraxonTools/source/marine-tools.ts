type R = { ok: boolean; data?: any; error?: string }

export class SonarSystem {
  _targets: any[] = []

  addTarget(id: string, range: number, bearing: number, depth: number): R {
    this._targets.push({ id, range, bearing, depth, classified: false })
    return { ok: true, data: { id, range, bearing, depth } }
  }

  getTargets(): R {
    return { ok: true, data: this._targets.map(t => ({ id: t.id, range: t.range, bearing: t.bearing, depth: t.depth })) }
  }

  classifyTarget(id: string): R {
    const t = this._targets.find(t => t.id === id)
    if (!t) return { ok: false, error: "Target not found" }
    t.classified = true
    let classification = "unknown"
    if (t.range < 500 && t.depth < 50) classification = "surface vessel"
    else if (t.range < 200 && t.depth > 100) classification = "submarine"
    else if (t.range > 1000) classification = "long range contact"
    else classification = "underwater object"
    return { ok: true, data: { id, classification, range: t.range, depth: t.depth } }
  }

  getDepth(bearing: number): R {
    const filtered = this._targets.filter(t => Math.abs(t.bearing - bearing) < 15)
    if (filtered.length === 0) return { ok: true, data: { averageDepth: 0, count: 0 } }
    const avg = filtered.reduce((s, t) => s + t.depth, 0) / filtered.length
    return { ok: true, data: { averageDepth: avg, count: filtered.length } }
  }

  getSeabedProfile(): R {
    const depths = this._targets.map((t, i) => ({ bearing: t.bearing, depth: t.depth + (i % 5) * 4 }))
    depths.sort((a, b) => a.bearing - b.bearing)
    return { ok: true, data: { profile: depths, minDepth: Math.min(...depths.map(d => d.depth)), maxDepth: Math.max(...depths.map(d => d.depth)) } }
  }
}

export class NavigationChart {
  _waypoints: any[] = []
  _route: any[] = []
  _position = { lat: 0, lon: 0 }

  addWaypoint(id: string, lat: number, lon: number, name: string): R {
    this._waypoints.push({ id, lat, lon, name, visited: false })
    return { ok: true, data: { id, lat, lon, name } }
  }

  setRoute(waypoints: string[]): R {
    const route = waypoints.map(id => {
      const wp = this._waypoints.find(w => w.id === id)
      return wp ? { id: wp.id, lat: wp.lat, lon: wp.lon, name: wp.name } : null
    }).filter(Boolean)
    if (route.length !== waypoints.length) return { ok: false, error: "Some waypoints not found" }
    this._route = route
    return { ok: true, data: { routeLength: route.length, route } }
  }

  getCurrentPosition(): R {
    return { ok: true, data: { ...this._position } }
  }

  getDistanceToWaypoint(): R {
    if (this._route.length === 0) return { ok: false, error: "No route set" }
    const next = this._route[0]
    const R = 6371e3
    const dLat = (next.lat - this._position.lat) * Math.PI / 180
    const dLon = (next.lon - this._position.lon) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(this._position.lat * Math.PI / 180) * Math.cos(next.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return { ok: true, data: { distanceMeters: dist, waypoint: next.name } }
  }

  getETA(): R {
    const dist = this.getDistanceToWaypoint()
    if (!dist.ok) return dist
    const speedKnots = 12
    const hours = dist.data.distanceMeters / 1000 / (speedKnots * 1.852)
    const now = new Date()
    now.setHours(now.getHours() + Math.floor(hours))
    now.setMinutes(now.getMinutes() + Math.floor((hours % 1) * 60))
    return { ok: true, data: { eta: now.toISOString(), hoursRemaining: hours.toFixed(2), nextWaypoint: this._route[0]?.name } }
  }

  checkShallowWater(): R {
    if (this._route.length === 0) return { ok: true, data: { shallow: false } }
    const next = this._route[0]
    const shallow = next.lat > 0 && next.lat < 1
    return { ok: true, data: { shallow, latitude: next.lat, warning: shallow ? "Approaching shallow area" : "Clear" } }
  }
}

export class HullMonitor {
  _sensors: Map<string, any> = new Map()

  addSensor(id: string, location: string): R {
    this._sensors.set(id, { location, pressureHistory: [], lastPressure: 0 })
    return { ok: true, data: { id, location } }
  }

  updatePressure(sensorId: string, pressure: number): R {
    const s = this._sensors.get(sensorId)
    if (!s) return { ok: false, error: "Sensor not found" }
    s.lastPressure = pressure
    s.pressureHistory.push({ pressure, timestamp: Date.now() })
    if (s.pressureHistory.length > 100) s.pressureHistory.shift()
    return { ok: true, data: { sensorId, pressure, historyLength: s.pressureHistory.length } }
  }

  checkStructuralIntegrity(): R {
    let maxPressure = 0
    let alertSensor = null
    this._sensors.forEach((s, id) => {
      if (s.lastPressure > maxPressure) { maxPressure = s.lastPressure; alertSensor = id }
    })
    const threshold = 1000
    const compromised = maxPressure > threshold
    return { ok: true, data: { compromised, maxPressure, alertSensor, sensorCount: this._sensors.size } }
  }

  getStressMap(): R {
    const map: any[] = []
    this._sensors.forEach((s, id) => {
      map.push({ id, location: s.location, pressure: s.lastPressure, stress: s.lastPressure / 1000 })
    })
    return { ok: true, data: { map, averageStress: map.length > 0 ? map.reduce((s, m) => s + m.stress, 0) / map.length : 0 } }
  }

  detectLeak(sensorId: string): R {
    const s = this._sensors.get(sensorId)
    if (!s) return { ok: false, error: "Sensor not found" }
    const history = s.pressureHistory
    if (history.length < 3) return { ok: true, data: { leak: false, reason: "Insufficient data" } }
    const recent = history.slice(-5)
    const avgRecent = recent.reduce((s: number, h: any) => s + h.pressure, 0) / recent.length
    const avgAll = history.reduce((s: number, h: any) => s + h.pressure, 0) / history.length
    const leak = avgRecent > avgAll * 1.2
    return { ok: true, data: { leak, sensorId, recentAvg: avgRecent, overallAvg: avgAll } }
  }

  getMaintenanceStatus(): R {
    const sensors: any[] = []
    this._sensors.forEach((s, id) => {
      const historyLength = s.pressureHistory.length
      const needsMaintenance = historyLength > 50 || s.lastPressure > 800
      sensors.push({ id, location: s.location, historyLength, lastPressure: s.lastPressure, needsMaintenance })
    })
    const needsService = sensors.filter(s => s.needsMaintenance).length
    return { ok: true, data: { sensors, totalSensors: sensors.length, needsService } }
  }
}

export class AnchorSystem {
  _anchorState = "raised"
  _scope = 0
  _holding = 0

  calculateScope(depth: number, wind: number): R {
    const scopeRatio = 7
    const windFactor = wind > 20 ? 1.3 : wind > 15 ? 1.15 : 1
    const scope = depth * scopeRatio * windFactor
    return { ok: true, data: { scope: scope.toFixed(1), depth, wind, scopeRatio } }
  }

  drop(anchorType: string, scope: number): R {
    if (this._anchorState === "dropped") return { ok: false, error: "Anchor already down" }
    this._anchorState = "dropped"
    this._scope = scope
    const holdingForces: Record<string, number> = { "plow": 1.2, "fluke": 1.0, "mushroom": 0.8, "claw": 1.1 }
    this._holding = scope * (holdingForces[anchorType] || 1.0)
    return { ok: true, data: { state: this._anchorState, anchorType, scope, holding: this._holding } }
  }

  retrieve(): R {
    if (this._anchorState === "raised") return { ok: false, error: "Anchor already raised" }
    this._anchorState = "raised"
    const scope = this._scope
    this._scope = 0
    this._holding = 0
    return { ok: true, data: { state: this._anchorState, retrievedScope: scope } }
  }

  getHoldStatus(): R {
    return { ok: true, data: { state: this._anchorState, scope: this._scope, holding: this._holding } }
  }

  calculateHoldingForce(windSpeed: number): R {
    if (this._anchorState === "raised") return { ok: false, error: "Anchor not deployed" }
    const baseForce = this._holding * 1000
    const windForce = baseForce * Math.pow(windSpeed / 10, 2)
    const safetyMargin = windForce * 0.3
    const totalCapacity = baseForce * 5
    const safe = windForce < totalCapacity
    return { ok: true, data: { windSpeed, windForce: windForce.toFixed(0), safetyMargin: safetyMargin.toFixed(0), totalCapacity, safe } }
  }
}

export class BallastController {
  _tanks: Map<string, any> = new Map()

  addTank(id: string, capacity: number): R {
    this._tanks.set(id, { capacity, level: 0 })
    return { ok: true, data: { id, capacity, level: 0 } }
  }

  fillTank(id: string, amount: number): R {
    const t = this._tanks.get(id)
    if (!t) return { ok: false, error: "Tank not found" }
    t.level = Math.min(t.level + amount, t.capacity)
    return { ok: true, data: { id, level: t.level, capacity: t.capacity, filled: amount } }
  }

  pumpTank(id: string, amount: number): R {
    const t = this._tanks.get(id)
    if (!t) return { ok: false, error: "Tank not found" }
    t.level = Math.max(t.level - amount, 0)
    return { ok: true, data: { id, level: t.level, capacity: t.capacity, pumped: amount } }
  }

  getTankLevel(id: string): R {
    const t = this._tanks.get(id)
    if (!t) return { ok: false, error: "Tank not found" }
    return { ok: true, data: { id, level: t.level, capacity: t.capacity, percentage: ((t.level / t.capacity) * 100).toFixed(1) } }
  }

  getTrim(): R {
    if (this._tanks.size === 0) return { ok: true, data: { trim: 0, status: "level" } }
    let totalLevel = 0
    let totalCapacity = 0
    this._tanks.forEach(t => { totalLevel += t.level; totalCapacity += t.capacity })
    const trim = (totalLevel / totalCapacity) * 100
    const status = trim > 70 ? "heavy" : trim < 30 ? "light" : "balanced"
    return { ok: true, data: { trim: trim.toFixed(1), status } }
  }

  getStability(): R {
    if (this._tanks.size === 0) return { ok: true, data: { stable: true, gm: 0, metacentricHeight: 0 } }
    let totalLevel = 0
    let totalCapacity = 0
    this._tanks.forEach(t => { totalLevel += t.level; totalCapacity += t.capacity })
    const freeSurface = this.calculateFreeSurface().data.freeSurface
    const gm = (totalCapacity / 1000) - freeSurface
    const stable = gm > 0.15
    return { ok: true, data: { stable, gm: gm.toFixed(3), metacentricHeight: gm.toFixed(3), freeSurface: freeSurface.toFixed(3) } }
  }

  calculateFreeSurface(): R {
    let freeSurface = 0
    this._tanks.forEach(t => {
      if (t.level > 0) {
        const area = t.capacity * 0.1
        freeSurface += (area * t.level) / 1000
      }
    })
    return { ok: true, data: { freeSurface: freeSurface.toFixed(3), tankCount: this._tanks.size } }
  }
}
