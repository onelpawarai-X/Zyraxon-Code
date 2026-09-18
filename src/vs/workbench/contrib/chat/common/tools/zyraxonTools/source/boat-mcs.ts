/**
 * ZYRAXON X — Boat Marine Control System
 * Propulsion, steering, autopilot, bilge, navigation, anchoring
 */
type R = { ok: boolean; data?: any; error?: string }

class PID {
  private integral = 0; private prevError = 0
  constructor(private kp: number, private ki: number, private kd: number, private outMin = -1e9, private outMax = 1e9, private intMax = 1e6) {}
  compute(error: number, dt: number): number {
    this.integral = Math.max(-this.intMax, Math.min(this.intMax, this.integral + error * dt))
    const deriv = dt > 0 ? (error - this.prevError) / dt : 0
    let output = this.kp * error + this.ki * this.integral + this.kd * deriv
    output = Math.max(this.outMin, Math.min(this.outMax, output))
    this.prevError = error; return output
  }
  reset(): void { this.integral = 0; this.prevError = 0 }
}

export class PropulsionSystem {
  private engines = new Map<string, { rpm: number; maxRpm: number; fuelRate: number; temp: number; oilPressure: number; status: string; hours: number }>()
  private propellers = new Map<string, { pitch: number; maxPitch: number; rpm: number; reversed: boolean }>()

  registerEngine(id: string, maxRpm = 3000): void { this.engines.set(id, { rpm: 0, maxRpm, fuelRate: 0, temp: 20, oilPressure: 0, status: 'OFF', hours: 0 }) }
  registerPropeller(id: string, maxPitch = 45): void { this.propellers.set(id, { pitch: 20, maxPitch, rpm: 0, reversed: false }) }

  async startEngine(id: string): Promise<R> {
    const e = this.engines.get(id)
    if (!e) return { ok: false, error: 'Engine not found' }
    e.status = 'STARTING'; e.rpm = 200; await new Promise(r => setTimeout(r, 500))
    e.rpm = 600; e.oilPressure = 35; e.status = 'RUNNING'; return { ok: true, data: { id, status: 'RUNNING' } }
  }

  async stopEngine(id: string): Promise<R> {
    const e = this.engines.get(id)
    if (!e) return { ok: false, error: 'Engine not found' }
    e.rpm = 0; e.oilPressure = 0; e.fuelRate = 0; e.status = 'OFF'; return { ok: true, data: { id, status: 'OFF' } }
  }

  setThrottle(id: string, pct: number): void {
    const e = this.engines.get(id)
    if (e && e.status === 'RUNNING') { e.rpm = (pct / 100) * e.maxRpm; e.fuelRate = e.rpm * 0.15 }
  }

  setPropellerPitch(id: string, pitch: number): void {
    const p = this.propellers.get(id)
    if (p) { p.pitch = Math.max(0, Math.min(p.maxPitch, pitch)) }
  }

  reversePropeller(id: string, reverse: boolean): void { const p = this.propellers.get(id); if (p) p.reversed = reverse }

  getTotalThrust(): number { let t = 0; this.engines.forEach(e => t += e.rpm * 0.1); return t }
  getTotalFuelRate(): number { let t = 0; this.engines.forEach(e => t += e.fuelRate); return t }

  getStatus(): Record<string, any> {
    const engines: Record<string, any> = {}; this.engines.forEach((e, id) => { engines[id] = { ...e } })
    const props: Record<string, any> = {}; this.propellers.forEach((p, id) => { props[id] = { ...p } })
    return { engines, propellers: props, totalThrust: this.getTotalThrust(), fuelRate: this.getTotalFuelRate() }
  }
}

export class SteeringSystem {
  private rudderAngle = 0; private maxRudderAngle = 35; private helmAngle = 0
  private steeringRatio = 1.5; private autopilotActive = false
  private headingPID = new PID(2.0, 0.05, 0.3, -35, 35, 50)

