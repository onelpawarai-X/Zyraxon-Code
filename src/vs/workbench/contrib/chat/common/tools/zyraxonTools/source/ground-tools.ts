type R = { ok: boolean; data?: any; error?: string };

// ─── V2X Communication ───────────────────────────────────────────────────────

export class V2XCommunication {
  private _connections: Map<string, { protocol: string; connected: boolean; lastSeen: number }> = new Map();
  private _messages: Array<{ from: string; to: string; type: string; payload: any; timestamp: number }> = [];
  private _signalPhases: Map<string, { phase: number; duration: number; elapsed: number; cycleLength: number }> = new Map();
  private _connectionCounter: number = 0;

  connect(protocol: string): R {
    this._connectionCounter++;
    const id = `v2x-${Date.now()}-${this._connectionCounter.toString(36).padStart(4, "0")}`;
    this._connections.set(id, { protocol, connected: true, lastSeen: Date.now() });
    return { ok: true, data: { connectionId: id, protocol } };
  }

  disconnect(connectionId?: string): R {
    if (connectionId) {
      const conn = this._connections.get(connectionId);
      if (!conn) return { ok: false, error: "Connection not found" };
      conn.connected = false;
      return { ok: true, data: { connectionId, disconnected: true } };
    }
    let count = 0;
    for (const [, conn] of this._connections) {
      conn.connected = false;
      count++;
    }
    return { ok: true, data: { disconnected: count } };
  }

  sendV2V(targetId: string, msg: any): R {
    const entry = { from: "self", to: targetId, type: "V2V", payload: msg, timestamp: Date.now() };
    this._messages.push(entry);
    return { ok: true, data: entry };
  }

  sendV2I(infrastructureId: string, msg: any): R {
    const entry = { from: "self", to: infrastructureId, type: "V2I", payload: msg, timestamp: Date.now() };
    this._messages.push(entry);
    return { ok: true, data: entry };
  }

  sendV2P(pedestrianId: string, msg: any): R {
    const entry = { from: "self", to: pedestrianId, type: "V2P", payload: msg, timestamp: Date.now() };
    this._messages.push(entry);
    return { ok: true, data: entry };
  }

  getMessages(filter?: { type?: string; since?: number }): R {
    let result = this._messages;
    if (filter?.type) result = result.filter(m => m.type === filter.type);
    if (filter?.since) result = result.filter(m => m.timestamp >= filter.since);
    return { ok: true, data: result.slice(-100) };
  }

  getSignalPhase(intersectionId: string): R {
    const phase = this._signalPhases.get(intersectionId);
    if (!phase) return { ok: false, error: "Intersection not found" };
    const now = Date.now();
    const elapsed = phase.elapsed + (now - (phase as any)._lastUpdate);
    const cyclePos = elapsed % phase.cycleLength;
    let accumulated = 0;
    let currentPhase = 0;
    for (let i = 0; i < phase.duration.length; i++) {
      accumulated += phase.duration[i];
      if (cyclePos < accumulated) { currentPhase = i; break; }
    }
    return { ok: true, data: { intersectionId, phase: currentPhase, timeToChange: accumulated - cyclePos, totalPhases: phase.duration.length } };
  }
}

// ─── Pedestrian Prediction ────────────────────────────────────────────────────

interface Pedestrian {
  id: string; x: number; y: number; vx: number; vy: number; intent: string;
  history: Array<{ x: number; y: number; t: number }>;
  kalmanState: { px: number; py: number; pvx: number; pvy: number; confidence: number };
}

export class PedestrianPrediction {
  private _pedestrians: Map<string, Pedestrian> = new Map();

  private _kalmanUpdate(p: Pedestrian, dt: number): void {
    const k = p.kalmanState;
    const predicted_x = k.px + k.pvx * dt;
    const predicted_y = k.py + k.pvy * dt;
    const gain = 0.6;
    k.px = predicted_x + gain * (p.x - predicted_x);
    k.py = predicted_y + gain * (p.y - predicted_y);
    k.pvx = k.pvx + gain * ((p.x - k.px) / Math.max(dt, 0.01) - k.pvx);
    k.pvy = k.pvy + gain * ((p.y - k.py) / Math.max(dt, 0.01) - k.pvy);
    k.confidence = Math.min(1, k.confidence + 0.1);
  }

