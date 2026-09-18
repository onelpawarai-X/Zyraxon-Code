/**
 * ZYRAXON X — Rocket Guidance, Navigation & Control
 * Trajectory optimization, attitude control, staging, abort logic
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

export class TrajectoryPlanner {
  // Hohmann transfer orbit calculation
  hohmannTransfer(r1: number, r2: number, mu = 3.986e14): { deltaV1: number; deltaV2: number; tof: number } {
    const a = (r1 + r2) / 2
    const deltaV1 = Math.sqrt(mu / r1) * (Math.sqrt(2 * r2 / (r1 + r2)) - 1)
    const deltaV2 = Math.sqrt(mu / r2) * (1 - Math.sqrt(2 * r1 / (r1 + r2)))
    const tof = Math.PI * Math.sqrt(a ** 3 / mu) // seconds
    return { deltaV1: +deltaV1.toFixed(2), deltaV2: +deltaV2.toFixed(2), tof: +tof.toFixed(2) }
  }

  // Gravity turn trajectory (simplified)
  gravityTurn(altitude: number, velocity: number, targetAngle: number): { pitch: number; throttle: number } {
    const turnRate = 0.001 // degrees per meter
    const pitch = Math.max(-90, Math.min(90, targetAngle - altitude * turnRate))
    const throttle = altitude < 50000 ? 100 : Math.max(60, 100 - (altitude - 50000) * 0.001) // throttle back at high altitude
    return { pitch: +pitch.toFixed(2), throttle: +throttle.toFixed(1) }
  }

  // Delta-V budget for mission phases
  computeMissionBudget(phases: Array<{ name: string; deltaV: number }>): { total: number; phases: Array<{ name: string; deltaV: number; cumulative: number }> } {
    let cumulative = 0
    const result = phases.map(p => { cumulative += p.deltaV; return { ...p, cumulative: +cumulative.toFixed(2) } })
    return { total: +cumulative.toFixed(2), phases: result }
  }

  // Tsiolkovsky rocket equation: deltaV = Isp * g0 * ln(m0/mf)
  rocketEquation(isp: number, m0: number, mf: number, g0 = 9.80665): { deltaV: number; massRatio: number } {
    if (mf <= 0 || m0 <= mf) return { deltaV: 0, massRatio: 1 }
    const deltaV = isp * g0 * Math.log(m0 / mf)
    return { deltaV: +deltaV.toFixed(2), massRatio: +(m0 / mf).toFixed(4) }
  }
}

export class AttitudeControl {
  private pitchPID = new PID(5.0, 0.1, 1.0, -100, 100, 200)
  private rollPID = new PID(4.0, 0.08, 0.8, -100, 100, 200)
  private yawPID = new PID(3.0, 0.05, 0.5, -100, 100, 200)
  private mode: 'inertial'|'earth'|'sun'|'star' = 'inertial'

  // Reaction wheel control
  private wheels = new Map<string, { speed: number; maxSpeed: number; torque: number }>()

  registerWheel(id: string, maxSpeed = 6000): void { this.wheels.set(id, { speed: 0, maxSpeed, torque: 0 }) }

  setMode(m: typeof this.mode): void { this.mode = m }

  compute(targetRoll: number, targetPitch: number, targetYaw: number,
          currentRoll: number, currentPitch: number, currentYaw: number,
          dt: number): { pitchTorque: number; rollTorque: number; yawTorque: number; wheels: Record<string, number> } {

    const rollErr = targetRoll - currentRoll
    const pitchErr = targetPitch - currentPitch
    let yawErr = targetYaw - currentYaw
    if (yawErr > 180) yawErr -= 360; if (yawErr < -180) yawErr += 360

    const rollTorque = this.rollPID.compute(rollErr, dt)
    const pitchTorque = this.pitchPID.compute(pitchErr, dt)
    const yawTorque = this.yawPID.compute(yawErr, dt)

    // Distribute torques to reaction wheels
    const wheelCmds: Record<string, number> = {}
    const wheelCount = this.wheels.size
    if (wheelCount > 0) {
      const axis分配 = ['x', 'y', 'z']
      let i = 0
      this.wheels.forEach((w, id) => {
        const axis = axis分配[i % 3]
        const torque = axis === 'x' ? rollTorque : axis === 'y' ? pitchTorque : yawTorque
        w.torque = torque / wheelCount
        w.speed = Math.max(-w.maxSpeed, Math.min(w.maxSpeed, w.speed + w.torque * dt * 100))
        wheelCmds[id] = +w.speed.toFixed(1)
        i++
      })
    }

    return { pitchTorque: +pitchTorque.toFixed(4), rollTorque: +rollTorque.toFixed(4), yawTorque: +yawTorque.toFixed(4), wheels: wheelCmds }
  }

  getStatus(): Record<string, any> {
    const wheels: Record<string, any> = {}; this.wheels.forEach((w, id) => { wheels[id] = { speed: +w.speed.toFixed(1), maxSpeed: w.maxSpeed, torque: +w.torque.toFixed(4) } })
    return { mode: this.mode, wheels }
  }
}

export class StagingSystem {
  private stages: Array<{ name: string; mass: number; fuelMass: number; thrust: number; isp: number; burnTime: number; jettisoned: boolean }> = []
  private currentStage = 0
  private missionTime = 0

  addStage(name: string, mass: number, fuelMass: number, thrust: number, isp: number, burnTime: number): void {
    this.stages.push({ name, mass, fuelMass, thrust, isp, burnTime, jettisoned: false })
  }

  getCurrentStage() { return this.stages[this.currentStage] || null }

  // Check if current stage is depleted
  isStageDepleted(): boolean {
    const s = this.getCurrentStage()
    return s ? s.fuelMass <= 0 || this.missionTime > this.getStageStartTime() + s.burnTime : true
  }

  private getStageStartTime(): number {
    let t = 0
    for (let i = 0; i < this.currentStage; i++) t += this.stages[i].burnTime
    return t
  }

  // Stage separation
  separate(): R {
    const s = this.getCurrentStage()
    if (!s) return { ok: false, error: 'No current stage' }
    s.jettisoned = true
    this.currentStage++
    const next = this.getCurrentStage()
    return { ok: true, data: { separated: s.name, nextStage: next?.name || 'mission_complete', mass: next?.mass } }
  }

  update(dt: number): void {
    this.missionTime += dt
    const s = this.getCurrentStage()
    if (s && s.fuelMass > 0) {
      const fuelRate = s.thrust / (s.isp * 9.80665) // kg/s
      s.fuelMass = Math.max(0, s.fuelMass - fuelRate * dt)
    }
  }

  getTotalDeltaV(): number {
    let totalDv = 0
    for (const s of this.stages) {
      if (s.fuelMass > 0) {
        totalDv += s.isp * 9.80665 * Math.log((s.mass + s.fuelMass) / s.mass)
      }
    }
    return +totalDv.toFixed(2)
  }

  getMissionTime(): number { return this.missionTime }
  getStatus(): Record<string, any> { return { currentStage: this.currentStage, missionTime: +this.missionTime.toFixed(1), stages: this.stages.map(s => ({ ...s })), totalDeltaV: this.getTotalDeltaV() } }
}

export class AbortSystem {
  private abortModes: Array<{ name: string; condition: string; action: string; priority: number }> = []
  private triggered = false; private activeMode = ''

  registerMode(name: string, condition: string, action: string, priority: number): void {
    this.abortModes.push({ name, condition, action, priority })
  }

  evaluate(conditions: Record<string, number>): { triggered: boolean; mode: string; action: string } {
    for (const mode of this.abortModes.sort((a, b) => b.priority - a.priority)) {
      // Parse simple condition like "altitude < 1000"
      const parts = mode.condition.split(' ')
      if (parts.length === 3) {
        const [param, op, val] = parts
        const value = conditions[param]
        if (value !== undefined) {
          const threshold = parseFloat(val)
          if ((op === '<' && value < threshold) || (op === '>' && value > threshold) ||
              (op === '<=' && value <= threshold) || (op === '>=' && value >= threshold)) {
            this.triggered = true; this.activeMode = mode.name
            return { triggered: true, mode: mode.name, action: mode.action }
          }
        }
      }
    }
    return { triggered: false, mode: '', action: '' }
  }

  reset(): void { this.triggered = false; this.activeMode = '' }
  isTriggered(): boolean { return this.triggered }
  getStatus(): Record<string, any> { return { triggered: this.triggered, activeMode: this.activeMode, modes: this.abortModes } }
}

export class TelemetryRecorder {
  private records: Array<{ time: number; data: Record<string, any> }> = []
  private maxRecords = 100000
  private samplingRate = 10 // Hz

  record(time: number, data: Record<string, any>): void {
    this.records.push({ time, data })
    if (this.records.length > this.maxRecords) this.records.splice(0, 1000)
  }

  getRecords(since?: number, until?: number): Array<{ time: number; data: Record<string, any> }> {
    let r = this.records
    if (since) r = r.filter(rec => rec.time >= since)
    if (until) r = r.filter(rec => rec.time <= until)
    return r
  }

  getLatest(n = 100) { return this.records.slice(-n) }
  exportCSV(): string {
    const keys = new Set<string>()
    this.records.forEach(r => Object.keys(r.data).forEach(k => keys.add(k)))
    const header = ['time', ...keys].join(',')
    const rows = this.records.map(r => [r.time, ...keys.map(k => r.data[k] ?? '')].join(','))
    return header + '\n' + rows.join('\n')
  }

  size(): number { return this.records.length }
  clear(): void { this.records = [] }
}

export class RocketGNC {
  public trajectory: TrajectoryPlanner
  public attitude: AttitudeControl
  public staging: StagingSystem
  public abort: AbortSystem
  public telemetry: TelemetryRecorder

  constructor() {
    this.trajectory = new TrajectoryPlanner()
    this.attitude = new AttitudeControl()
    this.staging = new StagingSystem()
    this.abort = new AbortSystem()
    this.telemetry = new TelemetryRecorder()

    // Register default abort modes
    this.abort.registerMode('LAUNCH_ABORT', 'altitude < 100', 'terminate', 10)
    this.abort.registerMode('HIGH_G', 'gforce > 8', 'abort_to_orbit', 9)
    this.abort.registerMode('ENGINE_FAIL', 'thrust < 50', 'early_separation', 8)
    this.abort.registerMode('TUMBLE', 'roll_rate > 50', 'terminate', 7)
  }

  getHealth(): Record<string, any> {
    return {
      attitude: this.attitude.getStatus(),
      staging: this.staging.getStatus(),
      abort: this.abort.getStatus(),
      telemetrySize: this.telemetry.size(),
    }
  }
}
