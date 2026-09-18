type R = { ok: boolean; data?: any; error?: string }

export class PowerGridController {
  private _generators = new Map<string, { type: string; capacity: number; running: boolean }>()
  private _loads = new Map<string, { power: number; shed: boolean }>()
  private _nominalFrequency = 50
  private _voltage = 230

  addGenerator(id: string, type: string, capacity: number): R {
    if (this._generators.has(id)) return { ok: false, error: "Generator already exists" }
    this._generators.set(id, { type, capacity, running: false })
    return { ok: true, data: { id, type, capacity } }
  }

  addLoad(id: string, power: number): R {
    if (this._loads.has(id)) return { ok: false, error: "Load already exists" }
    this._loads.set(id, { power, shed: false })
    return { ok: true, data: { id, power } }
  }

  getBalance(): R {
    let totalGen = 0
    let totalLoad = 0
    this._generators.forEach((g) => { if (g.running) totalGen += g.capacity })
    this._loads.forEach((l) => { if (!l.shed) totalLoad += l.power })
    return { ok: true, data: { generation: totalGen, load: totalLoad, balance: totalGen - totalLoad } }
  }

  getFrequency(): R {
    const balance = (this.getBalance() as any).data.balance
    const deviation = -balance * 0.05
    const freq = this._nominalFrequency + deviation
    return { ok: true, data: { frequency: Math.round(freq * 100) / 100, nominal: this._nominalFrequency } }
  }

  getVoltage(): R {
    return { ok: true, data: { voltage: this._voltage, unit: "V" } }
  }

  shedLoad(id: string): R {
    const load = this._loads.get(id)
    if (!load) return { ok: false, error: "Load not found" }
    if (load.shed) return { ok: false, error: "Load already shed" }
    load.shed = true
    return { ok: true, data: { id, powerRemoved: load.power } }
  }

  startGenerator(id: string): R {
    const gen = this._generators.get(id)
    if (!gen) return { ok: false, error: "Generator not found" }
    if (gen.running) return { ok: false, error: "Generator already running" }
    gen.running = true
    return { ok: true, data: { id, capacity: gen.capacity } }
  }

  stopGenerator(id: string): R {
    const gen = this._generators.get(id)
    if (!gen) return { ok: false, error: "Generator not found" }
    if (!gen.running) return { ok: false, error: "Generator already stopped" }
    gen.running = false
    return { ok: true, data: { id } }
  }
}

export class WaterTreatmentSystem {
  private _flowRate = 0
  private _ph = 7.0
  private _chlorine = 0
  private _quality = 100

  setFlowRate(rate: number): R {
    if (rate < 0 || rate > 1000) return { ok: false, error: "Invalid flow rate" }
    this._flowRate = rate
    this._recalcQuality()
    return { ok: true, data: { flowRate: rate } }
  }

  getFlowRate(): R {
    return { ok: true, data: { flowRate: this._flowRate } }
  }

  setPH(level: number): R {
    if (level < 0 || level > 14) return { ok: false, error: "Invalid pH" }
    this._ph = level
    this._recalcQuality()
    return { ok: true, data: { ph: level } }
  }

  getPH(): R {
    return { ok: true, data: { ph: this._ph } }
  }

  setChlorine(level: number): R {
    if (level < 0 || level > 10) return { ok: false, error: "Invalid chlorine level" }
    this._chlorine = level
    this._recalcQuality()
    return { ok: true, data: { chlorine: level } }
  }

  getChlorine(): R {
    return { ok: true, data: { chlorine: this._chlorine } }
  }

  getQuality(): R {
    return { ok: true, data: { quality: this._quality, status: this._quality > 80 ? "good" : this._quality > 50 ? "acceptable" : "poor" } }
  }

  flush(): R {
    this._flowRate = 0
    this._ph = 7.0
    this._chlorine = 0
    this._quality = 100
    return { ok: true, data: { message: "System flushed" } }
  }

  private _recalcQuality() {
    const phScore = 100 - Math.abs(this._ph - 7.0) * 10
    const clScore = this._chlorine > 0 && this._chlorine <= 4 ? 100 : 50
    const flowScore = this._flowRate > 0 ? 100 : 0
    this._quality = Math.max(0, Math.min(100, Math.round((phScore + clScore + flowScore) / 3)))
  }
}

export class HVACController {
  private _zones = new Map<string, { area: number; temp: number; humidity: number; fanSpeed: number; history: { temp: number; humidity: number; time: number }[] }>()

  addZone(id: string, area: number): R {
    if (this._zones.has(id)) return { ok: false, error: "Zone already exists" }
    this._zones.set(id, { area, temp: 22, humidity: 50, fanSpeed: 1, history: [] })
    return { ok: true, data: { id, area } }
  }

  setTemp(zoneId: string, temp: number): R {
    const zone = this._zones.get(zoneId)
    if (!zone) return { ok: false, error: "Zone not found" }
    zone.temp = temp
    zone.history.push({ temp, humidity: zone.humidity, time: Date.now() })
    return { ok: true, data: { zoneId, temp } }
  }

  setHumidity(zoneId: string, humidity: number): R {
    const zone = this._zones.get(zoneId)
    if (!zone) return { ok: false, error: "Zone not found" }
    zone.humidity = humidity
    zone.history.push({ temp: zone.temp, humidity, time: Date.now() })
    return { ok: true, data: { zoneId, humidity } }
  }

