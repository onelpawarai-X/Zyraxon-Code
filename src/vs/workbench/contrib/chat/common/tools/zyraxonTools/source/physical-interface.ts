type R = { ok: boolean; data?: any; error?: string }

export class ArduinoController {
  private _port = ''
  private _baudrate = 9600
  private _connected = false
  private _pins: Map<number, { mode: string; value: number }> = new Map()
  private _buffer: string[] = []
  private _onData?: (line: string) => void

  async connect(port: string, baudrate = 9600): Promise<R> {
    this._port = port
    this._baudrate = baudrate
    this._connected = true
    return { ok: true, data: { port, baudrate, protocol: 'serial' } }
  }

  disconnect(): R {
    this._connected = false
    this._pins.clear()
    return { ok: true }
  }

  async digitalWrite(pin: number, value: 0 | 1): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    this._pins.set(pin, { mode: 'output', value })
    return { ok: true, data: { pin, value, command: `D${pin}:${value}` } }
  }

  async digitalRead(pin: number): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const entry = this._pins.get(pin) || { mode: 'input', value: 0 }
    return { ok: true, data: { pin, value: entry.value, mode: entry.mode } }
  }

  async analogWrite(pin: number, value: number): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    value = Math.max(0, Math.min(255, Math.round(value)))
    this._pins.set(pin, { mode: 'pwm', value })
    return { ok: true, data: { pin, value, command: `A${pin}:${value}` } }
  }

  async analogRead(pin: number): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const entry = this._pins.get(pin) || { mode: 'analog', value: 0 }
    return { ok: true, data: { pin, value: entry.value, resolution: 10 } }
  }

  async servoWrite(pin: number, angle: number): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    angle = Math.max(0, Math.min(180, Math.round(angle)))
    this._pins.set(pin, { mode: 'servo', value: angle })
    return { ok: true, data: { pin, angle, command: `S${pin}:${angle}` } }
  }

  async serialWrite(data: string): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    this._buffer.push(data)
    return { ok: true, data: { bytes: Buffer.byteLength(data) } }
  }

  async serialRead(): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    if (this._buffer.length === 0) return { ok: false, error: 'Buffer empty' }
    const line = this._buffer.shift()!
    return { ok: true, data: line }
  }

  onData(callback: (line: string) => void): void {
    this._onData = callback
  }

  simulateInput(line: string): void {
    this._buffer.push(line)
    this._onData?.(line)
  }

  getPinMode(pin: number): R {
    const entry = this._pins.get(pin)
    if (!entry) return { ok: false, error: 'Pin not configured' }
    return { ok: true, data: { pin, mode: entry.mode } }
  }

  setPinMode(pin: number, mode: 'input' | 'output' | 'pwm' | 'servo'): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const entry = this._pins.get(pin) || { mode, value: 0 }
    entry.mode = mode
    this._pins.set(pin, entry)
    return { ok: true, data: { pin, mode } }
  }

  isConnected(): boolean { return this._connected }
  getPort(): string { return this._port }
  getBaudrate(): number { return this._baudrate }
  getAllPins(): Record<number, { mode: string; value: number }> {
    return Object.fromEntries(this._pins)
  }
}

export class RaspberryPiController {
  private _connected = false
  private _host = ''
  private _user = ''
  private _pins: Map<number, { mode: string; value: number }> = new Map()
  private _i2c: Map<number, Map<number, number>> = new Map()

  async connect(ip: string, user: string, _password: string): Promise<R> {
    this._host = ip
    this._user = user
    this._connected = true
    return { ok: true, data: { ip, user, protocol: 'ssh' } }
  }

  disconnect(): R {
    this._connected = false
    this._pins.clear()
    this._i2c.clear()
    return { ok: true }
  }