  addPedestrian(id: string, x: number, y: number, vx: number, vy: number, intent: string): R {
    const now = Date.now();
    const ped: Pedestrian = {
      id, x, y, vx, vy, intent,
      history: [{ x, y, t: now }],
      kalmanState: { px: x, py: y, pvx: vx, pvy: vy, confidence: 0.5 },
    };
    this._pedestrians.set(id, ped);
    return { ok: true, data: { id, registered: true } };
  }

  predictPath(id: string, horizonSec: number): R {
    const ped = this._pedestrians.get(id);
    if (!ped) return { ok: false, error: "Pedestrian not found" };
    const points: Array<{ x: number; y: number; t: number }> = [];
    const k = ped.kalmanState;
    const steps = Math.ceil(horizonSec / 0.1);
    for (let i = 1; i <= steps; i++) {
      const t = i * 0.1;
      let intentMod = 1;
      if (ped.intent === "crossing") intentMod = 1.2;
      else if (ped.intent === "stopping") intentMod = Math.max(0, 1 - t * 0.5);
      else if (ped.intent === "turning") intentMod = 0.8;
      points.push({
        x: k.px + k.pvx * t * intentMod,
        y: k.py + k.pvy * t * intentMod,
        t: Date.now() + t * 1000,
      });
    }
    return { ok: true, data: { id, path: points, confidence: k.confidence } };
  }

  assessRisk(id: string, vehiclePath: Array<{ x: number; y: number }>): R {
    const ped = this._pedestrians.get(id);
    if (!ped) return { ok: false, error: "Pedestrian not found" };
    if (!vehiclePath || vehiclePath.length < 2) return { ok: true, data: { risk: "low", reason: "No vehicle path" } };
    const predResult = this.predictPath(id, 3);
    if (!predResult.ok || !predResult.data) return { ok: true, data: { risk: "unknown" } };
    const pedPath = predResult.data.path;
    let minDist = Infinity;
    let ttc = Infinity;
    for (let i = 0; i < pedPath.length; i++) {
      for (let j = 0; j < vehiclePath.length - 1; j++) {
        const dx = pedPath[i].x - vehiclePath[j].x;
        const dy = pedPath[i].y - vehiclePath[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          const vSpeed = Math.sqrt(ped.vx ** 2 + ped.vy ** 2);
          ttc = vSpeed > 0 ? dist / vSpeed : Infinity;
        }
      }
    }
    const risk = minDist < 2 ? "critical" : minDist < 5 ? "high" : minDist < 10 ? "medium" : "low";
    return { ok: true, data: { id, risk, minDistance: minDist, ttc, intent: ped.intent } };
  }

  getCrossingProbability(id: string): R {
    const ped = this._pedestrians.get(id);
    if (!ped) return { ok: false, error: "Pedestrian not found" };
    let prob = 0;
    if (ped.intent === "crossing") prob = 0.95;
    else if (ped.intent === "stopping") prob = 0.05;
    else if (ped.intent === "turning") prob = 0.4;
    else {
      const speed = Math.sqrt(ped.vx ** 2 + ped.vy ** 2);
      prob = speed > 1.5 ? 0.7 : speed > 0.5 ? 0.3 : 0.1;
    }
    if (ped.history.length > 1) {
      const last = ped.history[ped.history.length - 1];
      const prev = ped.history[ped.history.length - 2];
      const lateralSpeed = Math.abs((last.x - prev.x));
      prob = Math.min(1, prob + lateralSpeed * 0.1);
    }
    return { ok: true, data: { id, crossingProbability: Math.round(prob * 100) / 100, intent: ped.intent } };
  }
}

// ─── Traffic Light Recognition ────────────────────────────────────────────────

interface SignalState {
  currentPhase: number; phases: Array<{ state: string; duration: number }>;
  cycleStart: number; lastUpdate: number;
}

export class TrafficLightRecognition {
  private _signals: Map<string, SignalState> = new Map();

