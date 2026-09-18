type R = { ok: boolean; data?: any; error?: string };

export class FailurePredictor {
  private _components: Map<string, { id: string; type: string; readings: number[]; lastUpdate: number }> = new Map();

  addComponent(id: string, type: string, readings: number[]): R {
    if (this._components.has(id)) return { ok: false, error: "Component exists" };
    this._components.set(id, { id, type, readings: [...readings], lastUpdate: Date.now() });
    return { ok: true, data: { id, type, readingCount: readings.length } };
  }

  predictFailure(componentId: string): R {
    const comp = this._components.get(componentId);
    if (!comp) return { ok: false, error: "Component not found" };
    if (comp.readings.length < 3) return { ok: false, error: "Insufficient data" };
    const recent = comp.readings.slice(-10);
    const trend = this.linearTrend(recent);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const std = Math.sqrt(recent.reduce((s, v) => s + (v - mean) ** 2, 0) / recent.length);
    const threshold = mean + 2 * std;
    const failureProbability = Math.min(1, Math.max(0, (mean + trend * 10) / threshold));
    const estimatedLife = trend > 0 ? Math.round((threshold - mean) / trend) : -1;
    return {
      ok: true,
      data: {
        failureProbability: Math.round(failureProbability * 1000) / 1000,
        estimatedLifeRemaining: estimatedLife,
        trend: Math.round(trend * 1000) / 1000,
        threshold: Math.round(threshold * 100) / 100,
      },
    };
  }

  getMTBF(componentId: string): R {
    const comp = this._components.get(componentId);
    if (!comp) return { ok: false, error: "Component not found" };
    const readings = comp.readings;
    if (readings.length < 2) return { ok: false, error: "Insufficient data" };
    const diffs: number[] = [];
    for (let i = 1; i < readings.length; i++) {
      diffs.push(Math.abs(readings[i] - readings[i - 1]));
    }
    const mtbf = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    return { ok: true, data: { mtbf: Math.round(mtbf * 1000) / 1000 } };
  }

  getMTTF(componentId: string): R {
    const comp = this._components.get(componentId);
    if (!comp) return { ok: false, error: "Component not found" };
    if (comp.readings.length < 2) return { ok: false, error: "Insufficient data" };
    const mean = comp.readings.reduce((a, b) => a + b, 0) / comp.readings.length;
    const variance = comp.readings.reduce((s, v) => s + (v - mean) ** 2, 0) / comp.readings.length;
    const std = Math.sqrt(variance);
    return { ok: true, data: { mttf: Math.round(mean * 1000) / 1000, stdDev: Math.round(std * 1000) / 1000 } };
  }

  updateModel(componentId: string, newReading: number): R {
    const comp = this._components.get(componentId);
    if (!comp) return { ok: false, error: "Component not found" };
    comp.readings.push(newReading);
    if (comp.readings.length > 200) comp.readings = comp.readings.slice(-200);
    comp.lastUpdate = Date.now();
    return { ok: true, data: { readingCount: comp.readings.length, lastReading: newReading } };
  }

  getRiskScore(componentId: string): R {
    const pred = this.predictFailure(componentId);
    if (!pred.ok) return pred;
    const prob = pred.data.failureProbability;
    const riskScore = Math.round(prob * 100);
    let level: string;
    if (riskScore >= 80) level = "critical";
    else if (riskScore >= 50) level = "high";
    else if (riskScore >= 25) level = "medium";
    else level = "low";
    return { ok: true, data: { riskScore, level, failureProbability: prob } };
  }

  private linearTrend(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    const denom = n * sumX2 - sumX * sumX;
    return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  }
}

export class MaintenanceScheduler {
  private _tasks: Map<string, { id: string; componentId: string; interval: number; priority: number; lastRun: number; nextRun: number; completed: boolean }> = new Map();
  private _schedule: string[] = [];

  addTask(id: string, componentId: string, interval: number, priority: number): R {
    if (this._tasks.has(id)) return { ok: false, error: "Task exists" };
    const now = Date.now();
    this._tasks.set(id, { id, componentId, interval, priority, lastRun: 0, nextRun: now, completed: false });
    this.rebuildSchedule();
    return { ok: true, data: { id, componentId, nextRun: now } };
  }

