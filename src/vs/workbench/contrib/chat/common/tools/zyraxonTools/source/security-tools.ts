type R = { ok: boolean; data?: any; error?: string }

export class SurveillanceSystem {
  private _cameras = new Map<string, { location: string; recording: boolean }>()
  private _motionDetections = new Map<string, { detected: boolean; zones: string[]; timestamp: number }>()

  addCamera(id: string, location: string): R {
    if (this._cameras.has(id)) return { ok: false, error: "Camera already exists" }
    this._cameras.set(id, { location, recording: false })
    return { ok: true, data: { id, location } }
  }

  getFeed(id: string): R {
    const cam = this._cameras.get(id)
    if (!cam) return { ok: false, error: "Camera not found" }
    return { ok: true, data: { id, location: cam.location, recording: cam.recording, status: "active", timestamp: Date.now() } }
  }

  detectMotion(cameraId: string): R {
    const cam = this._cameras.get(cameraId)
    if (!cam) return { ok: false, error: "Camera not found" }
    const detectionCount = this._motionDetections.size + 1
    const hasMotion = detectionCount % 2 === 0
    const zones = hasMotion ? ["zone-A", "zone-B"] : []
    this._motionDetections.set(cameraId, { detected: hasMotion, zones, timestamp: Date.now() })
    return { ok: true, data: { cameraId, detected: hasMotion, zones } }
  }

  getMotionZones(): R {
    const active: { cameraId: string; zones: string[] }[] = []
    this._motionDetections.forEach((d, id) => { if (d.detected) active.push({ cameraId: id, zones: d.zones }) })
    return { ok: true, data: { activeDetections: active } }
  }

  setRecording(cameraId: string, on: boolean): R {
    const cam = this._cameras.get(cameraId)
    if (!cam) return { ok: false, error: "Camera not found" }
    cam.recording = on
    return { ok: true, data: { cameraId, recording: on } }
  }

  getRecordingStatus(): R {
    const status: { id: string; location: string; recording: boolean }[] = []
    this._cameras.forEach((c, id) => status.push({ id, location: c.location, recording: c.recording }))
    return { ok: true, data: { cameras: status } }
  }
}

export class AccessControlSystem {
  private _entries = new Map<string, { type: string }>()
  private _access = new Map<string, Map<string, { expiresAt: number }>>()
  private _log: { personId: string; entryId: string; action: string; timestamp: number }[] = []

  addEntry(id: string, type: string): R {
    if (this._entries.has(id)) return { ok: false, error: "Entry already exists" }
    this._entries.set(id, { type })
    return { ok: true, data: { id, type } }
  }

  grantAccess(personId: string, entryId: string, duration: number): R {
    if (!this._entries.has(entryId)) return { ok: false, error: "Entry not found" }
    if (!this._access.has(personId)) this._access.set(personId, new Map())
    this._access.get(personId)!.set(entryId, { expiresAt: Date.now() + duration })
    this._log.push({ personId, entryId, action: "grant", timestamp: Date.now() })
    return { ok: true, data: { personId, entryId, expiresAt: Date.now() + duration } }
  }

  revokeAccess(personId: string, entryId: string): R {
    const personAccess = this._access.get(personId)
    if (!personAccess || !personAccess.has(entryId)) return { ok: false, error: "Access not found" }
    personAccess.delete(entryId)
    this._log.push({ personId, entryId, action: "revoke", timestamp: Date.now() })
    return { ok: true, data: { personId, entryId, revoked: true } }
  }

  checkAccess(personId: string, entryId: string): R {
    if (!this._entries.has(entryId)) return { ok: false, error: "Entry not found" }
    const personAccess = this._access.get(personId)
    if (!personAccess) return { ok: true, data: { granted: false } }
    const perm = personAccess.get(entryId)
    if (!perm) return { ok: true, data: { granted: false } }
    const valid = Date.now() < perm.expiresAt
    if (!valid) personAccess.delete(entryId)
    this._log.push({ personId, entryId, action: valid ? "access" : "denied", timestamp: Date.now() })
    return { ok: true, data: { granted: valid, expiresAt: perm.expiresAt } }
  }

  getLog(): R {
    return { ok: true, data: { entries: this._log } }
  }
}

export class IntrusionDetector {
  private _zones = new Map<string, { type: string; coordinates: number[]; armed: boolean }>()
  private _alerts: { zoneId: string; type: string; timestamp: number }[] = []

  setZone(id: string, type: string, coordinates: number[]): R {
    this._zones.set(id, { type, coordinates, armed: false })
    return { ok: true, data: { id, type, coordinates } }
  }

  armZone(id: string): R {
    const zone = this._zones.get(id)
    if (!zone) return { ok: false, error: "Zone not found" }
    zone.armed = true
    return { ok: true, data: { id, armed: true } }
  }

  disarmZone(id: string): R {
    const zone = this._zones.get(id)
    if (!zone) return { ok: false, error: "Zone not found" }
    zone.armed = false
    return { ok: true, data: { id, armed: false } }
  }

  getAlerts(): R {
    return { ok: true, data: { alerts: this._alerts } }
  }