  setFanSpeed(zoneId: string, speed: number): R {
    const zone = this._zones.get(zoneId)
    if (!zone) return { ok: false, error: "Zone not found" }
    if (speed < 0 || speed > 5) return { ok: false, error: "Invalid fan speed" }
    zone.fanSpeed = speed
    return { ok: true, data: { zoneId, fanSpeed: speed } }
  }

  getEfficiency(): R {
    let totalArea = 0
    let totalEfficiency = 0
    this._zones.forEach((z) => {
      totalArea += z.area
      const tempDelta = Math.abs(z.temp - 22)
      const humDelta = Math.abs(z.humidity - 50)
      totalEfficiency += z.area * Math.max(0, 100 - tempDelta * 5 - humDelta * 2)
    })
    const avg = totalArea > 0 ? Math.round(totalEfficiency / totalArea) : 0
    return { ok: true, data: { efficiency: avg } }
  }

  getEnergyUse(): R {
    let total = 0
    this._zones.forEach((z) => { total += z.area * z.fanSpeed * 0.5 + Math.abs(z.temp - 22) * 2 })
    return { ok: true, data: { energyKwh: Math.round(total * 100) / 100 } }
  }

  optimizeSchedule(): R {
    const zones: string[] = []
    this._zones.forEach((z, id) => {
      if (z.temp > 25) { z.fanSpeed = Math.min(5, z.fanSpeed + 1); zones.push(id) }
      else if (z.temp < 18) { z.fanSpeed = Math.min(5, z.fanSpeed + 1); zones.push(id) }
      else { z.fanSpeed = Math.max(1, z.fanSpeed - 1) }
    })
    return { ok: true, data: { optimized: zones } }
  }
}

export class FireSuppressionSystem {
  private _smoke = new Map<string, number>()
  private _heat = new Map<string, number>()
  private _suppressed = new Set<string>()
  private _alarmActive = false

  detectSmoke(zone: string): R {
    const current = (this._smoke.get(zone) || 0) + 1
    this._smoke.set(zone, current)
    if (current > 5) this._alarmActive = true
    return { ok: true, data: { zone, smokeLevel: current, alarm: this._alarmActive } }
  }

  detectHeat(zone: string, temp: number): R {
    this._heat.set(zone, temp)
    if (temp > 60) this._alarmActive = true
    return { ok: true, data: { zone, temperature: temp, alarm: this._alarmActive } }
  }

  getAlarmState(): R {
    return { ok: true, data: { active: this._alarmActive } }
  }

  activateSuppressant(zone: string): R {
    if (this._suppressed.has(zone)) return { ok: false, error: "Already suppressed" }
    this._suppressed.add(zone)
    this._smoke.delete(zone)
    this._heat.delete(zone)
    return { ok: true, data: { zone, suppressed: true } }
  }

  getSuppressedZones(): R {
    return { ok: true, data: { zones: Array.from(this._suppressed) } }
  }

  getFireSeverity(zone: string): R {
    const smoke = this._smoke.get(zone) || 0
    const heat = this._heat.get(zone) || 20
    let severity = "none"
    if (smoke > 8 || heat > 80) severity = "critical"
    else if (smoke > 5 || heat > 60) severity = "high"
    else if (smoke > 2 || heat > 40) severity = "medium"
    else if (smoke > 0 || heat > 25) severity = "low"
    return { ok: true, data: { zone, severity, smoke, heat } }
  }
}

export class RailwayController {
  private _signals = new Map<string, string>()
  private _trains = new Map<string, { speed: number; position: number; trackId: string }>()

  setSignal(section: string, state: string): R {
    const valid = ["red", "yellow", "green"]
    if (!valid.includes(state)) return { ok: false, error: "Invalid signal state" }
    this._signals.set(section, state)
    return { ok: true, data: { section, state } }
  }

  getSignal(section: string): R {
    const state = this._signals.get(section)
    if (!state) return { ok: false, error: "Section not found" }
    return { ok: true, data: { section, state } }
  }

  setSpeed(trainId: string, speed: number): R {
    const train = this._trains.get(trainId)
    if (!train) return { ok: false, error: "Train not found" }
    if (speed < 0 || speed > 300) return { ok: false, error: "Invalid speed" }
    train.speed = speed
    return { ok: true, data: { trainId, speed } }
  }

  getTrackStatus(trackId: string): R {
    let trainsOnTrack = 0
    this._trains.forEach((t) => { if (t.trackId === trackId) trainsOnTrack++ })
    return { ok: true, data: { trackId, trainsOnTrack, clear: trainsOnTrack <= 1 } }
  }

  getTrainPosition(trainId: string): R {
    const train = this._trains.get(trainId)
    if (!train) return { ok: false, error: "Train not found" }
    return { ok: true, data: { trainId, position: train.position, speed: train.speed, trackId: train.trackId } }
  }

  emergencyStop(trainId: string): R {
    const train = this._trains.get(trainId)
    if (!train) return { ok: false, error: "Train not found" }
    train.speed = 0
    return { ok: true, data: { trainId, stopped: true } }
  }
}
