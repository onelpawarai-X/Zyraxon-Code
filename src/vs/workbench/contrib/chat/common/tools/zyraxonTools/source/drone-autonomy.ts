/**
 * ZYRAXON X — Drone Autonomy
 * Formation flight, payload, visual landing, RTH, object tracking, battery manager
 */
type R = { ok: boolean; data?: any; error?: string }

// ═══════════════════════════════════════════════════════════════════
// FORMATION FLIGHT — Multi-drone coordination
// ═══════════════════════════════════════════════════════════════════
export class FormationFlight {
  private drones: Map<string, { x: number; y: number; z: number; heading: number; speed: number }> = new Map()
  private leaderId = ''
  private formationType: 'LINE'|'V'|'DIAMOND'|'CIRCLE' = 'LINE'
  private spacing = 5 // meters

  setLeader(id: string): void { this.leaderId = id }
  addDrone(id: string, pos: { x: number; y: number; z: number; heading: number; speed: number }): void { this.drones.set(id, pos) }
  setFormation(type: typeof this.formationType, spacing: number): void { this.formationType = type; this.spacing = spacing }

  private getOffset(index: number): { dx: number; dy: number; dz: number } {
    switch (this.formationType) {
      case 'LINE': return { dx: -this.spacing * index, dy: 0, dz: 0 }
      case 'V': return { dx: -this.spacing * index, dy: index % 2 === 0 ? this.spacing : -this.spacing, dz: 0 }
      case 'DIAMOND': {
        const positions = [[0, 0], [-1, 1], [-1, -1], [-2, 0]]
        const p = positions[index % 4]
        return { dx: p[0] * this.spacing, dy: p[1] * this.spacing, dz: 0 }
      }
      case 'CIRCLE': {
        const angle = (index / this.drones.size) * 2 * Math.PI
        return { dx: Math.cos(angle) * this.spacing, dy: Math.sin(angle) * this.spacing, dz: 0 }
      }
    }
  }

  computeFormationCommand(droneId: string, currentPos: { x: number; y: number; z: number; heading: number }): R {
    const leader = this.drones.get(this.leaderId)
    if (!leader) return { ok: false, error: 'No leader set' }
    const idx = Array.from(this.drones.keys()).indexOf(droneId)
    if (idx < 0) return { ok: false, error: 'Drone not in formation' }
    const offset = this.getOffset(idx)
    const target = { x: leader.x + offset.dx, y: leader.y + offset.dy, z: leader.z + offset.dz }
    const dx = target.x - currentPos.x, dy = target.y - currentPos.y, dz = target.z - currentPos.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    return { ok: true, data: { target, distance: +dist.toFixed(2), heading: +((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360).toFixed(1), throttle: Math.min(100, 50 + dist * 10) } }
  }

  breakFormation(): void { this.drones.clear(); this.leaderId = '' }
  getDrones() { return Object.fromEntries(this.drones) }
}

// ═══════════════════════════════════════════════════════════════════
// PAYLOAD CONTROLLER — Gimbal stabilization, delivery, weight management
// ═══════════════════════════════════════════════════════════════════
export class PayloadController {
  private payloadWeight = 0; private maxPayload = 2
  private gimbalYaw = 0; private gimbalPitch = 0; private gimbalRoll = 0
  private releaseAltitude = 0; private dropPoint: { lat: number; lon: number } | null = null
  private delivered = false

  setPayload(weightKg: number, maxKg: number): void { this.payloadWeight = weightKg; this.maxPayload = maxKg }
  setGimbal(yaw: number, pitch: number, roll: number): void { this.gimbalYaw = yaw; this.gimbalPitch = pitch; this.gimbalRoll = roll }
  setDropPoint(lat: number, lon: number, alt: number): void { this.dropPoint = { lat, lon }; this.releaseAltitude = alt }

