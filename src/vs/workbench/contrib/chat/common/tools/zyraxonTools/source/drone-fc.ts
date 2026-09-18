/**
 * ZYRAXON X — Drone Flight Controller
 * Full cascade PID: Position → Velocity → Attitude → Rate → Motor Mixing
 * Failsafe, waypoint following, geofencing, battery management
 */

type Result = { ok: boolean; data?: any; error?: string }

// ═══════════════════════════════════════════════════════════════════
// 3D VECTOR — Math operations for flight control
// ═══════════════════════════════════════════════════════════════════
class Vec3 {
  constructor(public x = 0, public y = 0, public z = 0) {}
  add(v: Vec3): Vec3 { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z) }
  sub(v: Vec3): Vec3 { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z) }
  scale(s: number): Vec3 { return new Vec3(this.x * s, this.y * s, this.z * s) }
  dot(v: Vec3): number { return this.x * v.x + this.y * v.y + this.z * v.z }
  cross(v: Vec3): Vec3 { return new Vec3(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x) }
  length(): number { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z) }
  normalize(): Vec3 { const l = this.length(); return l > 0 ? this.scale(1 / l) : new Vec3() }
  clamp(min: number, max: number): Vec3 {
    return new Vec3(Math.max(min, Math.min(max, this.x)), Math.max(min, Math.min(max, this.y)), Math.max(min, Math.min(max, this.z)))
  }
  toArray(): number[] { return [this.x, this.y, this.z] }
}

// ═══════════════════════════════════════════════════════════════════
// PID CONTROLLER — Reusable PID with all features
// ═══════════════════════════════════════════════════════════════════
class PID {
  private integral = 0
  private prevError = 0
  private prevDeriv = 0
  constructor(
    private kp: number, private ki: number, private kd: number,
    private outMin = -1e9, private outMax = 1e9,
    private intMax = 1e6, private dAlpha = 0.1
  ) {}
  compute(error: number, dt: number): number {
    this.integral = Math.max(-this.intMax, Math.min(this.intMax, this.integral + error * dt))
    const rawD = dt > 0 ? (error - this.prevError) / dt : 0
    const filtD = this.dAlpha * rawD + (1 - this.dAlpha) * this.prevDeriv
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
// MOTOR MIXER — Maps desired forces to individual motor outputs
// ═══════════════════════════════════════════════════════════════════
export class MotorMixer {
  private motorCount: number
  private config: Array<{ x: number; y: number; direction: 1 | -1 }> // arm position + rotation direction
  private _thrustCurve = ( pwm: number ) => 0.0001 * pwm * pwm + 0.01 * pwm // thrust = f(pwm)

  constructor(motorCount: number, config?: Array<{ x: number; y: number; direction: 1 | -1 }>) {
    this.motorCount = motorCount
    if (config) {
      this.config = config
    } else if (motorCount === 4) {
      // X-configuration quadcopter: front-right CW, rear-left CW, front-left CCW, rear-right CCW
      this.config = [
        { x: 1, y: 1, direction: 1 },   // front-right CW
        { x: -1, y: -1, direction: 1 },  // rear-left CW
        { x: -1, y: 1, direction: -1 },  // front-left CCW
        { x: 1, y: -1, direction: -1 },  // rear-right CCW
      ]
    } else if (motorCount === 6) {
      // Hexacopter X config
      this.config = [
        { x: 0.866, y: 1, direction: 1 },
        { x: -0.866, y: 1, direction: -1 },
        { x: -1, y: 0, direction: 1 },
        { x: -0.866, y: -1, direction: -1 },
        { x: 0.866, y: -1, direction: 1 },
        { x: 1, y: 0, direction: -1 },
      ]
    } else {
      // Octocopter or generic
      this.config = Array.from({ length: motorCount }, (_, i) => {
        const angle = (i / motorCount) * 2 * Math.PI
        return { x: Math.cos(angle), y: Math.sin(angle), direction: i % 2 === 0 ? 1 : -1 as 1 | -1 }
      })
    }
  }

  // Mix desired [thrust, roll, pitch, yaw] to motor PWM values [0-1000]
  mix(thrust: number, roll: number, pitch: number, yaw: number): number[] {
    const armLength = 0.25 // meters (distance from center to motor)
    const maxMotor = 1000
    const minMotor = 0

    const pwmValues: number[] = []
    for (let i = 0; i < this.motorCount; i++) {
      const arm = this.config[i]
      // Mixing equation for X-configuration
      const motorOutput =
        thrust / this.motorCount +
        (roll * arm.y - pitch * arm.x) * armLength * 0.5 +
        yaw * arm.direction * 0.25

      pwmValues.push(Math.max(minMotor, Math.min(maxMotor, Math.round(motorOutput))))
    }

    // Normalize if any motor exceeds limits
    const maxPwm = Math.max(...pwmValues)
    const minPwm = Math.min(...pwmValues)
    if (maxPwm > maxMotor || minPwm < minMotor) {
      const scale = maxMotor / Math.max(maxPwm, maxMotor - minPwm)
      for (let i = 0; i < pwmValues.length; i++) {
        pwmValues[i] = Math.round(pwmValues[i] * scale)
      }
    }

    return pwmValues
  }

  setThrustCurve(fn: (pwm: number) => number): void { this._thrustCurve = fn }
  getMotorCount(): number { return this.motorCount }
}

// ═══════════════════════════════════════════════════════════════════
// QUATERNION — Attitude representation for rotation math
// ═══════════════════════════════════════════════════════════════════
export class Quaternion {
  constructor(public w = 1, public x = 0, public y = 0, public z = 0) {}

  static fromEuler(roll: number, pitch: number, yaw: number): Quaternion {
    const cr = Math.cos(roll / 2), sr = Math.sin(roll / 2)
    const cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2)
    const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2)
    return new Quaternion(
      cr * cp * cy + sr * sp * sy,
      sr * cp * cy - cr * sp * sy,
      cr * sp * cy + sr * cp * sy,
      cr * cp * sy - sr * sp * cy
    )
  }

