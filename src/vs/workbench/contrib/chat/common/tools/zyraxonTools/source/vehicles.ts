/**
 * ZYRAXON X - Vehicle Control System
 * Drones (MAVLink), Cars (CAN/OBD), Boats, Rockets, Satellites
 */

// ─── Types ────────────────────────────────────────────────
export type VehicleType = "drone" | "car" | "boat" | "rocket" | "satellite" | "submarine" | "rover"

export type Position = { lat: number; lon: number; alt: number }
export type Attitude = { roll: number; pitch: number; yaw: number }
export type Battery = { voltage: number; current: number; percent: number }

export type Telemetry = {
  vehicleId: string
  type: VehicleType
  armed: boolean
  mode: string
  battery: Battery
  position: Position
  attitude: Attitude
  velocity: { x: number; y: number; z: number }
  signal: number
  timestamp: number
}

export type Waypoint = {
  lat: number
  lon: number
  alt: number
  speed?: number
  action?: "flyby" | "loiter" | "land" | "takeoff" | "rtl"
  holdTime?: number
}

// ─── MAVLink Protocol (Drones) ────────────────────────────
// Real MAVLink v2 message IDs
const MAV_CMD = {
  ARM: 400,
  DISARM: 401,
  TAKEOFF: 22,
  LAND: 21,
  NAV_WAYPOINT: 16,
  NAV_LOITER: 17,
  NAV_RTL: 20,
  SET_MODE: 176,
  SET_SPEED: 220,
  SET_REL_ALT: 178,
  GUIDED_ENABLE: 92,
  START_MOTOR: 223,
  MOTOR_TEST: 209,
  SET_POSITION: 502,
  SET_ATTITUDE: 82,
}

export class DroneController {
  private sock: WebSocket | null = null
  private _telemetry: Telemetry
  private _seq = 0