  setSignal(intersectionId: string, state: string, timing: { phases: Array<{ state: string; duration: number }> }): R {
    const now = Date.now();
    const existing = this._signals.get(intersectionId);
    let cycleStart = now;
    if (existing) {
      const elapsed = now - existing.cycleStart;
      const totalCycle = existing.phases.reduce((s, p) => s + p.duration, 0);
      cycleStart = now - (elapsed % totalCycle);
    }
    const phases = timing.phases.map(p => ({ state: p.state, duration: p.duration }));
    const currentIdx = phases.findIndex(p => p.state === state);
    this._signals.set(intersectionId, { currentPhase: currentIdx >= 0 ? currentIdx : 0, phases, cycleStart, lastUpdate: now });
    return { ok: true, data: { intersectionId, state, phasesCount: phases.length } };
  }

  getNextPhase(intersectionId: string): R {
    const sig = this._signals.get(intersectionId);
    if (!sig) return { ok: false, error: "Signal not found" };
    const now = Date.now();
    const totalCycle = sig.phases.reduce((s, p) => s + p.duration, 0);
    const elapsed = (now - sig.cycleStart) % totalCycle;
    let accumulated = 0;
    for (let i = 0; i < sig.phases.length; i++) {
      accumulated += sig.phases[i].duration;
      if (elapsed < accumulated) {
        const nextIdx = (i + 1) % sig.phases.length;
        return { ok: true, data: { current: sig.phases[i].state, next: sig.phases[nextIdx].state, nextDuration: sig.phases[nextIdx].duration, timeUntilChange: accumulated - elapsed } };
      }
    }
    return { ok: true, data: { current: sig.phases[0].state, next: sig.phases[1]?.state, timeUntilChange: sig.phases[0].duration } };
  }

  getTimeToChange(intersectionId: string): R {
    const sig = this._signals.get(intersectionId);
    if (!sig) return { ok: false, error: "Signal not found" };
    const now = Date.now();
    const totalCycle = sig.phases.reduce((s, p) => s + p.duration, 0);
    const elapsed = (now - sig.cycleStart) % totalCycle;
    let accumulated = 0;
    for (const phase of sig.phases) {
      accumulated += phase.duration;
      if (elapsed < accumulated) {
        return { ok: true, data: { timeToChange: accumulated - elapsed, currentPhase: phase.state } };
      }
    }
    return { ok: true, data: { timeToChange: sig.phases[0].duration, currentPhase: sig.phases[0].state } };
  }

  shouldProceed(intersectionId: string, vehicleSpeed: number, distance: number): R {
    const sig = this._signals.get(intersectionId);
    if (!sig) return { ok: false, error: "Signal not found" };
    const now = Date.now();
    const totalCycle = sig.phases.reduce((s, p) => s + p.duration, 0);
    const elapsed = (now - sig.cycleStart) % totalCycle;
    let accumulated = 0;
    let currentState = sig.phases[0].state;
    let timeToChange = sig.phases[0].duration;
    for (const phase of sig.phases) {
      accumulated += phase.duration;
      if (elapsed < accumulated) {
        currentState = phase.state;
        timeToChange = accumulated - elapsed;
        break;
      }
    }
    const timeToArrival = vehicleSpeed > 0 ? distance / vehicleSpeed : Infinity;
    if (currentState === "green") {
      if (timeToArrival < timeToChange) return { ok: true, data: { proceed: true, reason: "Green and can arrive before change" } };
      return { ok: true, data: { proceed: false, reason: "Green but cannot arrive before change" } };
    }
    if (currentState === "yellow") {
      return { ok: true, data: { proceed: false, reason: "Yellow — prepare to stop" } };
    }
    return { ok: true, data: { proceed: false, reason: "Red" } };
  }

