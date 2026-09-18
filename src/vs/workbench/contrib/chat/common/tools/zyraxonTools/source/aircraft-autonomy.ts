/**
 * ZYRAXON X — Aircraft Autonomy
 * Flight Data Recorder, GCAS, Fuel Optimizer, Approach, Performance, Emergency Autoland
 */
type R = { ok: boolean; data?: any; error?: string }

// ═══════════════════════════════════════════════════════════════════
// FLIGHT DATA RECORDER — Every parameter recorded at 1-10 Hz
// ═══════════════════════════════════════════════════════════════════
export class FlightDataRecorder {
  private buffer: Array<{ t: number; d: Record<string, number> }> = []
  private maxSize = 1000000; private sampleRate = 4; private lastSample = 0
  private incidents: Array<{ time: number; type: string; data: any }> = []

  record(t: number, data: Record<string, number>): void {
    if (t - this.lastSample < 1000 / this.sampleRate) return
    this.buffer.push({ t, d: { ...data } }); this.lastSample = t
    if (this.buffer.length > this.maxSize) this.buffer.splice(0, 10000)
  }

  detectIncident(t: number, data: Record<string, number>): string[] {
    const alerts: string[] = []
    if (data.ias && data.ias < 60) { alerts.push('STALL'); this.incidents.push({ time: t, type: 'STALL', data }) }
    if (data.vs && Math.abs(data.vs) > 6000) { alerts.push('EXCESSIVE_VS'); this.incidents.push({ time: t, type: 'EXCESSIVE_VS', data }) }
    if (data.roll && Math.abs(data.roll) > 60) { alerts.push('EXCESSIVE_BANK'); this.incidents.push({ time: t, type: 'EXCESSIVE_BANK', data }) }
    if (data.altitude && data.altitude < 500 && data.vs < -2000) { alerts.push('TERRAIN_RISK'); this.incidents.push({ time: t, type: 'TERRAIN_RISK', data }) }
    if (data.aoa && Math.abs(data.aoa) > 20) { alerts.push('HIGH_AOA'); this.incidents.push({ time: t, type: 'HIGH_AOA', data }) }
    if (data.gLoad && Math.abs(data.gLoad) > 2.5) { alerts.push('STRUCTURAL_OVERLOAD'); this.incidents.push({ time: t, type: 'STRUCTURAL_OVERLOAD', data }) }
    return alerts
  }

  exportBuffer(): Array<{ t: number; d: Record<string, number> }> { return this.buffer.slice() }
  getIncidents() { return this.incidents }
  clearIncidents(): void { this.incidents = [] }
  size(): number { return this.buffer.length }
}

// ═══════════════════════════════════════════════════════════════════
// GROUND COLLISION AVOIDANCE (Auto-GCAS)
// ═══════════════════════════════════════════════════════════════════
export class GroundCollisionAvoidance {
  private terrainDb: Array<{ lat: number; lon: number; alt: number }> = []
  private marginFt = 1000; private alertTime = 30; private recoveryPitchRate = 3

  loadTerrain(data: Array<{ lat: number; lon: number; alt: number }>): void { this.terrainDb = data }

  private getTerrainAlt(lat: number, lon: number): number {
    let closest = Infinity, alt = 0
    for (const t of this.terrainDb) {
      const d = Math.sqrt((t.lat - lat) ** 2 + (t.lon - lon) ** 2)
      if (d < closest) { closest = d; alt = t.alt }
    }
    return alt
  }

