/**
 * ZYRAXON X - Core Engine
 * Central orchestrator — self-contained, no external DB dependency
 */

import { ZyraxonVoice, ZyraxonTTS } from "./voice"
import type { VoiceResult } from "./voice"
import { ZyraxonPredict } from "./predict"
import { ZyraxonLearn } from "./learn"
import { ZyraxonHeal } from "./heal"
import { ZyraxonEvolve } from "./evolve"
import { ZyraxonGraph } from "./graph"
import { ZyraxonQuantum } from "./quantum"
import { ZyraxonMemory } from "./memory"
import { ZyraxonPhysical } from "./physical"
import { ZyraxonVehicles } from "./vehicles"
import { ZyraxonIoT } from "./iot"
import { ZyraxonBehavior } from "./behavior"
import { KnowledgeSystem } from "./knowledge/index"
import type { KnowledgeCategory } from "./knowledge/index"

export type XConfig = {
  name: string
  version: string
  autoLearn: boolean
  autoHeal: boolean
  autoEvolve: boolean
  physicalEnabled: boolean
}

const DEFAULT_CONFIG: XConfig = {
  name: "ZYRAXON X",
  version: "1.0.0",
  autoLearn: true,
  autoHeal: true,
  autoEvolve: true,
  physicalEnabled: false,
}

export class ZyraxonX {
  private config: XConfig
  private _ready = false

  readonly voice: ZyraxonVoice
  readonly tts: ZyraxonTTS
  readonly predict: ZyraxonPredict
  readonly learn: ZyraxonLearn
  readonly heal: ZyraxonHeal
  readonly evolve: ZyraxonEvolve
  readonly graph: ZyraxonGraph
  readonly quantum: ZyraxonQuantum
  readonly memory: ZyraxonMemory
  readonly physical: ZyraxonPhysical
  readonly vehicles: ZyraxonVehicles
  readonly iot: ZyraxonIoT
  readonly behavior: ZyraxonBehavior
  readonly knowledge: KnowledgeSystem

  onReady?: () => void
  onEvent?: (event: string, data: any) => void

  constructor(config?: Partial<XConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.voice = new ZyraxonVoice()
    this.tts = new ZyraxonTTS()
    this.predict = new ZyraxonPredict()
    this.learn = new ZyraxonLearn()
    this.heal = new ZyraxonHeal()
    this.evolve = new ZyraxonEvolve()
    this.graph = new ZyraxonGraph()
    this.quantum = new ZyraxonQuantum()
    this.memory = new ZyraxonMemory()
    this.physical = new ZyraxonPhysical()
    this.vehicles = new ZyraxonVehicles()
    this.iot = new ZyraxonIoT()
    this.behavior = new ZyraxonBehavior()
    this.knowledge = new KnowledgeSystem()
  }

  async init(): Promise<void> {
    if (this._ready) return
    this.memory.init()
    this.graph.init()
    await this.knowledge.init()
    this.behavior.startTick()
    if (this.config.autoLearn) this.learn.start(this)
    if (this.config.autoHeal) this.heal.start(this)
    this._ready = true
    this.onReady?.()
    this.emit("ready", { config: this.config, knowledgeStats: this.knowledge.getStats() })
  }

  get ready() { return this._ready }

  getKnowledgeContext(query: string): string {
    return this.knowledge.getContextForQuery(query)
  }

  private emit(event: string, data?: any) {
    this.onEvent?.(event, data)
  }

  async processInput(text: string, lang: string): Promise<string> {
    this.graph.addObservation("user_input", { text, lang })
    this.learn.observe("input", { text, lang })

    const knowledgeContext = this.knowledge.getContextForQuery(text)

    const prediction = this.predict.predictNext(text)
    if (prediction) this.emit("prediction", prediction)

    const context: Record<string, any> = {
      graph: this.graph,
      memory: this.memory,
      learn: this.learn,
    }
    if (knowledgeContext) {
      context.knowledgeContext = knowledgeContext
    }

    const response = await this.quantum.reason(text, context)
    this.graph.addObservation("response", { text: response })
    this.memory.store("last_response", response)
    return response
  }

  getStats() {
    return {
      version: this.config.version,
      ready: this._ready,
      voiceSupported: this.voice.isSupported(),
      memorySize: this.memory.size(),
      graphNodes: this.graph.nodeCount(),
      learningRate: this.learn.rate(),
      healEvents: this.heal.eventCount(),
      evolveStep: this.evolve.step(),
      knowledgeStats: this.knowledge.getStats(),
    }
  }

  async shutdown(): Promise<void> {
    this.voice.stop()
    this.heal.stop()
    this.learn.stop()
    this.behavior.stopTick()
    this.vehicles.disconnectAll()
    this.iot.disconnectAll()
    this._ready = false
  }
}
