/**
 * ZYRAXON X — Aircraft Flight Control System
 * Complete FCS: Autopilot, Engine, Hydraulics, Electrical, Fuel, Pressurization,
 * Anti-Ice, Landing Gear, Flaps, Trim, TCAS, GPWS, Weather Radar, Radio Altimeter
 */

type Result = { ok: boolean; data?: any; error?: string }

// ═══════════════════════════════════════════════════════════════════
// CORE PID — Used by ALL controllers (heading, altitude, speed, vs)
// ═══════════════════════════════════════════════════════════════════
class PID {
  private integral = 0
  private prevError = 0
  private prevDeriv = 0
  constructor(
    private kp: number, private ki: number, private kd: number,
    private outMin = -1e9, private outMax = 1e9,
    private intMax = 1e6, private derivAlpha = 0.1
  ) {}

  compute(error: number, dt: number): number {
    this.integral = Math.max(-this.intMax, Math.min(this.intMax, this.integral + error * dt))
    const rawD = dt > 0 ? (error - this.prevError) / dt : 0
    const filtD = this.derivAlpha * rawD + (1 - this.derivAlpha) * this.prevDeriv
    this.prevDeriv = filtD
    let output = this.kp * error + this.ki * this.integral + this.kd * filtD
    const saturated = output > this.outMax || output < this.outMin
    output = Math.max(this.outMin, Math.min(this.outMax, output))
    if (saturated && this.ki !== 0) this.integral -= error * dt
    this.prevError = error
    return output
  }

  reset(): void { this.integral = 0; this.prevError = 0; this.prevDeriv = 0 }
  setGains(kp: number, ki: number, kd: number): void { this.kp = kp; this.ki = ki; this.kd = kd }
}

// ═══════════════════════════════════════════════════════════════════
// FLIGHT CONTROL SYSTEM — The brain of the aircraft
// ═══════════════════════════════════════════════════════════════════
export class AircraftFCS {
  // Sub-systems
  public engines: EngineSystem
  public hydraulics: HydraulicSystem
  public electrical: ElectricalSystem
  public fuel: FuelSystem
  public pressurization: PressurizationSystem
  public antiIce: AntiIceSystem
  public landingGear: LandingGearSystem
  public flaps: FlapSystem
  public trim: TrimSystem
  public tcas: TCAS
  public gpws: GPWS
  public weatherRadar: WeatherRadar
  public radioAltimeter: RadioAltimeter
  public autobrake: AutobrakeSystem
  public oxygen: OxygenSystem
  public fireDetection: FireDetectionSystem

  // Autopilot controllers
  private hdgPID: PID
  private altPID: PID
  private spdPID: PID
  private vsPID: PID
  private locPID: PID
  private gsPID: PID

  // State
  private _modes = { hdg: false, alt: false, spd: false, vs: false, nav: false, app: false, autothrottle: false }
  private _targets = { hdg: 0, alt: 1000, spd: 0, vs: 0 }
  private _lastTime = 0
  private _apEnabled = false

  constructor() {
    this.engines = new EngineSystem()
    this.hydraulics = new HydraulicSystem()
    this.electrical = new ElectricalSystem()
    this.fuel = new FuelSystem()
    this.pressurization = new PressurizationSystem()
    this.antiIce = new AntiIceSystem()
    this.landingGear = new LandingGearSystem()
    this.flaps = new FlapSystem()
    this.trim = new TrimSystem()
    this.tcas = new TCAS()
    this.gpws = new GPWS()
    this.weatherRadar = new WeatherRadar()
    this.radioAltimeter = new RadioAltimeter()
    this.autobrake = new AutobrakeSystem()
    this.oxygen = new OxygenSystem()
    this.fireDetection = new FireDetectionSystem()

    // PID controllers with realistic tuning
    this.hdgPID = new PID(1.2, 0.05, 0.3, -30, 30, 50, 0.1) // bank angle command
    this.altPID = new PID(0.01, 0.002, 0.005, -25, 25, 50, 0.1) // pitch angle command
    this.spdPID = new PID(0.5, 0.1, 0.2, -20, 20, 50, 0.1) // throttle command
    this.vsPID = new PID(0.005, 0.001, 0.003, -25, 25, 50, 0.1) // pitch for VS
    this.locPID = new PID(2.0, 0.1, 0.5, -30, 30, 50, 0.1) // localizer
    this.gsPID = new PID(1.5, 0.08, 0.4, -10, 10, 50, 0.1) // glideslope
  }

