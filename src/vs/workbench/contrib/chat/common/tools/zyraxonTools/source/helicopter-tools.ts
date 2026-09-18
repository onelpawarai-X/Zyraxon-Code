type R = { ok: boolean; data?: any; error?: string };

export class RotorController {
  _collective = 0;
  _cyclicPitch = 0;
  _cyclicRoll = 0;
  _pedal = 0;
  _rpm = 0;
  _blades: { pitch: number; health: number }[] = [
    { pitch: 0, health: 100 },
    { pitch: 0, health: 100 },
    { pitch: 0, health: 100 },
    { pitch: 0, health: 100 },
  ];

  setCollective(pitch: number): R {
    if (pitch < -2 || pitch > 12) return { ok: false, error: 'collective out of range [-2, 12]' };
    this._collective = pitch;
    this._blades.forEach(b => { b.pitch = pitch; });
    this._rpm = 200 + pitch * 30;
    return { ok: true, data: { collective: this._collective, rpm: this._rpm } };
  }

  setCyclic(pitch: number, roll: number): R {
    if (Math.abs(pitch) > 10 || Math.abs(roll) > 10) return { ok: false, error: 'cyclic range [-10, 10]' };
    this._cyclicPitch = pitch;
    this._cyclicRoll = roll;
    for (let i = 0; i < this._blades.length; i++) {
      const angle = (i / this._blades.length) * Math.PI * 2;
      this._blades[i].pitch = this._collective + pitch * Math.sin(angle) + roll * Math.cos(angle);
    }
    return { ok: true, data: { pitch: this._cyclicPitch, roll: this._cyclicRoll } };
  }

  setPedal(antiTorque: number): R {
    if (Math.abs(antiTorque) > 100) return { ok: false, error: 'pedal range [-100, 100]' };
    this._pedal = antiTorque;
    return { ok: true, data: { pedal: this._pedal } };
  }

  getRotorRPM(): R {
    return { ok: true, data: { rpm: this._rpm, nominal: 400, status: this._rpm > 350 ? 'nominal' : 'low' } };
  }

  getVibration(): R {
    const avg = this._blades.reduce((s, b) => s + Math.abs(b.pitch - this._collective), 0) / this._blades.length;
    return { ok: true, data: { level: avg, unit: 'mm/s', status: avg < 0.5 ? 'normal' : 'excessive' } };
  }

  checkHealth(): R {
    const issues = this._blades.map((b, i) => ({ index: i, health: b.health, warn: b.health < 80 }));
    const degraded = issues.some(i => i.warn);
    return { ok: true, data: { blades: issues, overall: degraded ? 'degraded' : 'healthy' } };
  }

  getBladeAngle(bladeIndex: number): R {
    if (bladeIndex < 0 || bladeIndex >= this._blades.length) return { ok: false, error: 'invalid blade index' };
    return { ok: true, data: { index: bladeIndex, pitch: this._blades[bladeIndex].pitch, health: this._blades[bladeIndex].health } };
  }
}

export class HoverController {
  _target = { lat: 0, lon: 0, alt: 0 };
  _current = { lat: 0, lon: 0, alt: 0 };
  _pidLat = { kp: 1.2, ki: 0.05, kd: 0.3, integral: 0, prev: 0 };
  _pidLon = { kp: 1.2, ki: 0.05, kd: 0.3, integral: 0, prev: 0 };
  _pidAlt = { kp: 2.0, ki: 0.1, kd: 0.5, integral: 0, prev: 0 };

  private _pidStep(pid: { kp: number; ki: number; kd: number; integral: number; prev: number }, error: number, dt: number) {
    pid.integral += error * dt;
    pid.integral = Math.max(-50, Math.min(50, pid.integral));
    const derivative = (error - pid.prev) / dt;
    pid.prev = error;
    return pid.kp * error + pid.ki * pid.integral + pid.kd * derivative;
  }

  setTargetPosition(lat: number, lon: number, alt: number): R {
    this._target = { lat, lon, alt };
    this._pidLat.integral = 0; this._pidLon.integral = 0; this._pidAlt.integral = 0;
    return { ok: true, data: this._target };
  }

  updateIMU(accel: { x: number; y: number; z: number }, gyro: { x: number; y: number; z: number }): R {
    const dt = 0.01;
    this._current.lat += accel.x * dt * dt * 0.5;
    this._current.lon += accel.y * dt * dt * 0.5;
    this._current.alt += accel.z * dt * dt * 0.5;
    return { ok: true, data: this._current };
  }

  getPositionError(): R {
    return {
      ok: true,
      data: {
        latErr: this._target.lat - this._current.lat,
        lonErr: this._target.lon - this._current.lon,
        altErr: this._target.alt - this._current.alt,
      },
    };
  }

  getCorrectionCommands(): R {
    const dt = 0.01;
    const latCmd = this._pidStep(this._pidLat, this._target.lat - this._current.lat, dt);
    const lonCmd = this._pidStep(this._pidLon, this._target.lon - this._current.lon, dt);
    const altCmd = this._pidStep(this._pidAlt, this._target.alt - this._current.alt, dt);
    return { ok: true, data: { cyclicPitch: latCmd, cyclicRoll: lonCmd, collective: altCmd } };
  }

