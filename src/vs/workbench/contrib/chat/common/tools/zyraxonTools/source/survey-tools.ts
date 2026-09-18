type R = { ok: boolean; data?: any; error?: string };

interface Point3D {
  x: number;
  y: number;
  z: number;
  intensity: number;
}

interface SensorInfo {
  id: string;
  location: { lat: number; lon: number };
}

interface Detection {
  sensorId: string;
  type: "P" | "S";
  amplitude: number;
  timestamp: number;
}

export class LiDARScanner {
  private _points: Point3D[] = [];

  addPoint(x: number, y: number, z: number, intensity: number): R {
    this._points.push({ x, y, z, intensity });
    return { ok: true, data: { count: this._points.length } };
  }

  getPointCloud(): R {
    return { ok: true, data: this._points.map((p) => ({ ...p })) };
  }

  downsample(gridSize: number): R {
    const grid = new Map<string, Point3D[]>();
    for (const p of this._points) {
      const key = `${Math.floor(p.x / gridSize)},${Math.floor(p.y / gridSize)},${Math.floor(p.z / gridSize)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(p);
    }
    const sampled: Point3D[] = [];
    for (const pts of grid.values()) {
      const avg: Point3D = {
        x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
        y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
        z: pts.reduce((s, p) => s + p.z, 0) / pts.length,
        intensity: pts.reduce((s, p) => s + p.intensity, 0) / pts.length,
      };
      sampled.push(avg);
    }
    this._points = sampled;
    return { ok: true, data: { count: sampled.length } };
  }

  getElevationMap(): R {
    const map = new Map<string, { x: number; y: number; avgZ: number; count: number }>();
    for (const p of this._points) {
      const key = `${Math.floor(p.x)},${Math.floor(p.y)}`;
      if (!map.has(key)) map.set(key, { x: p.x, y: p.y, avgZ: 0, count: 0 });
      const cell = map.get(key)!;
      cell.avgZ = (cell.avgZ * cell.count + p.z) / (cell.count + 1);
      cell.count++;
    }
    return { ok: true, data: Array.from(map.values()) };
  }

  getVolume(boundary: { xMin: number; xMax: number; yMin: number; yMax: number }): R {
    const inside = this._points.filter(
      (p) =>
        p.x >= boundary.xMin &&
        p.x <= boundary.xMax &&
        p.y >= boundary.yMin &&
        p.y <= boundary.yMax
    );
    if (inside.length === 0) return { ok: false, error: "No points in boundary" };
    const baseZ = Math.min(...inside.map((p) => p.z));
    const volume = inside.reduce((sum, p) => sum + (p.z - baseZ), 0);
    return { ok: true, data: { volume, pointCount: inside.length, baseZ } };
  }

  getCrossSection(
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): R {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { ok: false, error: "Zero-length section" };
    const nx = -dy / len;
    const ny = dx / len;
    const section = this._points
      .filter((p) => {
        const px = p.x - start.x;
        const py = p.y - start.y;
        const dist = Math.abs(px * nx + py * ny);
        return dist < 1.0;
      })
      .sort((a, b) => {
        const da = (a.x - start.x) * dx + (a.y - start.y) * dy;
        const db = (b.x - start.x) * dx + (b.y - start.y) * dy;
        return da - db;
      });
    return { ok: true, data: section };
  }
}

export class GPSRTK {
  private _position: { lat: number; lon: number; alt: number } = {
    lat: 0,
    lon: 0,
    alt: 0,
  };
  private _corrections: { prn: number; correction: number }[] = [];
  private _fixQuality: string = "none";

  setPosition(lat: number, lon: number, alt: number): R {
    this._position = { lat, lon, alt };
    return { ok: true, data: { ...this._position } };
  }

  getCorrection(): R {
    const avg =
      this._corrections.length > 0
        ? this._corrections.reduce((s, c) => s + c.correction, 0) /
          this._corrections.length
        : 0;
    return {
      ok: true,
      data: { avgCorrection: avg, satellites: this._corrections.length },
    };
  }

  getAccuracy(): R {
    const base = this._fixQuality === "fixed" ? 0.002 : 0.02;
    const degraded =
      this._corrections.length < 4 ? (4 - this._corrections.length) * 0.01 : 0;
    return { ok: true, data: { horizontal: base + degraded, vertical: (base + degraded) * 1.5 } };
  }

  getFixQuality(): R {
    return { ok: true, data: this._fixQuality };
  }

  getSatellites(): R {
    return {
      ok: true,
      data: {
        count: this._corrections.length,
        list: this._corrections.map((c) => c.prn),
      },
    };
  }
}

export class TotalStation {
  private _station: { lat: number; lon: number; alt: number } = {
    lat: 0,
    lon: 0,
    alt: 0,
  };
  private _measurements: {
    distance: number;
    angle: number;
    elevation: number;
    timestamp: number;
  }[] = [];
  private _measurementIndex: number = 0;

  measureDistance(): R {
    this._measurementIndex++;
    const distance = (this._measurementIndex % 100) + 0.5;
    return { ok: true, data: { distance, unit: "m" } };
  }

  measureAngle(): R {
    this._measurementIndex++;
    const angle = (this._measurementIndex * 37) % 360;
    return { ok: true, data: { angle, unit: "deg" } };
  }

  measureElevation(): R {
    this._measurementIndex++;
    const elevation = (this._measurementIndex % 50) - 10;
    return { ok: true, data: { elevation, unit: "m" } };
  }

  calculatePosition(): R {
    const last = this._measurements[this._measurements.length - 1];
    if (!last) return { ok: false, error: "No measurements recorded" };
    const lat = this._station.lat + Math.cos((last.angle * Math.PI) / 180) * last.distance * 0.000009;
    const lon =
      this._station.lon +
      Math.sin((last.angle * Math.PI) / 180) * last.distance * 0.000009;
    const alt = this._station.alt + last.elevation;
    return { ok: true, data: { lat, lon, alt } };
  }

  setStation(lat: number, lon: number, alt: number): R {
    this._station = { lat, lon, alt };
    return { ok: true, data: { ...this._station } };
  }
}

export class DroneMapper {
  private _flightPlan: {
    waypoints: { lat: number; lon: number }[];
    altitude: number;
    overlap: number;
  } | null = null;
  private _photos: {
    path: string;
    lat: number;
    lon: number;
    alt: number;
    roll: number;
    pitch: number;
    yaw: number;
  }[] = [];

  setFlightPlan(
    waypoints: { lat: number; lon: number }[],
    altitude: number,
    overlap: number
  ): R {
    this._flightPlan = { waypoints, altitude, overlap };
    return { ok: true, data: { waypoints: waypoints.length, altitude, overlap } };
  }

  addPhoto(
    path: string,
    lat: number,
    lon: number,
    alt: number,
    roll: number,
    pitch: number,
    yaw: number
  ): R {
    this._photos.push({ path, lat, lon, alt, roll, pitch, yaw });
    return { ok: true, data: { total: this._photos.length } };
  }

  generateOrthomosaic(): R {
    if (this._photos.length === 0) return { ok: false, error: "No photos available" };
    const bounds = {
      north: Math.max(...this._photos.map((p) => p.lat)),
      south: Math.min(...this._photos.map((p) => p.lat)),
      east: Math.max(...this._photos.map((p) => p.lon)),
      west: Math.min(...this._photos.map((p) => p.lon)),
    };
    return {
      ok: true,
      data: { photoCount: this._photos.length, bounds, resolution: "0.05m/px" },
    };
  }

  get3DModel(): R {
    if (this._photos.length < 3) return { ok: false, error: "Need at least 3 photos" };
    return {
      ok: true,
      data: {
        vertices: this._photos.length * 1000,
        faces: this._photos.length * 1500,
        textureRes: "4096x4096",
      },
    };
  }

  getVolume(): R {
    if (this._photos.length === 0) return { ok: false, error: "No photos for volume" };
    const volume = this._photos.length * 50;
    return { ok: true, data: { volume, unit: "m³" } };
  }
}

export class SeismicMonitor {
  private _sensors: Map<string, SensorInfo> = new Map();
  private _detections: Detection[] = [];

  addSensor(id: string, location: { lat: number; lon: number }): R {
    this._sensors.set(id, { id, location });
    return { ok: true, data: { totalSensors: this._sensors.size } };
  }

  detectPWave(sensorId: string, amplitude: number): R {
    if (!this._sensors.has(sensorId)) return { ok: false, error: "Unknown sensor" };
    this._detections.push({
      sensorId,
      type: "P",
      amplitude,
      timestamp: Date.now(),
    });
    return { ok: true, data: { type: "P-wave", amplitude } };
  }

  detectSWave(sensorId: string, amplitude: number): R {
    if (!this._sensors.has(sensorId)) return { ok: false, error: "Unknown sensor" };
    this._detections.push({
      sensorId,
      type: "S",
      amplitude,
      timestamp: Date.now(),
    });
    return { ok: true, data: { type: "S-wave", amplitude } };
  }

  getMagnitude(): R {
    if (this._detections.length === 0)
      return { ok: false, error: "No detections" };
    const maxAmp = Math.max(...this._detections.map((d) => d.amplitude));
    const mag = Math.log10(maxAmp) * 2.5 + 2.0;
    return { ok: true, data: { magnitude: Math.round(mag * 100) / 100 } };
  }

  getEpicenter(): R {
    const sensorDets = this._detections.filter((d) =>
      this._sensors.has(d.sensorId)
    );
    if (sensorDets.length === 0) return { ok: false, error: "No sensor data" };
    const avgLat =
      sensorDets.reduce(
        (s, d) => s + this._sensors.get(d.sensorId)!.location.lat,
        0
      ) / sensorDets.length;
    const avgLon =
      sensorDets.reduce(
        (s, d) => s + this._sensors.get(d.sensorId)!.location.lon,
        0
      ) / sensorDets.length;
    return { ok: true, data: { lat: avgLat, lon: avgLon } };
  }

  getAlertLevel(): R {
    const mag = this.getMagnitude();
    if (!mag.ok) return { ok: true, data: { level: "normal", color: "green" } };
    const m = mag.data.magnitude;
    if (m < 3.0) return { ok: true, data: { level: "minor", color: "green" } };
    if (m < 5.0) return { ok: true, data: { level: "moderate", color: "yellow" } };
    if (m < 7.0) return { ok: true, data: { level: "severe", color: "orange" } };
    return { ok: true, data: { level: "critical", color: "red" } };
  }
}