  constructor() {
    this._telemetry = {
      vehicleId: "", type: "drone", armed: false, mode: "STABILIZE",
      battery: { voltage: 0, current: 0, percent: 100 },
      position: { lat: 0, lon: 0, alt: 0 },
      attitude: { roll: 0, pitch: 0, yaw: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      signal: 0, timestamp: 0,
    }
  }

  get telemetry() { return this._telemetry }

  // Connect to MAVLink proxy (mavproxy, DroneKit, or custom WebSocket bridge)
  async connect(url: string): Promise<boolean> {
    try {
      this.sock = new WebSocket(url)
      await new Promise<void>((resolve, reject) => {
        this.sock!.onopen = () => resolve()
        this.sock!.onerror = () => reject()
        setTimeout(reject, 5000)
      })
      this.sock!.onmessage = (e) => this.handleMessage(JSON.parse(e.data))
      return true
    } catch { return false }
  }

  private handleMessage(msg: any) {
    if (msg.type === "heartbeat") {
      this._telemetry.armed = msg.armed || false
      this._telemetry.mode = msg.mode || "UNKNOWN"
      this._telemetry.vehicleId = msg.vehicleId || ""
    }
    if (msg.type === "gps") {
      this._telemetry.position = { lat: msg.lat, lon: msg.lon, alt: msg.alt }
      this._telemetry.signal = msg.satellites || 0
    }
    if (msg.type === "attitude") {
      this._telemetry.attitude = { roll: msg.roll, pitch: msg.pitch, yaw: msg.yaw }
    }
    if (msg.type === "battery") {
      this._telemetry.battery = { voltage: msg.voltage, current: msg.current, percent: msg.percent }
    }
    if (msg.type === "velocity") {
      this._telemetry.velocity = { x: msg.vx, y: msg.vy, z: msg.vz }
    }
    this._telemetry.timestamp = Date.now()
  }

  private send(cmd: string, params: any) {
    if (!this.sock) return
    this._seq++
    this.sock.send(JSON.stringify({ seq: this._seq, cmd, ...params }))
  }

  // ─── Commands ──────────────────────────────────────────
  async arm(): Promise<boolean> {
    this.send("command", { command: MAV_CMD.ARM, params: [1, 0, 0, 0, 0, 0, 0] })
    return true
  }

  async disarm(): Promise<boolean> {
    this.send("command", { command: MAV_CMD.DISARM, params: [0, 0, 0, 0, 0, 0, 0] })
    return true
  }

  async takeoff(alt = 10): Promise<boolean> {
    this.send("command", { command: MAV_CMD.TAKEOFF, params: [0, 0, 0, 0, 0, 0, alt] })
    return true
  }

  async land(): Promise<boolean> {
    this.send("command", { command: MAV_CMD.LAND, params: [0, 0, 0, 0, 0, 0, 0] })
    return true
  }

  async returnToLaunch(): Promise<boolean> {
    this.send("command", { command: MAV_CMD.NAV_RTL, params: [0, 0, 0, 0, 0, 0, 0] })
    return true
  }

  async setMode(mode: string): Promise<boolean> {
    const modes: Record<string, number> = {
      STABILIZE: 0, ACRO: 1, ALT_HOLD: 2, AUTO: 3,
      GUIDED: 4, LOITER: 5, RTL: 6, CIRCLE: 7,
      LAND: 9, POSHOLD: 16, BRAKE: 17,
    }
    this.send("command", { command: MAV_CMD.SET_MODE, params: [modes[mode] || 0] })
    return true
  }

  async setSpeed(ms: number): Promise<boolean> {
    this.send("command", { command: MAV_CMD.SET_SPEED, params: [0, ms, -1, 0, 0, 0, 0] })
    return true
  }

  async flyTo(pos: Position, speed = 5): Promise<boolean> {
    this.send("set_position", { lat: pos.lat, lon: pos.lon, alt: pos.alt, speed })
    return true
  }

  async flyWaypoints(waypoints: Waypoint[]): Promise<boolean> {
    this.send("mission", { waypoints })
    return true
  }

  async setAttitude(att: Attitude, thrust = 0.5): Promise<boolean> {
    this.send("command", {
      command: MAV_CMD.SET_ATTITUDE,
      params: [0, att.roll, att.pitch, att.yaw, thrust],
    })
    return true
  }

  async setGeofence(center: Position, radiusM: number, maxHeight: number): Promise<boolean> {
    this.send("geofence", { center, radius: radiusM, maxHeight })
    return true
  }

  async motorTest(motor: number, throttle: number, durationMs: number): Promise<boolean> {
    this.send("command", {
      command: MAV_CMD.MOTOR_TEST,
      params: [motor, 0, throttle, 0, durationMs, 0, 0],
    })
    return true
  }

  async emergencyStop(): Promise<boolean> {
    await this.setMode("BRAKE")
    await this.disarm()
    return true
  }

  disconnect() {
    this.sock?.close()
    this.sock = null
  }
}

// ─── Car Controller (CAN Bus + OBD-II) ────────────────────
const OBD_PID = {
  RPM: "010C",
  SPEED: "010D",
  COOLANT_TEMP: "0105",
  FUEL_LEVEL: "012F",
  ENGINE_LOAD: "0104",
  THROTTLE: "0111",
  INTAKE_TEMP: "010F",
  MAF: "0110",
  O2_VOLTAGE: "0114",
  BATTERY_VOLTAGE: "4267",
  DTC: "03",
}

export class CarController {
  private sock: WebSocket | null = null
  private _telemetry: Telemetry
  private _dtcCodes: string[] = []