  async gpioRead(pin: number): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const entry = this._pins.get(pin) || { mode: 'input', value: 0 }
    return { ok: true, data: { pin, value: entry.value, mode: entry.mode } }
  }

  async gpioWrite(pin: number, value: 0 | 1): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    this._pins.set(pin, { mode: 'output', value })
    return { ok: true, data: { pin, value } }
  }

  async i2cRead(address: number, register: number): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    let device = this._i2c.get(address)
    if (!device) { device = new Map(); this._i2c.set(address, device) }
    const value = device.get(register) ?? 0
    return { ok: true, data: { address, register, value } }
  }

  async i2cWrite(address: number, register: number, value: number): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    let device = this._i2c.get(address)
    if (!device) { device = new Map(); this._i2c.set(address, device) }
    device.set(register, value & 0xff)
    return { ok: true, data: { address, register, value: value & 0xff } }
  }

  async spiTransfer(data: number[]): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const received = data.map(b => (b ^ 0xff) & 0xff)
    return { ok: true, data: { transmitted: data, received } }
  }

  getPWM(pin: number): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const entry = this._pins.get(pin)
    return { ok: true, data: { pin, frequency: 1000, duty: entry?.value ?? 0 } }
  }

  setPWM(pin: number, frequency: number, duty: number): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    duty = Math.max(0, Math.min(100, duty))
    this._pins.set(pin, { mode: 'pwm', value: duty })
    return { ok: true, data: { pin, frequency, duty } }
  }

  isConnected(): boolean { return this._connected }
  getHost(): string { return this._host }
}

export class CANBusController {
  private _interface = ''
  private _frames: Array<{ id: number; data: number[]; extended: boolean; timestamp: number }> = []
  private _stats = { tx: 0, rx: 0, errors: 0, dropped: 0 }
  private _connected = false
  private _filters: Array<{ id: number; mask: number }> = []
  private _bitrate = 500000
  private _onFrame?: (frame: { id: number; data: number[] }) => void

  async connect(interfaceName: string, bitrate = 500000): Promise<R> {
    this._interface = interfaceName
    this._bitrate = bitrate
    this._connected = true
    this._frames = []
    this._stats = { tx: 0, rx: 0, errors: 0, dropped: 0 }
    return { ok: true, data: { interface: interfaceName, bitrate } }
  }

  disconnect(): R {
    this._connected = false
    this._frames = []
    return { ok: true }
  }

  async sendFrame(id: number, data: number[], extended = false): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    if (data.length > 8) return { ok: false, error: 'Data length exceeds 8 bytes' }
    const padded = [...data, ...new Array(8 - data.length).fill(0)]
    this._stats.tx++
    this._frames.push({ id, data: padded, extended, timestamp: Date.now() })
    return { ok: true, data: { id, data: padded, extended, dlc: data.length } }
  }

  receiveFrame(id: number, data: number[], extended = false): void {
    if (!this._connected) return
    const frame = { id, data, extended, timestamp: Date.now() }
    this._frames.push(frame)
    this._stats.rx++
    this._onFrame?.({ id, data })
  }

  onFrame(callback: (frame: { id: number; data: number[] }) => void): void {
    this._onFrame = callback
  }

  getFrames(filter?: { id?: number; mask?: number }): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    let frames = [...this._frames]
    if (filter?.id !== undefined) {
      const mask = filter.mask ?? 0x7ff
      frames = frames.filter(f => (f.id & mask) === (filter.id! & mask))
    }
    return { ok: true, data: frames }
  }

  getStats(): R { return { ok: true, data: { ...this._stats } } }

  setFilter(id: number, mask: number): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    this._filters.push({ id, mask })
    return { ok: true, data: { filters: this._filters.length } }
  }

  getBusStatus(): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    return { ok: true, data: { busOff: false, errorPassive: false, lastError: 'None', rxErrors: this._stats.errors, txErrors: 0, interface: this._interface, bitrate: this._bitrate } }
  }

  isConnected(): boolean { return this._connected }
}

export class UARTController {
  private _port = ''
  private _baudrate = 115200
  private _connected = false
  private _txBuffer: string[] = []
  private _rxBuffer: string[] = []
  private _onData?: (data: string) => void

  async connect(port: string, baudrate = 115200): Promise<R> {
    this._port = port
    this._baudrate = baudrate
    this._connected = true
    return { ok: true, data: { port, baudrate } }
  }

  disconnect(): R {
    this._connected = false
    this._txBuffer = []
    this._rxBuffer = []
    return { ok: true }
  }

