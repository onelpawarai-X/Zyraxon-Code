/**
 * ZYRAXON X - Reality Bridge
 * Connects physical world to digital world
 * IoT, Smart Home, Smart Car, Smart City, Robotics
 */

type IoTDevice = {
  id: string
  name: string
  type: "light" | "ac" | "heater" | "fan" | "lock" | "camera" | "speaker" | "thermostat" | "sensor" | "custom"
  protocol: "mqtt" | "http" | "bluetooth" | "zigbee" | "zwave" | "wifi" | "serial"
  state: Record<string, any>
  capabilities: string[]
  location: string
  lastSeen: number
}

type AutomationRule = {
  id: string
  name: string
  trigger: { type: string; value: any }
  conditions: { type: string; value: any }[]
  actions: { type: string; params: any }[]
  enabled: boolean
}

type Scene = {
  id: string
  name: string
  devices: { deviceId: string; state: Record<string, any> }[]
}

export class RealityBridge {
  private devices: Map<string, IoTDevice> = new Map()
  private rules: Map<string, AutomationRule> = new Map()
  private scenes: Map<string, Scene> = new Map()
  private eventLog: { event: string; data: any; timestamp: number }[] = []

  registerDevice(device: IoTDevice) {
    this.devices.set(device.id, device)
    this.log("device_registered", { id: device.id, name: device.name, type: device.type })
  }

  removeDevice(id: string) {
    this.devices.delete(id)
    this.log("device_removed", { id })
  }

  async controlDevice(deviceId: string, command: string, params?: Record<string, any>): Promise<{ success: boolean; state: Record<string, any> }> {
    const device = this.devices.get(deviceId)
    if (!device) return { success: false, state: {} }

    const newState = { ...device.state }
    switch (command) {
      case "on": newState.power = true; break
      case "off": newState.power = false; break
      case "set": Object.assign(newState, params); break
      case "toggle": newState.power = !newState.power; break
      case "brighten": newState.brightness = Math.min(100, (newState.brightness || 50) + 10); break
      case "dim": newState.brightness = Math.max(0, (newState.brightness || 50) - 10); break
      case "lock": newState.locked = true; break
      case "unlock": newState.locked = false; break
    }

    device.state = newState
    device.lastSeen = Date.now()
    this.log("device_controlled", { id: deviceId, command, params, newState })
    return { success: true, state: newState }
  }

  async getState(deviceId: string): Promise<Record<string, any> | null> {
    return this.devices.get(deviceId)?.state ?? null
  }

  async getDeviceStates(): Promise<Record<string, Record<string, any>>> {
    const states: Record<string, Record<string, any>> = {}
    for (const [id, device] of this.devices) {
      states[id] = { ...device.state, type: device.type, name: device.name, location: device.location }
    }
    return states
  }

  createScene(scene: Scene) {
    this.scenes.set(scene.id, scene)
    this.log("scene_created", { id: scene.id, name: scene.name })
  }

  async activateScene(sceneId: string): Promise<{ success: boolean; activated: string[] }> {
    const scene = this.scenes.get(sceneId)
    if (!scene) return { success: false, activated: [] }

    const activated: string[] = []
    for (const entry of scene.devices) {
      const result = await this.controlDevice(entry.deviceId, "set", entry.state)
      if (result.success) activated.push(entry.deviceId)
    }
    this.log("scene_activated", { id: sceneId, activated })
    return { success: true, activated }
  }

  createRule(rule: AutomationRule) {
    this.rules.set(rule.id, rule)
    this.log("rule_created", { id: rule.id, name: rule.name })
  }

  enableRule(id: string, enabled: boolean) {
    const rule = this.rules.get(id)
    if (rule) rule.enabled = enabled
  }

  getRules(): AutomationRule[] { return Array.from(this.rules.values()) }
  getScenes(): Scene[] { return Array.from(this.scenes.values()) }
  getDevices(): IoTDevice[] { return Array.from(this.devices.values()) }
  getEventLog(count = 50) { return this.eventLog.slice(-count) }

  private log(event: string, data: any) {
    this.eventLog.push({ event, data, timestamp: Date.now() })
    if (this.eventLog.length > 1000) this.eventLog.shift()
  }
}
