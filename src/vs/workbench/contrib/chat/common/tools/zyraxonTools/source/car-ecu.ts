/**
 * ZYRAXON X — Car ECU (Engine Control Unit)
 * Engine, transmission, ABS, ESC, ADAS, cruise control, diagnostics
 */
type R = { ok: boolean; data?: any; error?: string }

export class EngineECU {
  private rpm = 0; private throttle = 0; private load = 0
  private coolantTemp = 20; private oilTemp = 20; private oilPress = 0
  private maf = 0; private timing = 0; private fuelTrim = { short: 0, long: 0 }
  private status: 'OFF'|'CRANKING'|'RUNNING'|'STALL' = 'OFF'
  private runHours = 0; private lastUpdate = 0

  private torqueCurve(rpm: number): number {
    if (rpm < 800 || rpm > 7000) return 0
    if (rpm < 2000) return 350 * (rpm / 2000) ** 0.8
    if (rpm <= 4500) return 350
    return 350 * Math.max(0, 1 - (rpm - 4500) / 2500) ** 1.2
  }

  async start(): Promise<R> {
    this.status = 'CRANKING'; this.rpm = 200
    await new Promise(r => setTimeout(r, 400))
    this.rpm = 900; this.oilPress = 45; this.status = 'RUNNING'; this.lastUpdate = Date.now()
    return { ok: true, data: { status: 'RUNNING', rpm: this.rpm } }
  }

  stop(): void { this.status = 'OFF'; this.rpm = 0; this.oilPress = 0; this.throttle = 0 }

  update(inp: { throttle?: number; coolantTemp?: number; oilTemp?: number; intakeAirTemp?: number }): void {
    if (this.status !== 'RUNNING') return
    const now = Date.now(); const dt = this.lastUpdate ? (now - this.lastUpdate) / 1000 : 0.1; this.lastUpdate = now
    if (inp.throttle !== undefined) this.throttle = Math.max(0, Math.min(100, inp.throttle))
    if (inp.coolantTemp !== undefined) this.coolantTemp = inp.coolantTemp
    if (inp.oilTemp !== undefined) this.oilTemp = inp.oilTemp
    this.load = this.throttle * 0.8 + (this.rpm / 7000) * 20
    this.maf = 1.225 * (288 / 298) * (this.rpm / 60) * 0.002 / 2 * (this.load / 100) * 1000
    const targetRPM = 800 + this.throttle * 62
    this.rpm += (targetRPM - this.rpm) * Math.min(1, dt * 3)
    this.rpm = Math.max(0, Math.min(7500, this.rpm))
    this.timing = 10 + (this.rpm / 7000) * 25 - (this.coolantTemp > 100 ? 5 : 0)
    this.runHours += dt / 3600
  }

  queryPID(pid: string): number | null {
    const map: Record<string, () => number> = {
      '0C': () => this.rpm * 4, '0D': () => this.throttle * 2.55,
      '05': () => this.coolantTemp + 40, '01': () => (this.load / 100) * 255,
      '0F': () => 40, '10': () => this.maf * 100, '0E': () => this.timing / 0.5 + 64,
    }
    return map[pid]?.() ?? null
  }

  getTorque(): number { return this.torqueCurve(this.rpm) }
  getPower(): number { return this.torqueCurve(this.rpm) * this.rpm * Math.PI / 30 / 1000 }

  getStatus(): Record<string, any> {
    return { status: this.status, rpm: +this.rpm.toFixed(0), throttle: +this.throttle.toFixed(1),
      load: +this.load.toFixed(1), torque: +this.getTorque().toFixed(1), power: +this.getPower().toFixed(1),
      coolantTemp: +this.coolantTemp.toFixed(1), oilTemp: +this.oilTemp.toFixed(1), oilPress: +this.oilPress.toFixed(1),
      maf: +this.maf.toFixed(2), timing: +this.timing.toFixed(1), fuelTrim: this.fuelTrim,
      runHours: +this.runHours.toFixed(1) }
  }
}

export class TransmissionECU {
  private gear = 0; private mode: 'P'|'R'|'N'|'D'|'M' = 'P'
  private ratios = [0, 4.71, 3.14, 2.11, 1.67, 1.29, 1.0, 0.84, 0.67]
  private reverseRatio = 3.32; private finalDrive = 3.23
  private shiftPts = [1500, 2500, 3500, 4500, 5000, 5500, 6000]
  private downPts = [1200, 1800, 2500, 3000, 3500, 4000, 4500]
  private shifting = false; private oilTemp = 80

