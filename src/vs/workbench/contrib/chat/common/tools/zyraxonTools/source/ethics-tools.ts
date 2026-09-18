type R = { ok: boolean; data?: any; error?: string };

export class EthicalFramework {
  private _principles: Map<string, { id: string; name: string; weight: number; constraints: Array<(a: any) => boolean> }> = new Map();
  private _scenarios: Map<string, { id: string; actions: Array<{ id: string; description: string; scores: Record<string, number> }>; principles: string[] }> = new Map();

  addPrinciple(id: string, name: string, weight: number): R {
    this._principles.set(id, { id, name, weight: Math.max(0, Math.min(1, weight)), constraints: [] });
    return { ok: true };
  }

  addScenario(id: string, actions: Array<{ id: string; description: string }>, principles: string[]): R {
    const fullActions = actions.map(a => ({
      ...a,
      scores: Object.fromEntries(principles.map(p => [p, 0.5]))
    }));
    this._scenarios.set(id, { id, actions: fullActions, principles });
    return { ok: true };
  }

  evaluate(scenarioId: string, actionId: string): R {
    const scenario = this._scenarios.get(scenarioId);
    if (!scenario) return { ok: false, error: "Scenario not found" };
    const action = scenario.actions.find(a => a.id === actionId);
    if (!action) return { ok: false, error: "Action not found" };
    let totalScore = 0;
    let totalWeight = 0;
    for (const principleId of scenario.principles) {
      const principle = this._principles.get(principleId);
      if (!principle) continue;
      const score = action.scores[principleId] ?? 0.5;
      totalScore += score * principle.weight;
      totalWeight += principle.weight;
    }
    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    return { ok: true, data: { scenarioId, actionId, score: finalScore, principleScores: action.scores } };
  }

  getScore(scenarioId: string, actionId: string): R {
    const result = this.evaluate(scenarioId, actionId);
    return result.ok ? { ok: true, data: result.data?.score } : result;
  }

  getBestAction(scenarioId: string): R {
    const scenario = this._scenarios.get(scenarioId);
    if (!scenario) return { ok: false, error: "Scenario not found" };
    let bestAction = null;
    let bestScore = -1;
    for (const action of scenario.actions) {
      const res = this.evaluate(scenarioId, action.id);
      if (res.ok && res.data && res.data.score > bestScore) {
        bestScore = res.data.score;
        bestAction = action;
      }
    }
    return { ok: true, data: bestAction ? { actionId: bestAction.id, score: bestScore } : null };
  }

  addConstraint(id: string, fn: (action: any) => boolean): R {
    const principle = this._principles.get(id);
    if (!principle) return { ok: false, error: "Principle not found" };
    principle.constraints.push(fn);
    return { ok: true };
  }
}

export class BiasDetector {
  private _datasets: Map<string, { id: string; data: any[]; protectedAttributes: string[]; biasResults: any }> = new Map();

  addDataset(name: string, data: any[], protectedAttributes: string[]): R {
    this._datasets.set(name, { id: name, data, protectedAttributes, biasResults: null });
    return { ok: true };
  }