  toEuler(): { roll: number; pitch: number; yaw: number } {
    const sinr = 2 * (this.w * this.x + this.y * this.z)
    const cosr = 1 - 2 * (this.x * this.x + this.y * this.y)
    const roll = Math.atan2(sinr, cosr)
    const sinp = 2 * (this.w * this.y - this.z * this.x)
    const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp)
    const siny = 2 * (this.w * this.z + this.x * this.y)
    const cosy = 1 - 2 * (this.y * this.y + this.z * this.z)
    const yaw = Math.atan2(siny, cosy)
    return { roll: roll * 180 / Math.PI, pitch: pitch * 180 / Math.PI, yaw: yaw * 180 / Math.PI }
  }

  multiply(q: Quaternion): Quaternion {
    return new Quaternion(
      this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z,
      this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y,
      this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x,
      this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w
    )
  }

  conjugate(): Quaternion { return new Quaternion(this.w, -this.x, -this.y, -this.z) }
  normalize(): Quaternion {
    const l = Math.sqrt(this.w * this.w + this.x * this.x + this.y * this.y + this.z * this.z)
    return l > 0 ? new Quaternion(this.w / l, this.x / l, this.y / l, this.z / l) : new Quaternion()
  }

  rotateVector(v: Vec3): Vec3 {
    const qv = new Quaternion(0, v.x, v.y, v.z)
    const rotated = this.multiply(qv).multiply(this.conjugate())
    return new Vec3(rotated.x, rotated.y, rotated.z)
  }

  toMatrix(): number[][] {
    const { w, x, y, z } = this
    return [
      [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
      [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
      [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
    ]
  }
}

// ═══════════════════════════════════════════════════════════════════
// DRONE FLIGHT CONTROLLER — The complete system
// ═══════════════════════════════════════════════════════════════════
export class DroneFlightController {
  // ── Sub-systems ──
  public mixer: MotorMixer
  public battery: BatteryMonitor
  public failsafe: FailsafeSystem
  public geofence: GeofenceSystem
  public waypointNavigator: WaypointNavigator

  // ── PID Controllers (Cascade: Pos → Vel → Att → Rate) ──
  private posPID_X: PID
  private posPID_Y: PID
  private posPID_Z: PID
  private velPID_X: PID
  private velPID_Y: PID
  private velPID_Z: PID
  private attPID_Roll: PID
  private attPID_Pitch: PID
  private attPID_Yaw: PID
  private ratePID_Roll: PID
  private ratePID_Pitch: PID
  private ratePID_Yaw: PID

  // ── State ──
  private _armed = false
  private _flightMode: 'stabilize' | 'altitude' | 'position' | 'mission' | 'rtl' = 'stabilize'
  private _lastTime = 0
  private _position = new Vec3()
  private _velocity = new Vec3()
  private _attitude = new Quaternion()
  private _angularRate = new Vec3()
  private _targetPosition = new Vec3()
  private _targetVelocity = new Vec3()
  private _targetAttitude = new Quaternion()
  private _rcInput = { roll: 0, pitch: 0, throttle: 0, yaw: 0 } // -1 to 1

  // ── Configuration ──
  private _maxTiltAngle = 45 // degrees
  private _maxAltitude = 500 // meters
  private _maxSpeed = 15 // m/s
  private _hoverThrottle = 500 // PWM value for hover
  private _mass = 1.5 // kg

  constructor(motorCount = 4) {
    this.mixer = new MotorMixer(motorCount)
    this.battery = new BatteryMonitor()
    this.failsafe = new FailsafeSystem()
    this.geofence = new GeofenceSystem()
    this.waypointNavigator = new WaypointNavigator()

    // Position PIDs (outer loop) — tuned for slow, stable response
    this.posPID_X = new PID(0.8, 0.02, 0.1, -3, 3, 5, 0.1)
    this.posPID_Y = new PID(0.8, 0.02, 0.1, -3, 3, 5, 0.1)
    this.posPID_Z = new PID(1.0, 0.05, 0.2, -3, 3, 5, 0.1)

    // Velocity PIDs (middle loop)
    this.velPID_X = new PID(1.2, 0.05, 0.1, -20, 20, 50, 0.1)
    this.velPID_Y = new PID(1.2, 0.05, 0.1, -20, 20, 50, 0.1)
    this.velPID_Z = new PID(1.5, 0.1, 0.15, -5, 5, 10, 0.1)

    // Attitude PIDs (inner loop)
    this.attPID_Roll = new PID(2.0, 0.0, 0.3, -25, 25, 50, 0.15)
    this.attPID_Pitch = new PID(2.0, 0.0, 0.3, -25, 25, 50, 0.15)
    this.attPID_Yaw = new PID(1.5, 0.0, 0.2, -180, 180, 50, 0.15)

    // Rate PIDs (fastest loop)
    this.ratePID_Roll = new PID(0.15, 0.01, 0.005, -500, 500, 500, 0.2)
    this.ratePID_Pitch = new PID(0.15, 0.01, 0.005, -500, 500, 500, 0.2)
    this.ratePID_Yaw = new PID(0.2, 0.005, 0.003, -300, 300, 300, 0.2)
  }

  // ── Arming ──
  arm(): Result {
    if (this.battery.getPercentage() < 20) return { ok: false, error: 'Battery too low to arm' }
    if (this.failsafe.isTriggered()) return { ok: false, error: 'Failsafe active' }
    this._armed = true
    this._lastTime = Date.now()
    this.resetPIDs()
    return { ok: true, data: { armed: true } }
  }

  disarm(): Result {
    this._armed = false
    this.resetPIDs()
    return { ok: true, data: { armed: false } }
  }

  // ── Flight Mode ──
  setFlightMode(mode: typeof this._flightMode): void { this._flightMode = mode }
  getFlightMode(): string { return this._flightMode }
  isArmed(): boolean { return this._armed }

  // ── RC Input (from pilot, -1 to 1) ──
  setRCInput(roll: number, pitch: number, throttle: number, yaw: number): void {
    this._rcInput = {
      roll: Math.max(-1, Math.min(1, roll)),
      pitch: Math.max(-1, Math.min(1, pitch)),
      throttle: Math.max(0, Math.min(1, throttle)),
      yaw: Math.max(-1, Math.min(1, yaw)),
    }
  }

  // ── Target ──
  setTargetPosition(x: number, y: number, z: number): void { this._targetPosition = new Vec3(x, y, z) }
  setTargetVelocity(vx: number, vy: number, vz: number): void { this._targetVelocity = new Vec3(vx, vy, vz) }

  // ═══════════════════════════════════════════════════════════════════
  // MAIN CONTROL LOOP — Run at 200-400Hz
  // ═══════════════════════════════════════════════════════════════════
  compute(sensors: {
    position: Vec3; velocity: Vec3; attitude: Quaternion
    angularRate: Vec3; baroAlt: number; gpsSpeed: number
    batteryVoltage: number; batteryCurrent: number
  }): Result {
    if (!this._armed) return { ok: true, data: { armed: false, motors: new Array(this.mixer.getMotorCount()).fill(0) } }

    const now = Date.now()
    const dt = this._lastTime ? Math.min((now - this._lastTime) / 1000, 0.05) : 0.005
    this._lastTime = now

    // Update state
    this._position = sensors.position
    this._velocity = sensors.velocity
    this._attitude = sensors.attitude
    this._angularRate = sensors.angularRate
    this.battery.update(sensors.batteryVoltage, sensors.batteryCurrent)

    // Check failsafe
    this.failsafe.check({
      battery: this.battery.getPercentage(),
      altitude: sensors.baroAlt,
      speed: sensors.gpsSpeed,
      position: sensors.position,
    })
    if (this.failsafe.isTriggered()) {
      this._flightMode = 'rtl'
    }

    // Check geofence
    if (this.geofence.isEnabled()) {
      const breach = this.geofence.check(sensors.position)
      if (breach) { this._flightMode = 'rtl' }
    }

    // ── Cascade PID Control ──
    let thrustCmd = 0, rollCmd = 0, pitchCmd = 0, yawCmd = 0

    if (this._flightMode === 'position' || this._flightMode === 'mission') {
      // Position mode: Position PID → Velocity PID → Attitude PID → Rate PID
      const velCmdX = this.posPID_X.compute(this._targetPosition.x - this._position.x, dt)
      const velCmdY = this.posPID_Y.compute(this._targetPosition.y - this._position.y, dt)
      const velCmdZ = this.posPID_Z.compute(this._targetPosition.z - this._position.z, dt)

      const attCmdRoll = this.velPID_X.compute(velCmdX - this._velocity.x, dt)
      const attCmdPitch = this.velPID_Y.compute(velCmdY - this._velocity.y, dt)
      thrustCmd = this._hoverThrottle + this.velPID_Z.compute(velCmdZ - this._velocity.z, dt)

      const euler = sensors.attitude.toEuler()
      const rateCmdRoll = this.attPID_Roll.compute(attCmdRoll - euler.roll, dt)
      const rateCmdPitch = this.attPID_Pitch.compute(attCmdPitch - euler.pitch, dt)
      const rateCmdYaw = this.attPID_Yaw.compute(0 - euler.yaw, dt) // heading hold

      rollCmd = this.ratePID_Roll.compute(rateCmdRoll - sensors.angularRate.x, dt)
      pitchCmd = this.ratePID_Pitch.compute(rateCmdPitch - sensors.angularRate.y, dt)
      yawCmd = this.ratePID_Yaw.compute(rateCmdYaw - sensors.angularRate.z, dt)

    } else if (this._flightMode === 'altitude') {
      // Altitude hold: only altitude PID
      thrustCmd = this._hoverThrottle + this.velPID_Z.compute(this._targetPosition.z - sensors.baroAlt, dt)
      rollCmd = this._rcInput.roll * this._maxTiltAngle * 2
      pitchCmd = this._rcInput.pitch * this._maxTiltAngle * 2
      yawCmd = this._rcInput.yaw * 200

    } else {
      // Stabilize mode: direct RC → attitude mapping
      thrustCmd = this._rcInput.throttle * 1000
      rollCmd = this._rcInput.roll * this._maxTiltAngle
      pitchCmd = this._rcInput.pitch * this._maxTiltAngle
      yawCmd = this._rcInput.yaw * 200

      // Attitude stabilization
      const euler = sensors.attitude.toEuler()
      const rateCmdRoll = this.attPID_Roll.compute(rollCmd - euler.roll, dt)
      const rateCmdPitch = this.attPID_Pitch.compute(pitchCmd - euler.pitch, dt)
      const rateCmdYaw = this.attPID_Yaw.compute(yawCmd - euler.yaw, dt)

      rollCmd = this.ratePID_Roll.compute(rateCmdRoll - sensors.angularRate.x, dt)
      pitchCmd = this.ratePID_Pitch.compute(rateCmdPitch - sensors.angularRate.y, dt)
      yawCmd = this.ratePID_Yaw.compute(rateCmdYaw - sensors.angularRate.z, dt)
    }

    // Safety limits
    thrustCmd = Math.max(0, Math.min(1000, thrustCmd))

    // ── Motor Mixing ──
    const motors = this.mixer.mix(thrustCmd, rollCmd, pitchCmd, yawCmd)

    // ── Waypoint navigation (if in mission mode) ──
    if (this._flightMode === 'mission') {
      const wp = this.waypointNavigator.getCurrentWaypoint()
      if (wp) {
        this.setTargetPosition(wp.x, wp.y, wp.z)
        const dist = this._position.sub(new Vec3(wp.x, wp.y, wp.z)).length()
        if (dist < wp.acceptanceRadius) this.waypointNavigator.advance()
      }
    }

    // ── RTL (Return to Launch) ──
    if (this._flightMode === 'rtl') {
      this.setTargetPosition(0, 0, 10) // Fly to home position at 10m altitude
      if (this._position.sub(new Vec3(0, 0, 10)).length() < 2) {
        // Close enough to home, land
        this._targetPosition = new Vec3(0, 0, 0)
        if (sensors.baroAlt < 0.5) this.disarm()
      }
    }

    return {
      ok: true,
      data: {
        armed: this._armed,
        mode: this._flightMode,
        motors,
        targets: {
          position: this._targetPosition.toArray(),
          velocity: this._targetVelocity.toArray(),
        },
        state: {
          position: this._position.toArray().map(v => +v.toFixed(2)),
          velocity: this._velocity.toArray().map(v => +v.toFixed(2)),
          attitude: this._attitude.toEuler(),
        },
        battery: this.battery.getStatus(),
        failsafe: this.failsafe.getStatus(),
      }
    }
  }

  private resetPIDs(): void {
    ;[this.posPID_X, this.posPID_Y, this.posPID_Z,
      this.velPID_X, this.velPID_Y, this.velPID_Z,
      this.attPID_Roll, this.attPID_Pitch, this.attPID_Yaw,
      this.ratePID_Roll, this.ratePID_Pitch, this.ratePID_Yaw,
    ].forEach(pid => pid.reset())
  }

  getConfiguration() {
    return {
      maxTiltAngle: this._maxTiltAngle,
      maxAltitude: this._maxAltitude,
      maxSpeed: this._maxSpeed,
      hoverThrottle: this._hoverThrottle,
      mass: this._mass,
      motorCount: this.mixer.getMotorCount(),
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// BATTERY MONITOR — Voltage, current, capacity estimation
// ═══════════════════════════════════════════════════════════════════
export class BatteryMonitor {
  private voltage = 0
  private current = 0
  private capacity = 5000 // mAh
  private consumed = 0 // mAh
  private cellCount = 4
  private _lowVoltageWarning = 3.5 // per cell
  private _criticalVoltage = 3.2 // per cell
  private history: Array<{ voltage: number; current: number; time: number }> = []
  private lastUpdate = 0

  update(voltage: number, current: number): void {
    const now = Date.now()
    if (this.lastUpdate > 0) {
      const dtHours = (now - this.lastUpdate) / 3600000
      this.consumed += current * dtHours // mAh consumed
    }
    this.voltage = voltage
    this.current = current
    this.lastUpdate = now
    this.history.push({ voltage, current, time: now })
    if (this.history.length > 10000) this.history.shift()
  }

  getVoltage(): number { return this.voltage }
  getCurrent(): number { return this.current }
  getPercentage(): number { return Math.max(0, Math.min(100, (1 - this.consumed / this.capacity) * 100)) }
  getConsumed(): number { return this.consumed }
  getCapacity(): number { return this.capacity }

  getCellVoltage(): number { return this.cellCount > 0 ? this.voltage / this.cellCount : 0 }

  isLow(): boolean { return this.getCellVoltage() < this._lowVoltageWarning }
  isCritical(): boolean { return this.getCellVoltage() < this._criticalVoltage }

  getEstimatedFlightTime(): number {
    if (this.current <= 0) return Infinity
    const remaining = Math.max(0, this.capacity - this.consumed)
    return (remaining / this.current) * 3600 // seconds
  }

  getStatus(): Record<string, any> {
    return {
      voltage: +this.voltage.toFixed(2),
      current: +this.current.toFixed(1),
      percentage: +this.getPercentage().toFixed(1),
      consumed: +this.consumed.toFixed(1),
      capacity: this.capacity,
      cellVoltage: +this.getCellVoltage().toFixed(3),
      flightTimeRemaining: +this.getEstimatedFlightTime().toFixed(0),
      low: this.isLow(),
      critical: this.isCritical(),
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// FAILSAFE SYSTEM — Battery, RC loss, geofence, motor failure
// ═══════════════════════════════════════════════════════════════════
export class FailsafeSystem {
  private _triggered = false
  private _reason = ''
  private _rcTimeout = 1000 // ms
  private _lastRC = 0
  private _minAltitude = 2 // meters (min safe altitude for RTL)
  private _maxAltitude = 500
  private _maxSpeed = 20 // m/s
  private _actions: Array<{ reason: string; time: number; action: string }> = []

  updateRCTime(): void { this._lastRC = Date.now() }

  check(params: {
    battery: number
    altitude: number
    speed: number
    position: Vec3
  }): void {
    this._triggered = false
    this._reason = ''

    // Battery critical
    if (params.battery < 10) {
      this._triggered = true; this._reason = 'BATTERY_CRITICAL'
      this._actions.push({ reason: this._reason, time: Date.now(), action: 'RTL' })
      return
    }

    // RC signal loss
    if (this._lastRC > 0 && Date.now() - this._lastRC > this._rcTimeout) {
      this._triggered = true; this._reason = 'RC_LOSS'
      this._actions.push({ reason: this._reason, time: Date.now(), action: 'RTL' })
      return
    }

    // Altitude exceeded
    if (params.altitude > this._maxAltitude) {
      this._triggered = true; this._reason = 'ALTITUDE_EXCEEDED'
      this._actions.push({ reason: this._reason, time: Date.now(), action: 'DESCEND' })
      return
    }

    // Speed exceeded
    if (params.speed > this._maxSpeed) {
      this._triggered = true; this._reason = 'SPEED_EXCEEDED'
      this._actions.push({ reason: this._reason, time: Date.now(), action: 'SLOW_DOWN' })
      return
    }
  }

  isTriggered(): boolean { return this._triggered }
  getReason(): string { return this._reason }
  getStatus(): Record<string, any> { return { triggered: this._triggered, reason: this._reason, recentActions: this._actions.slice(-5) } }
}

// ═══════════════════════════════════════════════════════════════════
// GEOFENCE SYSTEM — Cylindrical boundary with warn/act thresholds
// ═══════════════════════════════════════════════════════════════════
export class GeofenceSystem {
  private enabled = false
  private center = new Vec3()
  private radiusH = 100 // horizontal radius in meters
  private altitudeMax = 120 // meters (FAA limit)
  private altitudeMin = 2
  private warnRadius = 80 // warn when 80% of radius
  private breached = false

  setCenter(x: number, y: number, z: number): void { this.center = new Vec3(x, y, z) }
  setRadius(meters: number): void { this.radiusH = meters; this.warnRadius = meters * 0.8 }
  setAltitudeLimits(min: number, max: number): void { this.altitudeMin = min; this.altitudeMax = max }
  enable(): void { this.enabled = true }
  disable(): void { this.enabled = false }
  isEnabled(): boolean { return this.enabled }

  check(pos: Vec3): boolean {
    if (!this.enabled) return false
    const dx = pos.x - this.center.x, dy = pos.y - this.center.y
    const distH = Math.sqrt(dx * dx + dy * dy)

    if (distH > this.radiusH || pos.z > this.altitudeMax || pos.z < this.altitudeMin) {
      this.breached = true; return true
    }
    this.breached = false; return false
  }

  isWarning(pos: Vec3): boolean {
    if (!this.enabled) return false
    const dx = pos.x - this.center.x, dy = pos.y - this.center.y
    const distH = Math.sqrt(dx * dx + dy * dy)
    return distH > this.warnRadius || pos.z > this.altitudeMax * 0.9
  }

  getStatus(): Record<string, any> {
    return { enabled: this.enabled, center: this.center.toArray(), radius: this.radiusH, altitudeLimits: [this.altitudeMin, this.altitudeMax], breached: this.breached }
  }
}

// ═══════════════════════════════════════════════════════════════════
// WAYPOINT NAVIGATOR — GPS waypoint following with acceptance
// ═══════════════════════════════════════════════════════════════════
export class WaypointNavigator {
  private waypoints: Array<{ x: number; y: number; z: number; speed: number; acceptanceRadius: number; action?: string }> = []
  private currentIdx = 0
  private loopMode = false

  loadWaypoints(waypoints: Array<{ x: number; y: number; z: number; speed?: number; acceptanceRadius?: number; action?: string }>): void {
    this.waypoints = waypoints.map(w => ({ ...w, speed: w.speed || 5, acceptanceRadius: w.acceptanceRadius || 2 }))
    this.currentIdx = 0
  }

  getCurrentWaypoint() { return this.waypoints[this.currentIdx] || null }
  advance(): void {
    if (this.currentIdx < this.waypoints.length - 1) this.currentIdx++
    else if (this.loopMode) this.currentIdx = 0
  }

  jumpTo(idx: number): void { if (idx >= 0 && idx < this.waypoints.length) this.currentIdx = idx }
  isComplete(): boolean { return this.currentIdx >= this.waypoints.length && !this.loopMode }
  getProgress(): number { return this.waypoints.length ? (this.currentIdx / this.waypoints.length) * 100 : 0 }
  setLoopMode(loop: boolean): void { this.loopMode = loop }
  getWaypoints() { return this.waypoints }
  getCurrentIndex(): number { return this.currentIdx }
}