  async write(data: string | Buffer): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const str = typeof data === 'string' ? data : data.toString('hex')
    this._txBuffer.push(str)
    return { ok: true, data: { bytes: Buffer.byteLength(str) } }
  }

  async read(length: number): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    if (this._rxBuffer.length === 0) return { ok: false, error: 'Buffer empty' }
    const data = this._rxBuffer.splice(0, length).join('')
    return { ok: true, data: { bytes: Array.from(Buffer.from(data)), length: data.length } }
  }

  receiveData(data: string): void {
    this._rxBuffer.push(data)
    this._onData?.(data)
  }

  onData(callback: (data: string) => void): void { this._onData = callback }

  flush(): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const flushed = this._txBuffer.length
    this._txBuffer = []
    return { ok: true, data: { flushed } }
  }

  getBaudrate(): R { return { ok: true, data: { baudrate: this._baudrate } } }

  setBaudrate(rate: number): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    this._baudrate = rate
    return { ok: true, data: { baudrate: rate } }
  }

  isConnected(): boolean { return this._connected }
  getPort(): string { return this._port }
}

export class I2CBusController {
  private _bus = 0
  private _connected = false
  private _devices: Map<number, Map<number, number>> = new Map()

  async openBus(busNumber: number): Promise<R> {
    this._bus = busNumber
    this._connected = true
    this._devices.clear()
    return { ok: true, data: { bus: busNumber } }
  }

  close(): R {
    this._connected = false
    this._devices.clear()
    return { ok: true }
  }

  async readByte(address: number, register: number): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    let device = this._devices.get(address)
    if (!device) { device = new Map(); this._devices.set(address, device) }
    const value = device.get(register) ?? 0
    return { ok: true, data: { address, register, value } }
  }

  async writeByte(address: number, register: number, value: number): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    let device = this._devices.get(address)
    if (!device) { device = new Map(); this._devices.set(address, device) }
    device.set(register, value & 0xff)
    return { ok: true, data: { address, register, value: value & 0xff } }
  }

  async readBlock(address: number, register: number, length: number): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    let device = this._devices.get(address)
    if (!device) { device = new Map(); this._devices.set(address, device) }
    const data: number[] = []
    for (let i = 0; i < length; i++) {
      data.push(device.get(register + i) ?? 0)
    }
    return { ok: true, data: { address, register, data, length } }
  }

  async writeBlock(address: number, register: number, data: number[]): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    let device = this._devices.get(address)
    if (!device) { device = new Map(); this._devices.set(address, device) }
    data.forEach((val, i) => { device!.set(register + i, val & 0xff) })
    return { ok: true, data: { address, register, bytesWritten: data.length } }
  }

  async scan(): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const found: number[] = []
    this._devices.forEach((_v, addr) => { found.push(addr) })
    return { ok: true, data: { devices: found, count: found.length } }
  }

  addDevice(address: number): void {
    if (!this._devices.has(address)) this._devices.set(address, new Map())
  }

  setRegisterValue(address: number, register: number, value: number): void {
    let device = this._devices.get(address)
    if (!device) { device = new Map(); this._devices.set(address, device) }
    device.set(register, value)
  }

  getBus(): number { return this._bus }
  isConnected(): boolean { return this._connected }
}

export class SPIController {
  private _bus = 0
  private _cs = 0
  private _connected = false
  private _mode = 0
  private _speed = 1000000

  async open(bus: number, chipSelect = 0): Promise<R> {
    this._bus = bus
    this._cs = chipSelect
    this._connected = true
    return { ok: true, data: { bus, chipSelect } }
  }

  close(): R { this._connected = false; return { ok: true } }

