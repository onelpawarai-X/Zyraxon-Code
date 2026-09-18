type R = { ok: boolean; data?: any; error?: string };

interface VitalReading {
  value: number;
  timestamp: number;
}

interface VitalRanges {
  min: number;
  max: number;
  criticalLow: number;
  criticalHigh: number;
}

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  addedAt: number;
}

interface PatientInfo {
  id: string;
  name: string;
  age: number;
  vitals: Record<string, number>;
  history: Record<string, VitalReading[]>;
  alerts: string[];
}

const VITAL_RANGES: Record<string, VitalRanges> = {
  heartRate: { min: 60, max: 100, criticalLow: 40, criticalHigh: 150 },
  bloodPressureSystolic: { min: 90, max: 140, criticalLow: 70, criticalHigh: 180 },
  bloodPressureDiastolic: { min: 60, max: 90, criticalLow: 40, criticalHigh: 120 },
  spO2: { min: 95, max: 100, criticalLow: 90, criticalHigh: 101 },
  temperature: { min: 36.1, max: 37.5, criticalLow: 35.0, criticalHigh: 39.5 },
  respiratoryRate: { min: 12, max: 20, criticalLow: 8, criticalHigh: 30 },
};

const INTERACTION_DB: Record<string, string[]> = {
  warfarin: ["aspirin", "ibuprofen", "naproxen", "clopidogrel"],
  metformin: ["alcohol", "contrast dye", "lithium"],
  ssri: ["maoi", "tramadol", "triptans", "lithium"],
  ace_inhibitor: ["potassium supplements", "nsaid", "aliskiren"],
  statin: ["fibrate", "niacin", "cyclosporine"],
  methotrexate: ["nsaid", "penicillin", "probenecid"],
  lithium: ["nsaid", "ssri", "ace_inhibitor", "diuretic"],
  digoxin: ["amiodarone", "verapamil", "quinidine"],
  potassium_sparing_diuretic: ["potassium supplements", "ace_inhibitor", "arb"],
  nsaid: ["warfarin", "ace_inhibitor", "lithium", "methotrexate"],
};

const DRUG_CLASS_MAP: Record<string, string> = {
  aspirin: "nsaid",
  ibuprofen: "nsaid",
  naproxen: "nsaid",
  warfarin: "warfarin",
  metformin: "metformin",
  prozac: "ssri",
  fluoxetine: "ssri",
  sertraline: "ssri",
  paroxetine: "ssri",
  escitalopram: "ssri",
  lisinopril: "ace_inhibitor",
  enalapril: "ace_inhibitor",
  ramipril: "ace_inhibitor",
  atorvastatin: "statin",
  simvastatin: "statin",
  rosuvastatin: "statin",
  lithium: "lithium",
  methotrexate: "methotrexate",
  digoxin: "digoxin",
};

export class VitalSignsMonitor {
  private _readings: Map<string, VitalReading[]>;
  private _latest: Map<string, number>;

  constructor() {
    this._readings = new Map();
    this._latest = new Map();
  }

  updateReading(vital: string, value: number): R {
    if (!VITAL_RANGES[vital]) {
      return { ok: false, error: `Unknown vital: ${vital}` };
    }
    const reading: VitalReading = { value, timestamp: Date.now() };
    const history = this._readings.get(vital) || [];
    history.push(reading);
    if (history.length > 1000) history.shift();
    this._readings.set(vital, history);
    this._latest.set(vital, value);
    return { ok: true, data: reading };
  }

  getVitals(): R {
    const vitals: Record<string, any> = {};
    for (const [key, val] of this._latest.entries()) {
      const ranges = VITAL_RANGES[key];
      vitals[key] = {
        value: val,
        normal: val >= ranges.min && val <= ranges.max,
        timestamp: this._readings.get(key)!.slice(-1)[0].timestamp,
      };
    }
    return { ok: true, data: vitals };
  }

  checkAlerts(): R {
    const alerts: { vital: string; value: number; severity: string; message: string }[] = [];
    for (const [key, val] of this._latest.entries()) {
      const ranges = VITAL_RANGES[key];
      if (val < ranges.criticalLow) {
        alerts.push({ vital: key, value: val, severity: "critical", message: `${key} critically low: ${val}` });
      } else if (val > ranges.criticalHigh) {
        alerts.push({ vital: key, value: val, severity: "critical", message: `${key} critically high: ${val}` });
      } else if (val < ranges.min) {
        alerts.push({ vital: key, value: val, severity: "warning", message: `${key} below normal: ${val}` });
      } else if (val > ranges.max) {
        alerts.push({ vital: key, value: val, severity: "warning", message: `${key} above normal: ${val}` });
      }
    }
    return { ok: true, data: alerts };
  }