  getRecommendedSpeed(intersectionId: string, distance: number): R {
    const sig = this._signals.get(intersectionId);
    if (!sig) return { ok: false, error: "Signal not found" };
    const now = Date.now();
    const totalCycle = sig.phases.reduce((s, p) => s + p.duration, 0);
    const elapsed = (now - sig.cycleStart) % totalCycle;
    let accumulated = 0;
    let currentState = sig.phases[0].state;
    let timeToChange = sig.phases[0].duration;
    for (const phase of sig.phases) {
      accumulated += phase.duration;
      if (elapsed < accumulated) {
        currentState = phase.state;
        timeToChange = accumulated - elapsed;
        break;
      }
    }
    if (currentState === "red") {
      return { ok: true, data: { recommendedSpeed: 0, reason: "Stop for red light" } };
    }
    if (currentState === "green") {
      const safeSpeed = Math.max(0, Math.min(distance / Math.max(timeToChange, 0.1) * 0.9, 120));
      return { ok: true, data: { recommendedSpeed: Math.round(safeSpeed), reason: "Green — time-boxed speed" } };
    }
    const safeSpeed = Math.max(0, distance / Math.max(timeToChange, 0.1) * 0.7);
    return { ok: true, data: { recommendedSpeed: Math.round(safeSpeed), reason: "Yellow — reduce speed" } };
  }
}

// ─── Driver Monitoring System ─────────────────────────────────────────────────

interface FaceMetrics {
  eyeOpenness: number; gazeX: number; gazeY: number;
  headPitch: number; headYaw: number; headRoll: number;
  timestamp: number;
}

export class DriverMonitoringSystem {
  private _metrics: FaceMetrics[] = [];
  private _thresholds = {
    eyesClosedDuration: 1500,
    gazeAwayDuration: 3000,
    fatigueWindow: 30000,
    distractionAngle: 15,
    drowsinessBlinkRate: 0.6,
  };

  private _recentEyesClosed(): boolean {
    const now = Date.now();
    let closedStart = 0;
    for (let i = this._metrics.length - 1; i >= 0; i--) {
      if (this._metrics[i].eyeOpenness < 0.2) {
        closedStart = this._metrics[i].timestamp;
      } else break;
    }
    return closedStart > 0 && (now - closedStart) > this._thresholds.eyesClosedDuration;
  }

  private _recentGazeAway(): boolean {
    const now = Date.now();
    let awayStart = 0;
    for (let i = this._metrics.length - 1; i >= 0; i--) {
      const m = this._metrics[i];
      if (Math.abs(m.gazeX) > this._thresholds.distractionAngle || Math.abs(m.gazeY) > this._thresholds.distractionAngle) {
        awayStart = m.timestamp;
      } else break;
    }
    return awayStart > 0 && (now - awayStart) > this._thresholds.gazeAwayDuration;
  }