  check(pos: { lat: number; lon: number; alt: number; heading: number; vs: number; pitch: number; speed: number }): {
    alert: boolean; terrainAlt: number; clearance: number; action: string; timeToImpact: number
  } {
    const terrainAlt = this.getTerrainAlt(pos.lat, pos.lon)
    const clearance = pos.alt - terrainAlt
    const timeToImpact = pos.vs < 0 ? clearance / (-pos.vs) : Infinity
    const projectedAlt = pos.alt + pos.vs * this.alertTime
    const projectedTerrain = this.getTerrainAlt(
      pos.lat + Math.cos(pos.heading * Math.PI / 180) * pos.speed * this.alertTime / 6076,
      pos.lon + Math.sin(pos.heading * Math.PI / 180) * pos.speed * this.alertTime / 6076
    )

    if (clearance < this.marginFt || projectedAlt - projectedTerrain < 0) {
      return { alert: true, terrainAlt, clearance: +clearance.toFixed(1), action: 'PULL_UP', timeToImpact: +timeToImpact.toFixed(1) }
    }
    if (clearance < this.marginFt * 2 && pos.vs < -1000) {
      return { alert: true, terrainAlt, clearance: +clearance.toFixed(1), action: 'REDUCE_SINK', timeToImpact: +timeToImpact.toFixed(1) }
    }
    return { alert: false, terrainAlt, clearance: +clearance.toFixed(1), action: 'NONE', timeToImpact: +timeToImpact.toFixed(1) }
  }

  getRecoveryCommands(): { pitchUp: number; rollLevel: boolean; powerGoAround: boolean } {
    return { pitchUp: this.recoveryPitchRate, rollLevel: true, powerGoAround: true }
  }
}

// ═══════════════════════════════════════════════════════════════════
// FUEL OPTIMIZER — Range, endurance, fuel flow, step climb
// ═══════════════════════════════════════════════════════════════════
export class FuelOptimizer {
  private totalFuel = 0; private currentFuel = 0; private fuelFlow = 0
  private burnRatePerNm = 0 // kg/nm
  private reservePct = 5 // % reserve

  setTank(fuelKg: number) { this.totalFuel = fuelKg; this.currentFuel = fuelKg }
  setBurnRate(rateKgPerNm: number) { this.burnRatePerNm = rateKgPerNm }

  computeRange(altitude: number, speed: number): { maxRange: number; endurance: number; optimalSpeed: number } {
    const altitudeFactor = 1 + altitude / 40000 * 0.3
    const fuelAvail = this.currentFuel * (1 - this.reservePct / 100)
    const range = this.burnRatePerNm > 0 ? (fuelAvail / this.burnRatePerNm) * altitudeFactor : 0
    const endurance = this.fuelFlow > 0 ? fuelAvail / this.fuelFlow : 0
    const optimalSpeed = 0.78 * 550 // max range speed ~ Mach 0.78
    return { maxRange: +range.toFixed(0), endurance: +(endurance / 3600).toFixed(1), optimalSpeed: +optimalSpeed.toFixed(0) }
  }

  fuelRemaining(distanceNm: number): { fuelAtDestination: number; minutesToReserve: number } {
    const burn = distanceNm * this.burnRatePerNm
    const remaining = this.currentFuel - burn
    const reserveFuel = this.totalFuel * this.reservePct / 100
    const minToReserve = this.fuelFlow > 0 ? (remaining - reserveFuel) / this.fuelFlow * 60 : 0
    return { fuelAtDestination: +remaining.toFixed(0), minutesToReserve: +minToReserve.toFixed(0) }
  }

  updateFlow(dt: number): void { this.currentFuel = Math.max(0, this.currentFuel - this.fuelFlow * dt) }
  getStatus() { return { currentFuel: +this.currentFuel.toFixed(0), totalFuel: this.totalFuel, fuelFlow: +this.fuelFlow.toFixed(1), burnRate: this.burnRatePerNm } }
}

// ═══════════════════════════════════════════════════════════════════
// APPROACH CONTROLLER — ILS/RNAV/VOR approach sequencing
// ═══════════════════════════════════════════════════════════════════
export class ApproachController {
  private phase: 'ENROUTE'|'ARRIVAL'|'APPROACH'|'LANDING'|'GOAROUND' = 'ENROUTE'
  private decisionHeight = 200; private minAltitude = 0
  private localizerDeviation = 0; private glideslopeDeviation = 0

  setApproach(dh: number, minAlt: number): void { this.decisionHeight = dh; this.minAltitude = minAlt; this.phase = 'ARRIVAL' }

