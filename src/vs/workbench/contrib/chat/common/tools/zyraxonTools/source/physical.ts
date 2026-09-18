/**
 * ZYRAXON X - Physical Control
 * WiFi, Bluetooth, Serial, GPIO, Sensors
 */

export type SensorReading = {
  sensor: string
  value: number
  unit: string
  timestamp: number
}

export type GPSCoord = {
  lat: number
  lon: number
  alt: number
  speed: number
  heading: number
  satellites: number
  accuracy: number
  timestamp: number
}

// ─── WiFi ─────────────────────────────────────────────────
export class WiFiController {
  private _connected = false
  private _networks: any[] = []
  get connected() { return this._connected }
  get networks() { return this._networks }

  async scan(): Promise<any[]> {
    try {
      const r = await fetch("http://localhost:18790/wifi/scan")
      this._networks = await r.json()
    } catch { this._networks = [] }
    return this._networks
  }

  async connect(ssid: string, password?: string): Promise<boolean> {
    try {
      const r = await fetch("http://localhost:18790/wifi/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssid, password }),
      })
      this._connected = (await r.json()).ok
    } catch { this._connected = false }
    return this._connected
  }

  async disconnect() {
    try { await fetch("http://localhost:18790/wifi/disconnect") } catch {}
    this._connected = false
  }

  async getIP(): Promise<string | null> {
    try {
      const r = await fetch("https://api.ipify.org?format=json")
      return (await r.json()).ip
    } catch { return null }
  }

  async speedTest(): Promise<{ download: number; ping: number }> {
    const t0 = Date.now()
    try {
      await fetch("https://httpbin.org/bytes/8192")
      return { download: 8192 / ((Date.now() - t0) / 1000), ping: Date.now() - t0 }
    } catch { return { download: 0, ping: -1 } }
  }
}

// ─── Bluetooth ────────────────────────────────────────────
export class BluetoothController {
  private device: any = null
  private server: any = null
  get connected() { return !!this.device?.gatt?.connected }

  async scan(): Promise<any[]> {
    try {
      if ("bluetooth" in navigator) {
        this.device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ["battery_service", "device_information"],
        })
        return [{ id: this.device.id, name: this.device.name || "Unknown" }]
      }
    } catch {}
    return []
  }

  async connect(): Promise<boolean> {
    try {
      if (!this.device) return false
      this.server = await this.device.gatt.connect()
      return true
    } catch { return false }
  }

  async disconnect() {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect()
    this.device = null
    this.server = null
  }

  async read(serviceUUID: string, charUUID: string): Promise<DataView | null> {
    try {
      const svc = await this.server.getPrimaryService(serviceUUID)
      const ch = await svc.getCharacteristic(charUUID)
      return await ch.readValue()
    } catch { return null }
  }

  async write(serviceUUID: string, charUUID: string, data: ArrayBuffer): Promise<boolean> {
    try {
      const svc = await this.server.getPrimaryService(serviceUUID)
      const ch = await svc.getCharacteristic(charUUID)
      await ch.writeValue(data)
      return true
    } catch { return false }
  }
}

// ─── Serial/UART (Arduino, ESP32) ────────────────────────
export class SerialController {
  private port: any = null
  private reader: any = null
  private _buf = ""
  get connected() { return !!this.port }

  async requestPort(): Promise<boolean> {
    try {
      if ("serial" in navigator) {
        this.port = await (navigator as any).serial.requestPort()
        return true
      }
    } catch {}
    return false
  }

  async open(baudRate = 115200): Promise<boolean> {
    try {
      if (!this.port) await this.requestPort()
      if (!this.port) return false
      await this.port.open({ baudRate, dataBits: 8, stopBits: 1, parity: "none" })
      this.startRead()
      return true
    } catch { return false }
  }

  private startRead() {
    if (!this.port) return
    ;(async () => {
      try {
        this.reader = this.port.readable.getReader()
        while (true) {
          const { value, done } = await this.reader.read()
          if (done) break
          this._buf += new TextDecoder().decode(value)
        }
      } catch {}
    })()
  }

