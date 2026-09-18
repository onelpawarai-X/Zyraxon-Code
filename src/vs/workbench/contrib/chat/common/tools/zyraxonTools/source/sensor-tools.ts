type R = { ok: boolean; data?: any; error?: string }

export class LiDARSensor {
  private _points: Array<{ angle: number; distance: number; intensity: number }> = []
  private _protocol = ''
  private _connected = false
  private _scanRate = 10
  private _resolution = 360
  private _minRange = 0.1
  private _maxRange = 10.0

  async connect(protocol: string, port: string): Promise<R> {
    this._protocol = protocol
    this._connected = true
    return { ok: true, data: { protocol, port } }
  }

  disconnect(): R { this._connected = false; this._points = []; return { ok: true } }

  addPoint(angle: number, distance: number, intensity: number): void {
    this._points.push({ angle, distance, intensity })
  }

  setPoints(points: Array<{ angle: number; distance: number; intensity: number }>): void {
    this._points = points
  }

  async scan(): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    return { ok: true, data: { points: this._points.length, scanRate: this._scanRate } }
  }

  getPointCloud(): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    return { ok: true, data: this._points.map(p => ({
      x: p.distance * Math.cos((p.angle * Math.PI) / 180),
      y: p.distance * Math.sin((p.angle * Math.PI) / 180),
      z: 0, intensity: p.intensity
    })) }
  }

  getDistance(angle: number): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const point = this._points.find(p => Math.abs(p.angle - angle) < 1)
    if (!point) return { ok: false, error: 'No data for angle' }
    return { ok: true, data: { angle, distance: point.distance } }
  }

  getIntensity(angle: number): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const point = this._points.find(p => Math.abs(p.angle - angle) < 1)
    if (!point) return { ok: false, error: 'No data for angle' }
    return { ok: true, data: { angle, intensity: point.intensity } }
  }

  setScanRate(hz: number): R {
    if (hz <= 0) return { ok: false, error: 'Scan rate must be positive' }
    this._scanRate = hz; return { ok: true, data: { scanRate: hz } }
  }

  setResolution(res: number): R {
    if (res <= 0) return { ok: false, error: 'Resolution must be positive' }
    this._resolution = res; return { ok: true, data: { resolution: res } }
  }

  setRange(min: number, max: number): R {
    this._minRange = min; this._maxRange = max
    return { ok: true, data: { minRange: min, maxRange: max } }
  }

  getResolution(): R { return { ok: true, data: { resolution: this._resolution } } }
  isConnected(): boolean { return this._connected }
  getPointCount(): number { return this._points.length }
}

export class CameraSensor {
  private _id = ''
  private _resolution = { width: 1920, height: 1080 }
  private _recording = false
  private _frames: Buffer[] = []
  private _exposure = 0
  private _gain = 1.0
  private _fps = 30

  async connect(id: string, resolution: { width: number; height: number }): Promise<R> {
    this._id = id; this._resolution = resolution; this._frames = []
    return { ok: true, data: { id, resolution } }
  }

  disconnect(): R { this._recording = false; this._frames = []; return { ok: true } }

  addFrame(data: Buffer): void {
    this._frames.push(data)
    if (this._frames.length > 100) this._frames.shift()
  }

  async capture(): Promise<R> {
    if (!this._id) return { ok: false, error: 'Not connected' }
    return { ok: true, data: { id: this._id, resolution: this._resolution, frameIndex: this._frames.length, timestamp: Date.now() } }
  }

  async recordStart(): Promise<R> {
    if (!this._id) return { ok: false, error: 'Not connected' }
    this._recording = true; return { ok: true, data: { recording: true, startedAt: Date.now() } }
  }

  async recordStop(): Promise<R> {
    this._recording = false; return { ok: true, data: { recording: false, framesCaptured: this._frames.length } }
  }

  getFrame(): R {
    if (this._frames.length === 0) return { ok: false, error: 'No frames available' }
    return { ok: true, data: { index: this._frames.length - 1, size: this._frames[this._frames.length - 1].length, resolution: this._resolution } }
  }

  setExposure(exp: number): R { this._exposure = Math.max(0, Math.min(100, exp)); return { ok: true, data: { exposure: this._exposure } } }
  setGain(gain: number): R { this._gain = Math.max(0.1, Math.min(32, gain)); return { ok: true, data: { gain: this._gain } } }
  setFPS(fps: number): R { this._fps = Math.max(1, Math.min(120, fps)); return { ok: true, data: { fps: this._fps } } }

  async detectObjects(): Promise<R> {
    if (!this._id) return { ok: false, error: 'Not connected' }
    return { ok: true, data: { objects: [], count: 0, note: 'Feed frames for detection' } }
  }

