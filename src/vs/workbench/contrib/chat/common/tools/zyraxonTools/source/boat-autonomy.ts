/**
 * ZYRAXON X — Boat Autonomy
 * Radar processor, AIS, voyage planner, COLREGS collision avoidance, maneuvering, GMDSS
 */
type R = { ok: boolean; data?: any; error?: string }

export class RadarProcessor {
  private targets: Map<number, { range: number; bearing: number; speed: number; course: number; lastSeen: number }> = new Map()
  private nextId = 1; private sweepAngle = 0; private range = 24

  processSweep(detections: Array<{ range: number; bearing: number; strength: number }>): void {
    for (const d of detections) {
      let bestId: number | null = null, bestDist = 0.5
      this.targets.forEach((t, id) => {
        const dd = Math.sqrt((t.range - d.range) ** 2 + (t.bearing - d.bearing) ** 2)
        if (dd < bestDist) { bestDist = dd; bestId = id }
      })
      if (bestId !== null) { const t = this.targets.get(bestId)!; t.range = d.range; t.bearing = d.bearing; t.lastSeen = Date.now() }
      else this.targets.set(this.nextId++, { range: d.range, bearing: d.bearing, speed: 0, course: 0, lastSeen: Date.now() })
    }
  }

  getCPA(myCourse: number, mySpeed: number, targetId: number): { distance: number; timeToCPA: number } | null {
    const t = this.targets.get(targetId); if (!t) return null
    const dLat = t.range * Math.cos((t.bearing - myCourse) * Math.PI / 180)
    const dLon = t.range * Math.sin((t.bearing - myCourse) * Math.PI / 180)
    const relSpeed = Math.sqrt((t.speed * Math.cos(t.course * Math.PI / 180) - mySpeed * Math.cos(myCourse * Math.PI / 180)) ** 2 + (t.speed * Math.sin(t.course * Math.PI / 180) - mySpeed * Math.sin(myCourse * Math.PI / 180)) ** 2)
    const tcpa = dLat !== 0 ? -dLat / (t.speed * Math.cos(t.course * Math.PI / 180) - mySpeed * Math.cos(myCourse * Math.PI / 180)) : Infinity
    const cpa = Math.abs(dLon)
    return { distance: +cpa.toFixed(1), timeToCPA: +tcpa.toFixed(0) }
  }

  prune(): void { const now = Date.now(); this.targets.forEach((t, id) => { if (now - t.lastSeen > 30000) this.targets.delete(id) }) }
  getTargets() { return Array.from(this.targets.entries()).map(([id, t]) => ({ id, ...t })) }
}

export class AISReceiver {
  private vessels: Map<string, { mmsi: string; name: string; lat: number; lon: number; sog: number; cog: number; heading: number; type: string; lastSeen: number }> = new Map()

  update(data: Array<{ mmsi: string; name: string; lat: number; lon: number; sog: number; cog: number; heading: number; type: string }>): void {
    for (const d of data) this.vessels.set(d.mmsi, { ...d, lastSeen: Date.now() })
  }

  getCollisionRisk(myPos: { lat: number; lon: number; cog: number; sog: number }, targetMmsi: string): { bearing: number; range: number; tcpa: number; risk: string } | null {
    const v = this.vessels.get(targetMmsi); if (!v) return null
    const dLat = (v.lat - myPos.lat) * 60, dLon = (v.lon - myPos.lon) * 60 * Math.cos(myPos.lat * Math.PI / 180)
    const range = Math.sqrt(dLat * dLat + dLon * dLon) * 1852
    const bearing = (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360
    const relVx = v.sog * Math.cos(v.cog * Math.PI / 180) - myPos.sog * Math.cos(myPos.cog * Math.PI / 180)
    const relVy = v.sog * Math.sin(v.cog * Math.PI / 180) - myPos.sog * Math.sin(myPos.cog * Math.PI / 180)
    const tcpa = -(dLat * relVx + dLon * relVy) / (relVx ** 2 + relVy ** 2) * 3600
    const cpa = Math.abs(dLon * relVx - dLat * relVy) / Math.sqrt(relVx ** 2 + relVy ** 2) * 1852
    const risk = tcpa < 600 && cpa < 1000 ? 'HIGH' : tcpa < 1800 && cpa < 2000 ? 'MEDIUM' : 'LOW'
    return { bearing: +bearing.toFixed(1), range: +range.toFixed(0), tcpa: +tcpa.toFixed(0), risk }
  }

  getVessels() { return Array.from(this.vessels.values()) }
}

export class VoyagePlanner {
  private waypoints: Array<{ lat: number; lon: number; speed: number; name: string }> = []
  private currentIdx = 0; private totalDistance = 0

