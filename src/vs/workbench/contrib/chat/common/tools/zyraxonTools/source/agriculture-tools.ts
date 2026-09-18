type R = { ok: boolean; data?: any; error?: string };

interface SoilSample {
  id: string;
  location: { lat: number; lon: number };
  ph: number;
  moisture: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
}

interface Field {
  id: string;
  crop: string;
  area: number;
  growth?: { stage: string; health: number };
}

interface Zone {
  id: string;
  area: number;
  crop: string;
  active: boolean;
  schedules: { time: string; duration: number }[];
}

interface Observation {
  fieldId: string;
  pestType: string;
  severity: number;
  location: { lat: number; lon: number };
  timestamp: number;
}

interface HarvestField {
  id: string;
  crop: string;
  area: number;
  expectedYield: number;
  maturityDate: string;
}

export class SoilAnalyzer {
  private _samples: Map<string, SoilSample> = new Map();

  addSample(
    id: string,
    location: { lat: number; lon: number },
    ph: number,
    moisture: number,
    nitrogen: number,
    phosphorus: number,
    potassium: number
  ): R {
    this._samples.set(id, {
      id,
      location,
      ph,
      moisture,
      nitrogen,
      phosphorus,
      potassium,
    });
    return { ok: true, data: { total: this._samples.size } };
  }

  getRecommendation(sampleId: string): R {
    const s = this._samples.get(sampleId);
    if (!s) return { ok: false, error: "Sample not found" };
    const recs: string[] = [];
    if (s.ph < 6.0) recs.push("Add lime to raise pH");
    if (s.ph > 7.5) recs.push("Add sulfur to lower pH");
    if (s.moisture < 20) recs.push("Increase irrigation");
    if (s.moisture > 60) recs.push("Improve drainage");
    if (s.nitrogen < 30) recs.push("Apply nitrogen-rich fertilizer");
    if (s.phosphorus < 20) recs.push("Apply phosphorus supplement");
    if (s.potassium < 150) recs.push("Apply potash fertilizer");
    return { ok: true, data: { recommendations: recs, healthy: recs.length === 0 } };
  }

  getAverage(): R {
    const all = Array.from(this._samples.values());
    if (all.length === 0) return { ok: false, error: "No samples" };
    const avg = {
      ph: all.reduce((s, x) => s + x.ph, 0) / all.length,
      moisture: all.reduce((s, x) => s + x.moisture, 0) / all.length,
      nitrogen: all.reduce((s, x) => s + x.nitrogen, 0) / all.length,
      phosphorus: all.reduce((s, x) => s + x.phosphorus, 0) / all.length,
      potassium: all.reduce((s, x) => s + x.potassium, 0) / all.length,
    };
    return { ok: true, data: avg };
  }

  getHeatmap(): R {
    const points = Array.from(this._samples.values()).map((s) => ({
      lat: s.location.lat,
      lon: s.location.lon,
      healthScore: this._computeHealth(s),
    }));
    return { ok: true, data: points };
  }

  isHealthy(sampleId: string): R {
    const s = this._samples.get(sampleId);
    if (!s) return { ok: false, error: "Sample not found" };
    return { ok: true, data: this._computeHealth(s) >= 70 };
  }

  private _computeHealth(s: SoilSample): number {
    let score = 100;
    if (s.ph < 5.5 || s.ph > 8.0) score -= 20;
    else if (s.ph < 6.0 || s.ph > 7.5) score -= 10;
    if (s.moisture < 15 || s.moisture > 65) score -= 25;
    else if (s.moisture < 25 || s.moisture > 50) score -= 10;
    if (s.nitrogen < 20) score -= 15;
    if (s.phosphorus < 15) score -= 15;
    if (s.potassium < 120) score -= 15;
    return Math.max(0, score);
  }
}

export class CropMonitor {
  private _fields: Map<string, Field> = new Map();

  addField(id: string, crop: string, area: number): R {
    this._fields.set(id, { id, crop, area });
    return { ok: true, data: { total: this._fields.size } };
  }