  schedule(): R {
    const now = Date.now();
    const due: string[] = [];
    for (const [id, task] of this._tasks) {
      if (!task.completed && task.nextRun <= now) {
        due.push(id);
      }
    }
    due.sort((a, b) => {
      const ta = this._tasks.get(a)!;
      const tb = this._tasks.get(b)!;
      return tb.priority - ta.priority;
    });
    return { ok: true, data: { dueTasks: due, count: due.length } };
  }

  getNextMaintenance(componentId: string): R {
    let earliest: { id: string; nextRun: number } | null = null;
    for (const [id, task] of this._tasks) {
      if (task.componentId === componentId && !task.completed) {
        if (!earliest || task.nextRun < earliest.nextRun) {
          earliest = { id, nextRun: task.nextRun };
        }
      }
    }
    if (!earliest) return { ok: false, error: "No pending tasks" };
    return { ok: true, data: earliest };
  }

  completeTask(taskId: string): R {
    const task = this._tasks.get(taskId);
    if (!task) return { ok: false, error: "Task not found" };
    const now = Date.now();
    task.lastRun = now;
    task.nextRun = now + task.interval;
    task.completed = false;
    this.rebuildSchedule();
    return { ok: true, data: { taskId, nextRun: task.nextRun } };
  }

  overdueTasks(): R {
    const now = Date.now();
    const overdue: Array<{ id: string; componentId: string; overdueBy: number; priority: number }> = [];
    for (const [id, task] of this._tasks) {
      if (!task.completed && task.nextRun < now) {
        overdue.push({ id, componentId: task.componentId, overdueBy: now - task.nextRun, priority: task.priority });
      }
    }
    overdue.sort((a, b) => b.overdueBy - a.overdueBy);
    return { ok: true, data: overdue };
  }

  getStats(): R {
    let total = 0, completed = 0, overdue = 0;
    const now = Date.now();
    for (const task of this._tasks.values()) {
      total++;
      if (task.lastRun > 0) completed++;
      if (!task.completed && task.nextRun < now) overdue++;
    }
    return { ok: true, data: { total, completed, overdue, pending: total - overdue } };
  }

  private rebuildSchedule(): void {
    this._schedule = Array.from(this._tasks.keys()).sort((a, b) => {
      const ta = this._tasks.get(a)!;
      const tb = this._tasks.get(b)!;
      return tb.priority - ta.priority;
    });
  }
}

export class SparePartsManager {
  private _parts: Map<string, { id: string; name: string; quantity: number; minStock: number }> = new Map();
  private _usage: Array<{ partId: string; quantity: number; timestamp: number }> = [];

  addPart(id: string, name: string, quantity: number, minStock: number): R {
    if (this._parts.has(id)) return { ok: false, error: "Part exists" };
    this._parts.set(id, { id, name, quantity, minStock });
    return { ok: true, data: { id, name, quantity, minStock } };
  }

  usePart(id: string, quantity: number): R {
    const part = this._parts.get(id);
    if (!part) return { ok: false, error: "Part not found" };
    if (part.quantity < quantity) return { ok: false, error: "Insufficient stock" };
    part.quantity -= quantity;
    this._usage.push({ partId: id, quantity, timestamp: Date.now() });
    return { ok: true, data: { id, remaining: part.quantity, lowStock: part.quantity <= part.minStock } };
  }

  orderPart(id: string, quantity: number): R {
    const part = this._parts.get(id);
    if (!part) return { ok: false, error: "Part not found" };
    part.quantity += quantity;
    return { ok: true, data: { id, newQuantity: part.quantity } };
  }

  getStock(id: string): R {
    const part = this._parts.get(id);
    if (!part) return { ok: false, error: "Part not found" };
    return { ok: true, data: { id: part.id, name: part.name, quantity: part.quantity, minStock: part.minStock } };
  }

  getLowStock(): R {
    const low: Array<{ id: string; name: string; quantity: number; minStock: number }> = [];
    for (const part of this._parts.values()) {
      if (part.quantity <= part.minStock) {
        low.push({ id: part.id, name: part.name, quantity: part.quantity, minStock: part.minStock });
      }
    }
    return { ok: true, data: low };
  }

  getUsage(): R {
    const summary = new Map<string, number>();
    for (const entry of this._usage) {
      summary.set(entry.partId, (summary.get(entry.partId) ?? 0) + entry.quantity);
    }
    const usage = Array.from(summary.entries()).map(([partId, totalUsed]) => ({
      partId,
      totalUsed,
      occurrences: this._usage.filter(u => u.partId === partId).length,
    }));
    return { ok: true, data: usage };
  }