  private _blinkRate(): number {
    const window = 60000;
    const now = Date.now();
    const recent = this._metrics.filter(m => m.timestamp > now - window);
    let blinks = 0;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i - 1].eyeOpenness > 0.5 && recent[i].eyeOpenness < 0.2) blinks++;
    }
    return blinks;
  }

  updateFaceMetrics(eyeOpen: number, gaze: { x: number; y: number }, headPose: { pitch: number; yaw: number; roll: number }): R {
    const m: FaceMetrics = {
      eyeOpenness: Math.max(0, Math.min(1, eyeOpen)),
      gazeX: gaze.x, gazeY: gaze.y,
      headPitch: headPose.pitch, headYaw: headPose.yaw, headRoll: headPose.roll,
      timestamp: Date.now(),
    };
    this._metrics.push(m);
    if (this._metrics.length > 500) this._metrics = this._metrics.slice(-300);
    return { ok: true, data: { eyeOpenness: m.eyeOpenness, gaze: { x: m.gazeX, y: m.gazeY } } };
  }

  getAlertness(): R {
    const last5 = this._metrics.slice(-5);
    if (last5.length === 0) return { ok: true, data: { alertness: 1, level: "alert" } };
    const avgEyes = last5.reduce((s, m) => s + m.eyeOpenness, 0) / last5.length;
    const avgGaze = last5.reduce((s, m) => s + Math.abs(m.gazeX) + Math.abs(m.gazeY), 0) / last5.length;
    const alertness = Math.max(0, Math.min(1, avgEyes * 0.6 + (1 - Math.min(avgGaze / 30, 1)) * 0.4));
    const level = alertness > 0.7 ? "alert" : alertness > 0.4 ? "drowsy" : "impaired";
    return { ok: true, data: { alertness: Math.round(alertness * 100) / 100, level } };
  }

  getDistraction(): R {
    const distracted = this._recentGazeAway();
    const last5 = this._metrics.slice(-5);
    const avgYaw = last5.length ? last5.reduce((s, m) => s + Math.abs(m.headYaw), 0) / last5.length : 0;
    return { ok: true, data: { distracted, headYaw: Math.round(avgYaw * 10) / 10, threshold: this._thresholds.distractionAngle } };
  }

  getFatigue(): R {
    const blinkRate = this._blinkRate();
    const last20 = this._metrics.slice(-20);
    let nodCount = 0;
    for (let i = 1; i < last20.length; i++) {
      if (last20[i - 1].headPitch < last20[i].headPitch + 5 && last20[i].headPitch > 10) nodCount++;
    }
    const fatigue = Math.min(1, (blinkRate < 10 ? 0.3 : 0) + (nodCount > 3 ? 0.4 : 0) + (this._recentEyesClosed() ? 0.3 : 0));
    return { ok: true, data: { fatigue: Math.round(fatigue * 100) / 100, blinkRate, nodCount, level: fatigue > 0.6 ? "severe" : fatigue > 0.3 ? "moderate" : "normal" } };
  }

  shouldAlert(): R {
    const eyesClosed = this._recentEyesClosed();
    const gazedAway = this._recentGazeAway();
    const fatigueResult = this.getFatigue();
    const fatigue = fatigueResult.data?.fatigue ?? 0;
    const shouldAlert = eyesClosed || gazedAway || fatigue > 0.5;
    const reason = eyesClosed ? "Eyes closed too long" : gazedAway ? "Gaze away too long" : fatigue > 0.5 ? "High fatigue detected" : "None";
    return { ok: true, data: { shouldAlert, reason } };
  }

  getDrowsinessLevel(): R {
    const blinkRate = this._blinkRate();
    const avgEyeOpen = this._metrics.slice(-10).reduce((s, m) => s + m.eyeOpenness, 0) / Math.max(this._metrics.slice(-10).length, 1);
    const yawns = this._metrics.slice(-30).filter(m => m.headPitch > 15 && m.eyeOpenness > 0.7).length;
    let level = 0;
    if (blinkRate < 8) level += 0.3;
    if (avgEyeOpen < 0.3) level += 0.4;
    if (yawns > 2) level += 0.3;
    level = Math.min(1, level);
    const label = level > 0.7 ? "severe_drowsiness" : level > 0.4 ? "moderate_drowsiness" : level > 0.2 ? "mild_drowsiness" : "alert";
    return { ok: true, data: { level: Math.round(level * 100) / 100, label, blinkRate, avgEyeOpen: Math.round(avgEyeOpen * 100) / 100, yawns } };
  }
}

// ─── Road Condition System ────────────────────────────────────────────────────

interface FrictionReading { value: number; x: number; y: number; timestamp: number; source: string }
interface Hazard { type: string; x: number; y: number; severity: number; detectedAt: number; depth?: number }

export class RoadConditionSystem {
  private _friction: FrictionReading[] = [];
  private _hazards: Hazard[] = [];

  private _avgFriction(x: number, y: number, radius: number): number {
    const nearby = this._friction.filter(f => {
      const dx = f.x - x, dy = f.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
    });
    if (nearby.length === 0) return 0.7;
    return nearby.reduce((s, f) => s + f.value, 0) / nearby.length;
  }

  updateFriction(sensor: { value: number; x: number; y: number; source?: string }): R {
    const reading: FrictionReading = { value: Math.max(0, Math.min(1, sensor.value)), x: sensor.x, y: sensor.y, timestamp: Date.now(), source: sensor.source || "default" };
    this._friction.push(reading);
    if (this._friction.length > 200) this._friction = this._friction.slice(-150);
    return { ok: true, data: { friction: reading.value, totalReadings: this._friction.length } };
  }

