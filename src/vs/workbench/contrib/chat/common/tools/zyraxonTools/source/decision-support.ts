type R = { ok: boolean; data?: any; error?: string };

class DecisionEngine {
  _options: Map<string, { id: string; name: string; pros: string[]; cons: string[]; weight: number; score?: number }>;
  _constraints: Map<string, (option: any) => boolean>;

  constructor() {
    this._options = new Map();
    this._constraints = new Map();
  }

  addOption(id: string, name: string, pros: string[], cons: string[], weight: number): R {
    if (this._options.has(id)) return { ok: false, error: "Option already exists" };
    this._options.set(id, { id, name, pros, cons, weight, score: 0 });
    return { ok: true, data: { id, name } };
  }

  evaluate(options?: string[]): R {
    const ids = options || Array.from(this._options.keys());
    const results: Record<string, number> = {};
    for (const id of ids) {
      const opt = this._options.get(id);
      if (!opt) continue;
      let score = 0;
      score += opt.pros.length * 10;
      score -= opt.cons.length * 5;
      score *= opt.weight;
      for (const [, fn] of this._constraints) {
        if (!fn(opt)) score -= 20;
      }
      opt.score = score;
      results[id] = score;
    }
    return { ok: true, data: results };
  }

  getScore(optionId: string): R {
    const opt = this._options.get(optionId);
    if (!opt) return { ok: false, error: "Option not found" };
    return { ok: true, data: { optionId, score: opt.score || 0 } };
  }

  getBestOption(): R {
    let best: any = null;
    let bestScore = -Infinity;
    for (const [, opt] of this._options) {
      if ((opt.score || 0) > bestScore) {
        bestScore = opt.score || 0;
        best = opt;
      }
    }
    if (!best) return { ok: false, error: "No options evaluated" };
    return { ok: true, data: { id: best.id, name: best.name, score: bestScore } };
  }

  addConstraint(id: string, fn: (option: any) => boolean): R {
    this._constraints.set(id, fn);
    return { ok: true, data: { id } };
  }

  getViolations(): R {
    const violations: string[] = [];
    for (const [id, opt] of this._options) {
      for (const [, fn] of this._constraints) {
        if (!fn(opt)) violations.push(id);
      }
    }
    return { ok: true, data: violations };
  }
}

class ScenarioAnalyzer {
  _scenarios: Map<string, { id: string; variables: Map<string, number>; events: string[] }>;
  _results: Map<string, { outcomes: number[]; average: number; stdDev: number }>;

  constructor() {
    this._scenarios = new Map();
    this._results = new Map();
  }

  createScenario(id: string, variables: Record<string, number>, events: string[]): R {
    if (this._scenarios.has(id)) return { ok: false, error: "Scenario exists" };
    const vars = new Map(Object.entries(variables));
    this._scenarios.set(id, { id, variables: vars, events });
    return { ok: true, data: { id } };
  }

  simulate(scenarioId: string, duration: number): R {
    const scenario = this._scenarios.get(scenarioId);
    if (!scenario) return { ok: false, error: "Scenario not found" };
    const outcomes: number[] = [];
    for (let t = 0; t < duration; t++) {
      let val = 0;
      for (const [, v] of scenario.variables) val += v * (1 + Math.sin(t * 0.1));
      if (scenario.events.length > 0) val += scenario.events.length * 5;
      outcomes.push(val);
    }
    const avg = outcomes.reduce((a, b) => a + b, 0) / outcomes.length;
    const variance = outcomes.reduce((a, b) => a + (b - avg) ** 2, 0) / outcomes.length;
    const stdDev = Math.sqrt(variance);
    this._results.set(scenarioId, { outcomes, average: avg, stdDev });
    return { ok: true, data: { average: avg, stdDev, dataPoints: outcomes.length } };
  }

  compareScenarios(ids: string[]): R {
    const comparison: Record<string, any> = {};
    for (const id of ids) {
      const result = this._results.get(id);
      if (result) comparison[id] = { average: result.average, stdDev: result.stdDev };
    }
    return { ok: true, data: comparison };
  }

  getOutcome(scenarioId: string): R {
    const result = this._results.get(scenarioId);
    if (!result) return { ok: false, error: "No simulation results" };
    return { ok: true, data: result };
  }

  addVariable(scenarioId: string, variable: { name: string; value: number }): R {
    const scenario = this._scenarios.get(scenarioId);
    if (!scenario) return { ok: false, error: "Scenario not found" };
    scenario.variables.set(variable.name, variable.value);
    return { ok: true, data: { name: variable.name, value: variable.value } };
  }

