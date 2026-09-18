/**
 * ZYRAXON X - IoT & Home Automation
 * MQTT, HTTP REST, WebSocket, Modbus, Home Assistant
 */

export type MQTTMessage = { topic: string; payload: string; qos: 0 | 1 | 2; retain: boolean; timestamp: number }

export class MQTTController {
  private client: any = null
  private _subs: Map<string, (m: MQTTMessage) => void> = new Map()
  private _msgs: MQTTMessage[] = []
  private _connected = false
  get connected() { return this._connected }
  get messages() { return this._msgs }
  onMessage?: (m: MQTTMessage) => void

  async connect(broker: string, port = 1883, clientId?: string): Promise<boolean> {
    try {
      const url = broker.replace("mqtt://", "ws://") + ":" + port + "/mqtt"
      this.client = new WebSocket(url)
      await new Promise<void>((res, rej) => {
        this.client.onopen = () => res()
        this.client.onerror = () => rej()
        setTimeout(rej, 5000)
      })
      this.client.onmessage = (e: MessageEvent) => this.handleMsg(e.data)
      this._connected = true
      return true
    } catch { return false }
  }

  private handleMsg(data: any) {
    if (typeof data === "string") return
    const bytes = new Uint8Array(data)
    if (bytes.length < 4) return
    if ((bytes[0] & 0xf0) === 0x30) {
      let off = 1, rem = 0, mult = 1
      while (bytes[off] & 0x80) { rem += (bytes[off] & 0x7f) * mult; mult *= 128; off++ }
      rem += bytes[off] * mult; off++
      const tLen = (bytes[off] << 8) | bytes[off+1]; off += 2
      const topic = new TextDecoder().decode(bytes.slice(off, off + tLen))
      off += tLen
      const payload = new TextDecoder().decode(bytes.slice(off))
      const msg: MQTTMessage = { topic, payload, qos: 0, retain: false, timestamp: Date.now() }
      this._msgs.push(msg)
      if (this._msgs.length > 1000) this._msgs.shift()
      this._subs.get(topic)?.(msg)
      this.onMessage?.(msg)
    }
  }

  async subscribe(topic: string, handler?: (m: MQTTMessage) => void): Promise<boolean> {
    if (handler) this._subs.set(topic, handler)
    if (!this.client) return false
    const tb = new TextEncoder().encode(topic)
    const pkt = new Uint8Array([0x82, 2+2+tb.length, 0,1, tb.length>>8, tb.length&0xff])
    const full = new Uint8Array(pkt.length + tb.length)
    full.set(pkt); full.set(tb, pkt.length)
    this.client.send(full.buffer)
    return true
  }

  async publish(topic: string, payload: string, qos = 0, retain = false): Promise<boolean> {
    if (!this.client) return false
    const tb = new TextEncoder().encode(topic)
    const pb = new TextEncoder().encode(payload)
    const flags = 0x30 | (qos << 1) | (retain ? 1 : 0)
    const rem = 2 + tb.length + pb.length
    const pkt = new Uint8Array([flags, rem, tb.length>>8, tb.length&0xff])
    const full = new Uint8Array(4 + tb.length + pb.length)
    full.set(pkt); full.set(tb, 4); full.set(pb, 4+tb.length)
    this.client.send(full.buffer)
    this._msgs.push({ topic, payload, qos, retain, timestamp: Date.now() })
    return true
  }

  disconnect() {
    try { this.client?.send(new Uint8Array([0xe0,0]).buffer) } catch {}
    this.client?.close()
    this.client = null
    this._connected = false
  }
}

// --- HTTP REST Controller ---
export class HTTPController {
  private baseUrl: string
  private headers: Record<string, string> = {}

  constructor(baseUrl: string) { this.baseUrl = baseUrl.replace(/\/$/, '') }

  setHeader(key: string, value: string) { this.headers[key] = value }
  setAuth(token: string) { this.headers['Authorization'] = 'Bearer ' + token }

  private async req(method: string, path: string, body?: any): Promise<any> {
    const opts: RequestInit = { method, headers: { ...this.headers, 'Content-Type': 'application/json' } }
    if (body) opts.body = JSON.stringify(body)
    const r = await fetch(this.baseUrl + path, opts)
    const ct = r.headers.get('content-type') || ''
    if (ct.includes('json')) return r.json()
    return r.text()
  }

  get(path: string) { return this.req('GET', path) }
  post(path: string, body?: any) { return this.req('POST', path, body) }
  put(path: string, body?: any) { return this.req('PUT', path, body) }
  patch(path: string, body?: any) { return this.req('PATCH', path, body) }
  delete(path: string) { return this.req('DELETE', path) }
}

// --- WebSocket Controller ---
export class WSController {
  private ws: WebSocket | null = null
  private _handlers: Map<string, (d: any) => void> = new Map()
  private _reconnect = false
  private _url = ''
  get connected() { return this.ws?.readyState === WebSocket.OPEN }
  onMessage?: (d: any) => void

  async connect(url: string, reconnect = false): Promise<boolean> {
    this._url = url; this._reconnect = reconnect
    try {
      this.ws = new WebSocket(url)
      await new Promise<void>((res, rej) => {
        this.ws!.onopen = () => res()
        this.ws!.onerror = () => rej()
        setTimeout(rej, 5000)
      })
      this.ws!.onmessage = (e) => {
        try { const d = JSON.parse(e.data); this._handlers.get(d.type)?.(d); this.onMessage?.(d) } catch {}
      }
      this.ws!.onclose = () => { if (this._reconnect) setTimeout(() => this.connect(url, true), 3000) }
      return true
    } catch { return false }
  }