  async transfer(tx: number[]): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const rx = tx.map(b => (b ^ 0xa5) & 0xff)
    return { ok: true, data: { tx, rx, length: tx.length } }
  }

  async transferFullDuplex(tx: number[]): Promise<R> {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const rx = tx.map(b => ~b & 0xff)
    return { ok: true, data: { tx, rx, length: tx.length } }
  }

  setMode(mode: number): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    if (mode < 0 || mode > 3) return { ok: false, error: 'Invalid SPI mode (0-3)' }
    this._mode = mode
    return { ok: true, data: { mode } }
  }

  setSpeed(hz: number): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    this._speed = Math.max(0, hz)
    return { ok: true, data: { speed: this._speed } }
  }

  getBus(): number { return this._bus }
  getCS(): number { return this._cs }
  getMode(): number { return this._mode }
  getSpeed(): number { return this._speed }
  isConnected(): boolean { return this._connected }
}

export class ADCController {
  private _channels = 8
  private _reference = 5.0
  private _resolution = 10
  private _calibration: Map<number, { offset: number; gain: number }> = new Map()
  private _values: Map<number, number> = new Map()

  async read(channel: number): Promise<R> {
    if (channel < 0 || channel >= this._channels) return { ok: false, error: 'Invalid channel' }
    const raw = this._values.get(channel) ?? 0
    const cal = this._calibration.get(channel) || { offset: 0, gain: 1.0 }
    const voltage = ((raw * this._reference) / (1 << this._resolution) - cal.offset) * cal.gain
    return { ok: true, data: { channel, raw, voltage: Math.round(voltage * 1000) / 1000 } }
  }

  async readAll(): Promise<R> {
    const results: Array<{ channel: number; raw: number; voltage: number }> = []
    for (let ch = 0; ch < this._channels; ch++) {
      const res = await this.read(ch)
      if (res.ok) results.push(res.data)
    }
    return { ok: true, data: results }
  }

  setChannelValue(channel: number, raw: number): void {
    this._values.set(channel, raw)
  }

  setReference(voltage: number): R {
    if (voltage <= 0) return { ok: false, error: 'Reference voltage must be positive' }
    this._reference = voltage
    return { ok: true, data: { reference: voltage } }
  }

  getResolution(): R { return { ok: true, data: { bits: this._resolution, levels: 1 << this._resolution } } }

  calibrate(channel: number, knownVoltage: number): R {
    if (channel < 0 || channel >= this._channels) return { ok: false, error: 'Invalid channel' }
    const raw = this._values.get(channel) ?? 0
    const idealVoltage = (raw * this._reference) / (1 << this._resolution)
    const gain = idealVoltage > 0 ? knownVoltage / idealVoltage : 1.0
    this._calibration.set(channel, { offset: 0, gain })
    return { ok: true, data: { channel, knownVoltage, gain } }
  }

  getChannels(): number { return this._channels }
  getReference(): number { return this._reference }
}

export class PWMController {
  private _channels: Map<number, { frequency: number; duty: number; enabled: boolean }> = new Map()

  private _getChannel(channel: number) {
    if (!this._channels.has(channel)) {
      this._channels.set(channel, { frequency: 1000, duty: 0, enabled: false })
    }
    return this._channels.get(channel)!
  }

  setFrequency(channel: number, hz: number): R {
    if (hz <= 0) return { ok: false, error: 'Frequency must be positive' }
    const ch = this._getChannel(channel)
    ch.frequency = hz
    return { ok: true, data: { channel, frequency: hz } }
  }

  setDuty(channel: number, percent: number): R {
    percent = Math.max(0, Math.min(100, percent))
    const ch = this._getChannel(channel)
    ch.duty = percent
    return { ok: true, data: { channel, duty: percent } }
  }

  enable(channel: number): R {
    const ch = this._getChannel(channel)
    ch.enabled = true
    return { ok: true, data: { channel, enabled: true } }
  }

  disable(channel: number): R {
    const ch = this._getChannel(channel)
    ch.enabled = false
    ch.duty = 0
    return { ok: true, data: { channel, enabled: false } }
  }

  getFrequency(channel: number): R {
    const ch = this._getChannel(channel)
    return { ok: true, data: { channel, frequency: ch.frequency } }
  }

  getDuty(channel: number): R {
    const ch = this._getChannel(channel)
    return { ok: true, data: { channel, duty: ch.duty, enabled: ch.enabled } }
  }

  getAllChannels(): Record<number, { frequency: number; duty: number; enabled: boolean }> {
    return Object.fromEntries(this._channels)
  }
}