  constructor() {
    this._telemetry = {
      vehicleId: "car", type: "car", armed: false, mode: "OFF",
      battery: { voltage: 12, current: 0, percent: 100 },
      position: { lat: 0, lon: 0, alt: 0 },
      attitude: { roll: 0, pitch: 0, yaw: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      signal: 0, timestamp: 0,
    }
  }

  get telemetry() { return this._telemetry }
  get dtcCodes() { return this._dtcCodes }

  async connect(url: string): Promise<boolean> {
    try {
      this.sock = new WebSocket(url)
      await new Promise<void>((res, rej) => {
        this.sock!.onopen = () => res()
        this.sock!.onerror = () => rej()
        setTimeout(rej, 5000)
      })
      this.sock!.onmessage = (e) => this.handleMsg(JSON.parse(e.data))
      this._telemetry.armed = true
      this._telemetry.mode = "ON"
      return true
    } catch { return false }
  }

  private handleMsg(msg: any) {
    if (msg.type === "obd") {
      const data = msg.data
      if (data.pid === OBD_PID.RPM) this._telemetry.velocity.x = data.value / 4
      if (data.pid === OBD_PID.SPEED) this._telemetry.velocity.y = data.value * 3.6
      if (data.pid === OBD_PID.FUEL_LEVEL) this._telemetry.battery.percent = data.value
      if (data.pid === OBD_PID.COOLANT_TEMP) this._telemetry.battery.current = data.value - 40
      if (data.pid === OBD_PID.ENGINE_LOAD) this._telemetry.battery.voltage = data.value * 2.55
    }
    if (msg.type === "gps") {
      this._telemetry.position = { lat: msg.lat, lon: msg.lon, alt: msg.alt || 0 }
    }
    if (msg.type === "dtc") {
      this._dtcCodes = msg.codes || []
    }
    this._telemetry.timestamp = Date.now()
  }

  private send(cmd: string, params: any = {}) {
    this.sock?.send(JSON.stringify({ cmd, ...params }))
  }

  async readPID(pid: string): Promise<number> {
    return new Promise(resolve => {
      this.send("obd", { pid })
      const handler = (e: MessageEvent) => {
        const msg = JSON.parse(e.data)
        if (msg.type === "obd" && msg.pid === pid) {
          this.sock?.removeEventListener("message", handler)
          resolve(msg.value)
        }
      }
      this.sock?.addEventListener("message", handler)
      setTimeout(() => { this.sock?.removeEventListener("message", handler); resolve(-1) }, 3000)
    })
  }

  async getRPM(): Promise<number> { return this.readPID(OBD_PID.RPM) }
  async getSpeed(): Promise<number> { return this.readPID(OBD_PID.SPEED) }
  async getFuelLevel(): Promise<number> { return this.readPID(OBD_PID.FUEL_LEVEL) }
  async getEngineLoad(): Promise<number> { return this.readPID(OBD_PID.ENGINE_LOAD) }
  async getTemperature(): Promise<number> { return (await this.readPID(OBD_PID.COOLANT_TEMP)) - 40 }

  async readDTCs(): Promise<string[]> {
    this.send("obd", { pid: OBD_PID.DTC })
    return new Promise(resolve => {
      const handler = (e: MessageEvent) => {
        const msg = JSON.parse(e.data)
        if (msg.type === "dtc") {
          this.sock?.removeEventListener("message", handler)
          this._dtcCodes = msg.codes || []
          resolve(this._dtcCodes)
        }
      }
      this.sock?.addEventListener("message", handler)
      setTimeout(() => resolve([]), 3000)
    })
  }

  async clearDTCs(): Promise<boolean> {
    this.send("obd", { pid: "04" })
    return true
  }

  async lockDoors() { this.send("can", { id: 0x220, data: [0x01] }); return true }
  async unlockDoors() { this.send("can", { id: 0x220, data: [0x02] }); return true }
  async flashLights() { this.send("can", { id: 0x221, data: [0x01, 0x01] }); return true }
  async honkHorn(ms = 500) { this.send("can", { id: 0x222, data: [ms >> 8, ms & 0xff] }); return true }
  async startEngine() { this.send("can", { id: 0x223, data: [0x01] }); return true }
  async stopEngine() { this.send("can", { id: 0x223, data: [0x00] }); return true }
  async setClimate(tempC: number) { this.send("can", { id: 0x224, data: [tempC] }); return true }

  disconnect() { this.sock?.close(); this.sock = null }
}

// ─── Boat Controller ──────────────────────────────────────
export class BoatController {
  private drone: DroneController

  constructor() { this.drone = new DroneController() }

  async connect(url: string) { return this.drone.connect(url) }

  async setHeading(degrees: number) {
    this.drone.send("set_heading", { heading: degrees })
    return true
  }

  async setThrottle(percent: number) {
    this.drone.send("set_throttle", { throttle: Math.min(100, Math.max(0, percent)) })
    return true
  }