  // ── Autopilot Modes ──
  enable(): void { this._apEnabled = true }
  disable(): void {
    this._apEnabled = false
    this._modes = { hdg: false, alt: false, spd: false, vs: false, nav: false, app: false, autothrottle: false }
    Object.values(this).forEach(v => { if (v instanceof PID) v.reset() })
  }

  setMode(mode: keyof typeof this._modes, on: boolean, value?: number): void {
    this._modes[mode] = on
    if (value !== undefined) {
      if (mode === 'hdg') this._targets.hdg = ((value % 360) + 360) % 360
      if (mode === 'alt') this._targets.alt = Math.max(0, value)
      if (mode === 'spd') this._targets.spd = Math.max(0, value)
      if (mode === 'vs') this._targets.vs = value
    }
    if (on && (mode === 'hdg' || mode === 'alt' || mode === 'vs')) {
      this.hdgPID.reset(); this.altPID.reset(); this.vsPID.reset()
    }
  }

  // ── Main Compute Cycle (called at 50Hz) ──
  compute(state: {
    hdg: number; alt: number; spd: number; vs: number
    pitch: number; roll: number; lat: number; lon: number
    ias: number; mach: number; baroAlt: number; radioAlt: number
    windDir: number; windSpd: number; oat: number; sat: number
    locDev: number; gsDev: number; daMsg: string
  }): Result {
    if (!this._apEnabled) return { ok: true, data: { active: false } }

    const now = Date.now()
    const dt = this._lastTime ? (now - this._lastTime) / 1000 : 0.02
    this._lastTime = now

    const cmd = { roll: 0, pitch: 0, throttle: 50, rudder: 0, modes: [] as string[] }

    // ── Lateral (heading / nav / approach) ──
    if (this._modes.app) {
      // ILS approach — localizer + glideslope
      cmd.roll = this.locPID.compute(state.locDev, dt)
      cmd.pitch = this.gsPID.compute(-state.gsDev, dt)
      cmd.modes.push('APP')
    } else if (this._modes.nav) {
      // TODO: route following — for now use heading mode
      let hdgErr = this._targets.hdg - state.hdg
      if (hdgErr > 180) hdgErr -= 360; if (hdgErr < -180) hdgErr += 360
      cmd.roll = this.hdgPID.compute(hdgErr, dt)
      cmd.modes.push('NAV')
    } else if (this._modes.hdg) {
      let hdgErr = this._targets.hdg - state.hdg
      if (hdgErr > 180) hdgErr -= 360; if (hdgErr < -180) hdgErr += 360
      cmd.roll = this.hdgPID.compute(hdgErr, dt)
      cmd.modes.push('HDG')
    }

    // ── Vertical (altitude / vs) ──
    if (this._modes.alt) {
      const altErr = this._targets.alt - state.alt
      cmd.pitch = this.altPID.compute(altErr, dt)
      cmd.modes.push('ALT')
    } else if (this._modes.vs) {
      const vsErr = this._targets.vs - state.vs
      cmd.pitch = this.vsPID.compute(vsErr, dt)
      cmd.modes.push('VS')
    }

    // ── Autothrottle (speed) ──
    if (this._modes.autothrottle || this._modes.spd) {
      const spdErr = this._targets.spd - state.ias
      cmd.throttle = 50 + this.spdPID.compute(spdErr, dt)
      cmd.modes.push('AT')
    }

    // ── Safety checks ──
    const safety: string[] = []
    if (Math.abs(cmd.roll) > 33) safety.push('BANK_EXCESS')
    if (cmd.pitch > 25) safety.push('PITCH_HIGH')
    if (cmd.pitch < -15) safety.push('PITCH_LOW')

    return {
      ok: true,
      data: {
        active: true,
        roll: +cmd.roll.toFixed(2),
        pitch: +cmd.pitch.toFixed(2),
        throttle: Math.max(0, Math.min(100, +cmd.throttle.toFixed(1))),
        rudder: +cmd.rudder.toFixed(2),
        modes: cmd.modes,
        targets: { ...this._targets },
        safety,
      }
    }
  }

  // ── System Health ──
  getHealth(): Result {
    return {
      ok: true,
      data: {
        ap: this._apEnabled,
        modes: { ...this._modes },
        engines: this.engines.getStatus(),
        hydraulics: this.hydraulics.getOverallStatus(),
        electrical: this.electrical.getOverallStatus(),
        fuel: this.fuel.getSummary(),
        pressurization: this.pressurization.getStatus(),
        landingGear: this.landingGear.getStatus(),
        tcas: this.tcas.getAdvisory(),
        gpws: this.gpws.getStatus(),
        oxygen: this.oxygen.getStatus(),
        fire: this.fireDetection.getStatus(),
      }
    }
  }