  update(pos: { altitude: number; speed: number; locDev: number; gsDev: number; runwayAlt: number }): R {
    this.localizerDeviation = pos.locDev; this.glideslopeDeviation = pos.gsDev

    if (pos.altitude < 1000 && this.phase === 'ARRIVAL') this.phase = 'APPROACH'
    if (pos.altitude < this.decisionHeight + pos.runwayAlt && this.phase === 'APPROACH') this.phase = 'LANDING'

    if (this.phase === 'LANDING' && pos.altitude > this.decisionHeight + pos.runwayAlt + 50) {
      this.phase = 'GOAROUND'
      return { ok: true, data: { action: 'GO_AROUND', flaps: 15, pitch: 15, throttle: 100 } }
    }

    const locCmd = -this.localizerDeviation * 2.5
    const gsCmd = -this.glideslopeDeviation * 1.5
    const speedCmd = pos.altitude > 1000 ? 180 : pos.altitude > 500 ? 160 : 140

    return { ok: true, data: { phase: this.phase, locCmd: +locCmd.toFixed(2), gsCmd: +gsCmd.toFixed(2), speedCmd, dh: this.decisionHeight, localizer: +this.localizerDeviation.toFixed(2), glideslope: +this.glideslopeDeviation.toFixed(2) } }
  }

  goAround(): void { this.phase = 'GOAROUND' }
  getPhase(): string { return this.phase }
}

// ═══════════════════════════════════════════════════════════════════
// PERFORMANCE CALCULATOR — Takeoff/landing distances, climb gradient
// ═══════════════════════════════════════════════════════════════════
export class PerformanceCalculator {
  // Takeoff distance: TODA = 1.15 * (V2² / (2 * a)) + transition
  takeoffDistance(params: { v2Speed: number; accelPhase: number; transitionAlt: number; climbGradient: number; obstacleHeight: number }): R {
    const { v2Speed, transitionAlt, climbGradient, obstacleHeight } = params
    const accelDist = (v2Speed * 1.6878) ** 2 / (2 * 10) // m, ~10 m/s² acceleration
    const transDist = transitionAlt / Math.tan(climbGradient * Math.PI / 180)
    const totalDist = (accelDist + transDist) * 3.28084 // to feet
    return { ok: true, data: { takeoffDistance: +totalDist.toFixed(0), accel: +accelDist.toFixed(0), transition: +transDist.toFixed(0) } }
  }

  // Landing distance: LDA = Vref² / (2 * decel) + reverse thrust
  landingDistance(params: { vrefSpeed: number; decelRate: number; reverseThrust: boolean; autobrake: number }): R {
    const vrefFps = params.vrefSpeed * 1.6878
    const airDist = vrefFps * 2 // ~2 seconds float
    const groundDist = vrefFps ** 2 / (2 * params.decelRate)
    const reverseBonus = params.reverseThrust ? groundDist * 0.2 : 0
    const abBonus = params.autobrake * groundDist * 0.03
    const totalDist = (airDist + groundDist - reverseBonus - abBonus) * 0.3048 * 3.28084
    return { ok: true, data: { landingDistance: +totalDist.toFixed(0), airDist: +(airDist * 0.3048).toFixed(0), groundDist: +(groundDist * 0.3048).toFixed(0) } }
  }

  // Climb gradient: gradient% = (rate / groundspeed) * 100
  climbGradient(rate: number, groundSpeed: number): number { return +((rate / groundSpeed) * 100).toFixed(2) }
}

// ═══════════════════════════════════════════════════════════════════
// EMERGENCY AUTOLAND — Full autoland sequence for pilot incapacitation
// ═══════════════════════════════════════════════════════════════════
export class EmergencyAutoland {
  private phase: 'DETECTED'|'NAVIGATE'|'APPROACH'|'LANDING'|'ROLLOUT'|'COMPLETE' = 'DETECTED'
  private runway: { lat: number; lon: number; alt: number; heading: number; length: number } | null = null
  private elapsed = 0

