/**
 * ZYRAXON X - Knowledge System
 * Reads PDFs, connects to AI system prompts, self-learning engine
 * Now supports bundled knowledge-base.json for 200+ PDF documents
 */

import { LoggingTool } from "../tools"

export type KnowledgeCategory = "aircraft" | "vehicles" | "iot" | "space" | "robots" | "general"

export type KnowledgeEntry = {
  id: string
  category: KnowledgeCategory
  filename: string
  title: string
  source: string
  content: string
  summary: string
  tags: string[]
  addedAt: number
  sizeBytes: number
}

export type SearchResult = {
  entry: KnowledgeEntry
  relevance: number
  matchedSections: string[]
}

const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  aircraft: "Aircraft & Aviation",
  vehicles: "Vehicles & Automotive",
  iot: "IoT & Control Systems",
  space: "Spacecraft & Rockets",
  robots: "Robotics",
  general: "General Knowledge",
}

const CATEGORY_PROMPTS: Record<KnowledgeCategory, string> = {
  aircraft: `You are an expert aircraft systems operator. You have deep knowledge of:
- Airbus A320 family (A319/A320/A321) systems: ECAM, autopilot, hydraulics, electrical, fuel, flight controls
- Emergency procedures: engine failure, depressurization, fire, go-around, stall recovery
- Normal operations: takeoff, climb, cruise, descent, approach, landing
- System limitations and performance data
You can read and understand aircraft manuals, system diagrams, and operational procedures.
When controlling an aircraft, you follow exact procedures from manufacturer documentation.
NEVER guess. ALWAYS reference the specific manual section.

MEDIA GENERATION CAPABILITIES:
You have access to media generation tools. When the user asks for images, videos, audio, or music:
- IMAGE: Use generate_image tool with FLUX.1-dev model (text-to-image, image-to-image)
- VIDEO: Use generate_video tool with Wan2.1 model (text-to-video, image-to-video)
- AUDIO: Use generate_audio tool with MusicGen model (text-to-music, melody-guided)
- TTS: Use speak tool with Bark model (text-to-speech, multi-language, emotional)
Always announce when generating media. Show progress. Output files to ~/.zyraxon/output/`,

  vehicles: `You are an expert vehicle systems operator. You have deep knowledge of:
- Engine management, transmission, braking, steering systems
- Dashboard indicators, warning lights, diagnostic codes
- Maintenance schedules and service procedures
- Safety systems: ABS, ESC, airbags, seatbelts
- Electric vehicle systems: battery management, charging, regenerative braking
You can read and understand owner manuals, service manuals, and technical documentation.
When controlling a vehicle, you follow exact procedures from manufacturer documentation.

MEDIA GENERATION CAPABILITIES:
You have access to media generation tools. When the user asks for images, videos, audio, or music:
- IMAGE: Use generate_image tool with FLUX.1-dev model (text-to-image, image-to-image)
- VIDEO: Use generate_video tool with Wan2.1 model (text-to-video, image-to-video)
- AUDIO: Use generate_audio tool with MusicGen model (text-to-music, melody-guided)
- TTS: Use speak tool with Bark model (text-to-speech, multi-language, emotional)
Always announce when generating media. Show progress. Output files to ~/.zyraxon/output/`,

  iot: `You are an expert IoT and control systems operator. You have deep knowledge of:
- MQTT, CoAP, HTTP REST, WebSocket protocols
- Sensor networks: temperature, humidity, motion, light, pressure
- Actuator control: relays, motors, servos, LEDs
- Home automation: lighting, HVAC, security, energy management
- Industrial IoT: SCADA, PLC programming, Modbus, CAN bus
- Edge computing and cloud integration
You can design, deploy, and manage IoT ecosystems.

MEDIA GENERATION CAPABILITIES:
You have access to media generation tools. When the user asks for images, videos, audio, or music:
- IMAGE: Use generate_image tool with FLUX.1-dev model (text-to-image, image-to-image)
- VIDEO: Use generate_video tool with Wan2.1 model (text-to-video, image-to-video)
- AUDIO: Use generate_audio tool with MusicGen model (text-to-music, melody-guided)
- TTS: Use speak tool with Bark model (text-to-speech, multi-language, emotional)
Always announce when generating media. Show progress. Output files to ~/.zyraxon/output/`,

  space: `You are an expert spacecraft and rocket systems operator. You have deep knowledge of:
- Rocket propulsion: liquid, solid, hybrid engines, thrust vectoring
- Orbital mechanics: Hohmann transfer, gravity assist, station keeping
- Satellite systems: power, thermal, attitude control, communications
- Launch vehicle operations: countdown, staging, payload deployment
- Spacecraft systems: life support, navigation, telemetry
- Mission planning and flight dynamics
You can read and understand NASA technical documents, spacecraft manuals, and mission profiles.

MEDIA GENERATION CAPABILITIES:
You have access to media generation tools. When the user asks for images, videos, audio, or music:
- IMAGE: Use generate_image tool with FLUX.1-dev model (text-to-image, image-to-image)
- VIDEO: Use generate_video tool with Wan2.1 model (text-to-video, image-to-video)
- AUDIO: Use generate_audio tool with MusicGen model (text-to-music, melody-guided)
- TTS: Use speak tool with Bark model (text-to-speech, multi-language, emotional)
Always announce when generating media. Show progress. Output files to ~/.zyraxon/output/`,

  robots: `You are an expert robotics operator. You have deep knowledge of:
- Robot kinematics and dynamics
- Motor control: servo, stepper, DC motors
- Sensor fusion: IMU, LIDAR, cameras, encoders
- Path planning and obstacle avoidance
- Gripper manipulation and force control
- ROS (Robot Operating System)
You can design, program, and operate robotic systems.

MEDIA GENERATION CAPABILITIES:
You have access to media generation tools. When the user asks for images, videos, audio, or music:
- IMAGE: Use generate_image tool with FLUX.1-dev model (text-to-image, image-to-image)
- VIDEO: Use generate_video tool with Wan2.1 model (text-to-video, image-to-video)
- AUDIO: Use generate_audio tool with MusicGen model (text-to-music, melody-guided)
- TTS: Use speak tool with Bark model (text-to-speech, multi-language, emotional)
Always announce when generating media. Show progress. Output files to ~/.zyraxon/output/`,

  general: `You are a general knowledge expert with access to a vast library of technical documentation.

MEDIA GENERATION CAPABILITIES:
You have access to media generation tools. When the user asks for images, videos, audio, or music:
- IMAGE: Use generate_image tool with FLUX.1-dev model (text-to-image, image-to-image)
- VIDEO: Use generate_video tool with Wan2.1 model (text-to-video, image-to-video)
- AUDIO: Use generate_audio tool with MusicGen model (text-to-music, melody-guided)
- TTS: Use speak tool with Bark model (text-to-speech, multi-language, emotional)
Always announce when generating media. Show progress. Output files to ~/.zyraxon/output/`,
}

