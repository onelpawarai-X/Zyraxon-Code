type R = { ok: boolean; data?: any; error?: string }

export class SDRReceiver {
  private _device = ''
  private _sampleRate = 0
  private _frequency = 0
  private _connected = false
  private _capturing = false
  private _samples: number[] = []
  private _gain = 50
  private _bandwidth = 2000000

  connect(device: string, sampleRate: number, frequency: number): R {
    if (!device || sampleRate <= 0 || frequency <= 0) return { ok: false, error: 'Invalid params' }
    this._device = device; this._sampleRate = sampleRate; this._frequency = frequency; this._connected = true
    return { ok: true, data: { device, sampleRate, frequency } }
  }

  disconnect(): R {
    this._connected = false; this._capturing = false; this._samples = []; return { ok: true }
  }

  setFrequency(hz: number): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    this._frequency = hz; return { ok: true, data: { frequency: hz } }
  }

  setGain(gain: number): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    this._gain = Math.max(0, Math.min(100, gain)); return { ok: true, data: { gain: this._gain } }
  }

  setBandwidth(hz: number): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    this._bandwidth = hz; return { ok: true, data: { bandwidth: hz } }
  }

  feedSamples(samples: number[]): void { this._samples = samples }

  getSignal(): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const signal = this._samples.slice(-256)
    const rms = Math.sqrt(signal.reduce((s, v) => s + v * v, 0) / (signal.length || 1))
    return { ok: true, data: { samples: signal.length, rms } }
  }

  getFFT(): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const N = Math.min(this._samples.length, 1024)
    const fft: Array<{ bin: number; magnitude: number }> = []
    for (let k = 0; k < N / 2; k++) {
      let re = 0, im = 0
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N
        re += this._samples[n] * Math.cos(angle)
        im += this._samples[n] * Math.sin(angle)
      }
      fft.push({ bin: k, magnitude: Math.sqrt(re * re + im * im) / N })
    }
    return { ok: true, data: { bins: fft.length, fft } }
  }

  getPowerLevel(): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const signal = this._samples.slice(-512)
    const power = signal.reduce((s, v) => s + v * v, 0) / (signal.length || 1)
    const dbm = 10 * Math.log10(power * 1000 || 1e-10)
    return { ok: true, data: { power, dbm } }
  }

  startCapture(): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    this._capturing = true; return { ok: true, data: { capturing: true } }
  }

  stopCapture(): R {
    this._capturing = false; return { ok: true, data: { capturing: false, samplesCollected: this._samples.length } }
  }

  isConnected(): boolean { return this._connected }
  isCapturing(): boolean { return this._capturing }
  getFrequency(): number { return this._frequency }
  getSampleRate(): number { return this._sampleRate }
  getSampleCount(): number { return this._samples.length }
}

export class FMTransmitter {
  private _device = ''
  private _frequency = 0
  private _power = 1
  private _connected = false
  private _transmitting = false
  private _modulationIndex = 0
  private _audioSource = ''

  connect(device: string, frequency: number): R {
    this._device = device; this._frequency = frequency; this._connected = true
    return { ok: true, data: { device, frequency } }
  }

  disconnect(): R { this._connected = false; this._transmitting = false; return { ok: true } }

  setFrequency(hz: number): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    this._frequency = hz; return { ok: true, data: { frequency: hz } }
  }

  setPower(watts: number): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    this._power = Math.max(0.01, watts); return { ok: true, data: { power: this._power } }
  }

  startTransmission(): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    this._transmitting = true; return { ok: true, data: { transmitting: true } }
  }

  stopTransmission(): R {
    this._transmitting = false; return { ok: true, data: { transmitting: false } }
  }

  setModulationIndex(index: number): R { this._modulationIndex = index; return { ok: true, data: { modulationIndex: index } } }
  setAudioSource(source: string): R { this._audioSource = source; return { ok: true, data: { audioSource: source } } }

  getModulationIndex(): R { return { ok: true, data: { modulationIndex: this._modulationIndex } } }
  isConnected(): boolean { return this._connected }
  isTransmitting(): boolean { return this._transmitting }
}

export class WiFiAnalyzer {
  private _networks: Array<{ ssid: string; bssid: string; signal: number; channel: number; frequency: number; encrypted: boolean }> = []
  private _monitoring = false
  private _channelUtilization: Map<number, number> = new Map()

  scan(): R { return { ok: true, data: { networks: this._networks.length } } }

  addNetwork(ssid: string, bssid: string, signal: number, channel: number, frequency: number, encrypted: boolean): void {
    this._networks.push({ ssid, bssid, signal, channel, frequency, encrypted })
  }

  getNetworks(): R { return { ok: true, data: this._networks } }

  getSignalStrength(bssid: string): R {
    const n = this._networks.find(x => x.bssid === bssid)
    if (!n) return { ok: false, error: 'Network not found' }
    return { ok: true, data: { bssid, signal: n.signal, units: 'dBm' } }
  }

