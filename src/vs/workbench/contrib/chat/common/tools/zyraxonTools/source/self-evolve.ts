/**
 * ZYRAXON X - Self-Evolving Codebase
 * Codebase that learns, adapts, and improves itself
 * Pattern detection, auto-refactoring, predictive optimization
 */

type CodePattern = {
  id: string
  type: "function" | "class" | "module" | "api" | "test"
  name: string
  frequency: number
  lastSeen: number
  complexity: number
  quality: number
}

type RefactorSuggestion = {
  id: string
  type: "extract" | "rename" | "simplify" | "optimize" | "restructure"
  target: string
  description: string
  impact: "low" | "medium" | "high"
  confidence: number
  autoApplyable: boolean
}

type EvolutionMetric = {
  timestamp: number
  codeQuality: number
  complexity: number
  testCoverage: number
  performance: number
  maintainability: number
}

export class SelfEvolvingCodebase {
  private patterns: Map<string, CodePattern> = new Map()
  private suggestions: RefactorSuggestion[] = []
  private metrics: EvolutionMetric[] = []
  private rules: { pattern: RegExp; action: string; priority: number }[] = []

  constructor() {
    this.initDefaultRules()
  }

  private initDefaultRules() {
    this.rules = [
      { pattern: /function\s+\w+\s*\([^)]*\)\s*{[\s\S]{200,}}/g, action: "extract_long_function", priority: 3 },
      { pattern: /console\.(log|warn|error)/g, action: "remove_console", priority: 2 },
      { pattern: /var\s+/g, action: "convert_to_const_let", priority: 1 },
      { pattern: /===?\s*undefined/g, action: "use_optional_chaining", priority: 1 },
      { pattern: /catch\s*\(\s*\w+\s*\)\s*{\s*}/g, action: "add_error_handling", priority: 4 },
      { pattern: /setTimeout\s*\(\s*function/g, action: "convert_to_arrow", priority: 1 },
    ]
  }

  analyzeCode(code: string, filePath: string): CodePattern[] {
    const found: CodePattern[] = []

    const functionMatches = code.match(/function\s+(\w+)/g) || []
    for (const match of functionMatches) {
      const name = match.replace("function ", "")
      const pattern: CodePattern = {
        id: `func_${name}_${filePath}`,
        type: "function",
        name,
        frequency: 1,
        lastSeen: Date.now(),
        complexity: this.estimateComplexity(code, name),
        quality: this.estimateQuality(code, name),
      }
      const existing = this.patterns.get(pattern.id)
      if (existing) {
        existing.frequency++
        existing.lastSeen = Date.now()
        found.push(existing)
      } else {
        this.patterns.set(pattern.id, pattern)
        found.push(pattern)
      }
    }

    return found
  }

  private estimateComplexity(code: string, name: string): number {
    const funcRegex = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*{([\\s\\S]*?)}`, "g")
    const match = funcRegex.exec(code)
    if (!match) return 0
    const body = match[1]
    let complexity = 1
    complexity += (body.match(/if\s*\(/g) || []).length
    complexity += (body.match(/for\s*\(/g) || []).length
    complexity += (body.match(/while\s*\(/g) || []).length
    complexity += (body.match(/switch\s*\(/g) || []).length
    complexity += (body.match(/catch\s*\(/g) || []).length
    return complexity
  }

  private estimateQuality(code: string, name: string): number {
    let quality = 100
    const funcRegex = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*{([\\s\\S]*?)}`, "g")
    const match = funcRegex.exec(code)
    if (!match) return 50
    const body = match[1]
    if (body.length > 500) quality -= 20
    if (body.length > 1000) quality -= 30
    if (!body.includes("return")) quality -= 10
    const commentRatio = (body.match(/\/\//g) || []).length / Math.max(body.split("\n").length, 1)
    if (commentRatio < 0.1) quality -= 10
    return Math.max(0, Math.min(100, quality))
  }

  generateSuggestions(code: string, filePath: string): RefactorSuggestion[] {
    const suggestions: RefactorSuggestion[] = []

    for (const rule of this.rules) {
      const matches = code.match(rule.pattern)
      if (matches && matches.length > 0) {
        suggestions.push({
          id: `sug_${Date.now()}_${rule.priority}_${matches.length}`,
          type: this.mapActionToType(rule.action),
          target: filePath,
          description: `${rule.action}: Found ${matches.length} occurrences`,
          impact: rule.priority >= 3 ? "high" : rule.priority >= 2 ? "medium" : "low",
          confidence: Math.min(0.9, 0.5 + rule.priority * 0.1),
          autoApplyable: rule.priority <= 1,
        })
      }
    }

    this.suggestions.push(...suggestions)
    return suggestions
  }

  private mapActionToType(action: string): RefactorSuggestion["type"] {
    if (action.includes("extract")) return "extract"
    if (action.includes("rename") || action.includes("convert")) return "rename"
    if (action.includes("simplify") || action.includes("remove")) return "simplify"
    if (action.includes("optimize")) return "optimize"
    return "restructure"
  }

  recordMetric(metric: EvolutionMetric) {
    this.metrics.push(metric)
    if (this.metrics.length > 1000) this.metrics.shift()
  }

  getEvolutionTrend(): { direction: "improving" | "declining" | "stable"; changeRate: number } {
    if (this.metrics.length < 2) return { direction: "stable", changeRate: 0 }
    const recent = this.metrics.slice(-10)
    const first = recent[0]
    const last = recent[recent.length - 1]
    const change = last.codeQuality - first.codeQuality
    return {
      direction: change > 5 ? "improving" : change < -5 ? "declining" : "stable",
      changeRate: change,
    }
  }

  getPatterns(): CodePattern[] { return Array.from(this.patterns.values()) }
  getSuggestions(): RefactorSuggestion[] { return this.suggestions }
  getMetrics(): EvolutionMetric[] { return this.metrics }
}