  isConnected(): boolean { return this._id !== '' }
  getId(): string { return this._id }
  getResolution() { return this._resolution }
  isRecording(): boolean { return this._recording }
  getFrameCount(): number { return this._frames.length }
}

export class RadarSensor {
  private _targets: Array<{ id: number; range: number; velocity: number; angle: number; rcs: number }> = []
  private _type = ''
  private _connected = false
  private _sensitivity = 50
  private _maxRange = 250

  async connect(type: string, frequency: number): Promise<R> {
    this._type = type; this._connected = true; this._targets = []
    return { ok: true, data: { type, frequency } }
  }

  disconnect(): R { this._connected = false; this._targets = []; return { ok: true } }

  addTarget(id: number, range: number, velocity: number, angle: number, rcs: number): void {
    this._targets.push({ id, range, velocity, angle, rcs })
  }

  removeTarget(id: number): void { this._targets = this._targets.filter(t => t.id !== id) }

  async getTargets(): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    return { ok: true, data: this._targets }
  }

  getRange(): R { return { ok: true, data: { minRange: 0.1, maxRange: this._maxRange, units: 'meters' } } }
  getVelocity(targetId: number): R {
    const t = this._targets.find(x => x.id === targetId)
    if (!t) return { ok: false, error: 'Target not found' }
    return { ok: true, data: { targetId, velocity: t.velocity, units: 'm/s' } }
  }
  getAngle(targetId: number): R {
    const t = this._targets.find(x => x.id === targetId)
    if (!t) return { ok: false, error: 'Target not found' }
    return { ok: true, data: { targetId, angle: t.angle, units: 'degrees' } }
  }
  setSensitivity(level: number): R { this._sensitivity = Math.max(0, Math.min(100, level)); return { ok: true, data: { sensitivity: this._sensitivity } } }
  isConnected(): boolean { return this._connected }
  getTargetCount(): number { return this._targets.length }
}

export class IMUSensor {
  private _accel = { x: 0, y: 0, z: 9.81 }
  private _gyro = { x: 0, y: 0, z: 0 }
  private _mag = { x: 25, y: 0, z: -40 }
  private _connected = false
  private _temp = 25

  async connect(port: string): Promise<R> { this._connected = true; return { ok: true, data: { port } } }
  disconnect(): R { this._connected = false; return { ok: true } }

  updateAccel(x: number, y: number, z: number): void { this._accel = { x, y, z } }
  updateGyro(x: number, y: number, z: number): void { this._gyro = { x, y, z } }
  updateMag(x: number, y: number, z: number): void { this._mag = { x, y, z } }
  updateTemp(temp: number): void { this._temp = temp }

  async getAcceleration(): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    return { ok: true, data: { ...this._accel, units: 'm/s^2' } }
  }
  async getGyroscope(): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    return { ok: true, data: { ...this._gyro, units: 'deg/s' } }
  }
  async getMagnetometer(): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    return { ok: true, data: { ...this._mag, units: 'uT' } }
  }
  async getQuaternion(): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const { x, y, z } = this._accel
    const mag = Math.sqrt(x * x + y * y + z * z) || 1
    return { ok: true, data: { w: 1, x: x / mag, y: y / mag, z: z / mag } }
  }
  async getEuler(): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const { x, y, z } = this._accel
    return { ok: true, data: { roll: Math.atan2(y, z) * 180 / Math.PI, pitch: Math.atan2(-x, Math.sqrt(y * y + z * z)) * 180 / Math.PI, yaw: 0, units: 'degrees' } }
  }
  async getTemperature(): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    return { ok: true, data: { temperature: this._temp, units: 'C' } }
  }
  async calibrate(): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    return { ok: true, data: { status: 'completed', accelOffset: { x: 0, y: 0, z: 0 } } }
  }
  isConnected(): boolean { return this._connected }
}

export class UltrasonicSensor {
  private _trigger = 0
  private _echo = 0
  private _connected = false
  private _distance = 0
  private _minRange = 0.02
  private _maxRange = 4.0

  async connect(trigger: number, echo: number): Promise<R> {
    this._trigger = trigger; this._echo = echo; this._connected = true
    return { ok: true, data: { trigger, echo } }
  }
  disconnect(): R { this._connected = false; return { ok: true } }

  updateDistance(distance: number): void { this._distance = distance }

  async getDistance(): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const duration = (this._distance * 2) / 0.0343
    return { ok: true, data: { distance: Math.round(this._distance * 10000) / 10000, duration: Math.round(duration * 100) / 100, units: 'meters' } }
  }

  async getMultipleDistances(count = 5): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    return { ok: true, data: { readings: [this._distance], average: this._distance, count: 1 } }
  }

  setRange(min: number, max: number): R {
    if (min >= max) return { ok: false, error: 'Min must be less than max' }
    this._minRange = min; this._maxRange = max; return { ok: true, data: { minRange: min, maxRange: max } }
  }
  isConnected(): boolean { return this._connected }
}

