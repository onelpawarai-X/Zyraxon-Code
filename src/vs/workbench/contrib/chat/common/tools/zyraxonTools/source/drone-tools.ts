type R = { ok: boolean; data?: any; error?: string };

interface GeoZone {
  id: string;
  type: "airport" | "military" | "government" | "restricted" | "temporary";
  center: { lat: number; lon: number };
  radius: number;
  altMin: number;
  altMax: number;
}

interface WindSample {
  vx: number;
  vy: number;
  vz: number;
  ts: number;
}

interface Obstacle {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  velocity: { x: number; y: number; z: number };
}

interface SwarmDrone {
  id: string;
  pos: { x: number; y: number; z: number };
  vel: { x: number; y: number; z: number };
  active: boolean;
}

interface Shipment {
  id: string;
  from: string;
  to: string;
  package: any;
  droneId: string | null;
  status: string;
  route: { x: number; y: number; z: number }[];
  chainOfCustody: { actor: string; action: string; timestamp: number; proof?: string }[];
}

interface FieldBoundary {
  points: { x: number; y: number }[];
}

interface SARArea {
  points: { x: number; y: number }[];
}

const Haversine = {
  toMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },
};

function vecSub(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function vecAdd(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
function vecScale(v: { x: number; y: number; z: number }, s: number) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}
function vecLen(v: { x: number; y: number; z: number }) {
  return Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
}
function vecNorm(v: { x: number; y: number; z: number }) {
  const l = vecLen(v);
  return l > 0 ? vecScale(v, 1 / l) : { x: 0, y: 0, z: 0 };
}
function dot(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export class GeoFencing {
  private _zones: Map<string, GeoZone> = new Map();

  addZone(
    id: string,
    type: GeoZone["type"],
    center: { lat: number; lon: number },
    radius: number,
    altMin: number,
    altMax: number
  ): R {
    this._zones.set(id, { id, type, center, radius, altMin, altMax });
    return { ok: true };
  }

  removeZone(id: string): R {
    if (!this._zones.has(id)) return { ok: false, error: "Zone not found" };
    this._zones.delete(id);
    return { ok: true };
  }

  checkPosition(lat: number, lon: number, alt: number): R {
    const violations: GeoZone[] = [];
    for (const z of this._zones.values()) {
      const dist = Haversine.toMeters(lat, lon, z.center.lat, z.center.lon);
      if (dist <= z.radius && alt >= z.altMin && alt <= z.altMax) {
        violations.push(z);
      }
    }
    return { ok: violations.length === 0, data: { inViolation: violations.length > 0, violations } };
  }

  getViolations(): R {
    return { ok: true, data: Array.from(this._zones.values()) };
  }

  getNearestZone(lat: number, lon: number): R {
    let nearest: GeoZone | null = null;
    let minDist = Infinity;
    for (const z of this._zones.values()) {
      const d = Haversine.toMeters(lat, lon, z.center.lat, z.center.lon) - z.radius;
      if (d < minDist) {
        minDist = d;
        nearest = z;
      }
    }
    return nearest ? { ok: true, data: { zone: nearest, distance: Math.max(0, minDist) } } : { ok: false, error: "No zones defined" };
  }
}

export class WindEstimation {
  private _samples: WindSample[] = [];
  private readonly _maxSamples = 200;
  private _turbulence = 0;
  private _gustFactor = 1;

  updateFromIMU(pitch: number, roll: number, throttle: number, velocity: { x: number; y: number; z: number }): R {
    const thrustForward = throttle * Math.cos((pitch * Math.PI) / 180);
    const thrustUp = throttle * Math.sin((pitch * Math.PI) / 180);
    const crossWind = throttle * Math.sin((roll * Math.PI) / 180);
    const windEst = {
      x: -thrustForward * Math.sin((roll * Math.PI) / 180) + crossWind,
      y: velocity.y,
      z: -thrustUp,
    };
    this._pushSample({ vx: windEst.x, vy: windEst.y, vz: windEst.z, ts: Date.now() });
    return { ok: true };
  }

  updateFromGPS(groundSpeed: number, groundTrack: number, airspeed: number, heading: number): R {
    const trackRad = (groundTrack * Math.PI) / 180;
    const headingRad = (heading * Math.PI) / 180;
    const gvx = groundSpeed * Math.sin(trackRad);
    const gvy = groundSpeed * Math.cos(trackRad);
    const avx = airspeed * Math.sin(headingRad);
    const avy = airspeed * Math.cos(headingRad);
    this._pushSample({ vx: avx - gvx, vy: avy - gvy, vz: 0, ts: Date.now() });
    return { ok: true };
  }

  getWindVector(): R {
    if (this._samples.length === 0) return { ok: false, error: "No samples" };
    const recent = this._samples.slice(-50);
    const avg = {
      x: recent.reduce((s, s2) => s + s2.vx, 0) / recent.length,
      y: recent.reduce((s, s2) => s + s2.vy, 0) / recent.length,
      z: recent.reduce((s, s2) => s + s2.vz, 0) / recent.length,
    };
    return { ok: true, data: avg };
  }

  getTurbulence(): R {
    if (this._samples.length < 2) return { ok: false, error: "Not enough data" };
    const recent = this._samples.slice(-50);
    const avg = { x: recent.reduce((s, s2) => s + s2.vx, 0) / recent.length, y: recent.reduce((s, s2) => s + s2.vy, 0) / recent.length };
    const variance = recent.reduce((s, s2) => s + (s2.vx - avg.x) ** 2 + (s2.vy - avg.y) ** 2, 0) / recent.length;
    this._turbulence = Math.sqrt(variance);
    return { ok: true, data: { turbulence: this._turbulence } };
  }

  getGustFactor(): R {
    if (this._samples.length < 10) return { ok: false, error: "Not enough data" };
    const recent = this._samples.slice(-50);
    const speeds = recent.map((s2) => Math.sqrt(s2.vx ** 2 + s2.vy ** 2));
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const maxSpeed = Math.max(...speeds);
    this._gustFactor = avgSpeed > 0 ? maxSpeed / avgSpeed : 1;
    return { ok: true, data: { gustFactor: this._gustFactor } };
  }

  private _pushSample(s: WindSample): void {
    this._samples.push(s);
    if (this._samples.length > this._maxSamples) this._samples.shift();
  }
}

export class ObstacleAvoidance3D {
  private _obstacles: Map<string, Obstacle> = new Map();
  private readonly _repulsiveGain = 50;
  private readonly _attractiveGain = 1.2;

  addObstacle(id: string, x: number, y: number, z: number, radius: number, velocity: { x: number; y: number; z: number }): R {
    this._obstacles.set(id, { id, x, y, z, radius, velocity });
    return { ok: true };
  }

  removeObstacle(id: string): R {
    if (!this._obstacles.delete(id)) return { ok: false, error: "Not found" };
    return { ok: true };
  }

  getAvoidanceVector(dronePos: { x: number; y: number; z: number }, droneVel: { x: number; y: number; z: number }, targetPos: { x: number; y: number; z: number }): R {
    const toTarget = vecSub(targetPos, dronePos);
    const attractive = vecScale(vecNorm(toTarget), this._attractiveGain);
    let repulsive = { x: 0, y: 0, z: 0 };
    for (const obs of this._obstacles.values()) {
      const diff = vecSub(dronePos, obs);
      const dist = vecLen(diff) - obs.radius;
      if (dist < 15) {
        const force = vecScale(vecNorm(diff), this._repulsiveGain / Math.max(dist, 0.5) ** 2);
        repulsive = vecAdd(repulsive, force);
      }
    }
    const velocityObs = this._velocityObstacle(dronePos, droneVel);
    const combined = vecAdd(vecAdd(attractive, repulsive), velocityObs);
    return { ok: true, data: { vector: combined, magnitude: vecLen(combined) } };
  }

  findSafePath(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, obstacles?: Obstacle[]): R {
    const obs = obstacles ?? Array.from(this._obstacles.values());
    const waypoints: { x: number; y: number; z: number }[] = [from];
    let current = from;
    const maxIter = 100;
    for (let i = 0; i < maxIter; i++) {
      const diff = vecSub(to, current);
      if (vecLen(diff) < 1) break;
      let step = vecScale(vecNorm(diff), 2);
      for (const o of obs) {
        const d = vecLen(vecSub(current, o)) - o.radius;
        if (d < 5) {
          const away = vecScale(vecNorm(vecSub(current, o)), 3);
          step = vecAdd(step, away);
        }
      }
      current = vecAdd(current, step);
      waypoints.push({ ...current });
    }
    return { ok: true, data: { waypoints, segments: waypoints.length - 1 } };
  }

  checkCollision(pos: { x: number; y: number; z: number }, radius: number): R {
    const collisions: Obstacle[] = [];
    for (const o of this._obstacles.values()) {
      const dist = vecLen(vecSub(pos, o)) - o.radius;
      if (dist < radius) collisions.push(o);
    }
    return { ok: collisions.length === 0, data: { collision: collisions.length > 0, obstacles: collisions } };
  }

  private _velocityObstacle(pos: { x: number; y: number; z: number }, vel: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    let vo = { x: 0, y: 0, z: 0 };
    for (const o of this._obstacles.values()) {
      const toObs = vecSub(o, pos);
      const dist = vecLen(toObs);
      const relVel = vecSub(vel, o.velocity);
      if (dist < 10 && dot(relVel, vecNorm(toObs)) < 0) {
        vo = vecAdd(vo, vecScale(vecNorm(vecSub(pos, o)), 3));
      }
    }
    return vo;
  }
}

export class SwarmIntelligence {
  private _drones: Map<string, SwarmDrone> = new Map();
  private _leaderId: string | null = null;

  addDrone(id: string, pos: { x: number; y: number; z: number }): R {
    this._drones.set(id, { id, pos: { ...pos }, vel: { x: 0, y: 0, z: 0 }, active: true });
    return { ok: true };
  }

  removeDrone(id: string): R {
    if (!this._drones.delete(id)) return { ok: false, error: "Not found" };
    return { ok: true };
  }

  computeConsensus(): R {
    const active = Array.from(this._drones.values()).filter((d) => d.active);
    if (active.length === 0) return { ok: false, error: "No active drones" };
    const centroid = active.reduce(
      (acc, d) => ({ x: acc.x + d.pos.x / active.length, y: acc.y + d.pos.y / active.length, z: acc.z + d.pos.z / active.length }),
      { x: 0, y: 0, z: 0 }
    );
    const avgDist = active.reduce((s, d) => s + vecLen(vecSub(d.pos, centroid)), 0) / active.length;
    for (const d of active) {
      const toCenter = vecSub(centroid, d.pos);
      const correction = vecScale(vecNorm(toCenter), vecLen(toCenter) * 0.1);
      d.vel = vecAdd(d.vel, correction);
      d.pos = vecAdd(d.pos, d.vel);
    }
    return { ok: true, data: { centroid, avgDist, iterations: 1 } };
  }

  getLeaderElection(): R {
    const active = Array.from(this._drones.values()).filter((d) => d.active);
    if (active.length === 0) return { ok: false, error: "No active drones" };
    let leader = active[0];
    for (const d of active) {
      if (d.pos.z > leader.pos.z) leader = d;
    }
    this._leaderId = leader.id;
    return { ok: true, data: { leaderId: leader.id, position: leader.pos, totalDrones: active.length } };
  }

  splitTask(task: { totalArea: number; boundaries: any }, drones: string[]): R {
    const ids = drones.length > 0 ? drones : Array.from(this._drones.keys());
    const perDrone = task.totalArea / ids.length;
    const assignments = ids.map((id, i) => ({
      droneId: id,
      areaShare: perDrone,
      startIndex: Math.floor((i * task.totalArea) / ids.length),
      endIndex: Math.floor(((i + 1) * task.totalArea) / ids.length),
    }));
    return { ok: true, data: { assignments, droneCount: ids.length } };
  }

  synchronizeClocks(): R {
    const now = Date.now();
    const offsets = Array.from(this._drones.values()).map((d) => ({ id: d.id, offset: 0 }));
    return { ok: true, data: { referenceTime: now, offsets, droneCount: offsets.length } };
  }

  getOptimalCommunication(): R {
    const active = Array.from(this._drones.values()).filter((d) => d.active);
    if (active.length < 2) return { ok: true, data: { mesh: [], coverage: 1 } };
    const edges: { from: string; to: string; distance: number }[] = [];
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const dist = vecLen(vecSub(active[i].pos, active[j].pos));
        if (dist < 50) edges.push({ from: active[i].id, to: active[j].id, distance: dist });
      }
    }
    const coverage = edges.length / ((active.length * (active.length - 1)) / 2);
    return { ok: true, data: { mesh: edges, coverage, droneCount: active.length } };
  }
}

