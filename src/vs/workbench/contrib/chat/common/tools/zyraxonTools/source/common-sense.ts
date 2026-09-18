type R = { ok: boolean; data?: any; error?: string };

export class ReasoningEngine {
  private _facts: Map<string, { id: string; content: string; confidence: number; timestamp: number }> = new Map();
  private _rules: Map<string, { id: string; condition: string; conclusion: string; weight: number }> = new Map();
  private _inferences: Array<{ id: string; query: string; result: any; confidence: number; ruleIds: string[]; timestamp: number }> = [];

  addFact(id: string, content: string, confidence: number): R {
    this._facts.set(id, { id, content, confidence, timestamp: Date.now() });
    return { ok: true };
  }

  addRule(id: string, condition: string, conclusion: string): R {
    this._rules.set(id, { id, condition, conclusion, weight: 1 });
    return { ok: true };
  }

  infer(query: string): R {
    const matchedFacts = Array.from(this._facts.values()).filter(f =>
      f.content.toLowerCase().includes(query.toLowerCase())
    );
    const matchedRules = Array.from(this._rules.values()).filter(r =>
      r.condition.toLowerCase().includes(query.toLowerCase()) ||
      r.conclusion.toLowerCase().includes(query.toLowerCase())
    );
    const avgConfidence = matchedFacts.length
      ? matchedFacts.reduce((s, f) => s + f.confidence, 0) / matchedFacts.length
      : 0;
    const inference = {
      id: `inf-${Date.now()}`,
      query,
      result: { facts: matchedFacts.map(f => f.id), rules: matchedRules.map(r => r.id) },
      confidence: Math.min(avgConfidence + matchedRules.length * 0.1, 1),
      ruleIds: matchedRules.map(r => r.id),
      timestamp: Date.now()
    };
    this._inferences.push(inference);
    return { ok: true, data: inference };
  }

  getExplanation(inferenceId: string): R {
    const inf = this._inferences.find(i => i.id === inferenceId);
    if (!inf) return { ok: false, error: "Inference not found" };
    const facts = inf.ruleIds.flatMap(rid => {
      const rule = this._rules.get(rid);
      return rule ? [{ rule: rule.id, condition: rule.condition, conclusion: rule.conclusion }] : [];
    });
    return { ok: true, data: { inference: inf.id, query: inf.query, steps: facts, confidence: inf.confidence } };
  }

  chain(query: string, depth: number): R {
    const chainResults: string[] = [query];
    let currentQuery = query;
    for (let i = 0; i < depth; i++) {
      const res = this.infer(currentQuery);
      if (!res.ok || !res.data) break;
      const inf = res.data;
      if (inf.ruleIds.length === 0) break;
      const rule = this._rules.get(inf.ruleIds[0]);
      if (!rule) break;
      chainResults.push(rule.conclusion);
      currentQuery = rule.conclusion;
    }
    return { ok: true, data: { chain: chainResults, depth: chainResults.length } };
  }

  contradictions(): R {
    const contradictions: Array<{ factA: string; factB: string; reason: string }> = [];
    const facts = Array.from(this._facts.values());
    for (let i = 0; i < facts.length; i++) {
      for (let j = i + 1; j < facts.length; j++) {
        if (facts[i].content.toLowerCase().includes("not") && facts[j].content.toLowerCase() === facts[i].content.toLowerCase().replace("not ", "")) {
          contradictions.push({ factA: facts[i].id, factB: facts[j].id, reason: "Direct negation" });
        }
      }
    }
    return { ok: true, data: contradictions };
  }
}

export class CausalInference {
  private _variables: Map<string, { id: string; name: string; value: any }> = new Map();
  private _observations: Map<string, { varId: string; value: any; timestamp: number }[]> = new Map();
  private _links: Array<{ from: string; to: string; strength: number; lag: number }> = [];

  addVariable(id: string, name: string): R {
    this._variables.set(id, { id, name, value: null });
    this._observations.set(id, []);
    return { ok: true };
  }

  addObservation(varId: string, value: any): R {
    if (!this._variables.has(varId)) return { ok: false, error: "Variable not found" };
    const obs = this._observations.get(varId)!;
    obs.push({ varId, value, timestamp: Date.now() });
    const v = this._variables.get(varId)!;
    v.value = value;
    return { ok: true };
  }