  forecastNeed(partId: string, days: number): R {
    const part = this._parts.get(partId);
    if (!part) return { ok: false, error: "Part not found" };
    const cutoff = Date.now() - days * 86400000;
    const recent = this._usage.filter(u => u.partId === partId && u.timestamp >= cutoff);
    const totalUsed = recent.reduce((s, u) => s + u.quantity, 0);
    const dailyRate = days > 0 ? totalUsed / days : 0;
    const daysUntilLow = dailyRate > 0 ? (part.quantity - part.minStock) / dailyRate : -1;
    return {
      ok: true,
      data: {
        partId,
        dailyRate: Math.round(dailyRate * 1000) / 1000,
        daysUntilLow: Math.round(daysUntilLow),
        recommendedOrder: Math.max(0, Math.ceil(dailyRate * days - part.quantity + part.minStock)),
      },
    };
  }
}

export class VibrationAnalyzer {
  private _sensors: Map<string, { id: string; location: string; readings: Array<{ timestamp: number; amplitude: number; frequency: number }>; bearingFaultScore: number }> = new Map();

  addSensor(id: string, location: string): R {
    if (this._sensors.has(id)) return { ok: false, error: "Sensor exists" };
    this._sensors.set(id, { id, location, readings: [], bearingFaultScore: 0 });
    return { ok: true, data: { id, location } };
  }

  updateReading(sensorId: string, data: { amplitude: number; frequency: number }): R {
    const sensor = this._sensors.get(sensorId);
    if (!sensor) return { ok: false, error: "Sensor not found" };
    sensor.readings.push({ timestamp: Date.now(), amplitude: data.amplitude, frequency: data.frequency });
    if (sensor.readings.length > 500) sensor.readings = sensor.readings.slice(-500);
    return { ok: true, data: { readingCount: sensor.readings.length } };
  }

  analyzeFFT(sensorId: string): R {
    const sensor = this._sensors.get(sensorId);
    if (!sensor) return { ok: false, error: "Sensor not found" };
    if (sensor.readings.length < 4) return { ok: false, error: "Insufficient data" };
    const amps = sensor.readings.slice(-64).map(r => r.amplitude);
    const freqs = sensor.readings.slice(-64).map(r => r.frequency);
    const dominantIdx = amps.indexOf(Math.max(...amps));
    const totalEnergy = amps.reduce((s, a) => s + a * a, 0);
    const spectralCentroid = amps.reduce((s, a, i) => s + a * freqs[i], 0) / amps.reduce((s, a) => s + a, 0);
    return {
      ok: true,
      data: {
        dominantFrequency: freqs[dominantIdx],
        dominantAmplitude: amps[dominantIdx],
        totalEnergy: Math.round(totalEnergy * 1000) / 1000,
        spectralCentroid: Math.round(spectralCentroid * 100) / 100,
        sampleCount: amps.length,
      },
    };
  }

  detectBearingFault(sensorId: string): R {
    const sensor = this._sensors.get(sensorId);
    if (!sensor) return { ok: false, error: "Sensor not found" };
    if (sensor.readings.length < 10) return { ok: false, error: "Insufficient data" };
    const recent = sensor.readings.slice(-20);
    const avgAmp = recent.reduce((s, r) => s + r.amplitude, 0) / recent.length;
    const maxAmp = Math.max(...recent.map(r => r.amplitude));
    const variance = recent.reduce((s, r) => s + (r.amplitude - avgAmp) ** 2, 0) / recent.length;
    const crestFactor = maxAmp / (avgAmp || 1);
    const faultScore = Math.min(100, Math.round((crestFactor * 0.4 + Math.sqrt(variance) * 0.3 + avgAmp * 0.3) * 10));
    sensor.bearingFaultScore = faultScore;
    let diagnosis: string;
    if (faultScore >= 70) diagnosis = "severe_bearing_fault";
    else if (faultScore >= 40) diagnosis = "moderate_wear";
    else if (faultScore >= 20) diagnosis = "early_wear";
    else diagnosis = "healthy";
    return { ok: true, data: { faultScore, diagnosis, crestFactor: Math.round(crestFactor * 100) / 100, avgAmplitude: Math.round(avgAmp * 1000) / 1000 } };
  }