  selectNearestRunway(pos: { lat: number; lon: number }, runways: Array<{ lat: number; lon: number; alt: number; heading: number; length: number; hasILS: boolean }>): typeof this.runway {
    const suitable = runways.filter(r => r.hasILS && r.length > 2000).sort((a, b) => {
      const dA = Math.sqrt((a.lat - pos.lat) ** 2 + (a.lon - pos.lon) ** 2)
      const dB = Math.sqrt((b.lat - pos.lat) ** 2 + (b.lon - pos.lon) ** 2)
      return dA - dB
    })
    this.runway = suitable[0] || null
    return this.runway
  }

  update(dt: number, pos: { altitude: number; speed: number; lat: number; lon: number; heading: number }): R {
    this.elapsed += dt
    if (!this.runway) return { ok: false, error: 'No suitable runway' }

    const rwyDist = Math.sqrt((this.runway.lat - pos.lat) ** 2 + (this.runway.lon - pos.lon) ** 2) * 60 * 1852
    if (this.phase === 'DETECTED') this.phase = 'NAVIGATE'
    if (rwyDist < 5000 && this.phase === 'NAVIGATE') this.phase = 'APPROACH'
    if (pos.altitude < 50 && this.phase === 'APPROACH') this.phase = 'LANDING'
    if (pos.altitude < 5 && this.phase === 'LANDING') this.phase = 'ROLLOUT'
    if (pos.speed < 5 && this.phase === 'ROLLOUT') this.phase = 'COMPLETE'

    const cmd: Record<string, any> = { phase: this.phase, elapsed: +this.elapsed.toFixed(1) }
    switch (this.phase) {
      case 'NAVIGATE': cmd.heading = this.runway.heading; cmd.altitude = 3000; cmd.speed = 180; break
      case 'APPROACH': cmd.altitude = Math.max(0, rwyDist * 0.003); cmd.speed = 140; cmd.flaps = 20; break
      case 'LANDING': cmd.throttle = 0; cmd.flaps = 30; cmd.gear = 'DOWN'; break
      case 'ROLLOUT': cmd.reverseThrust = true; cmd.autobrake = 5; cmd.speed = 0; break
      case 'COMPLETE': cmd.engines = 'SHUTDOWN'; cmd.emergencyServices = true; break
    }
    return { ok: true, data: cmd }
  }

  getPhase(): string { return this.phase }
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE HEALTH MONITOR — Vibration, EGT, oil analysis
// ═══════════════════════════════════════════════════════════════════
export class EngineHealthMonitor {
  private engines: Map<string, { n1: number; n2: number; egt: number; oilTemp: number; oilPress: number; vibration: number; fuelFlow: number; status: string }> = new Map()

  registerEngine(id: string): void { this.engines.set(id, { n1: 0, n2: 0, egt: 0, oilTemp: 0, oilPress: 0, vibration: 0, fuelFlow: 0, status: 'NORMAL' }) }

  updateEngine(id: string, data: Partial<{ n1: number; n2: number; egt: number; oilTemp: number; oilPress: number; vibration: number; fuelFlow: number }>): void {
    const e = this.engines.get(id); if (!e) return
    Object.assign(e, data)
    if (e.egt > 1000) e.status = 'EGT_OVERTEMP'
    else if (e.oilPress < 20) e.status = 'LOW_OIL_PRESS'
    else if (e.vibration > 5) e.status = 'HIGH_VIBRATION'
    else if (e.oilTemp > 140) e.status = 'OIL_OVERTEMP'
    else e.status = 'NORMAL'
  }

  diagnose(): Array<{ engine: string; status: string; alerts: string[] }> {
    const results: Array<{ engine: string; status: string; alerts: string[] }> = []
    this.engines.forEach((e, id) => {
      const alerts: string[] = []
      if (e.egt > 950) alerts.push('EGT_WARNING')
      if (e.oilPress < 30) alerts.push('OIL_PRESS_LOW')
      if (e.vibration > 4) alerts.push('VIBRATION_HIGH')
      if (e.n1 < 10 && e.n2 > 30) alerts.push('N1_N2_DIVERGENCE')
      results.push({ engine: id, status: e.status, alerts })
    })
    return results
  }

  getEngineStatus(id: string) { return this.engines.get(id) }
  getAllStatus() { return Object.fromEntries(this.engines) }
}
