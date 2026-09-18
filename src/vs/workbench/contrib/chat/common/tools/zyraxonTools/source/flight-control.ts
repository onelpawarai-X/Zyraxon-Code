/**
 * ZYRAXON X — Aircraft Flight Control System (Autopilot Layer)
 * PID loops, attitude rate control, navigation, waypoint following
 */
type R = { ok: boolean; data?: any; error?: string }

export class PIDController {
  private integral = 0; private prevError = 0; private prevTime = 0
  constructor(private kp: number, private ki: number, private kd: number,
    private outMin = -1e9, private outMax = 1e9, private intMax = 1e6) {}
  compute(error: number, dt: number): number {
    this.integral = Math.max(-this.intMax, Math.min(this.intMax, this.integral + error * dt))
    const deriv = dt > 0 ? (error - this.prevError) / dt : 0
    let out = this.kp * error + this.ki * this.integral + this.kd * deriv
    out = Math.max(this.outMin, Math.min(this.outMax, out))
    this.prevError = error; return out
  }
  reset(): void { this.integral = 0; this.prevError = 0 }
  getGains() { return { kp: this.kp, ki: this.ki, kd: this.kd } }
}

export class RateController {
  private pid: PIDController
  private maxRate: number
  constructor(kp = 5.0, ki = 0.5, kd = 1.0, maxRate = 30) {
    this.pid = new PIDController(kp, ki, kd, -maxRate, maxRate, maxRate * 2)
    this.maxRate = maxRate
  }
  compute(targetRate: number, currentRate: number, dt: number): number {
    return this.pid.compute(targetRate - currentRate, dt)
  }
  reset(): void { this.pid.reset() }
}

export class AttitudeController {
  private rollRatePID: RateController
  private pitchRatePID: RateController
  private yawRatePID: RateController
  private outerRollPID: PIDController
  private outerPitchPID: PIDController
  private maxAngle: number

  constructor(maxAngle = 60) {
    this.rollRatePID = new RateController(5.0, 0.5, 1.0, 30)
    this.pitchRatePID = new RateController(4.0, 0.4, 0.8, 25)
    this.yawRatePID = new RateController(3.0, 0.3, 0.6, 20)
    this.outerRollPID = new PIDController(1.5, 0.1, 0.3, -maxAngle, maxAngle, 100)
    this.outerPitchPID = new PIDController(1.2, 0.08, 0.25, -maxAngle, maxAngle, 100)
    this.maxAngle = maxAngle
  }

  compute(targetRoll: number, targetPitch: number, targetYaw: number,
    currentRoll: number, currentPitch: number, currentYaw: number,
    rollRate: number, pitchRate: number, yawRate: number, dt: number) {
    let yawErr = targetYaw - currentYaw
    if (yawErr > 180) yawErr -= 360; if (yawErr < -180) yawErr += 360
    const rollCmd = this.outerRollPID.compute(targetRoll - currentRoll, dt)
    const pitchCmd = this.outerPitchPID.compute(targetPitch - currentPitch, dt)
    return {
      rollRateCmd: +this.rollRatePID.compute(rollCmd - rollRate, dt).toFixed(3),
      pitchRateCmd: +this.pitchRatePID.compute(pitchCmd - pitchRate, dt).toFixed(3),
      yawRateCmd: +this.yawRatePID.compute(yawErr - yawRate, dt).toFixed(3),
    }
  }
}

export class NavigationController {
  private lateralPID: PIDController
  private verticalPID: PIDController
  private maxBank = 30; private maxPitch = 20

  constructor() {
    this.lateralPID = new PIDController(2.0, 0.05, 0.5, -30, 30, 50)
    this.verticalPID = new PIDController(1.5, 0.03, 0.4, -20, 20, 50)
  }