  setHelm(angle: number): void { this.helmAngle = Math.max(-90, Math.min(90, angle)); this.rudderAngle = Math.max(-this.maxRudderAngle, Math.min(this.maxRudderAngle, this.helmAngle / this.steeringRatio)) }
  getRudderAngle(): number { return this.rudderAngle }
  getHelmAngle(): number { return this.helmAngle }

  autopilotHeading(targetHdg: number, currentHdg: number, dt: number): number {
    let err = targetHdg - currentHdg
    if (err > 180) err -= 360; if (err < -180) err += 360
    const rudderCmd = this.headingPID.compute(err, dt)
    this.rudderAngle = Math.max(-this.maxRudderAngle, Math.min(this.maxRudderAngle, rudderCmd))
    return this.rudderAngle
  }

  getStatus(): Record<string, any> { return { rudderAngle: +this.rudderAngle.toFixed(1), helmAngle: +this.helmAngle.toFixed(1), maxRudder: this.maxRudderAngle } }
}

export class BilgeSystem {
  private pumps = new Map<string, { active: boolean; flowRate: number; autoLevel: number; runtime: number }>()
  private waterLevel = 0; private maxLevel = 100

  registerPump(id: string, flowRate: number, autoLevel = 30): void { this.pumps.set(id, { active: false, flowRate, autoLevel, runtime: 0 }) }

  setWaterLevel(level: number): void { this.waterLevel = Math.max(0, Math.min(this.maxLevel, level)) }

  autoControl(dt: number): { pumpsOn: string[]; waterLevel: number } {
    const pumpsOn: string[] = []
    this.pumps.forEach((p, id) => {
      if (this.waterLevel > p.autoLevel) { p.active = true; pumpsOn.push(id); p.runtime += dt; this.waterLevel -= p.flowRate * dt * 0.01 }
      else { p.active = false }
    })
    return { pumpsOn, waterLevel: Math.max(0, this.waterLevel) }
  }

  getWaterLevel(): number { return this.waterLevel }
  isFlooding(): boolean { return this.waterLevel > 70 }
  getStatus(): Record<string, any> { return { waterLevel: +this.waterLevel.toFixed(1), pumps: Object.fromEntries(this.pumps), flooding: this.isFlooding() } }
}

export class AnchorSystem {
  private deployed = false; private chainLength = 0; private maxChain = 200 // meters
  private anchorLoad = 0; private scope = 0 // chain depth ratio
  private dragging = false; private position = { lat: 0, lon: 0 }

  deploy(targetLat: number, targetLon: number, depth: number): R {
    this.deployed = true; this.position = { lat: targetLat, lon: targetLon }
    this.scope = Math.max(5, depth * 3) // 7:1 scope recommended
    this.chainLength = this.scope * depth
    return { ok: true, data: { deployed: true, scope: this.scope, chainLength: this.chainLength } }
  }

  retrieve(): R { this.deployed = false; this.chainLength = 0; this.anchorLoad = 0; return { ok: true, data: { retrieved: true } } }

  update(anchorLoad: number): void {
    this.anchorLoad = anchorLoad
    if (this.deployed && anchorLoad > 5000) this.dragging = true // dragging detection
  }

  isDeployed(): boolean { return this.deployed }
  isDragging(): boolean { return this.dragging }
  getStatus(): Record<string, any> { return { deployed: this.deployed, chainLength: this.chainLength, scope: this.scope, anchorLoad: this.anchorLoad, dragging: this.dragging, position: this.position } }
}

export class NavigationLighting {
  private lights = new Map<string, { on: boolean; color: string; brightness: number; flashRate: number }>()

  registerLight(id: string, color: string, flashRate = 0): void { this.lights.set(id, { on: false, color, brightness: 100, flashRate }) }
  setLight(id: string, on: boolean): void { const l = this.lights.get(id); if (l) l.on = on }

  setDayNight(daytime: boolean): void {
    // Navigation lights required at night
    this.lights.forEach((l, id) => {
      if (id === 'masthead' || id === 'port' || id === 'starboard' || id === 'stern') l.on = !daytime
    })
  }

  getAllLights() { return Object.fromEntries(this.lights) }
}