  setChannelUtilization(channel: number, utilization: number): void { this._channelUtilization.set(channel, utilization) }

  getChannelUtilization(): R { return { ok: true, data: Object.fromEntries(this._channelUtilization) } }

  getInterference(): R {
    const channels = Array.from(this._channelUtilization.entries())
    const avg = channels.length ? channels.reduce((s, [, v]) => s + v, 0) / channels.length : 0
    return { ok: true, data: { averageUtilization: avg, channels: channels.length } }
  }

  getBestChannel(): R {
    let best = 1, bestUtil = Infinity
    this._channelUtilization.forEach((util, ch) => { if (util < bestUtil) { bestUtil = util; best = ch } })
    return { ok: true, data: { channel: best, utilization: bestUtil } }
  }

  startMonitor(): R { this._monitoring = true; return { ok: true, data: { monitoring: true } } }
  stopMonitor(): R { this._monitoring = false; return { ok: true, data: { monitoring: false } } }
  isMonitoring(): boolean { return this._monitoring }
}

export class BluetoothScanner {
  private _devices: Map<string, { name: string; rssi: number; services: string[]; connected: boolean }> = new Map()
  private _scanning = false

  addDevice(id: string, name: string, rssi: number, services: string[]): void {
    this._devices.set(id, { name, rssi, services, connected: false })
  }

  scan(): R { this._scanning = true; return { ok: true, data: { devices: this._devices.size } } }
  stopScan(): R { this._scanning = false; return { ok: true } }

  getDevices(): R { return { ok: true, data: Array.from(this._devices.entries()).map(([id, d]) => ({ id, ...d })) } }

  getRSSI(deviceId: string): R {
    const d = this._devices.get(deviceId)
    if (!d) return { ok: false, error: 'Device not found' }
    return { ok: true, data: { deviceId, rssi: d.rssi, units: 'dBm' } }
  }

  getServices(deviceId: string): R {
    const d = this._devices.get(deviceId)
    if (!d) return { ok: false, error: 'Device not found' }
    return { ok: true, data: { deviceId, services: d.services } }
  }

  connect(deviceId: string): R {
    const d = this._devices.get(deviceId)
    if (!d) return { ok: false, error: 'Device not found' }
    d.connected = true; return { ok: true, data: { deviceId, connected: true } }
  }

  disconnect(deviceId: string): R {
    const d = this._devices.get(deviceId)
    if (!d) return { ok: false, error: 'Device not found' }
    d.connected = false; return { ok: true, data: { deviceId, connected: false } }
  }

  send(deviceId: string, data: string): R {
    const d = this._devices.get(deviceId)
    if (!d?.connected) return { ok: false, error: 'Not connected' }
    return { ok: true, data: { deviceId, bytes: data.length } }
  }

  isScanning(): boolean { return this._scanning }
}

export class LoRaTransceiver {
  private _frequency = 0
  private _sf = 7
  private _bw = 125000
  private _connected = false
  private _messages: Array<{ from: string; data: string; rssi: number; snr: number; time: number }> = []
  private _rssi = -80
  private _snr = 10

  connect(frequency: number, spreading: number, bandwidth: number): R {
    this._frequency = frequency; this._sf = spreading; this._bw = bandwidth; this._connected = true
    return { ok: true, data: { frequency, spreading, bandwidth } }
  }

  disconnect(): R { this._connected = false; return { ok: true } }

  transmit(data: string, destination: string): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    this._messages.push({ from: 'self', data, rssi: this._rssi, snr: this._snr, time: Date.now() })
    const airtime = (data.length * 8) / (this._bw / Math.pow(2, this._sf))
    return { ok: true, data: { destination, bytes: data.length, airtime } }
  }

  receive(): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    const received = this._messages.filter(m => m.from !== 'self')
    return { ok: true, data: { messages: received, count: received.length } }
  }

  addReceivedMessage(from: string, data: string, rssi: number, snr: number): void {
    this._messages.push({ from, data, rssi, snr, time: Date.now() })
  }

  setSpreadingFactor(sf: number): R { this._sf = Math.max(6, Math.min(12, sf)); return { ok: true, data: { sf: this._sf } } }
  setBandwidth(bw: number): R { this._bw = bw; return { ok: true, data: { bw } } }
  setRSSI(rssi: number): R { this._rssi = rssi; return { ok: true, data: { rssi } } }
  setSNR(snr: number): R { this._snr = snr; return { ok: true, data: { snr } } }
  getSNR(): R { return { ok: true, data: { snr: this._snr } } }
  getRSSI(): R { return { ok: true, data: { rssi: this._rssi } } }
  isConnected(): boolean { return this._connected }
  getMessageCount(): number { return this._messages.length }
}

export class GPSReceiver {
  private _port = ''
  private _connected = false
  private _position: { lat: number; lon: number; alt: number } | null = null
  private _velocity: { speed: number; heading: number } = { speed: 0, heading: 0 }
  private _satellites: Array<{ prn: number; elevation: number; azimuth: number; snr: number }> = []
  private _hdop = 1.0
  private _navigating = false