  addCausalLink(fromId: string, toId: string, strength: number): R {
    if (!this._variables.has(fromId) || !this._variables.has(toId)) {
      return { ok: false, error: "Variable not found" };
    }
    this._links.push({ from: fromId, to: toId, strength: Math.max(0, Math.min(1, strength)), lag: 0 });
    return { ok: true };
  }

  predict(varId: string, interventions: Record<string, any>): R {
    if (!this._variables.has(varId)) return { ok: false, error: "Variable not found" };
    const incomingLinks = this._links.filter(l => l.to === varId);
    let predictedValue = 0;
    let totalWeight = 0;
    for (const link of incomingLinks) {
      const sourceVal = interventions[link.from] ?? this._variables.get(link.from)?.value ?? 0;
      const numVal = typeof sourceVal === "number" ? sourceVal : parseFloat(sourceVal) || 0;
      predictedValue += numVal * link.strength;
      totalWeight += link.strength;
    }
    const result = totalWeight > 0 ? predictedValue / totalWeight : 0;
    return { ok: true, data: { varId, predicted: result, confidence: Math.min(totalWeight, 1) } };
  }

  getMostLikely(): R {
    const variables = Array.from(this._variables.values());
    const scores = variables.map(v => {
      const outgoing = this._links.filter(l => l.from === v.id);
      const incoming = this._links.filter(l => l.to === v.id);
      const influence = outgoing.reduce((s, l) => s + l.strength, 0) + incoming.reduce((s, l) => s + l.strength, 0);
      return { varId: v.id, name: v.name, influence };
    });
    scores.sort((a, b) => b.influence - a.influence);
    return { ok: true, data: scores };
  }

  simulateIntervention(varId: string, value: any): R {
    if (!this._variables.has(varId)) return { ok: false, error: "Variable not found" };
    const受影响Vars = new Map<string, any>();
    受影响Vars.set(varId, value);
    const queue = [varId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const outgoing = this._links.filter(l => l.from === current);
      for (const link of outgoing) {
        if (受影响Vars.has(link.to)) continue;
        const sourceVal = 受影响Vars.get(current) ?? 0;
        const numVal = typeof sourceVal === "number" ? sourceVal : parseFloat(sourceVal) || 0;
        const newVal = numVal * link.strength;
        受影响Vars.set(link.to, newVal);
        queue.push(link.to);
      }
    }
    for (const [vid, val] of 受影响Vars) {
      const v = this._variables.get(vid)!;
      v.value = val;
      const obs = this._observations.get(vid)!;
      obs.push({ varId: vid, value: val, timestamp: Date.now() });
    }
    return { ok: true, data: Object.fromEntries(受影响Vars) };
  }
}

export class WorldModel {
  private _objects: Map<string, { id: string; type: string; properties: Record<string, any> }> = new Map();
  private _relations: Array<{ objA: string; objB: string; relation: string; timestamp: number }> = [];
  private _history: Array<{ action: string; state: Record<string, any>; timestamp: number }> = [];

  addObject(id: string, type: string, properties: Record<string, any>): R {
    this._objects.set(id, { id, type, properties });
    this._history.push({ action: "addObject", state: { id, type }, timestamp: Date.now() });
    return { ok: true };
  }

  addRelation(objA: string, objB: string, relation: string): R {
    if (!this._objects.has(objA) || !this._objects.has(objB)) {
      return { ok: false, error: "Object not found" };
    }
    this._relations.push({ objA, objB, relation, timestamp: Date.now() });
    return { ok: true };
  }

  query(type: string, properties?: Record<string, any>): R {
    let results = Array.from(this._objects.values()).filter(o => o.type === type);
    if (properties) {
      results = results.filter(o =>
        Object.entries(properties).every(([k, v]) => o.properties[k] === v)
      );
    }
    return { ok: true, data: results };
  }

  simulate(action: string): R {
    const snapshot = this.getState();
    this._history.push({ action, state: snapshot, timestamp: Date.now() });
    return { ok: true, data: { action, snapshot } };
  }

  revert(): R {
    if (this._history.length < 2) return { ok: false, error: "No history to revert" };
    this._history.pop();
    const previous = this._history[this._history.length - 1];
    return { ok: true, data: previous };
  }

  getState(): R {
    const state: Record<string, any> = {};
    for (const [id, obj] of this._objects) {
      state[id] = { type: obj.type, properties: { ...obj.properties } };
    }
    return { ok: true, data: state };
  }

  getTimeline(): R {
    return { ok: true, data: this._history };
  }
}