  detectPothole(x: number, y: number, severity: number): R {
    const hazard: Hazard = { type: "pothole", x, y, severity: Math.max(0, Math.min(1, severity)), detectedAt: Date.now() };
    this._hazards.push(hazard);
    const recommendation = severity > 0.7 ? "avoid" : severity > 0.4 ? "slow_down" : "caution";
    return { ok: true, data: { hazard, recommendation } };
  }

  detectStandingWater(x: number, y: number, depth: number): R {
    const hazard: Hazard = { type: "standing_water", x, y, severity: Math.min(1, depth / 0.3), detectedAt: Date.now(), depth };
    this._hazards.push(hazard);
    const hydroplaningRisk = depth > 0.05 ? "high" : depth > 0.02 ? "medium" : "low";
    return { ok: true, data: { hazard, hydroplaningRisk } };
  }

  getFrictionAhead(x: number, y: number, distance: number): R {
    const ahead = this._friction.filter(f => {
      const dx = f.x - x, dy = f.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= distance;
    });
    const avgFriction = this._avgFriction(x, y, distance);
    const hazardsAhead = this._hazards.filter(h => {
      const dx = h.x - x, dy = h.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= distance;
    });
    const status = avgFriction > 0.6 ? "good" : avgFriction > 0.3 ? "moderate" : "poor";
    return { ok: true, data: { avgFriction: Math.round(avgFriction * 100) / 100, readingsCount: ahead.length, hazardsAhead: hazardsAhead.length, status } };
  }

  getRecommendation(speed: number): R {
    const avg = this._friction.length > 0 ? this._friction.slice(-5).reduce((s, f) => s + f.value, 0) / Math.min(this._friction.length, 5) : 0.7;
    const recentHazards = this._hazards.filter(h => Date.now() - h.detectedAt < 10000);
    let maxSeverity = 0;
    for (const h of recentHazards) maxSeverity = Math.max(maxSeverity, h.severity);
    const stoppingDist = (speed * speed) / (2 * avg * 9.81);
    let recommendedSpeed = speed;
    if (avg < 0.3) recommendedSpeed = Math.min(speed, 30);
    else if (avg < 0.5) recommendedSpeed = Math.min(speed, 60);
    if (maxSeverity > 0.7) recommendedSpeed *= 0.5;
    else if (maxSeverity > 0.4) recommendedSpeed *= 0.7;
    return { ok: true, data: { currentSpeed: speed, recommendedSpeed: Math.round(recommendedSpeed), friction: Math.round(avg * 100) / 100, stoppingDistance: Math.round(stoppingDist), hazardCount: recentHazards.length } };
  }
}

// ─── Collision Imminence System ───────────────────────────────────────────────

interface TrackedObject {
  id: string; x: number; y: number; vx: number; vy: number;
  width: number; height: number; type: string; lastUpdate: number;
}

export class CollisionImminenceSystem {
  private _objects: Map<string, TrackedObject> = new Map();
  private _selfSpeed = 0;
  private _selfX = 0;
  private _selfY = 0;
  private _selfHeading = 0;
  private _brakeDecel = 8.0;
  private _lateralAccel = 4.0;

  updateObjects(objects: Array<{ id: string; x: number; y: number; vx: number; vy: number; width?: number; height?: number; type?: string }>): R {
    const now = Date.now();
    for (const obj of objects) {
      const existing = this._objects.get(obj.id);
      this._objects.set(obj.id, {
        id: obj.id, x: obj.x, y: obj.y, vx: obj.vx, vy: obj.vy,
        width: obj.width ?? 1.5, height: obj.height ?? 1.5, type: obj.type ?? "unknown",
        lastUpdate: now,
      });
    }
    return { ok: true, data: { tracked: this._objects.size } };
  }