  getModes() { return { ...this._modes } }
  getTargets() { return { ...this._targets } }
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE SYSTEM — Multi-engine monitoring & control
// ═══════════════════════════════════════════════════════════════════
export class EngineSystem {
  private engines = new Map<string, {
    n1: number; n2: number; egt: number; fuelFlow: number
    oilTemp: number; oilPress: number; vib: number; status: string
    startedAt: number; lastUpdate: number
  }>()

  register(id: string): void {
    this.engines.set(id, {
      n1: 0, n2: 0, egt: 0, fuelFlow: 0,
      oilTemp: 20, oilPress: 0, vib: 0, status: 'OFF',
      startedAt: 0, lastUpdate: Date.now()
    })
  }

  async start(id: string): Promise<Result> {
    const e = this.engines.get(id)
    if (!e) return { ok: false, error: `Engine ${id} not found` }
    // Simulate realistic start sequence: N2 first, then fuel, then N1
    e.status = 'STARTING'
    e.n2 = 25; e.oilTemp = 30; e.oilPress = 20
    await new Promise(r => setTimeout(r, 500))
    e.egt = 200; e.fuelFlow = 15
    await new Promise(r => setTimeout(r, 300))
    e.n1 = 18; e.egt = 350; e.status = 'RUNNING'
    e.startedAt = Date.now(); e.lastUpdate = Date.now()
    return { ok: true, data: { id, status: 'RUNNING', n1: e.n1, n2: e.n2, egt: e.egt } }
  }

  async stop(id: string): Promise<Result> {
    const e = this.engines.get(id)
    if (!e) return { ok: false, error: `Engine ${id} not found` }
    e.status = 'SHUTTING'
    await new Promise(r => setTimeout(r, 300))
    e.n1 = 0; e.n2 = 0; e.egt = 0; e.fuelFlow = 0; e.oilPress = 0
    e.status = 'OFF'; e.lastUpdate = Date.now()
    return { ok: true, data: { id, status: 'OFF' } }
  }

  update(id: string, data: Partial<{
    n1: number; n2: number; egt: number; fuelFlow: number
    oilTemp: number; oilPress: number; vib: number; status: string
  }>): void {
    const e = this.engines.get(id)
    if (e) { Object.assign(e, data, { lastUpdate: Date.now() }) }
  }

  checkLimits(id: string): { ok: boolean; warnings: string[] } {
    const e = this.engines.get(id)
    if (!e) return { ok: false, warnings: ['Engine not found'] }
    const w: string[] = []
    if (e.egt > 900) w.push('EGT_EXCEED')
    if (e.n1 > 105) w.push('N1_OVERLIMIT')
    if (e.n2 > 105) w.push('N2_OVERLIMIT')
    if (e.oilTemp > 155) w.push('OIL_TEMP_HIGH')
    if (e.oilPress < 12) w.push('OIL_PRESS_LOW')
    if (e.vib > 5.0) w.push('VIBRATION_HIGH')
    if (e.fuelFlow > 3000) w.push('FUEL_FLOW_HIGH')
    return { ok: w.length === 0, warnings: w }
  }

  getStatus(): Record<string, any> {
    const result: Record<string, any> = {}
    this.engines.forEach((e, id) => { result[id] = { ...e } })
    return result
  }

  getTotalThrust(): number { let t = 0; this.engines.forEach(e => t += e.n1); return t }
  getTotalFuelFlow(): number { let t = 0; this.engines.forEach(e => t += e.fuelFlow); return t }
  getOverallStatus(): string {
    for (const [, e] of this.engines) {
      if (e.status === 'FAILURE' || e.status === 'OFF') return 'CRITICAL'
      if (e.egt > 850 || e.oilTemp > 140) return 'DEGRADED'
    }
    return 'NOMINAL'
  }
}

// ═══════════════════════════════════════════════════════════════════
// HYDRAULIC SYSTEM — Pressure, quantity, pump control
// ═══════════════════════════════════════════════════════════════════
export class HydraulicSystem {
  private systems = new Map<string, {
    pressure: number; quantity: number; temp: number
    pumpOn: boolean; filterOk: boolean; nominalPsi: number
  }>()