  stabilizeGimbal(targetYaw: number, targetPitch: number, dt: number): { yaw: number; pitch: number; roll: number } {
    const kp = 3.0, kd = 0.5
    const yawCmd = kp * (targetYaw - this.gimbalYaw) + kd * (0 - this.gimbalYaw) * dt
    const pitchCmd = kp * (targetPitch - this.gimbalPitch) + kd * (0 - this.gimbalPitch) * dt
    this.gimbalYaw += yawCmd * dt; this.gimbalPitch += pitchCmd * dt
    return { yaw: +this.gimbalYaw.toFixed(2), pitch: +this.gimbalPitch.toFixed(2), roll: +this.gimbalRoll.toFixed(2) }
  }

  checkRelease(pos: { altitude: number; speed: number }): { ready: boolean; reason: string } {
    if (this.delivered) return { ready: false, reason: 'Already delivered' }
    if (this.payloadWeight > this.maxPayload) return { ready: false, reason: 'Overweight' }
    if (pos.altitude > this.releaseAltitude + 10) return { ready: false, reason: 'Too high' }
    if (pos.altitude < this.releaseAltitude - 10) return { ready: false, reason: 'Too low' }
    if (pos.speed > 5) return { ready: false, reason: 'Too fast' }
    return { ready: true, reason: 'Ready to release' }
  }

  release(): R { this.delivered = true; return { ok: true, data: { delivered: true, payload: this.payloadWeight } } }
  isDelivered(): boolean { return this.delivered }
}

// ═══════════════════════════════════════════════════════════════════
// VISUAL LANDING SYSTEM — Precision landing with downward camera
// ═══════════════════════════════════════════════════════════════════
export class VisualLandingSystem {
  private targetX = 0; private targetY = 0; private locked = false
  private arTags: Array<{ id: number; x: number; y: number; size: number; distance: number }> = []
  private kp = 0.8; private descentRate = 0.5

  detectARTags(detections: Array<{ id: number; x: number; y: number; size: number; distance: number }>): void {
    this.arTags = detections
    const landing = this.arTags.find(t => t.id === 0)
    if (landing) { this.targetX = landing.x; this.targetY = landing.y; this.locked = true }
  }

  computeLanding(pos: { x: number; y: number; z: number; vx: number; vy: number }): R {
    if (!this.locked) return { ok: true, data: { action: 'SEARCH', pattern: 'SPIRAL' } }
    const dx = this.targetX - pos.x, dy = this.targetY - pos.y
    const horizontalDist = Math.sqrt(dx * dx + dy * dy)

    if (horizontalDist < 0.3 && pos.z < 2) return { ok: true, data: { action: 'TOUCHDOWN', throttle: 0 } }
    if (horizontalDist > 5) return { ok: true, data: { action: 'REPOSITION', heading: Math.atan2(dy, dx) * 180 / Math.PI } }

    const vx = this.kp * dx, vy = this.kp * dy
    const vz = pos.z > 3 ? -this.descentRate : -0.2
    return { ok: true, data: { action: 'DESCEND', vx: +vx.toFixed(3), vy: +vy.toFixed(3), vz: +vz.toFixed(3), altitude: +pos.z.toFixed(2), locked: true } }
  }
}

// ═══════════════════════════════════════════════════════════════════
// RETURN TO HOME — Emergency RTH with safe landing
// ═══════════════════════════════════════════════════════════════════
export class ReturnToHome {
  private homePos = { lat: 0, lon: 0, alt: 0 }
  private phase: 'IDLE'|'ASCEND'|'NAVIGATE'|'DESCEND'|'LANDING' = 'IDLE'
  private rthAltitude = 30; private descendRate = 1

  setHome(lat: number, lon: number, alt: number): void { this.homePos = { lat, lon, alt } }
  setRTHAltitude(alt: number): void { this.rthAltitude = alt }