  async send(data: string): Promise<boolean> {
    try {
      const w = this.port.writable.getWriter()
      await w.write(new TextEncoder().encode(data))
      w.releaseLock()
      return true
    } catch { return false }
  }

  async readLine(timeout = 5000): Promise<string> {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      const i = this._buf.indexOf("\n")
      if (i !== -1) {
        const line = this._buf.slice(0, i).trim()
        this._buf = this._buf.slice(i + 1)
        return line
      }
      await new Promise(r => setTimeout(r, 10))
    }
    const rest = this._buf.trim()
    this._buf = ""
    return rest
  }

  async sendCommand(cmd: string): Promise<string> {
    await this.send(cmd + "\n")
    return this.readLine()
  }

  async close() {
    try {
      if (this.reader) await this.reader.cancel()
      if (this.port) await this.port.close()
    } catch {}
    this.port = null
    this.reader = null
  }
}

// ─── GPIO (Raspberry Pi) ──────────────────────────────────
export class GPIOController {
  constructor(private serial: SerialController) {}

  async pinMode(pin: number, mode: "input" | "output" | "pwm"): Promise<boolean> {
    return this.serial.send(`PIN ${pin} ${mode.toUpperCase()}\n`)
  }

  async write(pin: number, value: 0 | 1): Promise<boolean> {
    return this.serial.send(`DWRITE ${pin} ${value}\n`)
  }

  async read(pin: number): Promise<number | null> {
    const resp = await this.serial.sendCommand(`DREAD ${pin}`)
    const m = resp.match(/(\d+)/)
    return m ? parseInt(m[1]) : null
  }

  async analogWrite(pin: number, value: number): Promise<boolean> {
    const v = Math.min(255, Math.max(0, Math.round(value)))
    return this.serial.send(`AWRITE ${pin} ${v}\n`)
  }

  async analogRead(pin: number): Promise<number | null> {
    const resp = await this.serial.sendCommand(`AREAD ${pin}`)
    const m = resp.match(/(\d+)/)
    return m ? parseInt(m[1]) : null
  }

  async servoWrite(pin: number, angle: number): Promise<boolean> {
    const v = Math.min(180, Math.max(0, Math.round(angle)))
    return this.serial.send(`SERVO ${pin} ${v}\n`)
  }
}

// ─── I2C Sensor Bus ───────────────────────────────────────
export class I2CController {
  constructor(private serial: SerialController) {}

  async readByte(address: number, register: number): Promise<number | null> {
    const resp = await this.serial.sendCommand(`I2C_READ ${address} ${register} 1`)
    const m = resp.match(/0x([0-9a-fA-F]+)/)
    return m ? parseInt(m[1], 16) : null
  }

  async readBytes(address: number, register: number, count: number): Promise<number[]> {
    const resp = await this.serial.sendCommand(`I2C_READ ${address} ${register} ${count}`)
    return resp.match(/0x[0-9a-fA-F]+/g)?.map((h: string) => parseInt(h, 16)) || []
  }

  async writeByte(address: number, register: number, value: number): Promise<boolean> {
    return this.serial.send(`I2C_WRITE ${address} ${register} ${value}\n`) as any
  }
}

// ─── GPS Module ───────────────────────────────────────────
export class GPSController {
  private _coord: GPSCoord = { lat: 0, lon: 0, alt: 0, speed: 0, heading: 0, satellites: 0, accuracy: 0, timestamp: 0 }

  get position() { return this._coord }

  async init(serial: SerialController, baud = 9600): Promise<boolean> {
    await serial.open(baud)
    return true
  }

