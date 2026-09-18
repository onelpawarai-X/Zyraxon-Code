type R = { ok: boolean; data?: any; error?: string };

interface PLCConfig {
  id: string;
  ip: string;
  connected: boolean;
  lastPing: number;
}

interface SensorConfig {
  id: string;
  type: string;
  location: string;
  value: number;
  minLimit: number;
  maxLimit: number;
  criticalLow: number;
  criticalHigh: number;
  lastUpdate: number;
  alarmActive: boolean;
}

interface CNCState {
  program: string;
  status: "idle" | "running" | "paused" | "error" | "stopped";
  spindleSpeed: number;
  feedRate: number;
  position: { x: number; y: number; z: number };
  lineNumber: number;
  startTime: number | null;
}

interface JointAngles {
  j1: number;
  j2: number;
  j3: number;
  j4: number;
  j5: number;
  j6: number;
}

interface ConveyorItem {
  id: string;
  type: string;
  weight: number;
  addedAt: number;
  position: number;
}

export class PLCController {
  private _plcs: Map<string, PLCConfig>;
  private _registers: Map<string, Map<number, number>>;
  private _coils: Map<string, Map<number, boolean>>;

  constructor() {
    this._plcs = new Map();
    this._registers = new Map();
    this._coils = new Map();
  }

  connect(plcId: string, ip: string): R {
    const config: PLCConfig = { id: plcId, ip, connected: true, lastPing: Date.now() };
    this._plcs.set(plcId, config);
    if (!this._registers.has(plcId)) this._registers.set(plcId, new Map());
    if (!this._coils.has(plcId)) this._coils.set(plcId, new Map());
    return { ok: true, data: { plcId, ip, status: "connected" } };
  }

  readRegister(plcId: string, address: number): R {
    if (!this._plcs.has(plcId)) return { ok: false, error: `PLC ${plcId} not connected` };
    const regs = this._registers.get(plcId)!;
    const value = regs.get(address);
    if (value === undefined) return { ok: false, error: `Register ${address} not initialized` };
    this._plcs.get(plcId)!.lastPing = Date.now();
    return { ok: true, data: { plcId, address, value, timestamp: Date.now() } };
  }

  writeRegister(plcId: string, address: number, value: number): R {
    if (!this._plcs.has(plcId)) return { ok: false, error: `PLC ${plcId} not connected` };
    if (address < 0 || address > 65535) return { ok: false, error: "Invalid register address" };
    const regs = this._registers.get(plcId)!;
    regs.set(address, value);
    this._plcs.get(plcId)!.lastPing = Date.now();
    return { ok: true, data: { plcId, address, value, written: true } };
  }

  getCoilState(plcId: string, address: number): R {
    if (!this._plcs.has(plcId)) return { ok: false, error: `PLC ${plcId} not connected` };
    const coils = this._coils.get(plcId)!;
    const state = coils.get(address);
    if (state === undefined) return { ok: false, error: `Coil ${address} not initialized` };
    return { ok: true, data: { plcId, address, state } };
  }

  setCoilState(plcId: string, address: number, state: boolean): R {
    if (!this._plcs.has(plcId)) return { ok: false, error: `PLC ${plcId} not connected` };
    if (address < 0 || address > 65535) return { ok: false, error: "Invalid coil address" };
    const coils = this._coils.get(plcId)!;
    coils.set(address, state);
    return { ok: true, data: { plcId, address, state, set: true } };
  }

  getProgramStatus(): R {
    const statuses: { id: string; ip: string; connected: boolean; registers: number; coils: number; lastPing: number }[] = [];
    for (const [id, plc] of this._plcs.entries()) {
      statuses.push({
        id,
        ip: plc.ip,
        connected: plc.connected,
        registers: this._registers.get(id)?.size || 0,
        coils: this._coils.get(id)?.size || 0,
        lastPing: plc.lastPing,
      });
    }
    return { ok: true, data: { plcCount: statuses.length, plcs: statuses } };
  }
}

export class SCADAMonitor {
  private _sensors: Map<string, SensorConfig>;

  constructor() {
    this._sensors = new Map();
  }

  addSensor(id: string, type: string, location: string): R {
    if (this._sensors.has(id)) return { ok: false, error: `Sensor ${id} already exists` };
    const sensor: SensorConfig = {
      id,
      type,
      location,
      value: 0,
      minLimit: 0,
      maxLimit: 100,
      criticalLow: -Infinity,
      criticalHigh: Infinity,
      lastUpdate: Date.now(),
      alarmActive: false,
    };
    this._sensors.set(id, sensor);
    return { ok: true, data: sensor };
  }

  updateValue(sensorId: string, value: number): R {
    const sensor = this._sensors.get(sensorId);
    if (!sensor) return { ok: false, error: `Sensor ${sensorId} not found` };
    sensor.value = value;
    sensor.lastUpdate = Date.now();
    sensor.alarmActive = value < sensor.criticalLow || value > sensor.criticalHigh;
    return { ok: true, data: { sensorId, value, alarm: sensor.alarmActive } };
  }