export class ThermalSensor {
  private _temperatures: number[] = []
  private _connected = false
  private _alertTemp = 50
  private _currentTemp = 25

  async connect(port: string): Promise<R> { this._connected = true; this._temperatures = []; return { ok: true, data: { port } } }
  disconnect(): R { this._connected = false; this._temperatures = []; return { ok: true } }

  updateTemperature(temp: number): void {
    this._currentTemp = temp
    this._temperatures.push(temp)
    if (this._temperatures.length > 1000) this._temperatures.shift()
  }

  async getTemperature(): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    return { ok: true, data: { temperature: this._currentTemp, units: 'C', alert: this._currentTemp >= this._alertTemp } }
  }

  async getTemperatureMap(): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    return { ok: true, data: { map: [[this._currentTemp]], width: 1, height: 1, units: 'C' } }
  }

  getMin(): R {
    if (this._temperatures.length === 0) return { ok: false, error: 'No data' }
    return { ok: true, data: { min: Math.min(...this._temperatures), units: 'C', samples: this._temperatures.length } }
  }
  getMax(): R {
    if (this._temperatures.length === 0) return { ok: false, error: 'No data' }
    return { ok: true, data: { max: Math.max(...this._temperatures), units: 'C', samples: this._temperatures.length } }
  }
  getAverage(): R {
    if (this._temperatures.length === 0) return { ok: false, error: 'No data' }
    const avg = this._temperatures.reduce((a, b) => a + b, 0) / this._temperatures.length
    return { ok: true, data: { average: Math.round(avg * 100) / 100, units: 'C', samples: this._temperatures.length } }
  }
  setAlertTemp(temp: number): R { this._alertTemp = temp; return { ok: true, data: { alertTemp: temp } } }
  isConnected(): boolean { return this._connected }
  getHistory(): number[] { return [...this._temperatures] }
}

export class AccelerometerSensor {
  private _data: Array<{ x: number; y: number; z: number; timestamp: number }> = []
  private _connected = false
  private _range = 2
  private _dataRate = 100
  private _current = { x: 0, y: 0, z: 0 }

  async connect(protocol: string): Promise<R> { this._connected = true; this._data = []; return { ok: true, data: { protocol } } }
  disconnect(): R { this._connected = false; this._data = []; return { ok: true } }

  updateReading(x: number, y: number, z: number): void {
    this._current = { x, y, z }
    this._data.push({ x, y, z, timestamp: Date.now() })
    if (this._data.length > 500) this._data.shift()
  }

  async getAcceleration(): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    return { ok: true, data: { ...this._current, timestamp: Date.now(), units: 'g' } }
  }

  async getPeakG(): Promise<R> {
    if (this._data.length === 0) return { ok: false, error: 'No data collected' }
    let peak = 0
    for (const d of this._data) {
      const mag = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z)
      if (mag > peak) peak = mag
    }
    return { ok: true, data: { peakG: Math.round(peak * 10000) / 10000, samples: this._data.length } }
  }

  setRange(g: number): R {
    const valid = [2, 4, 8, 16]
    if (!valid.includes(g)) return { ok: false, error: `Invalid range. Use: ${valid.join(', ')}` }
    this._range = g; return { ok: true, data: { range: g } }
  }

  setDataRate(hz: number): R {
    if (hz <= 0) return { ok: false, error: 'Data rate must be positive' }
    this._dataRate = hz; return { ok: true, data: { dataRate: hz } }
  }

  isConnected(): boolean { return this._connected }
  getDataCount(): number { return this._data.length }
  getData(): Array<{ x: number; y: number; z: number; timestamp: number }> { return [...this._data] }
}

export class PressureSensor {
  private _pressure = 101325
  private _connected = false
  private _zeroOffset = 0
  private _temp = 25

  async connect(type: string): Promise<R> { this._connected = true; return { ok: true, data: { type } } }
  disconnect(): R { this._connected = false; return { ok: true } }

  updatePressure(pressure: number): void { this._pressure = pressure }
  updateTemp(temp: number): void { this._temp = temp }

  async getPressure(): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    return { ok: true, data: { pressure: this._pressure - this._zeroOffset, units: 'Pa' } }
  }

  async getAltitude(): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const p = this._pressure - this._zeroOffset || 101325
    const altitude = 44330 * (1 - Math.pow(p / 101325, 1 / 5.255))
    return { ok: true, data: { altitude: Math.round(altitude * 100) / 100, units: 'meters' } }
  }

  async getTemperature(): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    return { ok: true, data: { temperature: this._temp, units: 'C' } }
  }

  async setZero(): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    this._zeroOffset = this._pressure; return { ok: true, data: { zeroOffset: this._zeroOffset, status: 'calibrated' } }
  }

  isConnected(): boolean { return this._connected }
}