  register(id: string, nominalPsi = 3000): void {
    this.systems.set(id, { pressure: 0, quantity: 100, temp: 20, pumpOn: false, filterOk: true, nominalPsi })
  }

  update(id: string, data: Partial<{ pressure: number; quantity: number; temp: number; pumpOn: boolean; filterOk: boolean }>): void {
    const s = this.systems.get(id)
    if (s) Object.assign(s, data)
  }

  async activatePump(id: string): Promise<Result> {
    const s = this.systems.get(id)
    if (!s) return { ok: false, error: 'System not found' }
    s.pumpOn = true; s.pressure = s.nominalPsi
    return { ok: true, data: { id, pressure: s.pressure } }
  }

  async deactivatePump(id: string): Promise<Result> {
    const s = this.systems.get(id)
    if (!s) return { ok: false, error: 'System not found' }
    s.pumpOn = false; s.pressure = 0
    return { ok: true, data: { id, pressure: 0 } }
  }

  isPressureOk(id: string): boolean {
    const s = this.systems.get(id)
    return s ? s.pressure >= s.nominalPsi * 0.85 : false
  }

  getOverallStatus(): string {
    let critical = false, degraded = false
    this.systems.forEach(s => {
      if (s.pressure < s.nominalPsi * 0.6 || s.quantity < 20) critical = true
      else if (s.pressure < s.nominalPsi * 0.85 || s.quantity < 50) degraded = true
    })
    return critical ? 'CRITICAL' : degraded ? 'DEGRADED' : 'NOMINAL'
  }

  getSystem(id: string) { return this.systems.get(id) }
  getAllSystems() { return Object.fromEntries(this.systems) }
}

// ═══════════════════════════════════════════════════════════════════
// ELECTRICAL SYSTEM — Bus, generator, battery, APU
// ═══════════════════════════════════════════════════════════════════
export class ElectricalSystem {
  private buses = new Map<string, { voltage: number; current: number; load: number; breakerOk: boolean }>()
  private generators = new Map<string, { voltage: number; freq: number; online: boolean; load: number }>()
  private batteries = new Map<string, { voltage: number; soc: number; temp: number; charging: boolean }>()

  registerBus(id: string): void { this.buses.set(id, { voltage: 0, current: 0, load: 0, breakerOk: true }) }
  registerGenerator(id: string): void { this.generators.set(id, { voltage: 0, freq: 0, online: false, load: 0 }) }
  registerBattery(id: string): void { this.batteries.set(id, { voltage: 0, soc: 0, temp: 20, charging: false }) }

  updateBus(id: string, voltage: number, current: number, load: number): void {
    const b = this.buses.get(id); if (b) { b.voltage = voltage; b.current = current; b.load = load }
  }

  tripBreaker(busId: string): void { const b = this.buses.get(busId); if (b) b.breakerOk = false }
  resetBreaker(busId: string): void { const b = this.buses.get(busId); if (b) b.breakerOk = true }

  getTotalLoad(): number { let t = 0; this.buses.forEach(b => t += b.load); return t }

  getOverallStatus(): string {
    let critical = false, degraded = false
    this.buses.forEach(b => { if (!b.breakerOk) critical = true; if (b.voltage < 110) degraded = true })
    this.generators.forEach(g => { if (g.online && g.freq < 380) degraded = true })
    return critical ? 'CRITICAL' : degraded ? 'DEGRADED' : 'NOMINAL'
  }

  getAllBuses() { return Object.fromEntries(this.buses) }
  getAllGenerators() { return Object.fromEntries(this.generators) }
  getAllBatteries() { return Object.fromEntries(this.batteries) }
}

// ═══════════════════════════════════════════════════════════════════
// FUEL SYSTEM — Tank management, transfer, balance, consumption
// ═══════════════════════════════════════════════════════════════════
export class FuelSystem {
  private tanks = new Map<string, {
    quantity: number; capacity: number; temperature: number
    density: number; pumpActive: boolean; selected: boolean
  }>()
  private transferLog: Array<{ from: string; to: string; amount: number; time: number }> = []

  registerTank(id: string, capacity: number): void {
    this.tanks.set(id, { quantity: 0, capacity, temperature: 15, density: 0.8, pumpActive: false, selected: false })
  }

  setQuantity(id: string, qty: number): void {
    const t = this.tanks.get(id); if (t) t.quantity = Math.max(0, Math.min(t.capacity, qty))
  }