  maintainHover(wind: { speed: number; direction: number }): R {
    const rad = (wind.direction * Math.PI) / 180;
    const windLat = wind.speed * Math.sin(rad) * 0.8;
    const windLon = wind.speed * Math.cos(rad) * 0.8;
    this._current.lat -= windLat * 0.01;
    this._current.lon -= windLon * 0.01;
    return this.getCorrectionCommands();
  }

  getPosition(): R {
    return { ok: true, data: { ...this._current } };
  }
}

export class ExternalLoadController {
  _loads = new Map<string, { weight: number; type: string; pos: { x: number; y: number; z: number }; swingAngle: number; swingVel: number }>();

  attachLoad(id: string, weight: number, type: string): R {
    if (weight <= 0 || weight > 5000) return { ok: false, error: 'weight must be 0-5000 kg' };
    this._loads.set(id, { weight, type, pos: { x: 0, y: 0, z: -10 }, swingAngle: 0, swingVel: 0 });
    return { ok: true, data: { id, attached: true } };
  }

  detachLoad(id: string): R {
    if (!this._loads.has(id)) return { ok: false, error: 'load not found' };
    this._loads.delete(id);
    return { ok: true, data: { id, detached: true } };
  }

  getLoadPosition(id: string): R {
    const load = this._loads.get(id);
    if (!load) return { ok: false, error: 'load not found' };
    return { ok: true, data: { id, position: load.pos, swingAngle: load.swingAngle } };
  }

  compensateLoad(id: string, wind: { speed: number; direction: number }): R {
    const load = this._loads.get(id);
    if (!load) return { ok: false, error: 'load not found' };
    const rad = (wind.direction * Math.PI) / 180;
    const windForce = wind.speed * 0.1 * load.weight * 0.001;
    const restoring = -9.81 * Math.sin(load.swingAngle);
    load.swingVel += (restoring + windForce * Math.cos(rad)) * 0.01;
    load.swingVel *= 0.98;
    load.swingAngle += load.swingVel * 0.01;
    load.pos.x += windForce * Math.sin(rad) * 0.001;
    return { ok: true, data: { swingAngle: load.swingAngle, correction: windForce } };
  }

  getSwingAngle(id: string): R {
    const load = this._loads.get(id);
    if (!load) return { ok: false, error: 'load not found' };
    return { ok: true, data: { angle: load.swingAngle, velocity: load.swingVel } };
  }

  dampenSwing(id: string): R {
    const load = this._loads.get(id);
    if (!load) return { ok: false, error: 'load not found' };
    load.swingVel *= 0.5;
    load.swingAngle *= 0.7;
    return { ok: true, data: { dampened: true, angle: load.swingAngle } };
  }
}

export class AutorotationSystem {
  _state: 'flying' | 'entry' | 'steady' | 'flare' | 'touchdown' = 'flying';
  _rotorRPM = 0;
  _descentRate = 0;
  _forwardSpeed = 0;
  _rotorInertia = 50;
  _bladeMass = 20;
  _bladeRadius = 5;

  detectPowerLoss(): R {
    if (this._state !== 'flying') return { ok: true, data: { detected: false } };
    return { ok: true, data: { detected: true, action: 'initiate autorotation' } };
  }

  initiate(): R {
    this._state = 'entry';
    this._descentRate = 15;
    this._rotorRPM = 300;
    return { ok: true, data: { state: this._state, rotorRPM: this._rotorRPM } };
  }

  maintain(targetRPM: number): R {
    if (this._state === 'touchdown') return { ok: false, error: 'already landed' };
    this._state = 'steady';
    const targetOmega = (targetRPM * 2 * Math.PI) / 60;
    const currentOmega = (this._rotorRPM * 2 * Math.PI) / 60;
    const ke = 0.5 * this._rotorInertia * currentOmega * currentOmega;
    const rpmError = targetRPM - this._rotorRPM;
    this._rotorRPM += rpmError * 0.05;
    this._descentRate = Math.max(5, this._descentRate - 0.1);
    return { ok: true, data: { state: this._state, rpm: this._rotorRPM, descentRate: this._descentRate, ke } };
  }

  flare(altitude: number): R {
    if (altitude > 50) return { ok: false, error: 'too high for flare' };
    this._state = 'flare';
    const flareFactor = 1 - altitude / 50;
    this._descentRate *= flareFactor;
    this._forwardSpeed *= 0.9;
    const omega = (this._rotorRPM * 2 * Math.PI) / 60;
    const ke = 0.5 * this._rotorInertia * omega * omega;
    return { ok: true, data: { state: this._state, descentRate: this._descentRate, forwardSpeed: this._forwardSpeed, ke } };
  }

  touchdown(): R {
    this._state = 'touchdown';
    this._descentRate = 0;
    this._rotorRPM = 0;
    return { ok: true, data: { state: this._state, safe: true } };
  }
}

