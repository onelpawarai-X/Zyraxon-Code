type R = { ok: boolean; data?: any; error?: string };

export class IdeaGenerator {
  private _concepts: Map<string, { id: string; keywords: string[]; connections: string[]; createdAt: number }> = new Map();
  private _ideas: Array<{ id: string; concepts: string[]; description: string; originality: number; feasibility: number; timestamp: number }> = [];
  private _selectionIndex: number = 0;

  addConcept(id: string, keywords: string[], connections: string[]): R {
    this._concepts.set(id, { id, keywords, connections, createdAt: Date.now() });
    return { ok: true };
  }

  brainstorm(topic: string, count: number): R {
    const ideas: Array<{ id: string; description: string; concepts: string[] }> = [];
    const topicConcepts = Array.from(this._concepts.values()).filter(c =>
      c.keywords.some(k => k.toLowerCase().includes(topic.toLowerCase()))
    );
    const connectedConcepts = topicConcepts.flatMap(c =>
      c.connections.map(cid => this._concepts.get(cid)).filter(Boolean)
    ).filter(Boolean) as any[];
    const pool = [...topicConcepts, ...connectedConcepts];
    for (let i = 0; i < count; i++) {
      const selected: string[] = [];
      for (let j = 0; j < 3; j++) {
        if (pool.length === 0) break;
        const idx = this._selectionIndex % pool.length;
        this._selectionIndex++;
        if (pool[idx]) selected.push(pool[idx].id);
      }
      const uniqueKeywords = [...new Set(selected.flatMap(id => this._concepts.get(id)?.keywords ?? []))];
      ideas.push({
        id: `idea-${Date.now()}-${i}`,
        description: uniqueKeywords.slice(0, 5).join(" + "),
        concepts: selected
      });
    }
    ideas.forEach(idea => {
      const conceptCount = idea.concepts.length;
      const totalKeywords = idea.concepts.reduce((s, cid) => s + (this._concepts.get(cid)?.keywords.length ?? 0), 0);
      this._ideas.push({
        id: idea.id, concepts: idea.concepts, description: idea.description,
        originality: Math.min(0.3 + conceptCount * 0.15, 1),
        feasibility: Math.min(0.2 + totalKeywords * 0.05, 1),
        timestamp: Date.now()
      });
    });
    return { ok: true, data: ideas };
  }

  combine(conceptIds: string[]): R {
    const validConcepts = conceptIds.map(id => this._concepts.get(id)).filter(Boolean) as any[];
    if (validConcepts.length < 2) return { ok: false, error: "Need at least 2 valid concepts" };
    const combinedKeywords = [...new Set(validConcepts.flatMap(c => c.keywords))];
    const idea = {
      id: `idea-${Date.now()}`,
      concepts: conceptIds,
      description: combinedKeywords.slice(0, 8).join(" + "),
      originality: Math.min(0.3 + validConcepts.length * 0.15, 1),
      feasibility: validConcepts.reduce((s, c) => s + (c.keywords.length > 0 ? 0.7 : 0.3), 0) / validConcepts.length,
      timestamp: Date.now()
    };
    this._ideas.push(idea);
    return { ok: true, data: idea };
  }

  expand(ideaId: string): R {
    const idea = this._ideas.find(i => i.id === ideaId);
    if (!idea) return { ok: false, error: "Idea not found" };
    const expansions = idea.concepts.flatMap(cid => {
      const concept = this._concepts.get(cid);
      if (!concept) return [];
      return concept.connections
        .map(connId => this._concepts.get(connId))
        .filter(Boolean)
        .map((c: any) => ({ conceptId: c.id, keywords: c.keywords }));
    });
    const newKeywords = [...new Set([...idea.description.split(" + "), ...expansions.flatMap(e => e.keywords)])];
    return { ok: true, data: { ...idea, expandedDescription: newKeywords.slice(0, 12).join(" + "), expansions } };
  }

  getOriginality(ideaId: string): R {
    const idea = this._ideas.find(i => i.id === ideaId);
    if (!idea) return { ok: false, error: "Idea not found" };
    const similarCount = this._ideas.filter(i => {
      if (i.id === ideaId) return false;
      const overlap = i.concepts.filter(c => idea.concepts.includes(c)).length;
      return overlap >= idea.concepts.length * 0.5;
    }).length;
    const originality = Math.max(0, idea.originality - similarCount * 0.1);
    return { ok: true, data: { originality, similarIdeas: similarCount } };
  }