  getDominantFrequency(sensorId: string): R {
    const sensor = this._sensors.get(sensorId);
    if (!sensor) return { ok: false, error: "Sensor not found" };
    if (sensor.readings.length === 0) return { ok: false, error: "No readings" };
    const last = sensor.readings[sensor.readings.length - 1];
    return { ok: true, data: { frequency: last.frequency, amplitude: last.amplitude } };
  }

  getTrend(sensorId: string): R {
    const sensor = this._sensors.get(sensorId);
    if (!sensor) return { ok: false, error: "Sensor not found" };
    if (sensor.readings.length < 5) return { ok: false, error: "Insufficient data" };
    const recent = sensor.readings.slice(-20).map(r => r.amplitude);
    const older = sensor.readings.slice(-40, -20).map(r => r.amplitude);
    if (older.length === 0) return { ok: false, error: "Insufficient historical data" };
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const changePercent = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
    let direction: string;
    if (changePercent > 10) direction = "increasing";
    else if (changePercent < -10) direction = "decreasing";
    else direction = "stable";
    return {
      ok: true,
      data: {
        direction,
        changePercent: Math.round(changePercent * 100) / 100,
        recentAvg: Math.round(recentAvg * 1000) / 1000,
        olderAvg: Math.round(olderAvg * 1000) / 1000,
      },
    };
  }
}

export class OilAnalyzer {
  private _samples: Map<string, Array<{ timestamp: number; viscosity: number; metalContent: number; waterContent: number; ph: number }>> = new Map();

  addSample(componentId: string, viscosity: number, metalContent: number, waterContent: number, ph: number): R {
    if (!this._samples.has(componentId)) this._samples.set(componentId, []);
    const samples = this._samples.get(componentId)!;
    samples.push({ timestamp: Date.now(), viscosity, metalContent, waterContent, ph });
    if (samples.length > 100) samples.splice(0, samples.length - 100);
    return { ok: true, data: { componentId, sampleCount: samples.length } };
  }

  analyze(componentId: string): R {
    const samples = this._samples.get(componentId);
    if (!samples || samples.length === 0) return { ok: false, error: "No samples" };
    const latest = samples[samples.length - 1];
    const issues: string[] = [];
    if (latest.viscosity > 50) issues.push("high_viscosity");
    else if (latest.viscosity < 10) issues.push("low_viscosity");
    if (latest.metalContent > 100) issues.push("excessive_metal_contamination");
    else if (latest.metalContent > 50) issues.push("moderate_metal_contamination");
    if (latest.waterContent > 5) issues.push("water_contamination");
    if (latest.ph < 6 || latest.ph > 9) issues.push("abnormal_ph");
    const healthScore = Math.max(0, 100 - issues.length * 25);
    return { ok: true, data: { viscosity: latest.viscosity, metalContent: latest.metalContent, waterContent: latest.waterContent, ph: latest.ph, issues, healthScore } };
  }

  getHealthIndex(componentId: string): R {
    const result = this.analyze(componentId);
    if (!result.ok) return result;
    return { ok: true, data: { healthIndex: result.data.healthScore } };
  }

  getRecommendation(componentId: string): R {
    const result = this.analyze(componentId);
    if (!result.ok) return result;
    const recs: string[] = [];
    if (result.data.healthScore <= 25) recs.push("immediate_oil_change");
    else if (result.data.healthScore <= 50) recs.push("schedule_oil_change");
    if (result.data.issues.includes("water_contamination")) recs.push("investigate_water_source");
    if (result.data.issues.some(i => i.includes("metal"))) recs.push("inspect_wear_parts");
    if (recs.length === 0) recs.push("oil_condition_normal");
    return { ok: true, data: { recommendations: recs, healthScore: result.data.healthScore } };
  }

  getTrend(componentId: string): R {
    const samples = this._samples.get(componentId);
    if (!samples || samples.length < 3) return { ok: false, error: "Insufficient samples" };
    const recent = samples.slice(-5);
    const older = samples.slice(-10, -5);
    if (older.length === 0) return { ok: false, error: "Insufficient historical data" };
    const avgRecentVisc = recent.reduce((s, r) => s + r.viscosity, 0) / recent.length;
    const avgOlderVisc = older.reduce((s, r) => s + r.viscosity, 0) / older.length;
    const avgRecentMetal = recent.reduce((s, r) => s + r.metalContent, 0) / recent.length;
    const avgOlderMetal = older.reduce((s, r) => s + r.metalContent, 0) / older.length;
    return {
      ok: true,
      data: {
        viscosityTrend: avgRecentVisc > avgOlderVisc ? "increasing" : "decreasing",
        metalTrend: avgRecentMetal > avgOlderMetal ? "increasing" : "decreasing",
        viscosityDelta: Math.round((avgRecentVisc - avgOlderVisc) * 100) / 100,
        metalDelta: Math.round((avgRecentMetal - avgOlderMetal) * 100) / 100,
      },
    };
  }
}

