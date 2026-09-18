type R = { ok: boolean; data?: any; error?: string }

export class ExcavatorController {
  _arm = 0
  _bucket = 0
  _swing = 0
  _depth = 0
  _load = 0

  setArm(angle: number): R {
    this._arm = Math.max(0, Math.min(180, angle))
    return { ok: true, data: { arm: this._arm } }
  }

  setBucket(angle: number): R {
    this._bucket = Math.max(-90, Math.min(45, angle))
    return { ok: true, data: { bucket: this._bucket } }
  }

  setSwing(angle: number): R {
    this._swing = Math.max(-360, Math.min(360, angle))
    return { ok: true, data: { swing: this._swing } }
  }

  setTrack(speed: number): R {
    const clamped = Math.max(-100, Math.min(100, speed))
    return { ok: true, data: { trackSpeed: clamped } }
  }

  dig(): R {
    const effectiveDepth = this._arm * Math.cos((this._bucket * Math.PI) / 180) * 0.05
    this._depth += effectiveDepth
    this._depth = Math.max(0, Math.min(15, this._depth))
    const material = effectiveDepth > 0.3 ? "hard" : effectiveDepth > 0.1 ? "medium" : "soft"
    return { ok: true, data: { depth: this._depth.toFixed(2), material, armAngle: this._arm } }
  }

  dump(): R {
    if (this._load <= 0) return { ok: false, error: "Nothing to dump" }
    const dumped = this._load
    this._load = 0
    return { ok: true, data: { dumped, remaining: this._load } }
  }

  getLoadWeight(): R {
    return { ok: true, data: { loadKg: this._load, loadTons: (this._load / 1000).toFixed(2) } }
  }

  getDepth(): R {
    return { ok: true, data: { depthMeters: this._depth.toFixed(2) } }
  }
}

export class CraneController {
  _boom = { angle: 45, length: 20 }
  _trolley = 0
  _hoist = 0
  _load = 0

  setBoom(angle: number, length: number): R {
    this._boom.angle = Math.max(10, Math.min(85, angle))
    this._boom.length = Math.max(5, Math.min(80, length))
    return { ok: true, data: { angle: this._boom.angle, length: this._boom.length } }
  }

  setTrolley(position: number): R {
    this._trolley = Math.max(0, Math.min(100, position))
    return { ok: true, data: { trolleyPosition: this._trolley } }
  }

  setHoist(speed: number): R {
    this._hoist = Math.max(-50, Math.min(50, speed))
    return { ok: true, data: { hoistSpeed: this._hoist } }
  }

  getLoadWeight(): R {
    return { ok: true, data: { loadKg: this._load, loadTons: (this._load / 1000).toFixed(2) } }
  }

  getRadius(): R {
    const boomHorizontal = this._boom.length * Math.cos((this._boom.angle * Math.PI) / 180)
    const radius = boomHorizontal + (this._trolley / 100) * 10
    return { ok: true, data: { radiusMeters: radius.toFixed(2), boomHorizontal: boomHorizontal.toFixed(2), trolleyOffset: (this._trolley / 100 * 10).toFixed(2) } }
  }

  getCapacity(): R {
    const radius = parseFloat(this.getRadius().data.radiusMeters)
    const baseCapacity = 50000
    const capacity = baseCapacity * (20 / radius) * Math.sin((this._boom.angle * Math.PI) / 180)
    return { ok: true, data: { capacityKg: Math.max(0, capacity).toFixed(0), radius, boomAngle: this._boom.angle } }
  }

  checkWindLimit(windSpeed: number): R {
    const limits = { safe: 20, caution: 35, stop: 50 }
    const status = windSpeed > limits.stop ? "stop" : windSpeed > limits.caution ? "caution" : "safe"
    const message = status === "stop" ? "Stop all operations" : status === "caution" ? "Reduce speed" : "Operations safe"
    return { ok: true, data: { windSpeed, status, message, limits } }
  }
}

export class ConcreteMixer {
  _ratio = { cement: 0, sand: 0, aggregate: 0, water: 0 }
  _mixing = false
  _consistency = 0

  setRatio(cement: number, sand: number, aggregate: number, water: number): R {
    const total = cement + sand + aggregate + water
    if (total === 0) return { ok: false, error: "Invalid ratio" }
    this._ratio = {
      cement: (cement / total) * 100,
      sand: (sand / total) * 100,
      aggregate: (aggregate / total) * 100,
      water: (water / total) * 100
    }
    return { ok: true, data: { ...this._ratio } }
  }

  startMix(): R {
    if (this._mixing) return { ok: false, error: "Already mixing" }
    this._mixing = true
    const waterCement = this._ratio.water / (this._ratio.cement || 1)
    if (waterCement > 0.6) this._consistency = 0.8
    else if (waterCement > 0.4) this._consistency = 0.95
    else this._consistency = 0.7
    return { ok: true, data: { mixing: this._mixing, consistency: this._consistency } }
  }

  stopMix(): R {
    if (!this._mixing) return { ok: false, error: "Not mixing" }
    this._mixing = false
    return { ok: true, data: { mixing: this._mixing, finalConsistency: this._consistency } }
  }

  getConsistency(): R {
    const labels: Record<string, string> = { high: "slump > 100mm", medium: "slump 50-100mm", low: "slump < 50mm" }
    const label = this._consistency > 0.9 ? "high" : this._consistency > 0.75 ? "medium" : "low"
    return { ok: true, data: { consistency: this._consistency, label: labels[label], mixing: this._mixing } }
  }

