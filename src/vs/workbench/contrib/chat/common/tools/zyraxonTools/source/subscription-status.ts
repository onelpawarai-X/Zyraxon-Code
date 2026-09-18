import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const TIER_ORDER = ["free", "pro", "max", "ultra"] as const
type Tier = typeof TIER_ORDER[number]

interface SubState {
  tier: Tier
  activatedAt: number | null
  expiresAt: number | null
  secretCode: string | null
  stripeSessionId: string | null
}

interface SubStatusResult {
  ok: boolean
  data?: {
    tier: Tier
    toolAccess: string
    daysRemaining: number | null
    isPermanent: boolean
    activatedAt: string | null
    expiresAt: string | null
    maxAgents: string
    memoryAllocation: string
    features: string
  }
  error?: string
}

function readSubState(): SubState {
  const freeState: SubState = { tier: "free", activatedAt: null, expiresAt: null, secretCode: null, stripeSessionId: null }
  try {
    const filePath = join(homedir(), ".zyraxon", "subscription.json")
    if (!existsSync(filePath)) return freeState
    const data = JSON.parse(readFileSync(filePath, "utf-8"))
    if (data.expiresAt && Date.now() > data.expiresAt) return freeState
    if (TIER_ORDER.includes(data.tier)) return data as SubState
    return freeState
  } catch {
    return freeState
  }
}

const TIER_INFO: Record<Tier, { tools: string; agents: string; memory: string; features: string }> = {
  free: {
    tools: "56 (Core, Math, Science, Finance, Security, Daily Life, Memory, Documents, Tasks)",
    agents: "1",
    memory: "Basic (100 entries)",
    features: "File R/W, Shell, Web Search, Glob/Grep, Todo, Math, Science, Finance, Data Science, Security basics, Daily life, Memory, Documents, Skills, Tasks",
  },
  pro: {
    tools: "113 (All Free + Aviation, Ground Vehicles, Drones, Helicopters, ML, Ethics, Creativity)",
    agents: "3",
    memory: "Pro (500 entries)",
    features: "Everything in Free + Code Analysis, API Testing, Screen Vision, Self-Evolution, Aviation (25 tools), Ground Vehicles (18), Drones (21), Helicopters (20), ML/Safety (13), Common Sense AI (11), Creativity (5), Multi-Agent",
  },
  max: {
    tools: "370 (All Pro + Space, Medical, Industrial, Infrastructure, Security, Survey, Agriculture, Marine, Construction, IoT, Digital Twin, Dashboard, Remote Control, Decision Support)",
    agents: "8",
    memory: "Max (2000 entries)",
    features: "Everything in Pro + Space Systems (22), Medical (9), Industrial (15), Infrastructure (15), Security (15), Survey (14), Agriculture (15), Marine (15), Construction (15), Physical I/O (22), SDR (7), Digital Twin (5), Dashboard (5), Alerts (4), Data Logging (5), Remote Control (6), Maintenance (6), Decision (6), Auth (6), Extended AI (24), Site Creation, GitHub Integration",
  },
  ultra: {
    tools: "500+ (All Max + Ultra Tools, Singularity AI, Guardian System, Unlimited Everything)",
    agents: "Unlimited",
    memory: "Ultra (10000 entries)",
    features: "Everything in Max + Ultra Code Generator, Ultra Security, Ultra Performance, Ultra Refactoring, Ultra Test Gen, Ultra Auto-Deploy, Ultra Code Review, Ultra Quantum, Singularity AI (5), Guardian System (4), Custom Models, Priority Support, Early Access",
  },
}

export function execute(_args: any): SubStatusResult {
  const state = readSubState()
  const tier = state.tier
  const info = TIER_INFO[tier]

  let daysRemaining: number | null = null
  if (state.expiresAt) {
    const diff = state.expiresAt - Date.now()
    daysRemaining = Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)))
  }

  const isPermanent = tier !== "free" && state.expiresAt === null

  return {
    ok: true,
    data: {
      tier,
      toolAccess: info.tools,
      daysRemaining,
      isPermanent,
      activatedAt: state.activatedAt ? new Date(state.activatedAt).toISOString() : null,
      expiresAt: state.expiresAt ? new Date(state.expiresAt).toISOString() : null,
      maxAgents: info.agents,
      memoryAllocation: info.memory,
      features: info.features,
    },
  }
}