  setRoute(wp: Array<{ lat: number; lon: number; speed: number; name: string }>): void {
    this.waypoints = wp; this.currentIdx = 0; this.totalDistance = 0
    for (let i = 1; i < wp.length; i++) {
      const dLat = (wp[i].lat - wp[i-1].lat) * 60, dLon = (wp[i].lon - wp[i-1].lon) * 60 * Math.cos(wp[i].lat * Math.PI / 180)
      this.totalDistance += Math.sqrt(dLat * dLat + dLon * dLon)
    }
  }

  getETA(currentSpeed: number): { eta: string; distanceRemaining: number; timeRemaining: number } {
    let remaining = 0
    for (let i = this.currentIdx; i < this.waypoints.length - 1; i++) {
      const dLat = (this.waypoints[i+1].lat - this.waypoints[i].lat) * 60
      const dLon = (this.waypoints[i+1].lon - this.waypoints[i].lon) * 60 * Math.cos(this.waypoints[i].lat * Math.PI / 180)
      remaining += Math.sqrt(dLat * dLat + dLon * dLon)
    }
    const hours = currentSpeed > 0 ? remaining / currentSpeed : Infinity
    const eta = new Date(Date.now() + hours * 3600000).toISOString()
    return { eta, distanceRemaining: +remaining.toFixed(1), timeRemaining: +hours.toFixed(1) }
  }

  checkWaypoint(pos: { lat: number; lon: number }): boolean {
    const wp = this.waypoints[this.currentIdx]; if (!wp) return false
    const d = Math.sqrt(((wp.lat - pos.lat) * 60) ** 2 + ((wp.lon - pos.lon) * 60) ** 2)
    if (d < 0.5) { this.currentIdx++; return true }
    return false
  }
}

export class COLREGSAvoidance {
  computeManeuver(myCourse: number, mySpeed: number, targetBearing: number, targetRange: number, targetCourse: number, targetSpeed: number): R {
    let risk = 'LOW', action = 'MAINTAIN'
    const closeRange = targetRange < 2
    const headOn = Math.abs(targetBearing - myCourse) < 15
    const crossing = targetBearing > 90 && targetBearing < 270
    const overtaking = targetBearing > 330 || targetBearing < 30

    if (closeRange && headOn) { risk = 'HIGH'; action = 'PORT_15' }
    else if (closeRange && crossing) { risk = 'HIGH'; action = targetBearing < 180 ? 'MAINTAIN' : 'STARBOARD_15' }
    else if (closeRange && overtaking) { risk = 'HIGH'; action = 'PORT_20' }
    else if (targetRange < 5) { risk = 'MEDIUM'; action = 'WIDE_BERTH' }
    return { ok: true, data: { risk, action, targetBearing: +targetBearing.toFixed(1), targetRange: +targetRange.toFixed(1) } }
  }
}

export class ManeuveringPrediction {
  turningCircle(speed: number, rudderAngle: number, displacement: number): { advance: number; transfer: number; tacticalDiameter: number } {
    const R = displacement * 1000 / (2 * 9.81 * Math.tan(rudderAngle * Math.PI / 180) * 10)
    return { advance: +(R * 1.0).toFixed(0), transfer: +(R * 0.5).toFixed(0), tacticalDiameter: +(R * 2).toFixed(0) }
  }
  speedToStop(speed: number, displacement: number): number { return +(speed * displacement / 5000).toFixed(0) }
}

export class GMDSS {
  private distressPosition: { lat: number; lon: number } | null = null
  sendDistress(pos: { lat: number; lon: number }): R { this.distressPosition = pos; return { ok: true, data: { type: 'DISTRESS', position: pos, dsc: true, selected: true, time: new Date().toISOString() } } }
  sendUrgency(msg: string): R { return { ok: true, data: { type: 'URGENCY', message: msg, time: new Date().toISOString() } } }
  sendSafety(msg: string): R { return { ok: true, data: { type: 'SAFETY', message: msg, time: new Date().toISOString() } } }
}

export class BoatAutonomy {
  public radar: RadarProcessor; public ais: AISReceiver; public voyage: VoyagePlanner
  public colregs: COLREGSAvoidance; public maneuvering: ManeuveringPrediction; public gmdss: GMDSS
  constructor(){this.radar=new RadarProcessor();this.ais=new AISReceiver();this.voyage=new VoyagePlanner();this.colregs=new COLREGSAvoidance();this.maneuvering=new ManeuveringPrediction();this.gmdss=new GMDSS()}
}