  parseNMEA(sentence: string): GPSCoord | null {
    if (!sentence.startsWith("$GP")) return null
    const parts = sentence.split(",")
    if (parts[0].includes("GGA") && parts.length > 9) {
      const lat = this.parseCoord(parts[1], parts[2])
      const lon = this.parseCoord(parts[3], parts[4])
      const alt = parseFloat(parts[9]) || 0
      const sats = parseInt(parts[7]) || 0
      const acc = parseFloat(parts[8]) || 0
      this._coord = { lat, lon, alt, speed: this._coord.speed, heading: this._coord.heading, satellites: sats, accuracy: acc, timestamp: Date.now() }
      return this._coord
    }
    if (parts[0].includes("RMC") && parts.length > 7) {
      const speed = parseFloat(parts[7]) || 0
      const heading = parseFloat(parts[8]) || 0
      this._coord.speed = speed * 1.852
      this._coord.heading = heading
      return this._coord
    }
    return null
  }

  private parseCoord(val: string, dir: string): number {
    if (!val) return 0
    const raw = parseFloat(val)
    const deg = Math.floor(raw / 100)
    const min = raw - deg * 100
    let coord = deg + min / 60
    if (dir === "S" || dir === "W") coord = -coord
    return coord
  }
}

// ─── Temperature/Humidity Sensor ──────────────────────────
export class TempSensor {
  constructor(private i2c: I2CController, private addr = 0x44) {}

  async read(): Promise<{ temp: number; humidity: number }> {
    const bytes = await this.i2c.readBytes(this.addr, 0x00, 6)
    if (!bytes || bytes.length < 6) return { temp: 0, humidity: 0 }
    const rawTemp = (bytes[0] << 8) | bytes[1]
    const rawHum = (bytes[3] << 8) | bytes[4]
    return {
      temp: -45 + 175 * rawTemp / 65535,
      humidity: 100 * rawHum / 65535,
    }
  }
}

// ─── Ultrasonic Distance (HC-SR04) ────────────────────────
export class UltrasonicSensor {
  constructor(private gpio: GPIOController) {}

  async measure(triggerPin: number, echoPin: number): Promise<number> {
    await this.gpio.write(triggerPin, 0)
    await new Promise(r => setTimeout(r, 2))
    await this.gpio.write(triggerPin, 1)
    await new Promise(r => setTimeout(r, 10))
    await this.gpio.write(triggerPin, 0)
    const start = Date.now()
    while (Date.now() - start < 30) {
      const val = await this.gpio.read(echoPin)
      if (val === 1) break
    }
    const echoStart = Date.now()
    while (Date.now() - echoStart < 30) {
      const val = await this.gpio.read(echoPin)
      if (val === 0) {
        const duration = Date.now() - echoStart
        return (duration * 0.0343) / 2
      }
    }
    return -1
  }
}

// ─── Camera Control ───────────────────────────────────────
export class CameraController {
  async capture(url: string): Promise<Blob | null> {
    try {
      const r = await fetch(url + "/capture")
      return await r.blob()
    } catch { return null }
  }

  async stream(url: string): Promise<MediaStream | null> {
    try {
      return await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    } catch { return null }
  }

  async record(url: string, durationMs = 5000): Promise<Blob | null> {
    const stream = await this.stream(url)
    if (!stream) return null
    return new Promise(resolve => {
      const chunks: Blob[] = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        resolve(new Blob(chunks, { type: "video/webm" }))
      }
      rec.start()
      setTimeout(() => rec.stop(), durationMs)
    })
  }
}

// ─── Master Physical Controller ───────────────────────────
export class ZyraxonPhysical {
  readonly wifi = new WiFiController()
  readonly bluetooth = new BluetoothController()
  readonly serial = new SerialController()
  readonly gpio = new GPIOController(this.serial)
  readonly i2c = new I2CController(this.serial)
  readonly gps = new GPSController()
  readonly tempSensor = new TempSensor(this.i2c)
  readonly ultrasonic = new UltrasonicSensor(this.gpio)
  readonly camera = new CameraController()

  private _devices: Map<string, any> = new Map()

  get devices() { return Array.from(this._devices.values()) }

  registerDevice(id: string, type: string, controller: any) {
    this._devices.set(id, { id, type, controller, connected: false })
  }

  getDevice(id: string) { return this._devices.get(id) }

  async scanAll(): Promise<any[]> {
    const results: any[] = []
    const wifiNets = await this.wifi.scan()
    results.push({ type: "wifi", items: wifiNets })
    return results
  }
}