  getTrend(vital: string): R {
    const history = this._readings.get(vital);
    if (!history || history.length < 2) {
      return { ok: false, error: `Insufficient data for ${vital}` };
    }
    const recent = history.slice(-20);
    const avgRecent = recent.reduce((s, r) => s + r.value, 0) / recent.length;
    const older = history.slice(0, -20);
    const avgOlder = older.length > 0 ? older.reduce((s, r) => s + r.value, 0) / older.length : avgRecent;
    const slope = (avgRecent - avgOlder) / Math.max(older.length, 1);
    let direction: string;
    if (slope > 0.5) direction = "rising";
    else if (slope < -0.5) direction = "falling";
    else direction = "stable";
    return {
      ok: true,
      data: {
        vital,
        direction,
        slope: Math.round(slope * 100) / 100,
        current: this._latest.get(vital),
        average: Math.round(avgRecent * 100) / 100,
        count: history.length,
      },
    };
  }

  isNormal(vital: string): R {
    const val = this._latest.get(vital);
    if (val === undefined) return { ok: false, error: `No reading for ${vital}` };
    const ranges = VITAL_RANGES[vital];
    return { ok: true, data: val >= ranges.min && val <= ranges.max };
  }
}

export class DrugInteractionChecker {
  private _medications: Map<string, Medication>;
  private _interactions: Record<string, string[]>;
  private _drugClasses: Record<string, string>;

  constructor() {
    this._medications = new Map();
    this._interactions = { ...INTERACTION_DB };
    this._drugClasses = { ...DRUG_CLASS_MAP };
  }

  addMedication(name: string, dosage: string, frequency: string): R {
    const key = name.toLowerCase();
    if (this._medications.has(key)) {
      return { ok: false, error: `${name} already in list` };
    }
    const med: Medication = { name, dosage, frequency, addedAt: Date.now() };
    this._medications.set(key, med);
    return { ok: true, data: med };
  }

  removeMedication(name: string): R {
    const key = name.toLowerCase();
    if (!this._medications.has(key)) {
      return { ok: false, error: `${name} not found` };
    }
    this._medications.delete(key);
    return { ok: true, data: { removed: name } };
  }

  checkInteractions(): R {
    const meds = Array.from(this._medications.keys());
    const interactions: { drug1: string; drug2: string; severity: string; detail: string }[] = [];
    for (let i = 0; i < meds.length; i++) {
      for (let j = i + 1; j < meds.length; j++) {
        const d1 = meds[i];
        const d2 = meds[j];
        const class1 = this._drugClasses[d1] || d1;
        const class2 = this._drugClasses[d2] || d2;
        const pairs1 = this._interactions[class1] || [];
        const pairs2 = this._interactions[class2] || [];
        if (pairs1.includes(class2) || pairs2.includes(class1)) {
          interactions.push({
            drug1: this._medications.get(d1)!.name,
            drug2: this._medications.get(d2)!.name,
            severity: "severe",
            detail: `${d1} (${class1}) interacts with ${d2} (${class2})`,
          });
        }
      }
    }
    return { ok: true, data: { totalMeds: meds.length, interactions } };
  }

  getContraindications(): R {
    const meds = Array.from(this._medications.keys());
    const warnings: string[] = [];
    for (const med of meds) {
      const cls = this._drugClasses[med];
      if (cls === "nsaid") warnings.push(`${med}: Risk of GI bleeding, avoid with anticoagulants`);
      if (cls === "ssri") warnings.push(`${med}: Serotonin syndrome risk with MAOIs`);
      if (cls === "warfarin") warnings.push(`${med}: High bleeding risk, monitor INR closely`);
      if (cls === "metformin") warnings.push(`${med}: Risk of lactic acidosis in renal impairment`);
      if (cls === "statin") warnings.push(`${med}: Risk of rhabdomyolysis with fibrates`);
    }
    return { ok: true, data: warnings };
  }

  getDosageAlert(): R {
    const alerts: { name: string; dosage: string; warning: string }[] = [];
    for (const [key, med] of this._medications.entries()) {
      const dosageNum = parseFloat(med.dosage);
      if (isNaN(dosageNum)) continue;
      if (key === "warfarin" && dosageNum > 10) {
        alerts.push({ name: med.name, dosage: med.dosage, warning: "High warfarin dose — bleeding risk" });
      }
      if (key === "metformin" && dosageNum > 2000) {
        alerts.push({ name: med.name, dosage: med.dosage, warning: "Metformin exceeds 2000mg — GI side effects" });
      }
      if ((key === "atorvastatin" || key === "simvastatin") && dosageNum > 80) {
        alerts.push({ name: med.name, dosage: med.dosage, warning: "Statin dose at maximum — monitor liver function" });
      }
    }
    return { ok: true, data: alerts };
  }
}

