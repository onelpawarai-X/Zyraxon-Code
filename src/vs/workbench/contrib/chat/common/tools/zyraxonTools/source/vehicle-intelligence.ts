/**
 * ZYRAXON X - Vehicle Intelligence
 * Knowledge-aware control for aircraft, vehicles, and IoT devices
 */

import { KnowledgeSystem } from "./knowledge/index"
import type { KnowledgeCategory } from "./knowledge/index"

export type ControlResult = {
  success: boolean
  action: string
  category: KnowledgeCategory
  procedureRef?: string
  contextUsed: string
  details: Record<string, any>
}

export type AircraftParams = {
  altitude?: number
  heading?: number
  speed?: number
  latitude?: number
  longitude?: number
  runway?: string
  reason?: string
}

export type VehicleParams = {
  speed?: number
  angle?: number
  direction?: "left" | "right" | "straight"
  intensity?: number
  target?: string
  reason?: string
}

export type IoTParams = {
  deviceId?: string
  deviceType?: string
  command?: string
  value?: any
  sensorType?: string
  actuatorType?: string
  pin?: number
  protocol?: string
}

export class VehicleIntelligence {
  private knowledge: KnowledgeSystem

  constructor(knowledge: KnowledgeSystem) {
    this.knowledge = knowledge
  }

  private findProcedure(category: KnowledgeCategory, keywords: string): string {
    const results = this.knowledge.search(keywords, category)
    if (results.length === 0) return ""
    const top = results[0]
    return `[Ref: ${top.entry.title}] ${top.entry.summary.substring(0, 300)}`
  }

  private getContextSnippet(category: KnowledgeCategory, keywords: string, maxLen = 500): string {
    const results = this.knowledge.search(keywords, category)
    if (results.length === 0) return "No relevant documentation found."
    return results.slice(0, 3).map(r =>
      `${r.entry.title}: ${r.entry.summary.substring(0, 150)}`
    ).join("\n")
  }

  async takeoff(params: AircraftParams): Promise<ControlResult> {
    const context = this.getContextSnippet("aircraft", "takeoff procedure climb engine thrust")
    const procedureRef = this.findProcedure("aircraft", "takeoff rotation speed V1 Vr V2")
    return {
      success: true,
      action: "takeoff",
      category: "aircraft",
      procedureRef,
      contextUsed: context,
      details: {
        altitude: params.altitude ?? 35000,
        heading: params.heading ?? 0,
        speed: params.speed ?? 150,
        message: "Initiating takeoff sequence with documented procedures",
      },
    }
  }

  async land(params: AircraftParams): Promise<ControlResult> {
    const context = this.getContextSnippet("aircraft", "landing approach descent ILS glideslope")
    const procedureRef = this.findProcedure("aircraft", "landing flare touchdown reverse thrust")
    return {
      success: true,
      action: "land",
      category: "aircraft",
      procedureRef,
      contextUsed: context,
      details: {
        runway: params.runway ?? "unknown",
        altitude: params.altitude ?? 0,
        speed: params.speed ?? 130,
        message: "Initiating landing sequence with documented procedures",
      },
    }
  }

  async navigate(params: AircraftParams): Promise<ControlResult> {
    const context = this.getContextSnippet("aircraft", "navigation waypoint route heading")
    const procedureRef = this.findProcedure("aircraft", "navigation GPS waypoint course")
    return {
      success: true,
      action: "navigate",
      category: "aircraft",
      procedureRef,
      contextUsed: context,
      details: {
        heading: params.heading ?? 0,
        latitude: params.latitude ?? 0,
        longitude: params.longitude ?? 0,
        altitude: params.altitude ?? 35000,
        message: "Setting navigation course with documented procedures",
      },
    }
  }

  async emergencyAction(params: AircraftParams): Promise<ControlResult> {
    const reason = params.reason ?? "unknown"
    const context = this.getContextSnippet("aircraft", `emergency ${reason} procedure`)
    const procedureRef = this.findProcedure("aircraft", `emergency ${reason} checklist`)
    return {
      success: true,
      action: "emergency",
      category: "aircraft",
      procedureRef,
      contextUsed: context,
      details: {
        reason,
        message: `Executing emergency procedure for: ${reason}`,
      },
    }
  }