export class ContextManager {
  private _contexts: Map<string, { id: string; data: Record<string, any>; createdAt: number; updatedAt: number }> = new Map();
  private _history: Map<string, Array<{ data: Record<string, any>; timestamp: number }>> = new Map();

  setContext(id: string, data: Record<string, any>): R {
    this._contexts.set(id, { id, data: { ...data }, createdAt: Date.now(), updatedAt: Date.now() });
    if (!this._history.has(id)) this._history.set(id, []);
    this._history.get(id)!.push({ data: { ...data }, timestamp: Date.now() });
    return { ok: true };
  }

  getContext(id: string): R {
    const ctx = this._contexts.get(id);
    if (!ctx) return { ok: false, error: "Context not found" };
    return { ok: true, data: { ...ctx } };
  }

  mergeContext(id: string, newData: Record<string, any>): R {
    const ctx = this._contexts.get(id);
    if (!ctx) return { ok: false, error: "Context not found" };
    ctx.data = { ...ctx.data, ...newData };
    ctx.updatedAt = Date.now();
    const hist = this._history.get(id)!;
    hist.push({ data: { ...ctx.data }, timestamp: Date.now() });
    return { ok: true, data: ctx.data };
  }

  getContextHistory(id: string): R {
    const hist = this._history.get(id);
    if (!hist) return { ok: false, error: "Context not found" };
    return { ok: true, data: hist };
  }

  predictNext(id: string): R {
    const hist = this._history.get(id);
    if (!hist || hist.length < 2) return { ok: true, data: null };
    const last = hist[hist.length - 1].data;
    const prev = hist[hist.length - 2].data;
    const predicted: Record<string, any> = {};
    const allKeys = new Set([...Object.keys(last), ...Object.keys(prev)]);
    for (const key of allKeys) {
      const lastVal = last[key];
      const prevVal = prev[key];
      if (typeof lastVal === "number" && typeof prevVal === "number") {
        predicted[key] = lastVal + (lastVal - prevVal);
      } else {
        predicted[key] = lastVal ?? prevVal;
      }
    }
    return { ok: true, data: predicted };
  }

  getRelevant(id: string, query: string): R {
    const ctx = this._contexts.get(id);
    if (!ctx) return { ok: false, error: "Context not found" };
    const relevant: Record<string, any> = {};
    const queryLower = query.toLowerCase();
    for (const [key, value] of Object.entries(ctx.data)) {
      if (key.toLowerCase().includes(queryLower) || String(value).toLowerCase().includes(queryLower)) {
        relevant[key] = value;
      }
    }
    return { ok: true, data: relevant };
  }
}

export class AnalogyEngine {
  private _analogies: Array<{ id: string; source: string; target: string; mappings: Record<string, string>; strength: number }> = [];

  addAnalogy(source: string, target: string, mappings: Record<string, string>): R {
    const id = `analogy-${this._analogies.length}`;
    const strength = Object.keys(mappings).length > 0 ? 0.8 : 0;
    this._analogies.push({ id, source, target, mappings, strength });
    return { ok: true, data: { id } };
  }

  findAnalogy(query: string): R {
    const matches = this._analogies.filter(a =>
      a.source.toLowerCase().includes(query.toLowerCase()) ||
      a.target.toLowerCase().includes(query.toLowerCase()) ||
      Object.keys(a.mappings).some(k => k.toLowerCase().includes(query.toLowerCase()))
    );
    return { ok: true, data: matches };
  }

  extendAnalogy(analogyId: string, newMappings: Record<string, string>): R {
    const idx = this._analogies.findIndex(a => a.id === analogyId);
    if (idx === -1) return { ok: false, error: "Analogy not found" };
    const analogy = this._analogies[idx];
    analogy.mappings = { ...analogy.mappings, ...newMappings };
    analogy.strength = Math.min(analogy.strength + 0.05, 1);
    return { ok: true, data: analogy };
  }

  applyAnalogy(analogyId: string, target: string): R {
    const analogy = this._analogies.find(a => a.id === analogyId);
    if (!analogy) return { ok: false, error: "Analogy not found" };
    const applied: Record<string, string> = {};
    for (const [srcKey, tgtKey] of Object.entries(analogy.mappings)) {
      applied[`${target}.${tgtKey}`] = srcKey;
    }
    return { ok: true, data: { target, appliedMappings: applied, strength: analogy.strength } };
  }