  connect(port: string, _baudrate = 9600): R {
    this._port = port; this._connected = true; return { ok: true, data: { port } }
  }

  disconnect(): R { this._connected = false; this._navigating = false; return { ok: true } }

  setPosition(lat: number, lon: number, alt: number): R {
    this._position = { lat, lon, alt }; return { ok: true, data: this._position }
  }

  setVelocity(speed: number, heading: number): R {
    this._velocity = { speed, heading }; return { ok: true, data: this._velocity }
  }

  addSatellite(prn: number, elevation: number, azimuth: number, snr: number): void {
    this._satellites.push({ prn, elevation, azimuth, snr })
  }

  setHDOP(hdop: number): R { this._hdop = hdop; return { ok: true, data: { hdop } } }

  getPosition(): R {
    if (!this._connected) return { ok: false, error: 'Not connected' }
    if (!this._position) return { ok: false, error: 'No fix' }
    return { ok: true, data: { ...this._position, fix: true } }
  }

  getVelocity(): R { return { ok: true, data: { ...this._velocity } } }
  getSatellites(): R { return { ok: true, data: { satellites: this._satellites, count: this._satellites.length } } }
  getTime(): R { return { ok: true, data: { time: new Date().toISOString() } } }
  getHDOP(): R { return { ok: true, data: { hdop: this._hdop } } }

  startNavigation(): R { this._navigating = true; return { ok: true, data: { navigating: true } } }
  stopNavigation(): R { this._navigating = false; return { ok: true, data: { navigating: false } } }
  isConnected(): boolean { return this._connected }
  isNavigating(): boolean { return this._navigating }
}

export class SignalAnalyzer {
  private _samples: number[] = []

  addSamples(data: number[]): void { this._samples = data }

  analyze(data: number[]): R {
    if (!data.length) return { ok: false, error: 'No data' }
    const mean = data.reduce((s, v) => s + v, 0) / data.length
    const variance = data.reduce((s, v) => s + (v - mean) ** 2, 0) / data.length
    const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length)
    const peak = Math.max(...data.map(Math.abs))
    return { ok: true, data: { samples: data.length, mean, variance, rms, peak, snr: rms > 0 ? 20 * Math.log10(peak / rms) : 0 } }
  }

  detectModulation(data: number[]): R {
    if (!data.length) return { ok: false, error: 'No data' }
    const mean = data.reduce((s, v) => s + v, 0) / data.length
    const hasCarrier = Math.abs(mean) > 0.01
    const envelope = Math.max(...data) - Math.min(...data)
    const type = hasCarrier && envelope < Math.abs(mean) * 0.5 ? 'AM' : hasCarrier ? 'FM' : 'Unknown'
    return { ok: true, data: { type, hasCarrier, envelope } }
  }

  getCarrierFrequency(data: number[]): R {
    if (data.length < 2) return { ok: false, error: 'Insufficient data' }
    let zeroCrossings = 0
    for (let i = 1; i < data.length; i++) {
      if ((data[i] >= 0 && data[i - 1] < 0) || (data[i] < 0 && data[i - 1] >= 0)) zeroCrossings++
    }
    return { ok: true, data: { zeroCrossings, estimatedFrequency: zeroCrossings / (2 * data.length) } }
  }

  getBandwidth(data: number[]): R {
    if (!data.length) return { ok: false, error: 'No data' }
    const max = Math.max(...data)
    const min = Math.min(...data)
    return { ok: true, data: { bandwidth: max - min, max, min } }
  }

  demodulate(data: number[], type: string): R {
    if (!data.length) return { ok: false, error: 'No data' }
    if (type === 'AM') {
      const mean = data.reduce((s, v) => s + v, 0) / data.length
      const demod = data.map(v => Math.abs(v - mean))
      return { ok: true, data: { samples: demod.length, type: 'AM' } }
    }
    if (type === 'FM') {
      const diffs: number[] = []
      for (let i = 1; i < data.length; i++) diffs.push(data[i] - data[i - 1])
      return { ok: true, data: { samples: diffs.length, type: 'FM' } }
    }
    return { ok: false, error: `Unknown modulation type: ${type}` }
  }

  getSNR(data: number[]): R {
    if (data.length < 10) return { ok: false, error: 'Insufficient data' }
    const signal = data.slice(0, Math.floor(data.length / 2))
    const noise = data.slice(Math.floor(data.length / 2))
    const signalPower = signal.reduce((s, v) => s + v * v, 0) / signal.length
    const noisePower = noise.reduce((s, v) => s + v * v, 0) / noise.length
    const snr = noisePower > 0 ? 10 * Math.log10(signalPower / noisePower) : Infinity
    return { ok: true, data: { snr, signalPower, noisePower } }
  }

  getSampleCount(): number { return this._samples.length }
}