  send(data: any) { this.ws?.send(JSON.stringify(data)) }
  on(type: string, handler: (d: any) => void) { this._handlers.set(type, handler) }
  disconnect() { this._reconnect = false; this.ws?.close(); this.ws = null }
}

// --- Modbus TCP Controller ---
export class ModbusController {
  private sock: WebSocket | null = null
  private _tid = 0
  get connected() { return this.sock?.readyState === WebSocket.OPEN }

  async connect(host: string, port = 502): Promise<boolean> {
    try {
      const url = 'ws://' + host + ':' + port
      this.sock = new WebSocket(url)
      await new Promise<void>((res, rej) => {
        this.sock!.onopen = () => res()
        this.sock!.onerror = () => rej()
        setTimeout(rej, 5000)
      })
      return true
    } catch { return false }
  }

  private sendFC(fc: number, addr: number, count: number): Promise<number[]> {
    return new Promise((resolve) => {
      this._tid++
      const pkt = new Uint8Array([
        this._tid >> 8, this._tid & 0xff, 0, 0, 0, 6, 1, fc,
        addr >> 8, addr & 0xff, count >> 8, count & 0xff
      ])
      const handler = (e: MessageEvent) => {
        this.sock?.removeEventListener('message', handler)
        const resp = new Uint8Array(e.data)
        const values: number[] = []
        for (let i = 9; i < resp.length; i++) values.push(resp[i])
        resolve(values)
      }
      this.sock?.addEventListener('message', handler)
      this.sock?.send(pkt.buffer)
      setTimeout(() => { this.sock?.removeEventListener('message', handler); resolve([]) }, 3000)
    })
  }

  readCoils(addr: number, count: number) { return this.sendFC(1, addr, count) }
  readDiscrete(addr: number, count: number) { return this.sendFC(2, addr, count) }
  readInputRegisters(addr: number, count: number) { return this.sendFC(4, addr, count) }
  readHoldingRegisters(addr: number, count: number) { return this.sendFC(3, addr, count) }

  async writeCoil(addr: number, value: boolean): Promise<boolean> {
    this._tid++
    const pkt = new Uint8Array([
      this._tid >> 8, this._tid & 0xff, 0, 0, 0, 6, 1, 5,
      addr >> 8, addr & 0xff, value ? 0xff : 0, 0
    ])
    this.sock?.send(pkt.buffer)
    return true
  }

  async writeRegister(addr: number, value: number): Promise<boolean> {
    this._tid++
    const pkt = new Uint8Array([
      this._tid >> 8, this._tid & 0xff, 0, 0, 0, 6, 1, 6,
      addr >> 8, addr & 0xff, value >> 8, value & 0xff
    ])
    this.sock?.send(pkt.buffer)
    return true
  }

  disconnect() { this.sock?.close(); this.sock = null }
}

// --- Home Assistant Controller ---
export class HomeAssistantController {
  private api: HTTPController
  private _states: Map<string, any> = new Map()

  get states() { return Array.from(this._states.values()) }

  constructor(url: string, token: string) {
    this.api = new HTTPController(url)
    this.api.setAuth(token)
  }

  async getStates(): Promise<any[]> {
    const data = await this.api.get('/api/states')
    if (Array.isArray(data)) {
      this._states.clear()
      for (const s of data) this._states.set(s.entity_id, s)
    }
    return data
  }

  async callService(domain: string, service: string, data: any = {}): Promise<any> {
    return this.api.post('/api/services/' + domain + '/' + service, data)
  }

  async turnOn(entityId: string) {
    const [domain] = entityId.split('.')
    return this.callService(domain, 'turn_on', { entity_id: entityId })
  }

  async turnOff(entityId: string) {
    const [domain] = entityId.split('.')
    return this.callService(domain, 'turn_off', { entity_id: entityId })
  }

  async toggle(entityId: string) {
    const [domain] = entityId.split('.')
    return this.callService(domain, 'toggle', { entity_id: entityId })
  }

  async setLight(entityId: string, brightness?: number, colorTemp?: number, color?: string) {
    const data: any = { entity_id: entityId }
    if (brightness !== undefined) data.brightness = brightness
    if (colorTemp !== undefined) data.color_temp = colorTemp
    if (color) data.rgb_color = color
    return this.callService('light', 'turn_on', data)
  }

  async setClimate(entityId: string, temp: number, mode?: string) {
    const data: any = { entity_id: entityId, temperature: temp }
    if (mode) data.hvac_mode = mode
    return this.callService('climate', 'set_temperature', data)
  }

  async lockDoor(entityId: string) { return this.callService('lock', 'lock', { entity_id: entityId }) }
  async unlockDoor(entityId: string) { return this.callService('lock', 'unlock', { entity_id: entityId }) }

  async getHistory(entityId: string, start?: string): Promise<any[]> {
    const path = '/api/history/period/' + (start || '') + '?filter_entity_id=' + entityId
    return this.api.get(path)
  }
}

// --- Master IoT Controller ---
export class ZyraxonIoT {
  readonly mqtt = new MQTTController()
  readonly ws = new WSController()
  readonly modbus = new ModbusController()
  private _httpClients: Map<string, HTTPController> = new Map()
  private _haControllers: Map<string, HomeAssistantController> = new Map()

  createHTTP(id: string, url: string): HTTPController {
    const c = new HTTPController(url)
    this._httpClients.set(id, c)
    return c
  }

  createHA(id: string, url: string, token: string): HomeAssistantController {
    const c = new HomeAssistantController(url, token)
    this._haControllers.set(id, c)
    return c
  }

  getHTTP(id: string) { return this._httpClients.get(id) }
  getHA(id: string) { return this._haControllers.get(id) }

  disconnectAll() {
    this.mqtt.disconnect()
    this.ws.disconnect()
    this.modbus.disconnect()
  }
}