  setMode(m: typeof this.mode): void { this.mode = m; if (m === 'D' && this.gear === 0) this.gear = 1 }
  getGear(): number { return this.gear }
  getMode(): string { return this.mode }
  getRatio(): number { return this.gear > 0 ? this.ratios[this.gear] || 1 : this.gear === -1 ? this.reverseRatio : 0 }

  getWheelSpeed(engineRPM: number): number {
    const ratio = this.getRatio() * this.finalDrive
    return ratio > 0 ? (engineRPM / ratio) * 2.0 * 60 / 1000 : 0
  }

  shouldShiftUp(rpm: number): boolean { return this.mode === 'D' && this.gear < 8 && !this.shifting && rpm > (this.shiftPts[this.gear - 1] || 6000) }
  shouldShiftDown(rpm: number): boolean { return this.mode === 'D' && this.gear > 1 && !this.shifting && rpm < (this.downPts[this.gear - 2] || 1200) }

  async shiftUp(): Promise<R> {
    if (this.gear >= 8 || this.shifting) return { ok: false }
    this.shifting = true; await new Promise(r => setTimeout(r, 100))
    this.gear++; this.shifting = false
    return { ok: true, data: { gear: this.gear, ratio: this.getRatio() } }
  }

  async shiftDown(): Promise<R> {
    if (this.gear <= 1 || this.shifting) return { ok: false }
    this.shifting = true; await new Promise(r => setTimeout(r, 80))
    this.gear--; this.shifting = false
    return { ok: true, data: { gear: this.gear, ratio: this.getRatio() } }
  }

  getStatus(): Record<string, any> { return { mode: this.mode, gear: this.gear, ratio: this.getRatio(), oilTemp: this.oilTemp, shifting: this.shifting } }
}

export class ABSSystem {
  private active = false; private wheelSpeeds = new Map<string, number>()
  private brakePressure = 0; private interventionCount = 0

  updateWheelSpeed(id: string, speed: number): void { this.wheelSpeeds.set(id, speed) }

  compute(wheelSpeeds: Record<string, number>): { active: boolean; pressures: Record<string, number>; slipRatios: Record<string, number> } {
    const speeds = Object.values(wheelSpeeds)
    const avgSpeed = speeds.reduce((s, v) => s + v, 0) / speeds.length
    const pressures: Record<string, number> = {}
    const slipRatios: Record<string, number> = {}
    this.active = false

    for (const [id, spd] of Object.entries(wheelSpeeds)) {
      const slip = avgSpeed > 0 ? (avgSpeed - spd) / avgSpeed : 0
      slipRatios[id] = +slip.toFixed(3)
      // ABS triggers when slip > 20% (locked wheel) or < -10% (spinning)
      if (Math.abs(slip) > 0.2 || slip < -0.1) {
        this.active = true; this.interventionCount++
        pressures[id] = Math.max(0, this.brakePressure * (1 - slip * 2))
      } else {
        pressures[id] = this.brakePressure
      }
    }
    return { active: this.active, pressures, slipRatios }
  }

  setBrakePressure(psi: number): void { this.brakePressure = Math.max(0, Math.min(3000, psi)) }
  isIntervening(): boolean { return this.active }
  getInterventionCount(): number { return this.interventionCount }
  getStatus(): Record<string, any> { return { active: this.active, brakePressure: this.brakePressure, interventions: this.interventionCount } }
}

export class StabilityControl {
  private escEnabled = true; private tcEnabled = true
  private yawRateTarget = 0; private yawRateActual = 0
  private lateralAccel = 0; private intervening = false
  private mode: 'normal'|'sport'|'off'|'track' = 'normal'

  setMode(m: typeof this.mode): void {
    this.mode = m
    if (m === 'off') { this.escEnabled = false; this.tcEnabled = false }
    else { this.escEnabled = true; this.tcEnabled = true }
  }