  calculateTTC(objectId: string): R {
    const obj = this._objects.get(objectId);
    if (!obj) return { ok: false, error: "Object not found" };
    const dx = obj.x - this._selfX;
    const dy = obj.y - this._selfY;
    const relVx = obj.vx - this._selfSpeed * Math.cos(this._selfHeading);
    const relVy = obj.vy - this._selfSpeed * Math.sin(this._selfHeading);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy);
    const closingSpeed = -(dx * relVx + dy * relVy) / Math.max(dist, 0.1);
    const ttc = closingSpeed > 0 ? dist / closingSpeed : Infinity;
    const alongTrack = (dx * relVx + dy * relVy) / Math.max(relSpeed, 0.01);
    const isApproaching = closingSpeed > 0 && alongTrack > 0;
    return { ok: true, data: { objectId, ttc: Math.round(ttc * 100) / 100, distance: Math.round(dist * 100) / 100, closingSpeed: Math.round(closingSpeed * 100) / 100, isApproaching } };
  }

  getBrakingDistance(speed: number): R {
    const dBrake = (speed * speed) / (2 * this._brakeDecel);
    const reactionDist = speed * 1.5;
    const total = dBrake + reactionDist;
    const dBrakeWet = (speed * speed) / (2 * this._brakeDecel * 0.6);
    return { ok: true, data: { brakingDistance: Math.round(dBrake * 100) / 100, reactionDistance: Math.round(reactionDist * 100) / 100, totalStoppingDistance: Math.round(total * 100) / 100, wetStoppingDistance: Math.round(dBrakeWet + reactionDist * 100) / 100, deceleration: this._brakeDecel } };
  }

  shouldBrake(): R {
    let minTTC = Infinity;
    let threatId = "";
    for (const [id] of this._objects) {
      const result = this.calculateTTC(id);
      if (result.ok && result.data && result.data.ttc < minTTC && result.data.isApproaching) {
        minTTC = result.data.ttc;
        threatId = id;
      }
    }
    const brakeDist = this.getBrakingDistance(this._selfSpeed).data?.totalStoppingDistance ?? 0;
    const nearestObj = this._objects.get(threatId);
    const nearestDist = nearestObj ? Math.sqrt((nearestObj.x - this._selfX) ** 2 + (nearestObj.y - this._selfY) ** 2) : Infinity;
    const shouldBrake = minTTC < 3 || nearestDist < brakeDist * 1.2;
    const urgency = minTTC < 1 ? "emergency" : minTTC < 2 ? "urgent" : minTTC < 3 ? "warning" : "none";
    return { ok: true, data: { shouldBrake, minTTC: Math.round(minTTC * 100) / 100, threatId, urgency, distanceToThreat: Math.round(nearestDist * 100) / 100 } };
  }

  shouldEvade(): R {
    const brakeCheck = this.shouldBrake();
    if (!brakeCheck.ok || !brakeCheck.data?.shouldBrake) return { ok: true, data: { shouldEvade: false, reason: "Braking sufficient" } };
    const minTTC = brakeCheck.data.minTTC;
    const brakeDist = this.getBrakingDistance(this._selfSpeed).data?.totalStoppingDistance ?? 0;
    const threatObj = this._objects.get(brakeCheck.data.threatId);
    if (!threatObj) return { ok: true, data: { shouldEvade: false, reason: "No threat" } };
    const dist = Math.sqrt((threatObj.x - this._selfX) ** 2 + (threatObj.y - this._selfY) ** 2);
    const shouldEvade = minTTC < 1.5 && dist < brakeDist * 0.8;
    const reason = shouldEvade ? "Braking alone insufficient — evasion needed" : "Braking should be sufficient";
    return { ok: true, data: { shouldEvade, reason, minTTC, distance: Math.round(dist * 100) / 100 } };
  }

  getEvadeDirection(): R {
    const threatId = this.shouldBrake().data?.threatId;
    if (!threatId) return { ok: true, data: { direction: "none", reason: "No threat" } };
    const threat = this._objects.get(threatId);
    if (!threat) return { ok: true, data: { direction: "none" } };
    const relX = threat.x - this._selfX;
    const relY = threat.y - this._selfY;
    const cross = Math.cos(this._selfHeading) * relY - Math.sin(this._selfHeading) * relX;
    const direction = cross > 0 ? "right" : "left";
    const lateralNeeded = Math.abs(cross);
    const feasible = lateralNeeded < this._lateralAccel * 2;
    return { ok: true, data: { direction, feasible, lateralDistance: Math.round(Math.abs(cross) * 100) / 100, reason: feasible ? `Evade ${direction}` : "Lane boundaries may be insufficient" } };
  }
}