export class HelicopterWeatherCompensation {
  _windVector = { x: 0, y: 0 };
  _turbulenceLevel = 0;

  getWindCorrection(heading: number, wind: { speed: number; direction: number }): R {
    const hRad = (heading * Math.PI) / 180;
    const wRad = (wind.direction * Math.PI) / 180;
    const relAngle = wRad - hRad;
    const crosswind = wind.speed * Math.sin(relAngle);
    const headwind = wind.speed * Math.cos(relAngle);
    const cyclicCorrection = -crosswind * 0.02;
    const collectiveCorrection = headwind > 0 ? headwind * 0.01 : 0;
    return { ok: true, data: { cyclicPitch: cyclicCorrection, collective: collectiveCorrection, crosswind, headwind } };
  }

  getCrosswindComponent(wind: { speed: number; direction: number }, heading: number): R {
    const wRad = (wind.direction * Math.PI) / 180;
    const hRad = (heading * Math.PI) / 180;
    const component = wind.speed * Math.sin(wRad - hRad);
    return { ok: true, data: { component, exceeds: Math.abs(component) > 30 } };
  }

  getHeadwindComponent(wind: { speed: number; direction: number }, heading: number): R {
    const wRad = (wind.direction * Math.PI) / 180;
    const hRad = (heading * Math.PI) / 180;
    const component = wind.speed * Math.cos(wRad - hRad);
    return { ok: true, data: { component, isHeadwind: component > 0 } };
  }

  recommendHoverLimits(wind: { speed: number; direction: number }): R {
    const maxCrosswind = 35;
    const maxHeadwind = 45;
    const wRad = (wind.direction * Math.PI) / 180;
    const crosswind = Math.abs(wind.speed * Math.sin(wRad));
    const headwind = wind.speed * Math.cos(wRad);
    const safe = crosswind < maxCrosswind && headwind < maxHeadwind;
    return { ok: true, data: { safe, crosswind, headwind, limits: { maxCrosswind, maxHeadwind } } };
  }

  getTurbulenceCompensation(): R {
    this._turbulenceLevel = Math.min(1, this._turbulenceLevel + 0.01);
    const cyclicDamp = 1 - this._turbulenceLevel * 0.3;
    const collectiveDamp = 1 - this._turbulenceLevel * 0.15;
    return { ok: true, data: { level: this._turbulenceLevel, cyclicDamp, collectiveDamp } };
  }
}

export class VerticalTakeoffLanding {
  _phase: 'ground' | 'liftoff' | 'climb' | 'hover' | 'approach' | 'landing' = 'ground';
  _energy = { kinetic: 0, potential: 0, total: 0 };
  _mass = 0;
  _gravity = 9.81;

  planTakeoff(wind: { speed: number; direction: number }, weight: number, altitude: number): R {
    this._mass = weight;
    const powerRequired = weight * this._gravity * 1.2;
    const windPenalty = wind.speed > 20 ? (wind.speed - 20) * 50 : 0;
    const climbTime = altitude / 3;
    return { ok: true, data: { power: powerRequired + windPenalty, climbTime, altitude, phase: 'planned' } };
  }

  planLanding(wind: { speed: number; direction: number }, weight: number, surfaceType: string): R {
    this._mass = weight;
    const surfacePenalty = surfaceType === 'soft' ? 1.3 : 1.0;
    const power = weight * this._gravity * surfacePenalty;
    return { ok: true, data: { power, surface: surfaceType, phase: 'planned' } };
  }

  executeTakeoff(): R {
    const phases: Array<typeof this._phase> = ['liftoff', 'climb', 'hover'];
    const idx = phases.indexOf(this._phase);
    if (idx < 0) {
      this._phase = 'liftoff';
      this._energy.kinetic = 0.5 * this._mass * 3 * 3;
    } else if (idx < phases.length - 1) {
      this._phase = phases[idx + 1];
      this._energy.potential += this._mass * this._gravity * 3;
    }
    this._energy.total = this._energy.kinetic + this._energy.potential;
    return { ok: true, data: { phase: this._phase, energy: this._energy } };
  }

  executeLanding(): R {
    const phases: Array<typeof this._phase> = ['approach', 'landing', 'ground'];
    const idx = phases.indexOf(this._phase);
    if (idx < 0) {
      this._phase = 'approach';
    } else if (idx < phases.length - 1) {
      this._phase = phases[idx + 1];
      this._energy.potential = Math.max(0, this._energy.potential - this._mass * this._gravity * 3);
    }
    if (this._phase === 'ground') {
      this._energy.kinetic = 0;
      this._energy.potential = 0;
    }
    this._energy.total = this._energy.kinetic + this._energy.potential;
    return { ok: true, data: { phase: this._phase, energy: this._energy } };
  }

  getVTOLEnergy(weight: number, altitude: number): R {
    const pe = weight * this._gravity * altitude;
    const climbV = 3;
    const ke = 0.5 * weight * climbV * climbV;
    const efficiency = 0.75;
    return { ok: true, data: { potential: pe, kinetic: ke, total: pe + ke, efficiency, powerRequired: (pe + ke) * efficiency } };
  }
}