export class BoatAutopilot {
  private headingPID = new PID(2.0, 0.05, 0.3, -35, 35, 50)
  private waypointPID = new PID(1.5, 0.02, 0.2, -35, 35, 50)
  private mode: 'heading'|'waypoint'|'windvane'|'standby' = 'standby'
  private targetHeading = 0; private targetWaypoint = { lat: 0, lon: 0 }
  private crossTrackError = 0; private maxXTE = 100 // meters

  setMode(m: typeof this.mode): void { this.mode = m }
  setHeading(hdg: number): void { this.targetHeading = ((hdg % 360) + 360) % 360; this.mode = 'heading' }
  setWaypoint(lat: number, lon: number): void { this.targetWaypoint = { lat, lon }; this.mode = 'waypoint' }

  compute(currentHdg: number, dt: number): { rudderAngle: number; mode: string; crossTrackError: number } {
    if (this.mode === 'standby') return { rudderAngle: 0, mode: 'STBY', crossTrackError: 0 }
    let err = this.targetHeading - currentHdg
    if (err > 180) err -= 360; if (err < -180) err += 360
    const rudder = this.headingPID.compute(err, dt)
    return { rudderAngle: Math.max(-35, Math.min(35, rudder)), mode: this.mode.toUpperCase(), crossTrackError: this.crossTrackError }
  }

  getBearingDistance(lat1: number, lon1: number, lat2: number, lon2: number): { bearing: number; distance: number } {
    const R = 6371000
    const dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    const bearing = Math.atan2(Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180), Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon))
    return { bearing: ((bearing * 180 / Math.PI) + 360) % 360, distance: 2 * R * Math.asin(Math.sqrt(a)) }
  }

  getStatus(): Record<string, any> { return { mode: this.mode, targetHeading: this.targetHeading, targetWaypoint: this.targetWaypoint, crossTrackError: this.crossTrackError } }
}

export class MarineWeather {
  private windSpeed = 0; private windDir = 0; private waveHeight = 0; private wavePeriod = 0
  private currentSpeed = 0; private currentDir = 0; private visibility = 10000

  update(windSpeed: number, windDir: number, waveHeight: number, wavePeriod: number, currentSpeed: number, currentDir: number, visibility: number): void {
    this.windSpeed = windSpeed; this.windDir = windDir; this.waveHeight = waveHeight; this.wavePeriod = wavePeriod
    this.currentSpeed = currentSpeed; this.currentDir = currentDir; this.visibility = visibility
  }

  isSafeToSail(): { safe: boolean; reason: string } {
    if (this.windSpeed > 40) return { safe: false, reason: 'Gale force winds' }
    if (this.waveHeight > 4) return { safe: false, reason: 'Dangerous seas' }
    if (this.visibility < 1000) return { safe: false, reason: 'Poor visibility' }
    return { safe: true, reason: 'Conditions acceptable' }
  }

  getStatus(): Record<string, any> { return { windSpeed: this.windSpeed, windDir: this.windDir, waveHeight: this.waveHeight, wavePeriod: this.wavePeriod, currentSpeed: this.currentSpeed, currentDir: this.currentDir, visibility: this.visibility } }
}

export class BoatControlSystem {
  public propulsion: PropulsionSystem
  public steering: SteeringSystem
  public bilge: BilgeSystem
  public anchor: AnchorSystem
  public lighting: NavigationLighting
  public autopilot: BoatAutopilot
  public weather: MarineWeather

  constructor() {
    this.propulsion = new PropulsionSystem()
    this.steering = new SteeringSystem()
    this.bilge = new BilgeSystem()
    this.anchor = new AnchorSystem()
    this.lighting = new NavigationLighting()
    this.autopilot = new BoatAutopilot()
    this.weather = new MarineWeather()
  }

  getHealth(): Record<string, any> {
    return {
      propulsion: this.propulsion.getStatus(),
      steering: this.steering.getStatus(),
      bilge: this.bilge.getStatus(),
      anchor: this.anchor.getStatus(),
      autopilot: this.autopilot.getStatus(),
      weather: this.weather.getStatus(),
      safeToSail: this.weather.isSafeToSail(),
    }
  }
}