  checkLimits(sensorId: string): R {
    const sensor = this._sensors.get(sensorId);
    if (!sensor) return { ok: false, error: `Sensor ${sensorId} not found` };
    const status = {
      value: sensor.value,
      withinNormal: sensor.value >= sensor.minLimit && sensor.value <= sensor.maxLimit,
      withinCritical: sensor.value >= sensor.criticalLow && sensor.value <= sensor.criticalHigh,
      minLimit: sensor.minLimit,
      maxLimit: sensor.maxLimit,
      criticalLow: sensor.criticalLow,
      criticalHigh: sensor.criticalHigh,
    };
    return { ok: true, data: status };
  }

  getAlarmState(sensorId: string): R {
    const sensor = this._sensors.get(sensorId);
    if (!sensor) return { ok: false, error: `Sensor ${sensorId} not found` };
    let alarmLevel: string;
    if (sensor.value < sensor.criticalLow || sensor.value > sensor.criticalHigh) {
      alarmLevel = "critical";
    } else if (sensor.value < sensor.minLimit || sensor.value > sensor.maxLimit) {
      alarmLevel = "warning";
    } else {
      alarmLevel = "normal";
    }
    return {
      ok: true,
      data: { sensorId, alarmActive: sensor.alarmActive, alarmLevel, value: sensor.value },
    };
  }

  getSystemStatus(): R {
    const sensors: any[] = [];
    let totalAlarms = 0;
    let criticalAlarms = 0;
    for (const [id, sensor] of this._sensors.entries()) {
      if (sensor.alarmActive) {
        totalAlarms++;
        if (sensor.value < sensor.criticalLow || sensor.value > sensor.criticalHigh) criticalAlarms++;
      }
      sensors.push({
        id,
        type: sensor.type,
        location: sensor.location,
        value: sensor.value,
        alarm: sensor.alarmActive,
        lastUpdate: sensor.lastUpdate,
      });
    }
    return {
      ok: true,
      data: {
        totalSensors: this._sensors.size,
        totalAlarms,
        criticalAlarms,
        systemHealth: criticalAlarms > 0 ? "critical" : totalAlarms > 0 ? "warning" : "healthy",
        sensors,
      },
    };
  }
}

export class CNCController {
  private _program: string[];
  private _state: CNCState;
  private _spindle: number;
  private _feed: number;
  private _position: { x: number; y: number; z: number };

  constructor() {
    this._program = [];
    this._state = {
      program: "",
      status: "idle",
      spindleSpeed: 0,
      feedRate: 0,
      position: { x: 0, y: 0, z: 0 },
      lineNumber: 0,
      startTime: null,
    };
    this._spindle = 0;
    this._feed = 0;
    this._position = { x: 0, y: 0, z: 0 };
  }

  loadProgram(gcode: string): R {
    const lines = gcode.split("\n").filter(l => l.trim().length > 0);
    this._program = lines;
    this._state.program = gcode.substring(0, 100);
    this._state.lineNumber = 0;
    this._state.status = "idle";
    return { ok: true, data: { lines: lines.length, preview: lines.slice(0, 5) } };
  }

  start(): R {
    if (this._program.length === 0) return { ok: false, error: "No program loaded" };
    if (this._state.status === "running") return { ok: false, error: "Already running" };
    this._state.status = "running";
    this._state.lineNumber = 0;
    this._state.startTime = Date.now();
    return { ok: true, data: { status: "running", totalLines: this._program.length } };
  }

  stop(): R {
    this._state.status = "stopped";
    this._state.spindleSpeed = 0;
    this._feed = 0;
    this._state.feedRate = 0;
    return { ok: true, data: { status: "stopped", finalPosition: this._position } };
  }

  pause(): R {
    if (this._state.status !== "running") return { ok: false, error: "Not running" };
    this._state.status = "paused";
    return { ok: true, data: { status: "paused", line: this._state.lineNumber } };
  }

  resume(): R {
    if (this._state.status !== "paused") return { ok: false, error: "Not paused" };
    this._state.status = "running";
    return { ok: true, data: { status: "running", resumedAt: this._state.lineNumber } };
  }

  getStatus(): R {
    return {
      ok: true,
      data: {
        status: this._state.status,
        lineNumber: this._state.lineNumber,
        totalLines: this._program.length,
        spindleSpeed: this._spindle,
        feedRate: this._feed,
        position: this._position,
        runtime: this._state.startTime ? Date.now() - this._state.startTime : 0,
      },
    };
  }

  getSpindleSpeed(): R {
    return { ok: true, data: { rpm: this._spindle, state: this._state.status } };
  }

  getFeedRate(): R {
    return { ok: true, data: { mmPerMin: this._feed, state: this._state.status } };
  }

  getPosition(): R {
    return { ok: true, data: { ...this._position } };
  }
}

export class RoboticArmController {
  private _joints: JointAngles;
  private _speed: number;
  private readonly MAX_ANGLE = 180;
  private readonly MIN_ANGLE = -180;