  computeToWaypoint(currentPos: { lat: number; lon: number; alt: number },
    waypoint: { lat: number; lon: number; alt: number },
    currentHeading: number, dt: number) {
    const dLat = (waypoint.lat - currentPos.lat) * 111320
    const dLon = (waypoint.lon - currentPos.lon) * 111320 * Math.cos(currentPos.lat * Math.PI / 180)
    const dist = Math.sqrt(dLat * dLat + dLon * dLon)
    const bearing = (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360
    let headingErr = bearing - currentHeading
    if (headingErr > 180) headingErr -= 360; if (headingErr < -180) headingErr += 360
    const altErr = waypoint.alt - currentPos.alt
    return {
      rollCommand: +Math.max(-this.maxBank, Math.min(this.maxBank, this.lateralPID.compute(headingErr, dt))).toFixed(2),
      pitchCommand: +Math.max(-this.maxPitch, Math.min(this.maxPitch, this.verticalPID.compute(altErr * 0.01, dt))).toFixed(2),
      distanceToWaypoint: +dist.toFixed(1),
      bearing: +bearing.toFixed(1),
    }
  }
}

export class TrajectoryTracker {
  private waypoints: Array<{ lat: number; lon: number; alt: number; speed: number }> = []
  private currentIndex = 0
  private arrivalRadius = 100

  setWaypoints(wp: Array<{ lat: number; lon: number; alt: number; speed: number }>) { this.waypoints = wp; this.currentIndex = 0 }
  getCurrentWaypoint() { return this.waypoints[this.currentIndex] || null }
  advanceWaypoint(): boolean { if (this.currentIndex < this.waypoints.length - 1) { this.currentIndex++; return true }; return false }
  isComplete(): boolean { return this.currentIndex >= this.waypoints.length - 1 }
  getProgress(): number { return this.waypoints.length > 0 ? this.currentIndex / this.waypoints.length : 0 }

  checkArrival(pos: { lat: number; lon: number; alt: number }): boolean {
    const wp = this.getCurrentWaypoint(); if (!wp) return false
    const dLat = (wp.lat - pos.lat) * 111320, dLon = (wp.lon - pos.lon) * 111320 * Math.cos(pos.lat * Math.PI / 180)
    return Math.sqrt(dLat * dLat + dLon * dLon) < this.arrivalRadius && Math.abs(wp.alt - pos.alt) < 50
  }
}

export class WaypointNavigator {
  public trajectory: TrajectoryTracker
  public navigation: NavigationController
  private legSpeed = 250

  constructor() { this.trajectory = new TrajectoryTracker(); this.navigation = new NavigationController() }

  loadFlightPlan(waypoints: Array<{ lat: number; lon: number; alt: number; speed: number }>) { this.trajectory.setWaypoints(waypoints); this.legSpeed = waypoints[0]?.speed || 250 }