  activate(pos: { lat: number; lon: number; alt: number; batteryPct: number }): R {
    this.phase = 'ASCEND'
    return { ok: true, data: { phase: 'ASCEND', targetAlt: this.rthAltitude } }
  }

  update(pos: { lat: number; lon: number; alt: number; batteryPct: number; speed: number }): R {
    if (this.phase === 'IDLE') return { ok: true, data: { action: 'STANDBY' } }

    const dLat = (this.homePos.lat - pos.lat) * 111320, dLon = (this.homePos.lon - pos.lon) * 111320 * Math.cos(pos.lat * Math.PI / 180)
    const dist = Math.sqrt(dLat * dLat + dLon * dLon)

    if (this.phase === 'ASCEND' && pos.alt >= this.rthAltitude - 1) this.phase = 'NAVIGATE'
    if (this.phase === 'NAVIGATE' && dist < 5) this.phase = 'DESCEND'
    if (this.phase === 'DESCEND' && pos.alt <= this.homePos.alt + 2) this.phase = 'LANDING'
    if (this.phase === 'LANDING' && pos.alt <= 0.5) this.phase = 'IDLE'

    const cmd: Record<string, any> = { phase: this.phase, distance: +dist.toFixed(1), battery: pos.batteryPct }
    switch (this.phase) {
      case 'ASCEND': cmd.vz = 2; cmd.vx = 0; cmd.vy = 0; break
      case 'NAVIGATE': cmd.heading = +((Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360).toFixed(1); cmd.altitude = this.rthAltitude; cmd.speed = 8; break
      case 'DESCEND': cmd.vz = -this.descendRate; cmd.vx = 0; cmd.vy = 0; break
      case 'LANDING': cmd.vz = -0.3; cmd.vy = 0; cmd.vx = 0; cmd.landing = true; break
    }
    return { ok: true, data: cmd }
  }

  getPhase(): string { return this.phase }
}

// ═══════════════════════════════════════════════════════════════════
// OBJECT TRACKER — Follow target, maintain distance
// ═══════════════════════════════════════════════════════════════════
export class ObjectTracker {
  private targetId: number | null = null; private locked = false
  private followDistance = 10; private followAltitude = 5
  private kp = 1.2

  acquireTarget(id: number): void { this.targetId = id; this.locked = true }
  releaseTarget(): void { this.targetId = null; this.locked = false }
  setFollowParams(distance: number, altitude: number): void { this.followDistance = distance; this.followAltitude = altitude }

  track(targetPos: { x: number; y: number; z: number; vx: number; vy: number }, dronePos: { x: number; y: number; z: number }): R {
    if (!this.locked) return { ok: true, data: { action: 'IDLE', locked: false } }
    const dx = targetPos.x - dronePos.x, dy = targetPos.y - dronePos.y, dz = targetPos.z - dronePos.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    const error = dist - this.followDistance

    return { ok: true, data: {
      locked: true,
      distanceToTarget: +dist.toFixed(2),
      followError: +error.toFixed(2),
      vx: +(this.kp * (dx / dist) * error).toFixed(3),
      vy: +(this.kp * (dy / dist) * error).toFixed(3),
      vz: +(this.kp * ((this.followAltitude + targetPos.z) - dronePos.z) * 0.5).toFixed(3),
    }}
  }
}

// ═══════════════════════════════════════════════════════════════════
// BATTERY MANAGER — Power monitoring, emergency procedures
// ═══════════════════════════════════════════════════════════════════
export class BatteryManager {
  private voltage = 0; private current = 0; private capacity = 0; private consumed = 0
  private temp = 25; private cellVoltages: number[] = []
  private warningPct = 20; private criticalPct = 10

  setBattery(voltage: number, capacityMah: number, cells: number): void {
    this.voltage = voltage; this.capacity = capacityMah; this.cellVoltages = Array(cells).fill(voltage / cells)
  }