  checkBreach(zoneId: string, sensorData: number): R {
    const zone = this._zones.get(zoneId)
    if (!zone) return { ok: false, error: "Zone not found" }
    if (!zone.armed) return { ok: true, data: { breach: false, reason: "zone disarmed" } }
    const breached = sensorData > 75
    if (breached) this._alerts.push({ zoneId, type: "breach", timestamp: Date.now() })
    return { ok: true, data: { breach: breached, sensorData, zoneId } }
  }

  getZoneStatus(id: string): R {
    const zone = this._zones.get(id)
    if (!zone) return { ok: false, error: "Zone not found" }
    return { ok: true, data: { id, type: zone.type, armed: zone.armed, coordinates: zone.coordinates } }
  }
}

export class CyberSecurityMonitor {
  private _hosts = new Map<string, { ip: string; status: string }>()
  private _threats: { hostId: string; type: string; severity: string; timestamp: number }[] = []
  private _blocked = new Set<string>()

  addHost(id: string, ip: string): R {
    if (this._blocked.has(ip)) return { ok: false, error: "IP is blocked" }
    this._hosts.set(id, { ip, status: "online" })
    return { ok: true, data: { id, ip } }
  }

  detectPortScan(hostId: string): R {
    const host = this._hosts.get(hostId)
    if (!host) return { ok: false, error: "Host not found" }
    const detected = this._threats.length % 3 === 0
    if (detected) this._threats.push({ hostId, type: "port-scan", severity: "medium", timestamp: Date.now() })
    return { ok: true, data: { hostId, detected } }
  }

  detectBruteForce(hostId: string): R {
    const host = this._hosts.get(hostId)
    if (!host) return { ok: false, error: "Host not found" }
    const detected = this._threats.length % 4 === 0
    if (detected) this._threats.push({ hostId, type: "brute-force", severity: "high", timestamp: Date.now() })
    return { ok: true, data: { hostId, detected } }
  }

  getThreats(): R {
    return { ok: true, data: { threats: this._threats } }
  }

  blockIP(ip: string): R {
    this._blocked.add(ip)
    this._hosts.forEach((h, id) => { if (h.ip === ip) { h.status = "blocked"; this._hosts.delete(id) } })
    return { ok: true, data: { ip, blocked: true } }
  }

  getFirewallStatus(): R {
    return { ok: true, data: { blockedIPs: Array.from(this._blocked), totalBlocked: this._blocked.size } }
  }
}

export class EncryptionEngine {
  private _keys = new Map<string, { algorithm: string; size: number; exported: string }>()

  async encrypt(data: string, algorithm: string): Promise<R> {
    try {
      const enc = new TextEncoder().encode(data)
      const key = await crypto.subtle.generateKey({ name: algorithm === "AES-GCM" ? "AES-GCM" : "AES-CBC", length: 256 }, true, ["encrypt", "decrypt"])
      const iv = crypto.getRandomValues(new Uint8Array(16))
      const encrypted = await crypto.subtle.encrypt({ name: algorithm === "AES-GCM" ? "AES-GCM" : "AES-CBC", iv }, key, enc)
      const raw = await crypto.subtle.exportKey("raw", key)
      return { ok: true, data: { ciphertext: Array.from(new Uint8Array(encrypted)), iv: Array.from(iv), key: Array.from(new Uint8Array(raw)) } }
    } catch (e: any) { return { ok: false, error: e.message } }
  }

  async decrypt(ciphertext: number[], key: number[], algorithm: string): Promise<R> {
    try {
      const iv = new Uint8Array(16)
      const cryptoKey = await crypto.subtle.importKey("raw", new Uint8Array(key), { name: algorithm === "AES-GCM" ? "AES-GCM" : "AES-CBC", length: 256 }, false, ["decrypt"])
      const decrypted = await crypto.subtle.decrypt({ name: algorithm === "AES-GCM" ? "AES-GCM" : "AES-CBC", iv }, cryptoKey, new Uint8Array(ciphertext))
      return { ok: true, data: { plaintext: new TextDecoder().decode(decrypted) } }
    } catch (e: any) { return { ok: false, error: e.message } }
  }

  async generateKey(algorithm: string, size: number): Promise<R> {
    try {
      const key = await crypto.subtle.generateKey({ name: algorithm === "AES-GCM" ? "AES-GCM" : "AES-CBC", length: size }, true, ["encrypt", "decrypt"])
      const raw = await crypto.subtle.exportKey("raw", key)
      const id = `key-${Date.now()}`
      this._keys.set(id, { algorithm, size, exported: Array.from(new Uint8Array(raw)).join(",") })
      return { ok: true, data: { id, algorithm, size } }
    } catch (e: any) { return { ok: false, error: e.message } }
  }

  async hash(data: string, algorithm: string = "SHA-256"): Promise<R> {
    try {
      const enc = new TextEncoder().encode(data)
      const hashBuffer = await crypto.subtle.hash(algorithm, enc)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
      return { ok: true, data: { hash: hashHex, algorithm } }
    } catch (e: any) { return { ok: false, error: e.message } }
  }

  async verifyHash(data: string, hash: string, algorithm: string = "SHA-256"): Promise<R> {
    try {
      const result = await this.hash(data, algorithm)
      if (!result.ok) return result
      return { ok: true, data: { match: result.data.hash === hash } }
    } catch (e: any) { return { ok: false, error: e.message } }
  }
}
