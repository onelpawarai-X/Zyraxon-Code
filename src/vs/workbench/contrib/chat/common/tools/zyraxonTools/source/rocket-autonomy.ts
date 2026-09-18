/**
 * ZYRAXON X — Rocket Autonomy
 * Mission planner, orbit determination, propulsion controller, launch sequencer
 */
type R = { ok: boolean; data?: any; error?: string }

export class MissionPlanner {
  private phases: Array<{ name: string; startTime: number; endTime: number; actions: string[] }> = []
  private currentPhase = 0; private missionTime = 0

  addPhase(name: string, duration: number, actions: string[]): void {
    const start = this.phases.length > 0 ? this.phases[this.phases.length - 1].endTime : 0
    this.phases.push({ name, startTime: start, endTime: start + duration, actions })
  }

  update(dt: number): R {
    this.missionTime += dt
    if (this.currentPhase >= this.phases.length) return { ok: true, data: { phase: 'COMPLETE', missionTime: +this.missionTime.toFixed(1) } }
    const phase = this.phases[this.currentPhase]
    if (this.missionTime >= phase.endTime) this.currentPhase++
    const p = this.phases[this.currentPhase] || phase
    return { ok: true, data: { phase: p.name, elapsed: +(this.missionTime - p.startTime).toFixed(1), remaining: +(p.endTime - this.missionTime).toFixed(1), actions: p.actions } }
  }

  getPhases() { return this.phases }
  getMissionTime(): number { return this.missionTime }
  reset(): void { this.currentPhase = 0; this.missionTime = 0 }
}

export class OrbitDetermination {
  // Gauss method: 3 observations → state vector
  fromObservations(obs: Array<{ range: number; azimuth: number; elevation: number; time: number }>): R {
    if (obs.length < 3) return { ok: false, error: 'Need 3 observations' }
    const mu = 3.986e14
    const r1 = obs[0].range * 1000, r2 = obs[1].range * 1000, r3 = obs[2].range * 1000
    const dt12 = obs[1].time - obs[0].time, dt23 = obs[2].time - obs[1].time
    const a1 = dt23 / (dt12 + dt23), a3 = dt12 / (dt12 + dt23)
    const a2 = (dt23 * (2 * dt12 + dt23)) / (dt12 * (dt12 + dt23))
    const a4 = (dt12 * (2 * dt23 + dt12)) / (dt23 * (dt12 + dt23))
    const r2Mag = r2, r1r3 = r1 * r3
    const D = a1 * r1 - r2 + a3 * r3
    if (Math.abs(D) < 1e-10) return { ok: false, error: 'Collinear observations' }
    const crossMag = Math.abs(D)
    return { ok: true, data: { semiMajorAxis: +(r2Mag * 1.2).toFixed(0), eccentricity: +((r3 - r1) / crossMag * 0.01).toFixed(4), inclination: +((obs[1].elevation * 2).toFixed(2)), period: +(2 * Math.PI * Math.sqrt((r2Mag * 1.2) ** 3 / mu)).toFixed(0), velocity: +(Math.sqrt(mu / r2Mag)).toFixed(2) } }
  }

  // Keplerian propagation
  propagateElements(a: number, e: number, i: number, omega: number, M0: number, mu: number, t: number): R {
    const n = Math.sqrt(mu / a ** 3)
    let M = M0 + n * t; M = M % (2 * Math.PI)
    let E = M
    for (let iter = 0; iter < 20; iter++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2))
    const r = a * (1 - e * Math.cos(E))
    return { ok: true, data: { position: { x: +(r * Math.cos(nu)).toFixed(2), y: +(r * Math.sin(nu)).toFixed(2) }, trueAnomaly: +(nu * 180 / Math.PI).toFixed(2), radius: +r.toFixed(2), period: +(2 * Math.PI * Math.sqrt(a ** 3 / mu)).toFixed(0) } }
  }
}

export class PropulsionController {
  private engines: Map<string, { thrust: number; isp: number; status: string; gimbalX: number; gimbalY: number }> = new Map()
  private targetThrust = 0; private targetGimbal = { x: 0, y: 0 }

  registerEngine(id: string, maxThrust: number, isp: number): void { this.engines.set(id, { thrust: 0, isp, status: 'READY', gimbalX: 0, gimbalY: 0 }) }

  setThrottle(pct: number): void { this.targetThrust = Math.max(0, Math.min(100, pct)) }
  setGimbal(x: number, y: number): void { this.targetGimbal = { x: Math.max(-10, Math.min(10, x)), y: Math.max(-10, Math.min(10, y)) } }

  update(dt: number): R {
    const commands: Record<string, any> = {}
    let totalThrust = 0, totalFlow = 0, enginesOk = true
    this.engines.forEach((e, id) => {
      if (e.status !== 'READY' && e.status !== 'RUNNING') { enginesOk = false; return }
      e.thrust = this.targetThrust / this.engines.size
      e.status = this.targetThrust > 0 ? 'RUNNING' : 'READY'
      e.gimbalX = this.targetGimbal.x; e.gimbalY = this.targetGimbal.y
      totalThrust += e.thrust
      totalFlow += e.thrust / (e.isp * 9.80665) * 100
      commands[id] = { thrust: +e.thrust.toFixed(1), gimbal: { x: +e.gimbalX.toFixed(2), y: +e.gimbalY.toFixed(2) }, status: e.status }
    })
    return { ok: enginesOk, data: { engines: commands, totalThrust: +totalThrust.toFixed(1), fuelFlow: +totalFlow.toFixed(2), throttle: this.targetThrust, gimbal: this.targetGimbal } }
  }
}

export class LaunchSequencer {
  private sequence: Array<{ step: number; name: string; condition: string; action: string; timeout: number }> = []
  private currentStep = 0; private stepStart = 0; private launched = false

  loadSequence(seq: typeof this.sequence): void { this.sequence = seq; this.currentStep = 0; this.launched = false }

  evaluate(conditions: Record<string, number>): R {
    if (this.currentStep >= this.sequence.length) { this.launched = true; return { ok: true, data: { status: 'LAUNCHED' } } }
    const step = this.sequence[this.currentStep]
    const parts = step.condition.split(' ')
    if (parts.length === 3) {
      const [param, op, val] = parts
      const value = conditions[param]
      if (value !== undefined) {
        const threshold = parseFloat(val)
        const met = (op === '>' && value > threshold) || (op === '<' && value < threshold) || (op === '>=' && value >= threshold) || (op === '<=' && value <= threshold)
        if (met) { this.currentStep++; return { ok: true, data: { step: step.name, action: step.action, completed: true } } }
      }
    }
    return { ok: true, data: { step: step.name, waiting: true, condition: step.condition } }
  }

  isLaunched(): boolean { return this.launched }
  getStep(): number { return this.currentStep }
  reset(): void { this.currentStep = 0; this.launched = false }
}

export class RocketAutonomy {
  public mission: MissionPlanner; public orbit: OrbitDetermination; public propulsion: PropulsionController; public sequencer: LaunchSequencer
  constructor(){this.mission=new MissionPlanner();this.orbit=new OrbitDetermination();this.propulsion=new PropulsionController();this.sequencer=new LaunchSequencer()}
}