  update(currentAmps: number, temp: number, dt: number): void {
    this.current = currentAmps; this.temp = temp
    this.consumed += currentAmps * 1000 / 3600 * dt // mAh consumed
  }

  getRemainingPct(): number { return Math.max(0, (1 - this.consumed / this.capacity) * 100) }

  getTimeRemaining(speed: number): number { // minutes
    return this.current > 0 ? ((this.capacity - this.consumed) / (this.current * 1000 / 60)) : Infinity
  }

  checkStatus(): R {
    const pct = this.getRemainingPct()
    if (pct <= this.criticalPct) return { ok: false, error: 'CRITICAL', data: { pct: +pct.toFixed(1), action: 'EMERGENCY_RTH' } }
    if (pct <= this.warningPct) return { ok: true, data: { pct: +pct.toFixed(1), warning: true, action: 'RTH_RECOMMENDED', timeRemaining: +this.getTimeRemaining(0).toFixed(0) } }
    return { ok: true, data: { pct: +pct.toFixed(1), warning: false, timeRemaining: +this.getTimeRemaining(0).toFixed(0) } }
  }
}

// ═══════════════════════════════════════════════════════════════════
// GEOFENCE ENFORCER — No-fly zone compliance
// ═══════════════════════════════════════════════════════════════════
export class GeofenceEnforcer {
  private zones: Array<{ name: string; lat: number; lon: number; radius: number; type: 'NOFLY'|'RESTRICT'|'CAUTION' }> = []
  private maxAlt = 120; private maxDist = 5000

  addZone(name: string, lat: number, lon: number, radius: number, type: 'NOFLY'|'RESTRICT'|'CAUTION'): void { this.zones.push({ name, lat, lon, radius, type }) }
  setLimits(maxAlt: number, maxDist: number): void { this.maxAlt = maxAlt; this.maxDist = maxDist }

  check(pos: { lat: number; lon: number; alt: number; homeLat: number; homeLon: number }): R {
    const alerts: string[] = []
    for (const z of this.zones) {
      const d = Math.sqrt((z.lat - pos.lat) ** 2 + (z.lon - pos.lon) ** 2) * 111320
      if (d < z.radius) alerts.push(`ZONE:${z.name}:${z.type}`)
    }
    const distFromHome = Math.sqrt((pos.homeLat - pos.lat) ** 2 + (pos.homeLon - pos.lon) ** 2) * 111320
    if (distFromHome > this.maxDist) alerts.push('MAX_DISTANCE')
    if (pos.alt > this.maxAlt) alerts.push('MAX_ALTITUDE')

    if (alerts.some(a => a.includes('NOFLY'))) return { ok: false, error: 'NO_FLY_ZONE', data: { alerts } }
    if (alerts.length > 0) return { ok: true, data: { alerts, warning: true } }
    return { ok: true, data: { alerts: [], warning: false } }
  }
}

// ═══════════════════════════════════════════════════════════════════
// DRONE AUTONOMY — Master class combining all drone subsystems
// ═══════════════════════════════════════════════════════════════════
export class DroneAutonomy {
  public formation: FormationFlight
  public payload: PayloadController
  public visualLanding: VisualLandingSystem
  public rth: ReturnToHome
  public tracker: ObjectTracker
  public battery: BatteryManager
  public geofence: GeofenceEnforcer

  constructor() {
    this.formation = new FormationFlight()
    this.payload = new PayloadController()
    this.visualLanding = new VisualLandingSystem()
    this.rth = new ReturnToHome()
    this.tracker = new ObjectTracker()
    this.battery = new BatteryManager()
    this.geofence = new GeofenceEnforcer()
  }

  healthCheck(pos: { lat: number; lon: number; alt: number; homeLat: number; homeLon: number }): Record<string, any> {
    return {
      battery: this.battery.checkStatus(),
      geofence: this.geofence.check(pos),
      rth: this.rth.getPhase(),
      trackerLocked: this.tracker.locked,
    }
  }
}