  updateGrowth(fieldId: string, stage: string, health: number): R {
    const f = this._fields.get(fieldId);
    if (!f) return { ok: false, error: "Field not found" };
    f.growth = { stage, health: Math.max(0, Math.min(100, health)) };
    return { ok: true, data: { stage, health: f.growth.health } };
  }

  predictYield(fieldId: string): R {
    const f = this._fields.get(fieldId);
    if (!f) return { ok: false, error: "Field not found" };
    const health = f.growth?.health ?? 50;
    const baseYield: Record<string, number> = {
      rice: 4.5,
      wheat: 3.2,
      corn: 9.0,
      cotton: 2.0,
      sugarcane: 70.0,
    };
    const base = baseYield[f.crop] ?? 5.0;
    const predicted = base * (health / 100) * f.area;
    return { ok: true, data: { predictedYield: Math.round(predicted * 100) / 100, unit: "tons" } };
  }

  getHealthIndex(fieldId: string): R {
    const f = this._fields.get(fieldId);
    if (!f) return { ok: false, error: "Field not found" };
    return { ok: true, data: { healthIndex: f.growth?.health ?? 0 } };
  }

  getIrrigationNeed(fieldId: string): R {
    const f = this._fields.get(fieldId);
    if (!f) return { ok: false, error: "Field not found" };
    const health = f.growth?.health ?? 50;
    const stage = f.growth?.stage ?? "unknown";
    let need = "low";
    if (stage === "flowering" || stage === "fruiting") need = "high";
    else if (stage === "vegetative") need = "medium";
    if (health < 40) need = "critical";
    return { ok: true, data: { irrigationNeed: need, area: f.area } };
  }
}

export class IrrigationController {
  private _zones: Map<string, Zone> = new Map();
  private _usage: { zoneId: string; liters: number; timestamp: number }[] = [];

  setZone(id: string, area: number, crop: string): R {
    this._zones.set(id, { id, area, crop, active: false, schedules: [] });
    return { ok: true, data: { total: this._zones.size } };
  }

  setSchedule(zoneId: string, time: string, duration: number): R {
    const z = this._zones.get(zoneId);
    if (!z) return { ok: false, error: "Zone not found" };
    z.schedules.push({ time, duration });
    return { ok: true, data: { schedules: z.schedules.length } };
  }

  startZone(zoneId: string): R {
    const z = this._zones.get(zoneId);
    if (!z) return { ok: false, error: "Zone not found" };
    z.active = true;
    const liters = z.area * 5;
    this._usage.push({ zoneId, liters, timestamp: Date.now() });
    return { ok: true, data: { zoneId, active: true, litersUsed: liters } };
  }

  stopZone(zoneId: string): R {
    const z = this._zones.get(zoneId);
    if (!z) return { ok: false, error: "Zone not found" };
    z.active = false;
    return { ok: true, data: { zoneId, active: false } };
  }

  getWaterUsage(): R {
    const total = this._usage.reduce((s, u) => s + u.liters, 0);
    return { ok: true, data: { totalLiters: total, entries: this._usage.length } };
  }

  getEfficiency(): R {
    const zones = Array.from(this._zones.values());
    const totalArea = zones.reduce((s, z) => s + z.area, 0);
    const totalLiters = this._usage.reduce((s, u) => s + u.liters, 0);
    const efficiency = totalArea > 0 && totalLiters > 0 ? (totalArea / totalLiters) * 1000 : 0;
    return { ok: true, data: { efficiency: Math.round(efficiency * 100) / 100 } };
  }
}

export class PestDetector {
  private _observations: Observation[] = [];

  addObservation(
    fieldId: string,
    pestType: string,
    severity: number,
    location: { lat: number; lon: number }
  ): R {
    this._observations.push({
      fieldId,
      pestType,
      severity: Math.max(0, Math.min(10, severity)),
      location,
      timestamp: Date.now(),
    });
    return { ok: true, data: { total: this._observations.length } };
  }