  getFeasibility(ideaId: string): R {
    const idea = this._ideas.find(i => i.id === ideaId);
    if (!idea) return { ok: false, error: "Idea not found" };
    const conceptComplexity = idea.concepts.map(cid => {
      const c = this._concepts.get(cid);
      return c ? c.keywords.length + c.connections.length : 0;
    });
    const avgComplexity = conceptComplexity.reduce((s, v) => s + v, 0) / Math.max(conceptComplexity.length, 1);
    const feasibility = Math.max(0.1, Math.min(1, idea.feasibility - avgComplexity * 0.02));
    return { ok: true, data: { feasibility, complexity: avgComplexity } };
  }
}

export class InnovationEngine {
  private _technologies: Map<string, { id: string; capabilities: string[]; maturity: number; cost: number }> = new Map();

  addTechnology(id: string, capabilities: string[]): R {
    const maturity = Math.min(0.3 + capabilities.length * 0.1, 1);
    const cost = capabilities.length * 25;
    this._technologies.set(id, { id, capabilities, maturity, cost });
    return { ok: true };
  }

  findApplications(techId: string, domain: string): R {
    const tech = this._technologies.get(techId);
    if (!tech) return { ok: false, error: "Technology not found" };
    const domainKeywords = domain.toLowerCase().split(/\s+/);
    const applications = tech.capabilities.map(cap => {
      const relevance = domainKeywords.filter(kw => cap.toLowerCase().includes(kw)).length / Math.max(domainKeywords.length, 1);
      return {
        capability: cap,
        relevance,
        application: `${cap} applied to ${domain}`,
        potential: relevance * tech.maturity
      };
    }).sort((a, b) => b.potential - a.potential);
    return { ok: true, data: { domain, applications } };
  }

  novelCombinations(techIds: string[]): R {
    const techs = techIds.map(id => this._technologies.get(id)).filter(Boolean) as any[];
    if (techs.length < 2) return { ok: false, error: "Need at least 2 technologies" };
    const combinations: Array<{ techs: string[]; combinedCapabilities: string[]; novelty: number; synergies: string[] }> = [];
    for (let i = 0; i < techs.length; i++) {
      for (let j = i + 1; j < techs.length; j++) {
        const shared = techs[i].capabilities.filter((c: string) => techs[j].capabilities.includes(c));
        const unique = [...new Set([...techs[i].capabilities, ...techs[j].capabilities])];
        const novelty = 1 - (shared.length / Math.max(unique.length, 1));
        combinations.push({
          techs: [techs[i].id, techs[j].id],
          combinedCapabilities: unique,
          novelty,
          synergies: shared
        });
      }
    }
    combinations.sort((a, b) => b.novelty - a.novelty);
    return { ok: true, data: combinations };
  }

  assessImpact(ideaId: string): R {
    const techCount = this._technologies.size;
    const avgMaturity = Array.from(this._technologies.values()).reduce((s, t) => s + t.maturity, 0) / Math.max(techCount, 1);
    const avgCost = Array.from(this._technologies.values()).reduce((s, t) => s + t.cost, 0) / Math.max(techCount, 1);
    const impact = {
      technicalFeasibility: avgMaturity,
      marketPotential: Math.min(0.5 + avgMaturity * 0.3, 1),
      timeToImpact: Math.round(6 + (1 - avgMaturity) * 24),
      riskLevel: avgMaturity > 0.7 ? "low" : avgMaturity > 0.4 ? "medium" : "high",
      overallScore: (avgMaturity + 0.7) / 2
    };
    return { ok: true, data: impact };
  }

  getPatentPotential(ideaId: string): R {
    const allCaps = Array.from(this._technologies.values()).flatMap(t => t.capabilities);
    const uniqueCaps = new Set(allCaps);
    const novelty = uniqueCaps.size / Math.max(allCaps.length, 1);
    const potential = {
      noveltyScore: novelty,
      uniqueness: novelty > 0.7 ? "high" : novelty > 0.4 ? "medium" : "low",
      filingRecommendation: novelty > 0.6 ? "Consider filing" : "Needs more differentiation",
      estimatedProtectionStrength: Math.min(novelty * 1.2, 1)
    };
    return { ok: true, data: potential };
  }
}

export class DesignThinking {
  private _projects: Map<string, {
    id: string; problem: string;
    phases: Record<string, { activities: string[]; completed: boolean }>;
    insights: string[];
    prototypes: Array<{ id: string; idea: string; tests: Array<{ prototypeId: string; results: any }> }>;
    status: string; createdAt: number
  }> = new Map();

  createProject(id: string, problem: string): R {
    this._projects.set(id, {
      id, problem,
      phases: { discover: { activities: [], completed: false }, ideate: { activities: [], completed: false }, prototype: { activities: [], completed: false }, test: { activities: [], completed: false } },
      insights: [], prototypes: [], status: "active", createdAt: Date.now()
    });
    return { ok: true };
  }