  async transfer(fromId: string, toId: string, amount: number): Promise<Result> {
    const from = this.tanks.get(fromId), to = this.tanks.get(toId)
    if (!from || !to) return { ok: false, error: 'Tank not found' }
    if (from.quantity < amount) return { ok: false, error: 'Insufficient fuel' }
    const actual = Math.min(amount, to.capacity - to.quantity)
    from.quantity -= actual; to.quantity += actual
    this.transferLog.push({ from: fromId, to: toId, amount: actual, time: Date.now() })
    return { ok: true, data: { transferred: actual } }
  }

  consumeFuel(id: string, amount: number): void {
    const t = this.tanks.get(id); if (t) t.quantity = Math.max(0, t.quantity - amount)
  }

  getTotalQuantity(): number { let t = 0; this.tanks.forEach(tank => t += tank.quantity); return t }
  getTotalCapacity(): number { let t = 0; this.tanks.forEach(tank => t += tank.capacity); return t }

  getBalance(): { left: number; right: number; imbalance: number } {
    let left = 0, right = 0
    this.tanks.forEach((t, id) => { if (id.includes('L')) left += t.quantity; else right += t.quantity })
    return { left, right, imbalance: Math.abs(left - right) }
  }

  getSummary(): Record<string, any> {
    const tanks: Record<string, any> = {}
    this.tanks.forEach((t, id) => { tanks[id] = { quantity: +t.quantity.toFixed(1), capacity: t.capacity, pct: +(t.quantity / t.capacity * 100).toFixed(1) } })
    return { tanks, total: +this.getTotalQuantity().toFixed(1), capacity: +this.getTotalCapacity().toFixed(1), balance: this.getBalance() }
  }

  getTransferLog(n = 20) { return this.transferLog.slice(-n) }
}

// ═══════════════════════════════════════════════════════════════════
// PRESSURIZATION SYSTEM — Cabin altitude, differential, outflow valve
// ═══════════════════════════════════════════════════════════════════
export class PressurizationSystem {
  private cabinAlt = 0
  private differential = 0
  private outflowValve = 0
  private targetCabinAlt = 0
  private maxDiff = 8.5
  private history: Array<{ cabinAlt: number; differential: number; time: number }> = []

  setTargetCabinAlt(alt: number): void { this.targetCabinAlt = Math.max(0, alt) }
  setMaxDifferential(max: number): void { this.maxDiff = max }

  update(cabinAlt: number, differential: number): void {
    this.cabinAlt = cabinAlt
    this.differential = differential
    this.history.push({ cabinAlt, differential, time: Date.now() })
    if (this.history.length > 10000) this.history.shift()
  }

  isOverpressure(): boolean { return this.differential > this.maxDiff }

  getOutflowValve(): number {
    const err = this.cabinAlt - this.targetCabinAlt
    this.outflowValve = Math.max(0, Math.min(100, 50 + err * 0.5))
    return this.outflowValve
  }

  getStatus(): Record<string, any> {
    return { cabinAlt: this.cabinAlt, differential: this.differential, outflowValve: this.getOutflowValve(), overpressure: this.isOverpressure() }
  }

  getHistory(n = 50) { return this.history.slice(-n) }
}

// ═══════════════════════════════════════════════════════════════════
// ANTI-ICE SYSTEM — Wing, engine, probe, window heat
// ═══════════════════════════════════════════════════════════════════
export class AntiIceSystem {
  private wingOn = false
  private engineOn = new Map<string, boolean>()
  private probeHeat = false
  private windowHeat = new Map<string, boolean>()

  setWing(on: boolean): void { this.wingOn = on }
  setEngine(id: string, on: boolean): void { this.engineOn.set(id, on) }
  setProbeHeat(on: boolean): void { this.probeHeat = on }
  setWindow(id: string, on: boolean): void { this.windowHeat.set(id, on) }

  isAnyActive(): boolean {
    return this.wingOn || this.probeHeat || [...this.engineOn.values()].some(v => v) || [...this.windowHeat.values()].some(v => v)
  }

  getAll(): Record<string, any> {
    return { wing: this.wingOn, engines: Object.fromEntries(this.engineOn), probeHeat: this.probeHeat, windowHeat: Object.fromEntries(this.windowHeat) }
  }
}

// ═══════════════════════════════════════════════════════════════════
// LANDING GEAR SYSTEM — Position, door, weight-on-wheels, steering
// ═══════════════════════════════════════════════════════════════════
export class LandingGearSystem {
  private gear = new Map<string, {
    position: 'UP' | 'TRANSIT' | 'DOWN'
    doorOpen: boolean; brakeTemp: number; tirePressure: number; tireTemp: number
  }>()
  private weightOnWheels = false
  private noseSteerAngle = 0