export class ThermalTrendAnalyzer {
  private _sensors: Map<string, { id: string; location: string; temps: Array<{ timestamp: number; value: number }>; limit: number }> = new Map();

  addSensor(id: string, location: string): R {
    if (this._sensors.has(id)) return { ok: false, error: "Sensor exists" };
    this._sensors.set(id, { id, location, temps: [], limit: 90 });
    return { ok: true, data: { id, location } };
  }

  updateTemp(sensorId: string, temp: number): R {
    const sensor = this._sensors.get(sensorId);
    if (!sensor) return { ok: false, error: "Sensor not found" };
    sensor.temps.push({ timestamp: Date.now(), value: temp });
    if (sensor.temps.length > 500) sensor.temps = sensor.temps.slice(-500);
    return { ok: true, data: { sensorId, temp, totalReadings: sensor.temps.length } };
  }

  predictOverheat(sensorId: string): R {
    const sensor = this._sensors.get(sensorId);
    if (!sensor) return { ok: false, error: "Sensor not found" };
    if (sensor.temps.length < 5) return { ok: false, error: "Insufficient data" };
    const recent = sensor.temps.slice(-20);
    const rate = this.calcRateOfChange(recent);
    const currentTemp = recent[recent.length - 1].value;
    const remaining = sensor.limit - currentTemp;
    const etaSeconds = rate > 0 ? remaining / rate : -1;
    return {
      ok: true,
      data: {
        currentTemp,
        limit: sensor.limit,
        rateOfChange: Math.round(rate * 10000) / 10000,
        etaToOverheat: etaSeconds > 0 ? Math.round(etaSeconds) : null,
        willOverheat: rate > 0 && remaining > 0,
      },
    };
  }

  getTrend(sensorId: string): R {
    const sensor = this._sensors.get(sensorId);
    if (!sensor) return { ok: false, error: "Sensor not found" };
    if (sensor.temps.length < 5) return { ok: false, error: "Insufficient data" };
    const recent = sensor.temps.slice(-20);
    const temps = recent.map(t => t.value);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
    const rate = this.calcRateOfChange(recent);
    let direction: string;
    if (rate > 0.1) direction = "rising";
    else if (rate < -0.1) direction = "falling";
    else direction = "stable";
    return {
      ok: true,
      data: { direction, rateOfChange: Math.round(rate * 10000) / 10000, min, max, avg: Math.round(avg * 100) / 100 },
    };
  }

  getRateOfChange(sensorId: string): R {
    const sensor = this._sensors.get(sensorId);
    if (!sensor) return { ok: false, error: "Sensor not found" };
    if (sensor.temps.length < 2) return { ok: false, error: "Insufficient data" };
    const recent = sensor.temps.slice(-10);
    const rate = this.calcRateOfChange(recent);
    return { ok: true, data: { rateOfChange: Math.round(rate * 10000) / 10000 } };
  }

  getETAtoLimit(sensorId: string): R {
    const sensor = this._sensors.get(sensorId);
    if (!sensor) return { ok: false, error: "Sensor not found" };
    if (sensor.temps.length < 3) return { ok: false, error: "Insufficient data" };
    const recent = sensor.temps.slice(-20);
    const currentTemp = recent[recent.length - 1].value;
    const rate = this.calcRateOfChange(recent);
    const remaining = sensor.limit - currentTemp;
    if (rate <= 0) return { ok: true, data: { eta: null, message: "Temperature not rising" } };
    if (remaining <= 0) return { ok: true, data: { eta: 0, message: "Already at or above limit" } };
    const etaSeconds = remaining / rate;
    return { ok: true, data: { eta: Math.round(etaSeconds), etaMinutes: Math.round(etaSeconds / 60 * 10) / 10, currentTemp, limit: sensor.limit } };
  }

  private calcRateOfChange(points: Array<{ timestamp: number; value: number }>): number {
    if (points.length < 2) return 0;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const x = (points[i].timestamp - points[0].timestamp) / 1000;
      const y = points[i].value;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    const denom = n * sumX2 - sumX * sumX;
    return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  }
}