  update(yawRate: number, lateralAccel: number, steeringAngle: number, speed: number): { brake: Record<string, number>; throttleReduction: number; yawCorrection: number } {
    this.yawRateActual = yawRate; this.lateralAccel = lateralAccel
    const yawError = this.yawRateTarget - this.yawRateActual
    this.intervening = this.escEnabled && (Math.abs(yawRate) > 30 || Math.abs(lateralAccel) > 0.8)

    const brakes: Record<string, number> = {}
    let throttleReduction = 0, yawCorrection = 0

    if (this.intervening) {
      // Yaw correction via differential braking
      if (yawError > 5) { brakes['front_left'] = Math.min(100, yawError * 3) }
      else if (yawError < -5) { brakes['front_right'] = Math.min(100, -yawError * 3) }
      throttleReduction = Math.min(50, Math.abs(yawError) * 2)
      yawCorrection = yawError * 0.5
    }

    if (this.tcEnabled && speed > 5) {
      // Traction control — reduce throttle on wheel spin
      const wheelSlip = Math.abs(lateralAccel) > 1.0
      if (wheelSlip) throttleReduction = Math.max(throttleReduction, 30)
    }

    return { brake: brakes, throttleReduction, yawCorrection }
  }

  isIntervening(): boolean { return this.intervening }
  getStatus(): Record<string, any> { return { mode: this.mode, esc: this.escEnabled, tc: this.tcEnabled, yawRate: this.yawRateActual, lateralAccel: this.lateralAccel, intervening: this.intervening } }
}

export class CruiseControl {
  private active = false; private setSpeed = 0
  private mode: 'standard'|'adaptive'|'sport'|'limiter' = 'standard'
  private followDistance = 3 // seconds
  private limiterMax = 0
  private pid_kp = 0.5; private pid_ki = 0.1; private pid_kd = 0.2
  private integral = 0; private prevError = 0

  activate(speed: number): void { this.active = true; this.setSpeed = Math.max(30, Math.min(200, speed)); this.integral = 0; this.prevError = 0 }
  deactivate(): void { this.active = false; this.integral = 0 }
  isActive(): boolean { return this.active }
  setMode(m: typeof this.mode): void { this.mode = m }
  setSpeed(s: number): void { this.setSpeed = Math.max(30, Math.min(200, s)) }
  setFollowDistance(d: number): void { this.followDistance = Math.max(1, Math.min(5, d)) }

  compute(currentSpeed: number, leadVehicleSpeed: number | null, dt: number): { throttle: number; braking: number } {
    if (!this.active) return { throttle: 0, braking: 0 }

    let targetSpeed = this.setSpeed
    if (this.mode === 'adaptive' && leadVehicleSpeed !== null) {
      const timeGap = this.followDistance
      targetSpeed = Math.min(targetSpeed, leadVehicleSpeed)
    }

    const error = targetSpeed - currentSpeed
    this.integral += error * dt
    this.integral = Math.max(-100, Math.min(100, this.integral))
    const deriv = dt > 0 ? (error - this.prevError) / dt : 0
    const output = this.pid_kp * error + this.pid_ki * this.integral + this.pid_kd * deriv
    this.prevError = error

    if (output > 0) return { throttle: Math.min(100, output), braking: 0 }
    return { throttle: 0, braking: Math.min(100, -output) }
  }

  getStatus(): Record<string, any> { return { active: this.active, setSpeed: this.setSpeed, mode: this.mode, followDistance: this.followDistance } }
}

export class ADASSystem {
  private laneDepartureWarning = true; private autoHighBeam = true
  private forwardCollisionWarning = true; private automaticEmergencyBraking = true
  private laneKeepAssist = true; private blindSpotMonitoring = true

  // Forward Collision Warning — time-to-collision
  computeTTC(egoSpeed: number, leadDistance: number, leadSpeed: number): { ttc: number; warning: boolean; brake: boolean } {
    const relativeSpeed = egoSpeed - leadSpeed // m/s
    if (relativeSpeed <= 0 || leadDistance <= 0) return { ttc: Infinity, warning: false, brake: false }
    const ttc = leadDistance / relativeSpeed
    const warning = ttc < 2.5 && this.forwardCollisionWarning
    const brake = ttc < 1.2 && this.automaticEmergencyBraking
    return { ttc: +ttc.toFixed(2), warning, brake }
  }

  // Lane Departure Warning
  computeLDW(lanePosition: number, laneWidth: number, steeringAngle: number): { departed: boolean; direction: string | null } {
    const threshold = laneWidth * 0.3
    if (lanePosition > threshold && steeringAngle > 2) return { departed: true, direction: 'right' }
    if (lanePosition < -threshold && steeringAngle < -2) return { departed: true, direction: 'left' }
    return { departed: false, direction: null }
  }