  async navigateTo(lat: number, lon: number) {
    return this.drone.flyTo({ lat, lon, alt: 0 })
  }

  async emergencyStop() {
    this.drone.send("set_throttle", { throttle: 0 })
    return true
  }

  get telemetry() { return this.drone.telemetry }
  disconnect() { this.drone.disconnect() }
}

// ─── Rocket Controller ────────────────────────────────────
export type RocketState = "prelaunch" | "countdown" | "powered" | "coasting" | "apogee" | "descent" | "landed" | "abort"

export class RocketController {
  private sock: WebSocket | null = null
  private _state: RocketState = "prelaunch"
  private _telemetry: Telemetry

  constructor() {
    this._telemetry = {
      vehicleId: "rocket", type: "rocket", armed: false, mode: "PRELAUNCH",
      battery: { voltage: 28, current: 0, percent: 100 },
      position: { lat: 0, lon: 0, alt: 0 },
      attitude: { roll: 0, pitch: 0, yaw: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      signal: 0, timestamp: 0,
    }
  }

  get state() { return this._state }
  get telemetry() { return this._telemetry }

  async connect(url: string): Promise<boolean> {
    try {
      this.sock = new WebSocket(url)
      await new Promise<void>((res, rej) => {
        this.sock!.onopen = () => res()
        this.sock!.onerror = () => rej()
        setTimeout(rej, 5000)
      })
      this.sock!.onmessage = (e) => this.handleMsg(JSON.parse(e.data))
      return true
    } catch { return false }
  }

  private handleMsg(msg: any) {
    if (msg.type === "telemetry") {
      this._telemetry.position = msg.position || this._telemetry.position
      this._telemetry.attitude = msg.attitude || this._telemetry.attitude
      this._telemetry.velocity = msg.velocity || this._telemetry.velocity
      this._telemetry.battery = msg.battery || this._telemetry.battery
    }
    if (msg.type === "state") {
      this._state = msg.state as RocketState
    }
    this._telemetry.timestamp = Date.now()
  }

  private send(cmd: string, params: any = {}) {
    this.sock?.send(JSON.stringify({ cmd, ...params }))
  }

  async arm() { this._telemetry.armed = true; this.send("arm"); return true }
  async disarm() { this._telemetry.armed = false; this.send("disarm"); return true }

  async startCountdown(seconds = 10) {
    this._state = "countdown"
    this.send("countdown", { seconds })
    return true
  }

  async launch() {
    this._state = "powered"
    this.send("launch")
    return true
  }

  async setTrajectory(pitch: number, yaw: number) {
    this.send("trajectory", { pitch, yaw })
    return true
  }

  async stageSeparation(stage: number) {
    this.send("staging", { stage })
    return true
  }

  async activateFairing() {
    this.send("fairing", { action: "deploy" })
    return true
  }

  async deployPayload() {
    this.send("payload", { action: "deploy" })
    return true
  }

  async abort() {
    this._state = "abort"
    this.send("abort")
    return true
  }

  async setThrottle(percent: number) {
    this.send("throttle", { value: Math.min(100, Math.max(0, percent)) })
    return true
  }

  async activateEngine(engineId: number) {
    this.send("engine", { id: engineId, action: "start" })
    return true
  }

  async shutdownEngine(engineId: number) {
    this.send("engine", { id: engineId, action: "stop" })
    return true
  }

  disconnect() { this.sock?.close(); this.sock = null }
}

// ─── Satellite Controller ─────────────────────────────────
export type OrbitParams = {
  altitude: number
  inclination: number
  eccentricity: number
  raan: number
  argPerigee: number
  trueAnomaly: number
}

export class SatelliteController {
  private sock: WebSocket | null = null
  private _telemetry: Telemetry
  private _orbit: OrbitParams = { altitude: 400, inclination: 51.6, eccentricity: 0.001, raan: 0, argPerigee: 0, trueAnomaly: 0 }

  constructor() {
    this._telemetry = {
      vehicleId: "satellite", type: "satellite", armed: false, mode: "NOMINAL",
      battery: { voltage: 28, current: 5, percent: 95 },
      position: { lat: 0, lon: 0, alt: 400000 },
      attitude: { roll: 0, pitch: 0, yaw: 0 },
      velocity: { x: 7660, y: 0, z: 0 },
      signal: 0, timestamp: 0,
    }
  }