  getSimilarity(source: string, target: string): R {
    const analogies = this._analogies.filter(a =>
      (a.source === source && a.target === target) || (a.source === target && a.target === source)
    );
    if (analogies.length === 0) return { ok: true, data: { similarity: 0 } };
    const avgStrength = analogies.reduce((s, a) => s + a.strength, 0) / analogies.length;
    const totalMappings = analogies.reduce((s, a) => s + Object.keys(a.mappings).length, 0);
    return { ok: true, data: { similarity: avgStrength, mappings: totalMappings } };
  }
}

export class SpatialReasoning {
  private _objects: Map<string, { id: string; position: [number, number, number]; dimensions: [number, number, number]; type: string }> = new Map();

  addObject(id: string, position: [number, number, number], dimensions: [number, number, number], type: string): R {
    this._objects.set(id, { id, position: [...position], dimensions: [...dimensions], type });
    return { ok: true };
  }

  checkCollision(objA: string, objB: string): R {
    const a = this._objects.get(objA);
    const b = this._objects.get(objB);
    if (!a || !b) return { ok: false, error: "Object not found" };
    const collide = [0, 1, 2].every(i => {
      const aMin = a.position[i] - a.dimensions[i] / 2;
      const aMax = a.position[i] + a.dimensions[i] / 2;
      const bMin = b.position[i] - b.dimensions[i] / 2;
      const bMax = b.position[i] + b.dimensions[i] / 2;
      return aMin < bMax && aMax > bMin;
    });
    return { ok: true, data: { collision: collide } };
  }

  getDistance(objA: string, objB: string): R {
    const a = this._objects.get(objA);
    const b = this._objects.get(objB);
    if (!a || !b) return { ok: false, error: "Object not found" };
    const dist = Math.sqrt(
      (a.position[0] - b.position[0]) ** 2 +
      (a.position[1] - b.position[1]) ** 2 +
      (a.position[2] - b.position[2]) ** 2
    );
    return { ok: true, data: { distance: dist } };
  }

  getVisible(fromObj: string, fov: number, range: number): R {
    const from = this._objects.get(fromObj);
    if (!from) return { ok: false, error: "Object not found" };
    const visible: Array<{ id: string; distance: number; angle: number }> = [];
    for (const [id, obj] of this._objects) {
      if (id === fromObj) continue;
      const dist = Math.sqrt(
        (from.position[0] - obj.position[0]) ** 2 +
        (from.position[1] - obj.position[1]) ** 2 +
        (from.position[2] - obj.position[2]) ** 2
      );
      if (dist > range) continue;
      const dx = obj.position[0] - from.position[0];
      const dz = obj.position[2] - from.position[2];
      const angle = Math.abs(Math.atan2(dz, dx) * (180 / Math.PI));
      if (angle <= fov / 2) {
        visible.push({ id, distance: dist, angle });
      }
    }
    return { ok: true, data: visible };
  }

  navigate(from: string, to: string, obstacles: string[]): R {
    const start = this._objects.get(from);
    const end = this._objects.get(to);
    if (!start || !end) return { ok: false, error: "Object not found" };
    const path: Array<[number, number, number]> = [start.position.map(p => p) as [number, number, number]];
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const point: [number, number, number] = [
        start.position[0] + (end.position[0] - start.position[0]) * t,
        start.position[1] + (end.position[1] - start.position[1]) * t,
        start.position[2] + (end.position[2] - start.position[2]) * t
      ];
      let blocked = false;
      for (const obsId of obstacles) {
        const obs = this._objects.get(obsId);
        if (!obs) continue;
        const dist = Math.sqrt(
          (point[0] - obs.position[0]) ** 2 +
          (point[1] - obs.position[1]) ** 2 +
          (point[2] - obs.position[2]) ** 2
        );
        const minClearance = Math.max(...obs.dimensions) / 2;
        if (dist < minClearance) { blocked = true; break; }
      }
      if (!blocked) path.push(point);
    }
    return { ok: true, data: { path, clear: path[path.length - 1] === end.position } };
  }

  getPath(from: string, to: string): R {
    const start = this._objects.get(from);
    const end = this._objects.get(to);
    if (!start || !end) return { ok: false, error: "Object not found" };
    const waypoints: Array<[number, number, number]> = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      waypoints.push([
        start.position[0] + (end.position[0] - start.position[0]) * t,
        start.position[1] + (end.position[1] - start.position[1]) * t,
        start.position[2] + (end.position[2] - start.position[2]) * t
      ]);
    }
    return { ok: true, data: { path: waypoints, distance: this.getDistance(from, to).data?.distance } };
  }
}