  register(id: string): void {
    this.gear.set(id, { position: 'UP', doorOpen: false, brakeTemp: 20, tirePressure: 180, tireTemp: 25 })
  }

  async extend(): Promise<Result> {
    for (const [id, g] of this.gear) { g.position = 'TRANSIT'; g.doorOpen = true }
    await new Promise(r => setTimeout(r, 800))
    for (const [, g] of this.gear) { g.position = 'DOWN'; g.doorOpen = false }
    return { ok: true, data: { position: 'DOWN', gearDown: this.isGearDown() } }
  }

  async retract(): Promise<Result> {
    for (const [id, g] of this.gear) { g.position = 'TRANSIT'; g.doorOpen = true }
    await new Promise(r => setTimeout(r, 800))
    for (const [, g] of this.gear) { g.position = 'UP'; g.doorOpen = false }
    return { ok: true, data: { position: 'UP', gearUp: this.isGearUp() } }
  }

  isGearDown(): boolean { return [...this.gear.values()].every(g => g.position === 'DOWN') }
  isGearUp(): boolean { return [...this.gear.values()].every(g => g.position === 'UP') }
  setWeightOnWheels(wow: boolean): void { this.weightOnWheels = wow }
  isWeightOnWheels(): boolean { return this.weightOnWheels }
  setNoseSteer(angle: number): void { this.noseSteerAngle = Math.max(-70, Math.min(70, angle)) }
  getHighestBrakeTemp(): number { let max = 0; this.gear.forEach(g => max = Math.max(max, g.brakeTemp)); return max }
  getAllGear() { return Object.fromEntries(this.gear) }
}

// ═══════════════════════════════════════════════════════════════════
// FLAP SYSTEM — Position, speed limits, load factor
// ═══════════════════════════════════════════════════════════════════
export class FlapSystem {
  private position = 0 // 0-40 degrees
  private maxPosition = 40
  private speedLimit = [0, 10, 15, 20, 25] // Vfe for each detent

  async setPosition(deg: number): Promise<Result> {
    this.position = Math.max(0, Math.min(this.maxPosition, deg))
    return { ok: true, data: { position: this.position } }
  }

  getPosition(): number { return this.position }
  isClean(): boolean { return this.position === 0 }
  getSpeedLimit(): number {
    const detents = [0, 10, 15, 20, 25, 40]
    for (let i = detents.length - 1; i >= 0; i--) {
      if (this.position >= detents[i]) return this.speedLimit[i] || 175
    }
    return 175
  }
}

// ═══════════════════════════════════════════════════════════════════
// TRIM SYSTEM — Pitch, roll, yaw trim with speed trim
// ═══════════════════════════════════════════════════════════════════
export class TrimSystem {
  private pitchTrim = 0 // -17 to +17 units
  private rollTrim = 0  // -15 to +15 units
  private yawTrim = 0   // -25 to +25 units
  private speedTrim = 0 // auto-trim for speed

  setPitch(units: number): void { this.pitchTrim = Math.max(-17, Math.min(17, units)) }
  setRoll(units: number): void { this.rollTrim = Math.max(-15, Math.min(15, units)) }
  setYaw(units: number): void { this.yawTrim = Math.max(-25, Math.min(25, units)) }

  autoTrim(pitchError: number, dt: number): void {
    this.speedTrim = Math.max(-17, Math.min(17, this.speedTrim + pitchError * 0.01 * dt))
  }

  reset(): void { this.pitchTrim = 0; this.rollTrim = 0; this.yawTrim = 0; this.speedTrim = 0 }
  getStatus(): Record<string, number> {
    return { pitch: this.pitchTrim, roll: this.rollTrim, yaw: this.yawTrim, speed: this.speedTrim }
  }
}

// ═══════════════════════════════════════════════════════════════════
// TCAS — Traffic Collision Avoidance System
// ═══════════════════════════════════════════════════════════════════
export class TCAS {
  private targets: Array<{ id: string; alt: number; distance: number; bearing: number; vs: number }> = []
  private taRange = 5 // nm
  private raRange = 2 // nm
  private advisory: 'NONE' | 'TA' | 'RA' = 'NONE'
  private raCommand = { verticalSpeed: 0, response: 'CLEAR' }