  addPhase(projectId: string, phase: string, activities: string[]): R {
    const project = this._projects.get(projectId);
    if (!project) return { ok: false, error: "Project not found" };
    project.phases[phase] = { activities, completed: false };
    return { ok: true };
  }

  addInsight(projectId: string, insight: string): R {
    const project = this._projects.get(projectId);
    if (!project) return { ok: false, error: "Project not found" };
    project.insights.push(insight);
    return { ok: true };
  }

  prototype(projectId: string, idea: string): R {
    const project = this._projects.get(projectId);
    if (!project) return { ok: false, error: "Project not found" };
    const prototypeId = `proto-${project.prototypes.length + 1}`;
    project.prototypes.push({ id: prototypeId, idea, tests: [] });
    return { ok: true, data: { prototypeId } };
  }

  test(projectId: string, prototypeId: string, results: any): R {
    const project = this._projects.get(projectId);
    if (!project) return { ok: false, error: "Project not found" };
    const proto = project.prototypes.find(p => p.id === prototypeId);
    if (!proto) return { ok: false, error: "Prototype not found" };
    proto.tests.push({ prototypeId, results });
    return { ok: true };
  }

  getStatus(projectId: string): R {
    const project = this._projects.get(projectId);
    if (!project) return { ok: false, error: "Project not found" };
    const phasesCompleted = Object.values(project.phases).filter(p => p.completed).length;
    const totalPhases = Object.keys(project.phases).length;
    return {
      ok: true,
      data: {
        id: project.id, problem: project.problem, status: project.status,
        progress: totalPhases > 0 ? phasesCompleted / totalPhases : 0,
        phases: Object.entries(project.phases).map(([name, p]) => ({ name, completed: p.completed, activityCount: p.activities.length })),
        insights: project.insights.length,
        prototypes: project.prototypes.length,
        testsConducted: project.prototypes.reduce((s, p) => s + p.tests.length, 0)
      }
    };
  }
}

export class PatternSynthesizer {
  private _patterns: Map<string, { id: string; data: any[]; type: string; frequency: number; trend: number }> = new Map();

  addPattern(id: string, data: any[], type: string): R {
    const trend = data.length > 1
      ? (data[data.length - 1] as number) - (data[0] as number)
      : 0;
    this._patterns.set(id, { id, data: [...data], type, frequency: data.length, trend });
    return { ok: true };
  }

  findSimilar(patternId: string): R {
    const pattern = this._patterns.get(patternId);
    if (!pattern) return { ok: false, error: "Pattern not found" };
    const similar: Array<{ id: string; similarity: number; type: string }> = [];
    for (const [id, other] of this._patterns) {
      if (id === patternId) continue;
      const avgA = pattern.data.reduce((s, v) => s + (v as number), 0) / Math.max(pattern.data.length, 1);
      const avgB = other.data.reduce((s, v) => s + (v as number), 0) / Math.max(other.data.length, 1);
      const varianceA = pattern.data.reduce((s, v) => s + ((v as number) - avgA) ** 2, 0) / Math.max(pattern.data.length, 1);
      const varianceB = other.data.reduce((s, v) => s + ((v as number) - avgB) ** 2, 0) / Math.max(other.data.length, 1);
      const cov = pattern.data.reduce((s, v, i) => s + ((v as number) - avgA) * ((other.data[i] as number) ?? avgB - avgB), 0) / Math.max(pattern.data.length, 1);
      const stdA = Math.sqrt(varianceA);
      const stdB = Math.sqrt(varianceB);
      const similarity = (stdA * stdB) > 0 ? Math.abs(cov / (stdA * stdB)) : 0;
      similar.push({ id, similarity, type: other.type });
    }
    similar.sort((a, b) => b.similarity - a.similarity);
    return { ok: true, data: similar };
  }

  synthesize(patternIds: string[]): R {
    const patterns = patternIds.map(id => this._patterns.get(id)).filter(Boolean) as any[];
    if (patterns.length === 0) return { ok: false, error: "No valid patterns" };
    const allData = patterns.flatMap(p => p.data);
    const avg = allData.reduce((s, v) => s + (v as number), 0) / allData.length;
    const variance = allData.reduce((s, v) => s + ((v as number) - avg) ** 2, 0) / allData.length;
    const synthesizedPattern = {
      id: `synth-${Date.now()}`,
      data: [avg],
      type: "synthesized",
      frequency: allData.length,
      trend: patterns.reduce((s, p) => s + p.trend, 0) / patterns.length,
      variance,
      confidence: Math.min(patterns.length * 0.2, 1)
    };
    return { ok: true, data: synthesizedPattern };
  }