export class PatientMonitor {
  private _patients: Map<string, PatientInfo>;

  constructor() {
    this._patients = new Map();
  }

  setPatient(id: string, info: { name: string; age: number }): R {
    if (this._patients.has(id)) {
      return { ok: false, error: `Patient ${id} already registered` };
    }
    const patient: PatientInfo = {
      id,
      name: info.name,
      age: info.age,
      vitals: {},
      history: {},
      alerts: [],
    };
    this._patients.set(id, patient);
    return { ok: true, data: patient };
  }

  updateVitals(patientId: string, vitals: Record<string, number>): R {
    const patient = this._patients.get(patientId);
    if (!patient) return { ok: false, error: `Patient ${patientId} not found` };
    for (const [key, val] of Object.entries(vitals)) {
      patient.vitals[key] = val;
      if (!patient.history[key]) patient.history[key] = [];
      patient.history[key].push({ value: val, timestamp: Date.now() });
      if (patient.history[key].length > 500) patient.history[key].shift();
    }
    const alerts = this._evaluateAlerts(patient);
    patient.alerts = alerts;
    return { ok: true, data: { patientId, vitals, alertCount: alerts.length } };
  }

  getAlertLevel(patientId: string): R {
    const patient = this._patients.get(patientId);
    if (!patient) return { ok: false, error: `Patient ${patientId} not found` };
    const critCount = patient.alerts.filter(a => a.startsWith("CRITICAL")).length;
    const warnCount = patient.alerts.filter(a => a.startsWith("WARNING")).length;
    let level: string;
    if (critCount > 0) level = "red";
    else if (warnCount > 1) level = "orange";
    else if (warnCount > 0) level = "yellow";
    else level = "green";
    return { ok: true, data: { patientId, level, alerts: patient.alerts } };
  }

  getTrend(patientId: string, vital: string): R {
    const patient = this._patients.get(patientId);
    if (!patient) return { ok: false, error: `Patient ${patientId} not found` };
    const history = patient.history[vital];
    if (!history || history.length < 3) {
      return { ok: false, error: `Insufficient history for ${vital}` };
    }
    const mid = Math.floor(history.length / 2);
    const firstHalf = history.slice(0, mid);
    const secondHalf = history.slice(mid);
    const avgFirst = firstHalf.reduce((s, r) => s + r.value, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, r) => s + r.value, 0) / secondHalf.length;
    const diff = avgSecond - avgFirst;
    let trend: string;
    if (diff > 1) trend = "increasing";
    else if (diff < -1) trend = "decreasing";
    else trend = "stable";
    return { ok: true, data: { patientId, vital, trend, avgFirst, avgSecond, diff: Math.round(diff * 100) / 100 } };
  }

  predictDeterioration(patientId: string): R {
    const patient = this._patients.get(patientId);
    if (!patient) return { ok: false, error: `Patient ${patientId} not found` };
    let riskScore = 0;
    const factors: string[] = [];
    for (const [vital, range] of Object.entries(VITAL_RANGES)) {
      const val = patient.vitals[vital];
      if (val === undefined) continue;
      const history = patient.history[vital] || [];
      if (history.length < 5) continue;
      const recent = history.slice(-5);
      const slope = (recent[4].value - recent[0].value) / 4;
      const inNormal = val >= range.min && val <= range.max;
      if (!inNormal) {
        riskScore += 20;
        factors.push(`${vital} out of normal range`);
      }
      if (Math.abs(slope) > 2) {
        riskScore += 15;
        factors.push(`${vital} trending ${slope > 0 ? "up" : "down"} rapidly`);
      }
      if (val < range.criticalLow || val > range.criticalHigh) {
        riskScore += 30;
        factors.push(`${vital} at CRITICAL level`);
      }
    }
    riskScore = Math.min(riskScore, 100);
    let risk: string;
    if (riskScore >= 70) risk = "high";
    else if (riskScore >= 40) risk = "moderate";
    else risk = "low";
    return {
      ok: true,
      data: { patientId, riskScore, risk, factors, recommendation: riskScore >= 70 ? "IMMEDIATE ATTENTION" : "continue monitoring" },
    };
  }

  private _evaluateAlerts(patient: PatientInfo): string[] {
    const alerts: string[] = [];
    for (const [key, val] of Object.entries(patient.vitals)) {
      const range = VITAL_RANGES[key];
      if (!range) continue;
      if (val < range.criticalLow || val > range.criticalHigh) {
        alerts.push(`CRITICAL: ${key} = ${val}`);
      } else if (val < range.min || val > range.max) {
        alerts.push(`WARNING: ${key} = ${val}`);
      }
    }
    return alerts;
  }
}