  monteCarlo(scenarioId: string, iterations: number): R {
    const scenario = this._scenarios.get(scenarioId);
    if (!scenario) return { ok: false, error: "Scenario not found" };
    const samples: number[] = [];
    for (let i = 0; i < iterations; i++) {
      let val = 0;
      for (const [, v] of scenario.variables) {
        val += v * (0.5 + ((i * 0.618) % 1));
      }
      samples.push(val);
    }
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const sorted = [...samples].sort((a, b) => a - b);
    const p5 = sorted[Math.floor(iterations * 0.05)];
    const p95 = sorted[Math.floor(iterations * 0.95)];
    return { ok: true, data: { average: avg, p5, p95, iterations } };
  }
}

class RiskAssessor {
  _risks: Map<string, { id: string; probability: number; impact: number; category: string; score: number }>;

  constructor() {
    this._risks = new Map();
  }

  addRisk(id: string, probability: number, impact: number, category: string): R {
    if (this._risks.has(id)) return { ok: false, error: "Risk exists" };
    const score = probability * impact;
    this._risks.set(id, { id, probability, impact, category, score });
    return { ok: true, data: { id, score } };
  }

  calculateRiskScore(riskId: string): R {
    const risk = this._risks.get(riskId);
    if (!risk) return { ok: false, error: "Risk not found" };
    risk.score = risk.probability * risk.impact;
    return { ok: true, data: { id: riskId, score: risk.score } };
  }

  getMitigation(riskId: string): R {
    const risk = this._risks.get(riskId);
    if (!risk) return { ok: false, error: "Risk not found" };
    const mitigations: string[] = [];
    if (risk.probability > 0.7) mitigations.push("Reduce probability through controls");
    if (risk.impact > 7) mitigations.push("Implement impact reduction measures");
    if (risk.score > 15) mitigations.push("Immediate escalation required");
    if (risk.category === "financial") mitigations.push("Add insurance coverage");
    if (risk.category === "technical") mitigations.push("Implement redundancy");
    return { ok: true, data: { riskId, mitigations } };
  }

  getOverallRisk(): R {
    let totalScore = 0;
    let count = 0;
    for (const [, risk] of this._risks) {
      totalScore += risk.score;
      count++;
    }
    const average = count > 0 ? totalScore / count : 0;
    const max = Math.max(...Array.from(this._risks.values()).map(r => r.score), 0);
    return { ok: true, data: { totalScore, average, max, riskCount: count } };
  }

  updateProbability(riskId: string, p: number): R {
    const risk = this._risks.get(riskId);
    if (!risk) return { ok: false, error: "Risk not found" };
    risk.probability = Math.max(0, Math.min(1, p));
    risk.score = risk.probability * risk.impact;
    return { ok: true, data: { id: riskId, probability: risk.probability, score: risk.score } };
  }

  updateImpact(riskId: string, i: number): R {
    const risk = this._risks.get(riskId);
    if (!risk) return { ok: false, error: "Risk not found" };
    risk.impact = Math.max(0, Math.min(10, i));
    risk.score = risk.probability * risk.impact;
    return { ok: true, data: { id: riskId, impact: risk.impact, score: risk.score } };
  }
}

class TradeoffAnalyzer {
  _tradeoffs: Map<string, { id: string; options: string[]; criteria: string[]; scores: Map<string, Map<string, number>> }>;
  _criteria: Map<string, { id: string; weight: number }>;

  constructor() {
    this._tradeoffs = new Map();
    this._criteria = new Map();
  }

  addTradeoff(id: string, options: string[], criteria: string[]): R {
    if (this._tradeoffs.has(id)) return { ok: false, error: "Tradeoff exists" };
    const scores = new Map<string, Map<string, number>>();
    for (const opt of options) scores.set(opt, new Map());
    this._tradeoffs.set(id, { id, options, criteria, scores });
    return { ok: true, data: { id, options, criteria } };
  }

  score(optionId: string, criteriaId: string, score: number): R {
    for (const [, tradeoff] of this._tradeoffs) {
      if (tradeoff.options.includes(optionId) && tradeoff.criteria.includes(criteriaId)) {
        const optScores = tradeoff.scores.get(optionId)!;
        optScores.set(criteriaId, score);
        return { ok: true, data: { optionId, criteriaId, score } };
      }
    }
    return { ok: false, error: "Option or criteria not found in any tradeoff" };
  }