export class PackageDeliveryChain {
  private _shipments: Map<string, Shipment> = new Map();

  createShipment(id: string, from: string, to: string, pkg: any): R {
    const shipment: Shipment = { id, from, to, package: pkg, droneId: null, status: "created", route: [], chainOfCustody: [{ actor: "system", action: "created", timestamp: Date.now() }] };
    this._shipments.set(id, shipment);
    return { ok: true, data: { shipmentId: id } };
  }

  assignDrone(droneId: string, shipmentId: string): R {
    const s = this._shipments.get(shipmentId);
    if (!s) return { ok: false, error: "Shipment not found" };
    s.droneId = droneId;
    s.status = "assigned";
    s.chainOfCustody.push({ actor: droneId, action: "assigned", timestamp: Date.now() });
    return { ok: true };
  }

  updateStatus(shipmentId: string, status: string): R {
    const s = this._shipments.get(shipmentId);
    if (!s) return { ok: false, error: "Shipment not found" };
    s.status = status;
    s.chainOfCustody.push({ actor: s.droneId ?? "system", action: `status:${status}`, timestamp: Date.now() });
    return { ok: true };
  }

  getRoute(shipmentId: string): R {
    const s = this._shipments.get(shipmentId);
    if (!s) return { ok: false, error: "Shipment not found" };
    return { ok: true, data: { route: s.route, status: s.status } };
  }