  detectBias(datasetId: string): R {
    const dataset = this._datasets.get(datasetId);
    if (!dataset) return { ok: false, error: "Dataset not found" };
    const groupStats: Record<string, Record<string, { count: number; mean: number }>> = {};
    for (const attr of dataset.protectedAttributes) {
      groupStats[attr] = {};
      const groups = new Map<string, number[]>();
      for (const item of dataset.data) {
        const group = String(item[attr] ?? "unknown");
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group)!.push(1);
      }
      for (const [group, vals] of groups) {
        groupStats[attr][group] = {
          count: vals.length,
          mean: vals.reduce((s, v) => s + v, 0) / vals.length
        };
      }
    }
    const disparities: Array<{ attribute: string; disparity: number }> = [];
    for (const attr of dataset.protectedAttributes) {
      const groups = Object.values(groupStats[attr] ?? {});
      if (groups.length < 2) continue;
      const means = groups.map(g => g.mean);
      const maxMean = Math.max(...means);
      const minMean = Math.min(...means);
      const disparity = maxMean > 0 ? (maxMean - minMean) / maxMean : 0;
      disparities.push({ attribute: attr, disparity });
    }
    const results = { groupStats, disparities, overallBias: disparities.reduce((s, d) => s + d.disparity, 0) / Math.max(disparities.length, 1) };
    dataset.biasResults = results;
    return { ok: true, data: results };
  }

  getBiasScore(datasetId: string): R {
    const dataset = this._datasets.get(datasetId);
    if (!dataset) return { ok: false, error: "Dataset not found" };
    if (!dataset.biasResults) {
      this.detectBias(datasetId);
    }
    return { ok: true, data: dataset.biasResults?.overallBias ?? 0 };
  }

  mitigateBias(datasetId: string, method: string): R {
    const dataset = this._datasets.get(datasetId);
    if (!dataset) return { ok: false, error: "Dataset not found" };
    if (method === "resample") {
      const groups = new Map<string, any[]>();
      for (const item of dataset.data) {
        const key = dataset.protectedAttributes.map(a => String(item[a])).join("_");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
      }
      const minSize = Math.min(...Array.from(groups.values()).map(g => g.length));
      const balanced: any[] = [];
      for (const items of groups.values()) {
        balanced.push(...items.slice(0, minSize));
      }
      dataset.data = balanced;
    } else if (method === "reweight") {
      const groupCounts = new Map<string, number>();
      for (const item of dataset.data) {
        const key = dataset.protectedAttributes.map(a => String(item[a])).join("_");
        groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
      }
      const total = dataset.data.length;
      for (const item of dataset.data) {
        const key = dataset.protectedAttributes.map(a => String(item[a])).join("_");
        const weight = total / ((groupCounts.get(key) ?? 1) * groupCounts.size);
        item._weight = weight;
      }
    }
    this.detectBias(datasetId);
    return { ok: true, data: { method, newBiasScore: dataset.biasResults?.overallBias } };
  }

  getMetrics(datasetId: string): R {
    const dataset = this._datasets.get(datasetId);
    if (!dataset) return { ok: false, error: "Dataset not found" };
    if (!dataset.biasResults) this.detectBias(datasetId);
    const total = dataset.data.length;
    const attributes = dataset.protectedAttributes.length;
    return {
      ok: true,
      data: { total, attributes, biasScore: dataset.biasResults?.overallBias, disparities: dataset.biasResults?.disparities }
    };
  }
}

export class FairnessAnalyzer {
  private _models: Map<string, { id: string; predictions: number[]; actual: number[]; protectedGroups: Record<string, number[]> }> = new Map();

  addModel(modelId: string, predictions: number[], actual: number[]): R {
    const groups: Record<string, number[]> = {};
    for (let i = 0; i < predictions.length; i++) {
      const group = predictions[i] >= 0.5 ? "positive" : "negative";
      if (!groups[group]) groups[group] = [];
      groups[group].push(i);
    }
    this._models.set(modelId, { id: modelId, predictions, actual, protectedGroups: groups });
    return { ok: true };
  }

  calculateFairness(modelId: string): R {
    const model = this._models.get(modelId);
    if (!model) return { ok: false, error: "Model not found" };
    return {
      ok: true,
      data: {
        demographicParity: this.getDemographicParity(modelId).data,
        equalOpportunity: this.getEqualOpportunity(modelId).data,
        disparateImpact: this.getDisparateImpact(modelId).data
      }
    };
  }

  getDemographicParity(modelId: string): R {
    const model = this._models.get(modelId);
    if (!model) return { ok: false, error: "Model not found" };
    const posRate = model.predictions.filter(p => p >= 0.5).length / model.predictions.length;
    return { ok: true, data: { positiveRate: posRate, parity: Math.abs(posRate - 0.5) * 2 } };
  }

  getEqualOpportunity(modelId: string): R {
    const model = this._models.get(modelId);
    if (!model) return { ok: false, error: "Model not found" };
    const truePositives = model.actual.filter((a, i) => a === 1 && model.predictions[i] >= 0.5).length;
    const actualPositives = model.actual.filter(a => a === 1).length;
    const tpr = actualPositives > 0 ? truePositives / actualPositives : 0;
    return { ok: true, data: { truePositiveRate: tpr, opportunity: tpr } };
  }

  getDisparateImpact(modelId: string): R {
    const model = this._models.get(modelId);
    if (!model) return { ok: false, error: "Model not found" };
    const posRate = model.predictions.filter(p => p >= 0.5).length / model.predictions.length;
    const impact = posRate > 0 ? Math.min(posRate / 0.5, 0.5 / posRate) : 0;
    return { ok: true, data: { disparateImpactRatio: impact, passes: impact >= 0.8 } };
  }

  recommend(modelId: string): R {
    const fairness = this.calculateFairness(modelId);
    if (!fairness.ok) return fairness;
    const issues: string[] = [];
    const dP = fairness.data?.demographicParity?.parity ?? 0;
    const eO = fairness.data?.equalOpportunity?.opportunity ?? 0;
    const dI = fairness.data?.disparateImpact?.disparateImpactRatio ?? 0;
    if (dP > 0.1) issues.push("Demographic parity violation - consider resampling training data");
    if (eO < 0.7) issues.push("Low equal opportunity - review threshold calibration");
    if (dI < 0.8) issues.push("Disparate impact detected - apply bias mitigation techniques");
    return { ok: true, data: { issues, recommendation: issues.length === 0 ? "Model appears fair" : `Found ${issues.length} fairness issue(s)` } };
  }
}