  getBestTradeoff(): R {
    let bestTradeoff: any = null;
    let bestScore = -Infinity;
    for (const [, tradeoff] of this._tradeoffs) {
      for (const opt of tradeoff.options) {
        let total = 0;
        let hasScores = false;
        const optScores = tradeoff.scores.get(opt);
        if (!optScores) continue;
        for (const [critId, s] of optScores) {
          const crit = this._criteria.get(critId);
          total += s * (crit ? crit.weight : 1);
          hasScores = true;
        }
        if (hasScores && total > bestScore) {
          bestScore = total;
          bestTradeoff = { tradeoffId: tradeoff.id, option: opt, totalScore: total };
        }
      }
    }
    return bestTradeoff ? { ok: true, data: bestTradeoff } : { ok: false, error: "No scored tradeoffs" };
  }

  getWeightedScore(optionId: string): R {
    for (const [, tradeoff] of this._tradeoffs) {
      if (!tradeoff.options.includes(optionId)) continue;
      const optScores = tradeoff.scores.get(optionId);
      if (!optScores) continue;
      let total = 0;
      let weightSum = 0;
      for (const [critId, s] of optScores) {
        const crit = this._criteria.get(critId);
        const w = crit ? crit.weight : 1;
        total += s * w;
        weightSum += w;
      }
      return { ok: true, data: { optionId, weightedScore: total, weightSum } };
    }
    return { ok: false, error: "Option not found" };
  }

  normalizeScores(): R {
    for (const [, tradeoff] of this._tradeoffs) {
      for (const critId of tradeoff.criteria) {
        let min = Infinity;
        let max = -Infinity;
        for (const [, optScores] of tradeoff.scores) {
          const s = optScores.get(critId);
          if (s !== undefined) {
            min = Math.min(min, s);
            max = Math.max(max, s);
          }
        }
        const range = max - min;
        for (const [, optScores] of tradeoff.scores) {
          const s = optScores.get(critId);
          if (s !== undefined && range > 0) {
            optScores.set(critId, (s - min) / range);
          }
        }
      }
    }
    return { ok: true, data: "Scores normalized" };
  }

  addCriteria(id: string, weight: number): R {
    this._criteria.set(id, { id, weight });
    return { ok: true, data: { id, weight } };
  }
}

class DecisionTree {
  _trees: Map<string, { id: string; nodes: Map<string, { id: string; parentId: string | null; condition: string | null; outcome: string | null; children: string[] }> }>;

  constructor() {
    this._trees = new Map();
  }

  createTree(id: string, root: { condition: string; outcome: string }): R {
    if (this._trees.has(id)) return { ok: false, error: "Tree exists" };
    const rootNode = { id: `${id}_root`, parentId: null, condition: root.condition, outcome: root.outcome, children: [] };
    const nodes = new Map<string, any>();
    nodes.set(rootNode.id, rootNode);
    this._trees.set(id, { id, nodes });
    return { ok: true, data: { id, rootId: rootNode.id } };
  }

  addNode(treeId: string, parentId: string, condition: string, outcome: string): R {
    const tree = this._trees.get(treeId);
    if (!tree) return { ok: false, error: "Tree not found" };
    const parent = tree.nodes.get(parentId);
    if (!parent) return { ok: false, error: "Parent not found" };
    const nodeId = `${treeId}_${tree.nodes.size}`;
    const node = { id: nodeId, parentId, condition, outcome, children: [] };
    tree.nodes.set(nodeId, node);
    parent.children.push(nodeId);
    return { ok: true, data: { nodeId, parentId } };
  }

  evaluate(treeId: string, inputs: Record<string, any>): R {
    const tree = this._trees.get(treeId);
    if (!tree) return { ok: false, error: "Tree not found" };
    const rootId = `${treeId}_root`;
    let current = tree.nodes.get(rootId);
    if (!current) return { ok: false, error: "Root not found" };
    const path: string[] = [current.id];
    while (current && current.children.length > 0) {
      let next: any = null;
      for (const childId of current.children) {
        const child = tree.nodes.get(childId);
        if (!child) continue;
        const cond = child.condition || "";
        const match = Object.entries(inputs).some(([k, v]) => cond.includes(k) && cond.includes(String(v)));
        if (match || current.children.length === 1) { next = child; break; }
      }
      if (!next) break;
      current = next;
      if (current) path.push(current.id);
    }
    return { ok: true, data: { outcome: current?.outcome || null, path } };
  }