  extrapolate(patternId: string, range: number): R {
    const pattern = this._patterns.get(patternId);
    if (!pattern) return { ok: false, error: "Pattern not found" };
    if (pattern.data.length < 2) return { ok: false, error: "Need at least 2 data points" };
    const n = pattern.data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += pattern.data[i] as number;
      sumXY += i * (pattern.data[i] as number);
      sumX2 += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const extrapolated: number[] = [];
    for (let i = 0; i < range; i++) {
      extrapolated.push(slope * (n + i) + intercept);
    }
    return { ok: true, data: { extrapolated, slope, intercept, confidence: Math.max(0, 1 - range * 0.05) } };
  }

  getNovelty(patternId: string): R {
    const pattern = this._patterns.get(patternId);
    if (!pattern) return { ok: false, error: "Pattern not found" };
    const similar = this.findSimilar(patternId);
    const avgSimilarity = similar.ok && similar.data?.length > 0
      ? similar.data.reduce((s: number, p: any) => s + p.similarity, 0) / similar.data.length
      : 0;
    const novelty = Math.max(0, 1 - avgSimilarity);
    return { ok: true, data: { novelty, similarPatterns: similar.data?.length ?? 0, type: pattern.type } };
  }
}

export class ConstraintRelaxer {
  private _problems: Map<string, {
    id: string; constraints: Array<{ id: string; description: string; relaxed: boolean; importance: number }>;
    objective: string; solutions: Array<{ id: string; constraints: string[]; objectiveValue: number; feasible: boolean }>;
    tradeoffs: Array<{ constraint: string; relaxationBenefit: number }>
  }> = new Map();

  addProblem(id: string, constraints: string[], objective: string): R {
    this._problems.set(id, {
      id, objective,
      constraints: constraints.map((c, i) => ({
        id: `c-${i}`, description: c, relaxed: false, importance: Math.min(0.3 + (i + 1) * 0.1, 1)
      })),
      solutions: [], tradeoffs: []
    });
    return { ok: true };
  }

  relaxConstraint(problemId: string, constraintId: string): R {
    const problem = this._problems.get(problemId);
    if (!problem) return { ok: false, error: "Problem not found" };
    const constraint = problem.constraints.find(c => c.id === constraintId);
    if (!constraint) return { ok: false, error: "Constraint not found" };
    constraint.relaxed = true;
    return { ok: true };
  }

  solve(problemId: string): R {
    const problem = this._problems.get(problemId);
    if (!problem) return { ok: false, error: "Problem not found" };
    const activeConstraints = problem.constraints.filter(c => !c.relaxed);
    const relaxedCount = problem.constraints.filter(c => c.relaxed).length;
    const solution = {
      id: `sol-${problem.solutions.length + 1}`,
      constraints: activeConstraints.map(c => c.id),
      objectiveValue: 0.5 + relaxedCount * 0.1,
      feasible: activeConstraints.length > 0
    };
    problem.solutions.push(solution);
    return { ok: true, data: solution };
  }

  getSolutions(problemId: string): R {
    const problem = this._problems.get(problemId);
    if (!problem) return { ok: false, error: "Problem not found" };
    return { ok: true, data: problem.solutions };
  }

  getTradeoffs(problemId: string): R {
    const problem = this._problems.get(problemId);
    if (!problem) return { ok: false, error: "Problem not found" };
    const tradeoffs = problem.constraints.map(c => ({
      constraint: c.description,
      importance: c.importance,
      relaxationBenefit: c.importance * (c.relaxed ? 1 : 0.5),
      recommendation: c.importance < 0.3 ? "Can relax" : c.importance < 0.7 ? "Consider relaxing" : "Keep strict"
    }));
    return { ok: true, data: tradeoffs };
  }

  optimize(problemId: string, criteria: string): R {
    const problem = this._problems.get(problemId);
    if (!problem) return { ok: false, error: "Problem not found" };
    const sorted = [...problem.constraints].sort((a, b) => {
      if (criteria === "minimize") return a.importance - b.importance;
      if (criteria === "maximize") return b.importance - a.importance;
      return b.importance - a.importance;
    });
    const optimized = sorted.slice(0, Math.ceil(sorted.length * 0.7));
    optimized.forEach(c => { c.relaxed = true; });
    const active = problem.constraints.filter(c => !c.relaxed);
    const solution = {
      id: `opt-${Date.now()}`,
      constraints: active.map(c => c.id),
      objectiveValue: 0.3 + active.length * 0.1,
      feasible: active.length > 0,
      optimized: true,
      criteria
    };
    problem.solutions.push(solution);
    return { ok: true, data: solution };
  }
}