  get telemetry() { return this._telemetry }
  get orbit() { return this._orbit }

  async connect(url: string): Promise<boolean> {
    try {
      this.sock = new WebSocket(url)
      await new Promise<void>((res, rej) => {
        this.sock!.onopen = () => res()
        this.sock!.onerror = () => rej()
        setTimeout(rej, 5000)
      })
      this.sock!.onmessage = (e) => this.handleMsg(JSON.parse(e.data))
      return true
    } catch { return false }
  }

  private handleMsg(msg: any) {
    if (msg.type === "telemetry") {
      Object.assign(this._telemetry, msg.data)
      this._telemetry.timestamp = Date.now()
    }
    if (msg.type === "orbit") {
      Object.assign(this._orbit, msg.data)
    }
  }

  private send(cmd: string, params: any = {}) {
    this.sock?.send(JSON.stringify({ cmd, ...params }))
  }

  async setAttitude(roll: number, pitch: number, yaw: number) {
    this.send("attitude", { roll, pitch, yaw })
    return true
  }

  async fireThruster(axis: "x" | "y" | "z", durationMs: number, direction: 1 | -1) {
    this.send("thruster", { axis, duration: durationMs, direction })
    return true
  }

  async adjustOrbit(params: Partial<OrbitParams>) {
    this.send("orbit_adjust", params)
    return true
  }

  async deploySolarPanels() { this.send("solar", { action: "deploy" }); return true }
  async pointAntenna(azimuth: number, elevation: number) { this.send("antenna", { azimuth, elevation }); return true }
  async takePicture(band = "visible") { this.send("camera", { band }); return true }
  async transmitData(data: ArrayBuffer) { this.send("transmit", { data: Array.from(new Uint8Array(data)) }); return true }
  async enterSafeMode() { this.send("safemode"); return true }
  async activateDeorbit() { this.send("deorbit"); return true }

  disconnect() { this.sock?.close(); this.sock = null }
}

// ─── Master Vehicle Controller ────────────────────────────
export class ZyraxonVehicles {
  readonly drones: Map<string, DroneController> = new Map()
  readonly cars: Map<string, CarController> = new Map()
  readonly boats: Map<string, BoatController> = new Map()
  readonly rockets: Map<string, RocketController> = new Map()
  readonly satellites: Map<string, SatelliteController> = new Map()

  createDrone(id: string): DroneController {
    const d = new DroneController()
    this.drones.set(id, d)
    return d
  }

  createCar(id: string): CarController {
    const c = new CarController()
    this.cars.set(id, c)
    return c
  }

  createBoat(id: string): BoatController {
    const b = new BoatController()
    this.boats.set(id, b)
    return b
  }

  createRocket(id: string): RocketController {
    const r = new RocketController()
    this.rockets.set(id, r)
    return r
  }

  createSatellite(id: string): SatelliteController {
    const s = new SatelliteController()
    this.satellites.set(id, s)
    return s
  }

  getAllTelemetry(): Telemetry[] {
    const result: Telemetry[] = []
    for (const d of this.drones.values()) result.push(d.telemetry)
    for (const c of this.cars.values()) result.push(c.telemetry)
    for (const b of this.boats.values()) result.push(b.telemetry)
    for (const r of this.rockets.values()) result.push(r.telemetry)
    for (const s of this.satellites.values()) result.push(s.telemetry)
    return result
  }

  emergencyStopAll() {
    for (const d of this.drones.values()) d.emergencyStop()
    for (const c of this.cars.values()) c.stopEngine()
    for (const b of this.boats.values()) b.emergencyStop()
    for (const r of this.rockets.values()) r.abort()
  }

  disconnectAll() {
    for (const d of this.drones.values()) d.disconnect()
    for (const c of this.cars.values()) c.disconnect()
    for (const b of this.boats.values()) b.disconnect()
    for (const r of this.rockets.values()) r.disconnect()
    for (const s of this.satellites.values()) s.disconnect()
  }
}