  getPath(treeId: string, inputs: Record<string, any>): R {
    const result = this.evaluate(treeId, inputs);
    return result.ok ? { ok: true, data: { path: result.data.path } } : result;
  }

  getAccuracy(treeId: string): R {
    const tree = this._trees.get(treeId);
    if (!tree) return { ok: false, error: "Tree not found" };
    let totalNodes = 0;
    let leafNodes = 0;
    for (const [, node] of tree.nodes) {
      totalNodes++;
      if (node.children.length === 0) leafNodes++;
    }
    return { ok: true, data: { totalNodes, leafNodes, depth: totalNodes } };
  }

  prune(treeId: string, threshold: number): R {
    const tree = this._trees.get(treeId);
    if (!tree) return { ok: false, error: "Tree not found" };
    let pruned = 0;
    const toRemove: string[] = [];
    for (const [nodeId, node] of tree.nodes) {
      if (node.children.length === 0) continue;
      if (node.children.length <= threshold) {
        toRemove.push(...node.children);
        node.children = [];
        pruned++;
      }
    }
    for (const id of toRemove) tree.nodes.delete(id);
    return { ok: true, data: { pruned, removed: toRemove.length } };
  }
}

class CausalAnalyzer {
  _variables: Map<string, { id: string; name: string; type: string; value: number }>;
  _causes: Array<{ causeId: string; effectId: string; strength: number }>;

  constructor() {
    this._variables = new Map();
    this._causes = [];
  }

  addVariable(id: string, name: string, type: string): R {
    if (this._variables.has(id)) return { ok: false, error: "Variable exists" };
    this._variables.set(id, { id, name, type, value: 0 });
    return { ok: true, data: { id, name, type } };
  }

  addCause(causeId: string, effectId: string, strength: number): R {
    if (!this._variables.has(causeId)) return { ok: false, error: "Cause variable not found" };
    if (!this._variables.has(effectId)) return { ok: false, error: "Effect variable not found" };
    this._causes.push({ causeId, effectId, strength: Math.max(-1, Math.min(1, strength)) });
    return { ok: true, data: { causeId, effectId, strength } };
  }

  getCausalChain(fromId: string, toId: string): R {
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[]; totalStrength: number }> = [{ id: fromId, path: [fromId], totalStrength: 1 }];
    const chains: Array<{ path: string[]; strength: number }> = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.id === toId && current.path.length > 1) {
        chains.push({ path: current.path, strength: current.totalStrength });
        continue;
      }
      if (visited.has(current.id)) continue;
      visited.add(current.id);
      for (const cause of this._causes) {
        if (cause.causeId === current.id && !visited.has(cause.effectId)) {
          queue.push({
            id: cause.effectId,
            path: [...current.path, cause.effectId],
            totalStrength: current.totalStrength * cause.strength,
          });
        }
      }
    }
    return { ok: true, data: { chains, found: chains.length > 0 } };
  }

  getEffects(variableId: string): R {
    const effects = this._causes
      .filter(c => c.causeId === variableId)
      .map(c => ({ effectId: c.effectId, strength: c.strength }));
    return { ok: true, data: effects };
  }

  getCauses(variableId: string): R {
    const causes = this._causes
      .filter(c => c.effectId === variableId)
      .map(c => ({ causeId: c.causeId, strength: c.strength }));
    return { ok: true, data: causes };
  }

  simulateIntervention(variableId: string, value: number): R {
    const variable = this._variables.get(variableId);
    if (!variable) return { ok: false, error: "Variable not found" };
    variable.value = value;
    const affected = new Map<string, number>();
    const queue = [variableId];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const cause of this._causes) {
        if (cause.causeId === current) {
          const effectVar = this._variables.get(cause.effectId);
          if (effectVar) {
            const currentVal = affected.get(cause.effectId) || effectVar.value;
            const newVal = currentVal + (affected.get(current) || variable.value) * cause.strength;
            affected.set(cause.effectId, newVal);
            queue.push(cause.effectId);
          }
        }
      }
    }
    for (const [id, val] of affected) {
      const v = this._variables.get(id);
      if (v) v.value = val;
    }
    return { ok: true, data: { variableId, value, affected: Object.fromEntries(affected) } };
  }
}

export { DecisionEngine, ScenarioAnalyzer, RiskAssessor, TradeoffAnalyzer, DecisionTree, CausalAnalyzer };