  getVolume(): R {
    const baseVolume = 1000
    const volume = baseVolume * (this._ratio.cement + this._ratio.sand + this._ratio.aggregate) / 100
    return { ok: true, data: { volumeLiters: volume.toFixed(0), components: this._ratio } }
  }

  discharge(): R {
    if (this._mixing) return { ok: false, error: "Stop mixing before discharge" }
    if (this._consistency === 0) return { ok: false, error: "No mixture prepared" }
    const quality = this._consistency > 0.9 ? "excellent" : this._consistency > 0.75 ? "good" : "poor"
    return { ok: true, data: { discharged: true, quality, consistency: this._consistency } }
  }
}

export class SurveyDrone {
  _site: any = null
  _photos: any[] = []
  _baseline: number = 0
  private _photoCounter: number = 0

  setSite(boundary: any[]): R {
    if (boundary.length < 3) return { ok: false, error: "Need at least 3 boundary points" }
    this._site = { boundary, area: this.calculateArea(boundary) }
    return { ok: true, data: { points: boundary.length, area: this._site.area.toFixed(2) } }
  }

  private calculateArea(points: any[]): number {
    let area = 0
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length
      area += points[i].x * points[j].y
      area -= points[j].x * points[i].y
    }
    return Math.abs(area / 2)
  }

  planFlight(altitude: number, overlap: number): R {
    if (!this._site) return { ok: false, error: "Set site first" }
    const flightLines = Math.ceil(this._site.area / (100 * (1 - overlap / 100)))
    const totalDistance = flightLines * Math.sqrt(this._site.area)
    const batteryUsage = totalDistance * 0.05
    return { ok: true, data: { altitude, overlap, flightLines, totalDistanceMeters: totalDistance.toFixed(0), batteryUsagePercent: batteryUsage.toFixed(1) } }
  }

  capturePhotos(): R {
    if (!this._site) return { ok: false, error: "Set site first" }
    const count = Math.floor(this._site.area / 50) + 10
    this._photos = Array.from({ length: count }, (_, i) => {
      this._photoCounter++;
      return { id: `photo_${this._photoCounter}`, timestamp: Date.now() + i * 1000, location: { x: (i * 37) % 100, y: (i * 53) % 100 } }
    })
    return { ok: true, data: { photosCaptured: count, totalPhotos: this._photos.length } }
  }

  generate3DModel(): R {
    if (this._photos.length === 0) return { ok: false, error: "No photos captured" }
    const vertices = this._photos.length * 100
    const faces = vertices * 2
    return { ok: true, data: { vertices, faces, resolution: "high", format: "OBJ", fileSizeMB: (vertices * 0.001).toFixed(1) } }
  }

  getVolumeChange(baseline: number): R {
    this._baseline = baseline
    const photoCount = this._photos.length
    const currentVolume = baseline * (0.9 + (photoCount % 10) * 0.02)
    const change = currentVolume - baseline
    const percentage = (change / baseline) * 100
    return { ok: true, data: { baseline, currentVolume: currentVolume.toFixed(2), change: change.toFixed(2), percentage: percentage.toFixed(2), excavated: change < 0 } }
  }

  getProgressReport(): R {
    const completed = this._photos.length > 0
    const totalTasks = 5
    const completedTasks = completed ? 4 : 1
    return { ok: true, data: { siteSet: !!this._site, photosCaptured: this._photos.length, progress: ((completedTasks / totalTasks) * 100).toFixed(0), tasks: { siteSurvey: !!this._site, flightPlan: !!this._site, photoCapture: completed, modelGeneration: false, volumeAnalysis: false } } }
  }
}

export class BulldozerController {
  _blade = { angle: 0, height: 50 }
  _throttle = 0
  _load = 0
  _grade = 0

  setBlade(angle: number, height: number): R {
    this._blade.angle = Math.max(-30, Math.min(30, angle))
    this._blade.height = Math.max(0, Math.min(100, height))
    return { ok: true, data: { angle: this._blade.angle, height: this._blade.height } }
  }

  setThrottle(level: number): R {
    this._throttle = Math.max(0, Math.min(100, level))
    return { ok: true, data: { throttle: this._throttle } }
  }

  setTrack(speed: number): R {
    const maxSpeed = this._throttle * 0.5
    const actualSpeed = Math.min(speed, maxSpeed)
    return { ok: true, data: { speed: actualSpeed, maxSpeed, throttle: this._throttle } }
  }

  push(): R {
    if (this._throttle === 0) return { ok: false, error: "Throttle not engaged" }
    const force = this._throttle * 100
    const resistance = this._load * 9.8 * 0.3
    const effective = force - resistance
    const moved = effective > 0
    if (moved) {
      const gradeChange = (this._blade.angle * this._throttle) / 10000
      this._grade += gradeChange
      this._grade = Math.max(-10, Math.min(10, this._grade))
    }
    this._load = Math.min(this._load + (moved ? 50 : 0), 5000)
    return { ok: true, data: { moved, force, resistance: resistance.toFixed(0), grade: this._grade.toFixed(2), bladeLoad: this._load } }
  }

  getBladeLoad(): R {
    return { ok: true, data: { loadKg: this._load, loadTons: (this._load / 1000).toFixed(2), maxCapacity: 5000, utilization: ((this._load / 5000) * 100).toFixed(1) } }
  }

  getGrade(): R {
    return { ok: true, data: { grade: this._grade.toFixed(2), gradePercent: (this._grade * 100).toFixed(1), status: Math.abs(this._grade) < 2 ? "acceptable" : "needs correction" } }
  }
}