  confirmDelivery(shipmentId: string, proof: string): R {
    const s = this._shipments.get(shipmentId);
    if (!s) return { ok: false, error: "Shipment not found" };
    s.status = "delivered";
    s.chainOfCustody.push({ actor: s.droneId ?? "system", action: "delivered", timestamp: Date.now(), proof });
    return { ok: true, data: { deliveredAt: Date.now(), chainLength: s.chainOfCustody.length } };
  }

  getChainOfCustody(shipmentId: string): R {
    const s = this._shipments.get(shipmentId);
    if (!s) return { ok: false, error: "Shipment not found" };
    return { ok: true, data: { shipmentId, chain: s.chainOfCustody } };
  }
}

export class AgriculturalSpraying {
  private _field: FieldBoundary | null = null;
  private _sprayParams = { volume: 0, chemical: "" };
  private _coverage: Map<string, number> = new Map();
  private _swaths: { x: number; y: number }[][] = [];

  setField(boundary: FieldBoundary): R {
    this._field = boundary;
    return { ok: true };
  }

  setSprayParams(volume: number, chemical: string): R {
    this._sprayParams = { volume, chemical };
    return { ok: true };
  }

  planSwath(field: FieldBoundary, spacing: number): R {
    const pts = field.points;
    if (pts.length < 2) return { ok: false, error: "Invalid field" };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const swaths: { x: number; y: number }[][] = [];
    let x = minX;
    while (x <= maxX) {
      const line = [{ x, y: minY }, { x, y: maxY }];
      swaths.push(line);
      x += spacing;
    }
    this._swaths = swaths;
    return { ok: true, data: { swathCount: swaths.length, spacing } };
  }