  async startEngine(params: VehicleParams): Promise<ControlResult> {
    const context = this.getContextSnippet("vehicles", "engine start ignition ignition procedure")
    const procedureRef = this.findProcedure("vehicles", "engine start cold warm procedure")
    return {
      success: true,
      action: "startEngine",
      category: "vehicles",
      procedureRef,
      contextUsed: context,
      details: {
        message: "Starting engine with documented procedure",
      },
    }
  }

  async setSpeed(params: VehicleParams): Promise<ControlResult> {
    const context = this.getContextSnippet("vehicles", "speed acceleration cruise control")
    const procedureRef = this.findProcedure("vehicles", "speed control transmission gear")
    return {
      success: true,
      action: "setSpeed",
      category: "vehicles",
      procedureRef,
      contextUsed: context,
      details: {
        speed: params.speed ?? 0,
        message: `Setting speed to ${params.speed ?? 0} km/h`,
      },
    }
  }

  async steer(params: VehicleParams): Promise<ControlResult> {
    const context = this.getContextSnippet("vehicles", "steering turning direction wheel")
    const procedureRef = this.findProcedure("vehicles", "steering control turning")
    return {
      success: true,
      action: "steer",
      category: "vehicles",
      procedureRef,
      contextUsed: context,
      details: {
        direction: params.direction ?? "straight",
        angle: params.angle ?? 0,
        message: `Steering ${params.direction ?? "straight"}`,
      },
    }
  }

  async brake(params: VehicleParams): Promise<ControlResult> {
    const context = this.getContextSnippet("vehicles", "brake braking stopping ABS deceleration")
    const procedureRef = this.findProcedure("vehicles", "brake system stopping distance")
    return {
      success: true,
      action: "brake",
      category: "vehicles",
      procedureRef,
      contextUsed: context,
      details: {
        intensity: params.intensity ?? 50,
        message: `Applying brake at ${params.intensity ?? 50}% intensity`,
      },
    }
  }

  async activateDevice(params: IoTParams): Promise<ControlResult> {
    const context = this.getContextSnippet("iot", `activate ${params.deviceType ?? "device"} ${params.command ?? ""}`)
    const procedureRef = this.findProcedure("iot", `activate ${params.deviceType ?? "device"} control`)
    return {
      success: true,
      action: "activateDevice",
      category: "iot",
      procedureRef,
      contextUsed: context,
      details: {
        deviceId: params.deviceId ?? "unknown",
        deviceType: params.deviceType ?? "unknown",
        command: params.command ?? "on",
        protocol: params.protocol ?? "mqtt",
        message: `Activating device ${params.deviceId ?? "unknown"}`,
      },
    }
  }

  async readSensor(params: IoTParams): Promise<ControlResult> {
    const context = this.getContextSnippet("iot", `read ${params.sensorType ?? "sensor"} measurement data`)
    const procedureRef = this.findProcedure("iot", `sensor ${params.sensorType ?? "reading"} protocol`)
    return {
      success: true,
      action: "readSensor",
      category: "iot",
      procedureRef,
      contextUsed: context,
      details: {
        deviceId: params.deviceId ?? "unknown",
        sensorType: params.sensorType ?? "unknown",
        value: params.value ?? 0,
        message: `Reading ${params.sensorType ?? "sensor"} data`,
      },
    }
  }

  async setActuator(params: IoTParams): Promise<ControlResult> {
    const context = this.getContextSnippet("iot", `set ${params.actuatorType ?? "actuator"} control output`)
    const procedureRef = this.findProcedure("iot", `actuator ${params.actuatorType ?? "control"} pin`)
    return {
      success: true,
      action: "setActuator",
      category: "iot",
      procedureRef,
      contextUsed: context,
      details: {
        deviceId: params.deviceId ?? "unknown",
        actuatorType: params.actuatorType ?? "unknown",
        pin: params.pin ?? 0,
        value: params.value ?? 0,
        message: `Setting ${params.actuatorType ?? "actuator"} to ${params.value ?? 0}`,
      },
    }
  }
}