export class TransparencyEngine {
  private _decisions: Map<string, { id: string; inputs: any; outputs: any; reasoning: string; confidence: number; factors: string[]; timestamp: number; auditTrail: Array<{ action: string; detail: string; timestamp: number }> }> = new Map();

  addDecision(id: string, inputs: any, outputs: any, reasoning: string): R {
    const inputKeys = Object.keys(inputs || {});
    const confidence = Math.min(0.7 + inputKeys.length * 0.05, 1);
    const factors = inputKeys;
    this._decisions.set(id, {
      id, inputs, outputs, reasoning, confidence, factors, timestamp: Date.now(),
      auditTrail: [{ action: "decision_created", detail: reasoning, timestamp: Date.now() }]
    });
    return { ok: true };
  }

  explain(decisionId: string): R {
    const d = this._decisions.get(decisionId);
    if (!d) return { ok: false, error: "Decision not found" };
    return {
      ok: true,
      data: {
        id: d.id, reasoning: d.reasoning, confidence: d.confidence,
        inputFactors: d.factors, output: d.outputs,
        timeline: d.auditTrail.map(a => `${a.action}: ${a.detail}`)
      }
    };
  }

  getAuditTrail(decisionId: string): R {
    const d = this._decisions.get(decisionId);
    if (!d) return { ok: false, error: "Decision not found" };
    return { ok: true, data: d.auditTrail };
  }

  getConfidence(decisionId: string): R {
    const d = this._decisions.get(decisionId);
    if (!d) return { ok: false, error: "Decision not found" };
    return { ok: true, data: d.confidence };
  }

  getFactors(decisionId: string): R {
    const d = this._decisions.get(decisionId);
    if (!d) return { ok: false, error: "Decision not found" };
    return { ok: true, data: d.factors };
  }
}

export class SafetyValidator {
  private _rules: Map<string, { id: string; check: (action: any, context: any) => boolean; severity: string }> = new Map();
  private _violations: Array<{ ruleId: string; action: any; severity: string; timestamp: number; overridden: boolean; overrideReason?: string }> = [];

  addRule(id: string, check: (action: any, context: any) => boolean, severity: string): R {
    this._rules.set(id, { id, check, severity });
    return { ok: true };
  }

  validate(action: any, context: any): R {
    const violations: Array<{ ruleId: string; severity: string; passed: boolean }> = [];
    for (const [id, rule] of this._rules) {
      const passed = rule.check(action, context);
      if (!passed) {
        this._violations.push({ ruleId: id, action, severity: rule.severity, timestamp: Date.now(), overridden: false });
      }
      violations.push({ ruleId: id, severity: rule.severity, passed });
    }
    const failed = violations.filter(v => !v.passed);
    return { ok: true, data: { violations, failed: failed.length, total: violations.length, safe: failed.length === 0 } };
  }

  getViolations(): R {
    return { ok: true, data: this._violations.filter(v => !v.overridden) };
  }

  getRiskScore(action: any): R {
    let risk = 0;
    for (const [id, rule] of this._rules) {
      try {
        if (!rule.check(action, {})) {
          const sevWeight = rule.severity === "critical" ? 1 : rule.severity === "high" ? 0.7 : rule.severity === "medium" ? 0.4 : 0.2;
          risk += sevWeight;
        }
      } catch {
        risk += 0.1;
      }
    }
    const maxRisk = this._rules.size;
    const score = maxRisk > 0 ? risk / maxRisk : 0;
    return { ok: true, data: { riskScore: Math.min(score, 1), riskLevel: score > 0.7 ? "critical" : score > 0.4 ? "high" : score > 0.2 ? "medium" : "low" } };
  }

  isSafe(action: any, context: any): R {
    const result = this.validate(action, context);
    return { ok: true, data: result.data?.safe ?? true };
  }

  override(actionId: string, userId: string, reason: string): R {
    const violations = this._violations.filter(v => v.ruleId === actionId && !v.overridden);
    if (violations.length === 0) return { ok: false, error: "No active violations found" };
    for (const v of violations) {
      v.overridden = true;
      v.overrideReason = `${userId}: ${reason}`;
    }
    return { ok: true, data: { overridden: violations.length, userId, reason } };
  }
}