  updateCoverage(x: number, y: number, radius: number): R {
    const key = `${Math.round(x)},${Math.round(y)}`;
    this._coverage.set(key, (this._coverage.get(key) ?? 0) + 1);
    return { ok: true, data: { totalPoints: this._coverage.size } };
  }

  getEfficiency(): R {
    if (!this._field) return { ok: false, error: "No field set" };
    const pts = this._field.points;
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    area = Math.abs(area) / 2;
    const sprayed = this._coverage.size * Math.PI * 25;
    return { ok: true, data: { fieldArea: area, sprayedArea: sprayed, efficiency: area > 0 ? Math.min(1, sprayed / area) : 0 } };
  }

  getOverlap(): R {
    let total = 0;
    let double = 0;
    for (const count of this._coverage.values()) {
      total++;
      if (count > 1) double++;
    }
    return { ok: true, data: { totalCells: total, overlapCells: double, overlapRatio: total > 0 ? double / total : 0 } };
  }
}

export class SearchAndRescue {
  private _area: SARArea | null = null;
  private _patterns: { type: string; points: { x: number; y: number }[] }[] = [];
  private _foundTargets: { id: string; pos: { x: number; y: number }; timestamp: number }[] = [];

  setArea(boundary: SARArea): R {
    this._area = boundary;
    return { ok: true };
  }