  navigate(pos: { lat: number; lon: number; alt: number }, heading: number, dt: number) {
    if (this.trajectory.checkArrival(pos)) this.trajectory.advanceWaypoint()
    const wp = this.trajectory.getCurrentWaypoint()
    if (!wp) return { status: 'COMPLETE' as const, rollCommand: 0, pitchCommand: 0 }
    const nav = this.navigation.computeToWaypoint(pos, wp, heading, dt)
    return { status: 'NAVIGATING' as const, ...nav, targetSpeed: wp.speed, legIndex: this.trajectory.getProgress() }
  }
}

export class AltitudeHold {
  private pid: PIDController; private targetAlt = 0; private active = false
  constructor(kp = 1.0, ki = 0.05, kd = 0.3) { this.pid = new PIDController(kp, ki, kd, -20, 20, 50) }
  setTarget(alt: number) { this.targetAlt = alt; this.active = true }
  compute(currentAlt: number, currentVS: number, dt: number) {
    if (!this.active) return { pitchCommand: 0, targetAlt: this.targetAlt, active: false }
    const altErr = this.targetAlt - currentAlt
    const pitchCmd = this.pid.compute(altErr * 0.01 - currentVS * 0.1, dt)
    return { pitchCommand: +Math.max(-20, Math.min(20, pitchCmd)).toFixed(2), targetAlt: this.targetAlt, active: true }
  }
  deactivate(): void { this.active = false; this.pid.reset() }
}

export class SpeedHold {
  private pid: PIDController; private targetSpeed = 0; private active = false
  constructor() { this.pid = new PIDController(0.5, 0.02, 0.1, 0, 100, 50) }
  setTarget(spd: number) { this.targetSpeed = spd; this.active = true }
  compute(currentSpeed: number, dt: number) {
    if (!this.active) return { throttleCommand: 50, active: false }
    const err = this.targetSpeed - currentSpeed
    return { throttleCommand: +Math.max(0, Math.min(100, 50 + this.pid.compute(err * 0.1, dt))).toFixed(1), active: true }
  }
  deactivate(): void { this.active = false; this.pid.reset() }
}

export class HeadingHold {
  private pid: PIDController; private targetHeading = 0; private active = false
  constructor() { this.pid = new PIDController(1.5, 0.05, 0.4, -30, 30, 50) }
  setTarget(hdg: number) { this.targetHeading = hdg; this.active = true }
  compute(currentHeading: number, dt: number) {
    if (!this.active) return { rollCommand: 0, active: false }
    let err = this.targetHeading - currentHeading; if (err > 180) err -= 360; if (err < -180) err += 360
    return { rollCommand: +Math.max(-30, Math.min(30, this.pid.compute(err, dt))).toFixed(2), active: true }
  }
  deactivate(): void { this.active = false; this.pid.reset() }
}

export class FlightDirector {
  public altHold: AltitudeHold; public spdHold: SpeedHold; public hdgHold: HeadingHold
  public nav: WaypointNavigator
  private mode: 'OFF'|'HDG'|'NAV'|'ALT'|'APPR' = 'OFF'

  constructor() {
    this.altHold = new AltitudeHold(); this.spdHold = new SpeedHold()
    this.hdgHold = new HeadingHold(); this.nav = new WaypointNavigator()
  }

  setMode(m: typeof this.mode) { this.mode = m }
  getMode() { return this.mode }
  disengage(): void { this.mode = 'OFF'; this.altHold.deactivate(); this.spdHold.deactivate(); this.hdgHold.deactivate() }

  compute(state: { altitude: number; airspeed: number; heading: number; vs: number; lat: number; lon: number }, dt: number) {
    if (this.mode === 'OFF') return { roll: 0, pitch: 0, throttle: 50, mode: 'OFF' }
    const spd = this.spdHold.compute(state.airspeed, dt)
    if (this.mode === 'HDG') {
      const hdg = this.hdgHold.compute(state.heading, dt)
      return { roll: hdg.rollCommand, pitch: 0, throttle: spd.throttleCommand, mode: 'HDG' }
    }
    if (this.mode === 'NAV') {
      const navResult = this.nav.navigate({ lat: state.lat, lon: state.lon, alt: state.altitude }, state.heading, dt)
      return { roll: navResult.rollCommand || 0, pitch: navResult.pitchCommand || 0, throttle: spd.throttleCommand, mode: 'NAV' }
    }
    if (this.mode === 'ALT') {
      const alt = this.altHold.compute(state.altitude, state.vs, dt)
      return { roll: 0, pitch: alt.pitchCommand, throttle: spd.throttleCommand, mode: 'ALT' }
    }
    return { roll: 0, pitch: 0, throttle: 50, mode: this.mode }
  }
}

export class AutopilotManager {
  public director: FlightDirector
  public attitude: AttitudeController
  private engaged = false; private disconnectOn手动 = true

  constructor() { this.director = new FlightDirector(); this.attitude = new AttitudeController() }

  engage(mode: 'HDG'|'NAV'|'ALT'|'APPR'): void { this.engaged = true; this.director.setMode(mode) }
  disengage(): void { this.engaged = false; this.director.disengage() }
  isEngaged(): boolean { return this.engaged }