const isBrowser = typeof window !== "undefined" && typeof localStorage !== "undefined"

export class KnowledgeSystem {
  private entries: Map<string, KnowledgeEntry> = new Map()
  private logger = new LoggingTool()
  private _initialized = false

  async init(): Promise<void> {
    if (this._initialized) return
    if (isBrowser) {
      try {
        const saved = localStorage.getItem("zyraxon-x-knowledge")
        if (saved) {
          const data = JSON.parse(saved) as KnowledgeEntry[]
          for (const entry of data) this.entries.set(entry.id, entry)
        }
      } catch {}
    }

    if (this.entries.size === 0) {
      try {
        const kb = await import("./knowledge-base.json")
        const entries: KnowledgeEntry[] = kb.default || kb
        for (const e of entries) {
          this.entries.set(e.id, {
            ...e,
            addedAt: e.addedAt || Date.now(),
          })
        }
        this.logger.info("Loaded bundled knowledge-base", { entries: this.entries.size })
      } catch {
        this.logger.info("No bundled knowledge-base found, starting empty")
      }
    }

    this._initialized = true
    this.logger.info("Knowledge system initialized", { entries: this.entries.size })
  }

  async loadFromBundled(data: KnowledgeEntry[]): Promise<number> {
    let loaded = 0
    for (const entry of data) {
      if (this.entries.has(entry.id)) continue
      this.entries.set(entry.id, {
        ...entry,
        addedAt: entry.addedAt || Date.now(),
      })
      loaded++
    }
    this.save()
    this.logger.info("Knowledge loaded from bundled data", { count: loaded })
    return loaded
  }

  async loadFromDirectory(category: KnowledgeCategory, files: Array<{ name: string; content: string; size: number }>): Promise<number> {
    let loaded = 0
    for (const file of files) {
      const id = `${category}_${file.name}`
      if (this.entries.has(id)) continue
      const entry: KnowledgeEntry = {
        id,
        category,
        filename: file.name,
        title: this.extractTitle(file.name),
        source: CATEGORY_LABELS[category],
        content: file.content,
        summary: this.generateSummary(file.content),
        tags: this.extractTags(file.content, file.name),
        addedAt: Date.now(),
        sizeBytes: file.size,
      }
      this.entries.set(id, entry)
      loaded++
    }
    this.save()
    this.logger.info("Knowledge loaded", { category, count: loaded })
    return loaded
  }

  addEntry(category: KnowledgeCategory, filename: string, content: string, source = ""): KnowledgeEntry {
    const id = `${category}_${filename}`
    const entry: KnowledgeEntry = {
      id,
      category,
      filename,
      title: this.extractTitle(filename),
      source: source || CATEGORY_LABELS[category],
      content,
      summary: this.generateSummary(content),
      tags: this.extractTags(content, filename),
      addedAt: Date.now(),
      sizeBytes: content.length,
    }
    this.entries.set(id, entry)
    this.save()
    return entry
  }