  setTARange(nm: number): void { this.taRange = nm }
  setRARange(nm: number): void { this.raRange = nm }

  updateTargets(targets: Array<{ id: string; alt: number; distance: number; bearing: number; vs: number }>): void {
    this.targets = targets
  }

  evaluate(): { advisory: string; response: string; target?: any } {
    let closest: any = null, closestDist = Infinity
    this.targets.forEach(t => { if (t.distance < closestDist) { closestDist = t.distance; closest = t } })

    if (closest && closestDist < this.raRange) {
      this.advisory = 'RA'
      this.raCommand = closest.alt > 0
        ? { verticalSpeed: -2000, response: 'DESCEND' }
        : { verticalSpeed: 2000, response: 'CLIMB' }
      return { advisory: 'RA', response: this.raCommand.response, target: closest }
    }
    if (closest && closestDist < this.taRange) {
      this.advisory = 'TA'
      return { advisory: 'TA', response: 'MONITOR', target: closest }
    }
    this.advisory = 'NONE'; this.raCommand = { verticalSpeed: 0, response: 'CLEAR' }
    return { advisory: 'NONE', response: 'CLEAR' }
  }

  getAdvisory() { return this.advisory }
  getRACommand() { return this.raCommand }
  getTargets() { return this.targets }
}

// ═══════════════════════════════════════════════════════════════════
// GPWS — Ground Proximity Warning System
// ═══════════════════════════════════════════════════════════════════
export class GPWS {
  private modes = { terrain: true, sinkRate: true, pullUp: true, terrainClearance: true, glideslope: true }
  private warnings: Array<{ mode: string; message: string; time: number; priority: number }> = []

  update(radioAlt: number, terrainAlt: number, glidePathDev?: number, verticalSpeed?: number): void {
    this.warnings = []
    if (this.modes.terrain && radioAlt < 500 && terrainAlt > radioAlt * 0.8) {
      this.warnings.push({ mode: 'TERRAIN', message: 'TERRAIN, TERRAIN', time: Date.now(), priority: 3 })
    }
    if (this.modes.pullUp && radioAlt < 200) {
      this.warnings.push({ mode: 'PULL_UP', message: 'PULL UP', time: Date.now(), priority: 4 })
    }
    if (this.modes.sinkRate && verticalSpeed !== undefined && verticalSpeed < -2000 && radioAlt < 1500) {
      this.warnings.push({ mode: 'SINK_RATE', message: 'SINK RATE', time: Date.now(), priority: 2 })
    }
    if (this.modes.glideslope && glidePathDev !== undefined && Math.abs(glidePathDev) > 1.5) {
      this.warnings.push({ mode: 'GLIDESLOPE', message: 'GLIDESLOPE', time: Date.now(), priority: 1 })
    }
  }

  getWarnings() { return this.warnings }
  hasWarning(): boolean { return this.warnings.length > 0 }
  getMostSevere(): string {
    if (!this.warnings.length) return 'NONE'
    return this.warnings.sort((a, b) => b.priority - a.priority)[0].message
  }
  getStatus(): Record<string, any> { return { warnings: this.warnings, hasWarning: this.hasWarning(), mostSevere: this.getMostSevere() } }
}

// ═══════════════════════════════════════════════════════════════════
// WEATHER RADAR — Tilt, gain, mode, storm detection
// ═══════════════════════════════════════════════════════════════════
export class WeatherRadar {
  private tilt = 0
  private gain = 50
  private mode: 'WX' | 'MAP' | 'TURB' | 'GCC' = 'WX'
  private range = 80
  private returns: Array<{ distance: number; bearing: number; intensity: number; type: string }> = []
  private stormCells: Array<{ intensity: number; tops: number; distance: number }> = []

  setTilt(deg: number): void { this.tilt = Math.max(-30, Math.min(30, deg)) }
  setGain(pct: number): void { this.gain = Math.max(0, Math.min(100, pct)) }
  setMode(mode: typeof this.mode): void { this.mode = mode }
  setRange(nm: number): void { this.range = Math.max(10, Math.min(320, nm)) }

  processReturns(returns: Array<{ distance: number; bearing: number; intensity: number }>): void {
    this.returns = returns.map(r => ({ ...r, type: r.intensity > 70 ? 'SEVERE' : r.intensity > 40 ? 'MODERATE' : 'LIGHT' }))
    this.stormCells = this.returns.filter(r => r.intensity > 60).map(r => ({ intensity: r.intensity, tops: r.intensity * 200, distance: r.distance }))
  }