  compute(state: { altitude: number; airspeed: number; heading: number; vs: number; lat: number; lon: number; roll: number; pitch: number; rollRate: number; pitchRate: number; yawRate: number }, dt: number) {
    if (!this.engaged) return { aileron: 0, elevator: 0, rudder: 0, throttle: 50, engaged: false }
    const cmd = this.director.compute(state, dt)
    const rates = this.attitude.compute(cmd.roll, cmd.pitch, 0, state.roll, state.pitch, 0, state.rollRate, state.pitchRate, state.yawRate, dt)
    return { aileron: rates.rollRateCmd, elevator: rates.pitchRateCmd, rudder: rates.yawRateCmd, throttle: cmd.throttle, engaged: true, mode: cmd.mode }
  }
}

export class AircraftSensors {
  private pressureAlt = 0; private baroAlt = 0; private gpsAlt = 0
  private ias = 0; private tas = 0; private mach = 0
  private aoa = 0; private aos = 0
  private roll = 0; private pitch = 0; private heading = 0
  private rollRate = 0; private pitchRate = 0; private yawRate = 0
  private lat = 0; private lon = 0; private groundSpeed = 0; private track = 0
  private windDir = 0; private windSpeed = 0; private outsideTemp = 15

  update(data: Record<string, number>): void {
    if (data.pressureAlt !== undefined) this.pressureAlt = data.pressureAlt
    if (data.ias !== undefined) this.ias = data.ias
    if (data.roll !== undefined) this.roll = data.roll
    if (data.pitch !== undefined) this.pitch = data.pitch
    if (data.heading !== undefined) this.heading = data.heading
    if (data.lat !== undefined) this.lat = data.lat
    if (data.lon !== undefined) this.lon = data.lon
    this.tas = this.ias * Math.sqrt(1.225 / this.getAirDensity())
    this.mach = this.tas / (340.3 * Math.sqrt(1 + this.outsideTemp / 273.15))
  }

  private getAirDensity(): number {
    const alt = Math.max(0, this.pressureAlt)
    if (alt < 11000) return 1.225 * Math.exp(-alt / 8500)
    return 0.364 * Math.exp(-(alt - 11000) / 6300)
  }

  getState() {
    return {
      pressureAlt: +this.pressureAlt.toFixed(1), ias: +this.ias.toFixed(1), tas: +this.tas.toFixed(1),
      mach: +this.mach.toFixed(3), aoa: +this.aoa.toFixed(2), roll: +this.roll.toFixed(2),
      pitch: +this.pitch.toFixed(2), heading: +this.heading.toFixed(1),
      rollRate: +this.rollRate.toFixed(2), pitchRate: +this.pitchRate.toFixed(2), yawRate: +this.yawRate.toFixed(2),
      lat: +this.lat.toFixed(6), lon: +this.lon.toFixed(6), groundSpeed: +this.groundSpeed.toFixed(1),
      windDir: +this.windDir.toFixed(0), windSpeed: +this.windSpeed.toFixed(1), outsideTemp: +this.outsideTemp.toFixed(1),
    }
  }
}

export class AircraftFlightControl {
  public sensors: AircraftSensors
  public autopilot: AutopilotManager
  public director: FlightDirector
  private surfaces = { aileron: 0, elevator: 0, rudder: 0, flaps: 0, gear: 'UP' as 'UP'|'DOWN' }

  constructor() {
    this.sensors = new AircraftSensors()
    this.autopilot = new AutopilotManager()
    this.director = this.autopilot.director
  }

  updateSurface(name: keyof typeof surfaces, value: any): void {
    (this.surfaces as any)[name] = value
  }

  tick(dt: number) {
    const state = this.sensors.getState()
    const cmd = this.autopilot.compute(state, dt)
    this.surfaces.aileron = cmd.aileron
    this.surfaces.elevator = cmd.elevator
    this.surfaces.rudder = cmd.rudder
    return { surfaces: { ...this.surfaces }, autopilot: cmd }
  }

  getHealth() {
    return { sensors: this.sensors.getState(), surfaces: { ...this.surfaces }, autopilotEngaged: this.autopilot.isEngaged(), mode: this.director.getMode() }
  }
}