  getRisk(fieldId: string): R {
    const obs = this._observations.filter((o) => o.fieldId === fieldId);
    if (obs.length === 0) return { ok: true, data: { risk: "none", level: 0 } };
    const avgSev = obs.reduce((s, o) => s + o.severity, 0) / obs.length;
    const uniquePests = new Set(obs.map((o) => o.pestType)).size;
    const riskScore = Math.min(10, avgSev * 0.6 + uniquePests * 0.8);
    let risk = "low";
    if (riskScore > 7) risk = "critical";
    else if (riskScore > 5) risk = "high";
    else if (riskScore > 3) risk = "moderate";
    return { ok: true, data: { risk, level: Math.round(riskScore * 10) / 10 } };
  }

  getRecommendation(fieldId: string): R {
    const obs = this._observations.filter((o) => o.fieldId === fieldId);
    if (obs.length === 0) return { ok: true, data: { actions: ["No pest observations"] } };
    const pests = [...new Set(obs.map((o) => o.pestType))];
    const actions: string[] = [];
    for (const p of pests) {
      const sev = Math.max(...obs.filter((o) => o.pestType === p).map((o) => o.severity));
      if (sev > 7) actions.push(`Immediate treatment for ${p}`);
      else if (sev > 4) actions.push(`Monitor and apply organic control for ${p}`);
      else actions.push(`Continue monitoring for ${p}`);
    }
    return { ok: true, data: { actions } };
  }

  getAffectedAreas(): R {
    const areas = this._observations.map((o) => ({
      fieldId: o.fieldId,
      pestType: o.pestType,
      location: o.location,
    }));
    return { ok: true, data: areas };
  }
}

export class HarvestPlanner {
  private _fields: Map<string, HarvestField> = new Map();

  setField(
    id: string,
    crop: string,
    area: number,
    expectedYield: number,
    maturityDate: string
  ): R {
    this._fields.set(id, { id, crop, area, expectedYield, maturityDate });
    return { ok: true, data: { total: this._fields.size } };
  }

  planSchedule(
    fields: { fieldId: string; priority: number }[]
  ): R {
    const sorted = [...fields].sort((a, b) => b.priority - a.priority);
    const schedule = sorted
      .map((f, i) => {
        const field = this._fields.get(f.fieldId);
        return field
          ? {
              order: i + 1,
              fieldId: f.fieldId,
              crop: field.crop,
              date: field.maturityDate,
            }
          : null;
      })
      .filter(Boolean);
    return { ok: true, data: schedule };
  }

  getEquipmentNeeded(): R {
    const fields = Array.from(this._fields.values());
    const totalArea = fields.reduce((s, f) => s + f.area, 0);
    const harvesters = Math.ceil(totalArea / 100);
    const trucks = Math.ceil(totalArea / 80);
    const grain = fields.some((f) => ["rice", "wheat", "corn"].includes(f.crop))
      ? Math.ceil(totalArea / 120)
      : 0;
    return {
      ok: true,
      data: { harvesters, trucks, grainDryers: grain, totalArea },
    };
  }

  getLaborNeeded(): R {
    const fields = Array.from(this._fields.values());
    const totalArea = fields.reduce((s, f) => s + f.area, 0);
    const workers = Math.ceil(totalArea / 5);
    const days = Math.ceil(totalArea / 20);
    return {
      ok: true,
      data: { workers, estimatedDays: days, totalArea },
    };
  }

  getOptimalDate(fieldId: string): R {
    const f = this._fields.get(fieldId);
    if (!f) return { ok: false, error: "Field not found" };
    const base = new Date(f.maturityDate);
    const fieldCount = this._fields.size;
    const offset = (fieldCount % 5) - 2;
    base.setDate(base.getDate() + offset);
    return {
      ok: true,
      data: {
        optimalDate: base.toISOString().split("T")[0],
        originalMaturity: f.maturityDate,
        confidence: 0.85,
      },
    };
  }
}