  // Lane Keep Assist — steering correction
  computeLKA(lanePosition: number, laneWidth: number): number {
    const center = 0
    const error = center - lanePosition
    return Math.max(-2, Math.min(2, error * 0.5)) // steering angle correction
  }

  // Blind Spot Monitoring
  checkBlindSpot(side: 'left' | 'right', distance: number, relativeSpeed: number): { alert: boolean; safe: boolean } {
    const alert = distance < 5 && relativeSpeed > 0 && this.blindSpotMonitoring
    const safe = distance > 3 || relativeSpeed <= 0
    return { alert, safe }
  }

  // Auto High Beam
  computeAutoHighBeam(ambientLight: number, oncomingDistance: number): { highBeam: boolean } {
    if (!this.autoHighBeam) return { highBeam: false }
    return { highBeam: ambientLight < 50 && oncomingDistance > 300 }
  }

  getStatus(): Record<string, any> {
    return { ldw: this.laneDepartureWarning, aeb: this.automaticEmergencyBraking, lka: this.laneKeepAssist,
      bsm: this.blindSpotMonitoring, fcw: this.forwardCollisionWarning, ahb: this.autoHighBeam }
  }
}

export class ClimateControl {
  private zones = new Map<string, { target: number; current: number; fan: number; mode: string; ac: boolean; auto: boolean }>()
  private extTemp = 25

  registerZone(id: string): void { this.zones.set(id, { target: 22, current: 25, fan: 3, mode: 'auto', ac: true, auto: true }) }

  setTargetTemp(id: string, t: number): void { const z = this.zones.get(id); if (z) z.target = Math.max(16, Math.min(30, t)) }
  setFanSpeed(id: string, s: number): void { const z = this.zones.get(id); if (z) z.fan = Math.max(0, Math.min(7, s)) }
  setAC(id: string, on: boolean): void { const z = this.zones.get(id); if (z) z.ac = on }

  update(dt: number): void {
    this.zones.forEach(z => {
      const diff = z.target - z.current
      const rate = z.ac ? (diff > 0 ? 0.5 : 1.0) : (diff > 0 ? 1.0 : 0.3) // cooling faster with AC
      z.current += Math.sign(diff) * Math.min(Math.abs(diff), rate * z.fan * dt)
    })
  }

  getZone(id: string) { return this.zones.get(id) }
  getAllZones() { return Object.fromEntries(this.zones) }
}

export class TireMonitor {
  private tires = new Map<string, { pressure: number; temp: number; tread: number }>()
  private nominalPressure = 32

  registerTire(id: string, nominal = 32): void { this.tires.set(id, { pressure: 0, temp: 25, tread: 8 }); this.nominalPressure = nominal }
  update(id: string, data: Partial<{ pressure: number; temp: number; tread: number }>): void { const t = this.tires.get(id); if (t) Object.assign(t, data) }

  checkAll(): { ok: boolean; alerts: Array<{ tire: string; issue: string; value: number }> } {
    const alerts: Array<{ tire: string; issue: string; value: number }> = []
    this.tires.forEach((t, id) => {
      if (t.pressure < this.nominalPressure * 0.75) alerts.push({ tire: id, issue: 'LOW_PRESSURE', value: t.pressure })
      if (t.pressure > this.nominalPressure * 1.3) alerts.push({ tire: id, issue: 'HIGH_PRESSURE', value: t.pressure })
      if (t.temp > 80) alerts.push({ tire: id, issue: 'OVERHEATING', value: t.temp })
      if (t.tread < 1.6) alerts.push({ tire: id, issue: 'LOW_TREAD', value: t.tread })
    })
    return { ok: alerts.length === 0, alerts }
  }

  getAllTires() { return Object.fromEntries(this.tires) }
}

export class OBDReader {
  private dtcCodes: Array<{ code: string; desc: string; severity: string; time: number }> = []
  private liveData = new Map<string, number>()

  addDTC(code: string, desc: string, severity = 'warning'): void { this.dtcCodes.push({ code, desc, severity, time: Date.now() }) }
  clearDTCs(): void { this.dtcCodes = [] }
  getDTCs() { return this.dtcCodes }

  setLiveData(pid: string, value: number): void { this.liveData.set(pid, value) }
  getLiveData(pid: string) { return this.liveData.get(pid) }
  getAllLiveData() { return Object.fromEntries(this.liveData) }

  freezeFrame(): Record<string, number> { return Object.fromEntries(this.liveData) }
}