  planGridSearch(droneCount: number, altitude: number): R {
    if (!this._area) return { ok: false, error: "No area set" };
    const pts = this._area.points;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const strips = droneCount;
    const stripWidth = (maxX - minX) / strips;
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < strips; i++) {
      const x = minX + stripWidth * (i + 0.5);
      points.push({ x, y: minY }, { x, y: maxY });
    }
    this._patterns.push({ type: "grid", points });
    return { ok: true, data: { strips, altitude, totalWaypoints: points.length } };
  }

  planSpiralSearch(center: { x: number; y: number }, radius: number): R {
    const points: { x: number; y: number }[] = [];
    const turns = Math.ceil(radius / 5);
    const totalPoints = turns * 36;
    for (let i = 0; i <= totalPoints; i++) {
      const angle = (i / 36) * 2 * Math.PI;
      const r = (i / totalPoints) * radius;
      points.push({ x: center.x + r * Math.cos(angle), y: center.y + r * Math.sin(angle) });
    }
    this._patterns.push({ type: "spiral", points });
    return { ok: true, data: { turns, points: points.length, radius } };
  }

  planCreepingLine(start: { x: number; y: number }, end: { x: number; y: number }, spacing: number): R {
    const dir = vecNorm(vecSub({ ...end, z: 0 }, { ...start, z: 0 }));
    const perp = { x: -dir.y, y: dir.x, z: 0 };
    const length = vecLen(vecSub({ ...end, z: 0 }, { ...start, z: 0 }));
    const lines = Math.ceil(spacing > 0 ? 10 / spacing : 3);
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < lines; i++) {
      const offset = vecScale(perp, (i - lines / 2) * spacing);
      const from = { x: start.x + offset.x, y: start.y + offset.y, z: 0 };
      const to = { x: end.x + offset.x, y: end.y + offset.y, z: 0 };
      points.push({ x: from.x, y: from.y }, { x: to.x, y: to.y });
    }
    this._patterns.push({ type: "creeping_line", points });
    return { ok: true, data: { lines, spacing, totalWaypoints: points.length } };
  }

  updateFound(target: { id: string; pos: { x: number; y: number } }): R {
    this._foundTargets.push({ ...target, timestamp: Date.now() });
    return { ok: true, data: { foundCount: this._foundTargets.length } };
  }

  getCoverage(): R {
    const totalWaypoints = this._patterns.reduce((s, p) => s + p.points.length, 0);
    return { ok: true, data: { patterns: this._patterns.length, totalWaypoints, foundTargets: this._foundTargets } };
  }
}