  constructor() {
    this._joints = { j1: 0, j2: 0, j3: 0, j4: 0, j5: 0, j6: 0 };
    this._speed = 50;
  }

  setJoint(axis: number, angle: number): R {
    if (axis < 1 || axis > 6) return { ok: false, error: "Axis must be 1-6" };
    if (angle < this.MIN_ANGLE || angle > this.MAX_ANGLE) {
      return { ok: false, error: `Angle must be ${this.MIN_ANGLE} to ${this.MAX_ANGLE}` };
    }
    const key = `j${axis}` as keyof JointAngles;
    this._joints[key] = angle;
    return { ok: true, data: { axis, angle, joints: { ...this._joints } } };
  }

  getJoints(): R {
    return { ok: true, data: { joints: { ...this._joints }, speed: this._speed } };
  }

  moveLinear(x: number, y: number, z: number): R {
    const distance = Math.sqrt(x * x + y * y + z * z);
    const estimatedTime = distance / (this._speed * 10);
    const target = { x, y, z };
    return {
      ok: true,
      data: {
        from: { ...this._position },
        to: target,
        distance: Math.round(distance * 100) / 100,
        estimatedTime: Math.round(estimatedTime * 100) / 100,
      },
    };
  }

  moveJoint(angles: { j1?: number; j2?: number; j3?: number; j4?: number; j5?: number; j6?: number }): R {
    const changed: string[] = [];
    for (const [key, angle] of Object.entries(angles)) {
      if (angle === undefined) continue;
      if (angle < this.MIN_ANGLE || angle > this.MAX_ANGLE) {
        return { ok: false, error: `${key}: angle ${angle} out of range` };
      }
      (this._joints as any)[key] = angle;
      changed.push(key);
    }
    return { ok: true, data: { joints: { ...this._joints }, changed } };
  }

  getKinematics(): R {
    const j = this._joints;
    const r1 = 100;
    const r2 = 80;
    const r3 = 60;
    const t1 = (j.j1 * Math.PI) / 180;
    const t2 = (j.j2 * Math.PI) / 180;
    const t3 = (j.j3 * Math.PI) / 180;
    const x = Math.cos(t1) * (r1 * Math.cos(t2) + r2 * Math.cos(t2 + t3));
    const y = Math.sin(t1) * (r1 * Math.cos(t2) + r2 * Math.cos(t2 + t3));
    const z = r1 * Math.sin(t2) + r2 * Math.sin(t2 + t3);
    const reachable = Math.sqrt(x * x + y * y + z * z) <= r1 + r2 + r3;
    return {
      ok: true,
      data: {
        joints: { ...this._joints },
        endEffector: { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, z: Math.round(z * 100) / 100 },
        reachable,
        workspaceRadius: r1 + r2 + r3,
      },
    };
  }

  setSpeed(pct: number): R {
    if (pct < 1 || pct > 100) return { ok: false, error: "Speed must be 1-100%" };
    this._speed = pct;
    return { ok: true, data: { speed: this._speed } };
  }
}

export class ConveyorController {
  private _items: ConveyorItem[];
  private _speed: number;
  private _running: boolean;
  private _nextId: number;

  constructor() {
    this._items = [];
    this._speed = 0;
    this._running = false;
    this._nextId = 1;
  }

  start(): R {
    if (this._running) return { ok: false, error: "Already running" };
    this._running = true;
    if (this._speed === 0) this._speed = 50;
    return { ok: true, data: { running: true, speed: this._speed } };
  }

  stop(): R {
    this._running = false;
    this._speed = 0;
    return { ok: true, data: { running: false, itemsOnBelt: this._items.length } };
  }

  setSpeed(pct: number): R {
    if (pct < 0 || pct > 100) return { ok: false, error: "Speed must be 0-100%" };
    this._speed = pct;
    if (pct > 0 && !this._running) this._running = true;
    if (pct === 0) this._running = false;
    return { ok: true, data: { speed: this._speed, running: this._running } };
  }

  getSpeed(): R {
    return { ok: true, data: { speed: this._speed, running: this._running } };
  }

  getItems(): R {
    return { ok: true, data: { items: [...this._items], count: this._items.length } };
  }

  addItem(item: { type: string; weight: number }): R {
    const newItem: ConveyorItem = {
      id: `item-${this._nextId++}`,
      type: item.type,
      weight: item.weight,
      addedAt: Date.now(),
      position: 0,
    };
    this._items.push(newItem);
    return { ok: true, data: newItem };
  }

  removeItem(id: string): R {
    const idx = this._items.findIndex(i => i.id === id);
    if (idx === -1) return { ok: false, error: `Item ${id} not found` };
    const removed = this._items.splice(idx, 1)[0];
    return { ok: true, data: removed };
  }

  getItemCount(): R {
    const byType: Record<string, number> = {};
    let totalWeight = 0;
    for (const item of this._items) {
      byType[item.type] = (byType[item.type] || 0) + 1;
      totalWeight += item.weight;
    }
    return {
      ok: true,
      data: { count: this._items.length, byType, totalWeight: Math.round(totalWeight * 100) / 100 },
    };
  }
}