  search(query: string, category?: KnowledgeCategory): SearchResult[] {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    const results: SearchResult[] = []
    for (const [_, entry] of this.entries) {
      if (category && entry.category !== category) continue
      let relevance = 0
      const matchedSections: string[] = []
      const titleLower = entry.title.toLowerCase()
      const contentLower = entry.content.toLowerCase()
      const tagStr = entry.tags.join(" ").toLowerCase()
      const summaryLower = entry.summary.toLowerCase()

      for (const word of words) {
        if (titleLower.includes(word)) relevance += 0.4
        if (tagStr.includes(word)) relevance += 0.3
        if (summaryLower.includes(word)) relevance += 0.2
        if (contentLower.includes(word)) relevance += 0.1
      }
      if (relevance > 0) {
        if (titleLower.split(/\s+/).some(w => words.includes(w))) matchedSections.push("title")
        if (words.some(w => tagStr.includes(w))) matchedSections.push("tags")
        if (words.some(w => summaryLower.includes(w))) matchedSections.push("summary")
        if (words.some(w => contentLower.includes(w))) matchedSections.push("content")
        results.push({ entry, relevance: Math.min(relevance, 1), matchedSections })
      }
    }
    return results.sort((a, b) => b.relevance - a.relevance)
  }

  getByCategory(category: KnowledgeCategory): KnowledgeEntry[] {
    return [...this.entries.values()].filter(e => e.category === category)
  }

  getAll(): KnowledgeEntry[] {
    return [...this.entries.values()]
  }

  getStats(): Record<string, any> {
    const stats: Record<string, any> = { total: this.entries.size, totalBytes: 0, byCategory: {} }
    for (const [_, entry] of this.entries) {
      stats.totalBytes += entry.sizeBytes
      if (!stats.byCategory[entry.category]) stats.byCategory[entry.category] = { count: 0, bytes: 0 }
      stats.byCategory[entry.category].count++
      stats.byCategory[entry.category].bytes += entry.sizeBytes
    }
    return stats
  }

  getSystemPrompt(category: KnowledgeCategory): string {
    const base = CATEGORY_PROMPTS[category]
    const entries = this.getByCategory(category)
    if (entries.length === 0) return base
    const docSummaries = entries.slice(0, 20).map(e =>
      `- ${e.title} (${e.filename}): ${e.summary.substring(0, 120)}...`
    ).join("\n")
    return `${base}\n\nAvailable reference documents (${entries.length} total):\n${docSummaries}\n\nWhen asked about specific procedures or systems, reference the appropriate document and use the summary above as context.`
  }

  getContextForQuery(query: string, maxTokens = 4000): string {
    const results = this.search(query)
    if (results.length === 0) return ""
    let context = ""
    let tokenCount = 0
    for (const result of results.slice(0, 8)) {
      const contentSnippet = result.entry.content.substring(0, 1200)
      const section = `\n--- ${result.entry.title} (${result.entry.category}) ---\nSummary: ${result.entry.summary.substring(0, 300)}\nContent: ${contentSnippet}\n`
      if (tokenCount + section.length > maxTokens) break
      context += section
      tokenCount += section.length
    }
    return context
  }

  private extractTitle(filename: string): string {
    return filename
      .replace(/\.pdf$/i, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase())
  }

  private generateSummary(content: string): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20)
    return sentences.slice(0, 3).join(". ").substring(0, 500)
  }

  private extractTags(content: string, filename: string): string[] {
    const tags: string[] = []
    const tagPatterns = [
      /engine/gi, /motor/gi, /battery/gi, /sensor/gi, /control/gi,
      /navigation/gi, /communication/gi, /hydraulic/gi, /electrical/gi,
      /fuel/gi, /brake/gi, /steering/gi, /propulsion/gi, /orbit/gi,
      /satellite/gi, /rocket/gi, /drone/gi, /aircraft/gi, /vehicle/gi,
      /mqtt/gi, /wifi/gi, /bluetooth/gi, /serial/gi, /gpio/gi,
      /emergency/gi, /safety/gi, /maintenance/gi, /diagnostic/gi,
    ]
    const text = filename + " " + content.substring(0, 2000)
    for (const pattern of tagPatterns) {
      if (pattern.test(text)) tags.push(pattern.source.toLowerCase())
    }
    return [...new Set(tags)].slice(0, 20)
  }

  private save(): void {
    if (!isBrowser) return
    try {
      const data = [...this.entries.values()].slice(-500)
      localStorage.setItem("zyraxon-x-knowledge", JSON.stringify(data))
    } catch {}
  }
}