  hasSevereWeather(): boolean { return this.returns.some(r => r.intensity > 70) }
  getReturns() { return this.returns }
  getStormCells() { return this.stormCells }
}

// ═══════════════════════════════════════════════════════════════════
// RADIO ALTIMETER — Height above terrain, decision height
// ═══════════════════════════════════════════════════════════════════
export class RadioAltimeter {
  private height = 0
  private decisionHeight = 200
  private minimums = 100
  private history: Array<{ height: number; time: number }> = []
  private onDecision?: () => void

  setDecisionHeight(feet: number): void { this.decisionHeight = feet }
  setMinimums(feet: number): void { this.minimums = feet }
  onDecision(cb: () => void): void { this.onDecision = cb }

  update(height: number): void {
    this.height = height
    this.history.push({ height, time: Date.now() })
    if (this.history.length > 5000) this.history.shift()
    if (height <= this.decisionHeight) this.onDecision?.()
  }

  getHeight(): number { return this.height }
  isAtDecisionHeight(): boolean { return this.height <= this.decisionHeight }
  isBelowMinimums(): boolean { return this.height <= this.minimums }
  getDescentRate(): number {
    if (this.history.length < 2) return 0
    const prev = this.history[this.history.length - 2]
    const curr = this.history[this.history.length - 1]
    return (curr.height - prev.height) / ((curr.time - prev.time) / 1000)
  }
}

// ═══════════════════════════════════════════════════════════════════
// AUTOBRAKE — Deceleration rates, rejected takeoff
// ═══════════════════════════════════════════════════════════════════
export class AutobrakeSystem {
  private level: 0 | 1 | 2 | 3 | 4 | 5 = 0
  private armed = false
  private active = false
  private decelRates = [0, 2, 4, 6, 8, 10] // m/s²

  setLevel(level: 0 | 1 | 2 | 3 | 4 | 5): void { this.level = level; this.armed = level > 0 }
  activate(): void { if (this.armed) this.active = true }
  deactivate(): void { this.active = false; this.armed = false }
  reject(): void { this.active = true } // RTO mode
  getDecelRate(): number { return this.decelRates[this.level] }
  getStatus(): Record<string, any> { return { level: this.level, armed: this.armed, active: this.active, decelRate: this.getDecelRate() } }
}

// ═══════════════════════════════════════════════════════════════════
// OXYGEN SYSTEM — Pressure, flow, mask deployment
// ═══════════════════════════════════════════════════════════════════
export class OxygenSystem {
  private pressure = 0 // PSI
  private flow = false
  private maskDeployed = false
  private regulatorOk = true

  setPressure(psi: number): void { this.pressure = Math.max(0, psi) }
  setFlow(on: boolean): void { this.flow = on }
  deployMask(): void { this.maskDeployed = true; this.flow = true }
  getStatus(): Record<string, any> {
    return { pressure: this.pressure, flow: this.flow, maskDeployed: this.maskDeployed, regulatorOk: this.regulatorOk, lowPressure: this.pressure < 500 }
  }
}

// ═══════════════════════════════════════════════════════════════════
// FIRE DETECTION — Loop resistance, smoke, agent discharge
// ═══════════════════════════════════════════════════════════════════
export class FireDetectionSystem {
  private zones = new Map<string, { fire: boolean; smoke: boolean; loopOk: boolean; agentDischarged: boolean }>()

  registerZone(id: string): void { this.zones.set(id, { fire: false, smoke: false, loopOk: true, agentDischarged: false }) }
  setFire(id: string, fire: boolean): void { const z = this.zones.get(id); if (z) z.fire = fire }
  setSmoke(id: string, smoke: boolean): void { const z = this.zones.get(id); if (z) z.smoke = smoke }

  dischargeAgent(id: string): Result {
    const z = this.zones.get(id)
    if (!z) return { ok: false, error: 'Zone not found' }
    z.agentDischarged = true; z.fire = false
    return { ok: true, data: { zone: id, agent: 'DISCHARGED' } }
  }

  hasFire(): boolean { return [...this.zones.values()].some(z => z.fire) }
  hasSmoke(): boolean { return [...this.zones.values()].some(z => z.smoke) }
  getStatus(): Record<string, any> { return { zones: Object.fromEntries(this.zones), hasFire: this.hasFire(), hasSmoke: this.hasSmoke() } }
}
