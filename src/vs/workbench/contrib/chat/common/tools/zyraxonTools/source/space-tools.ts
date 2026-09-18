type R = { ok: boolean; data?: any; error?: string };

const EARTH_ROTATION_RATE = 7.2921e-5;
const MU_EARTH = 3.986e14;
const EARTH_RADIUS = 6371000;

export class LaunchWindowCalculator {
  private _vehicle: Record<string, any> = {};
  private _weather: { wind: number; precip: number } = { wind: 0, precip: 0 };

  setWeather(wind: number, precip: number): R {
    this._weather = { wind, precip };
    return { ok: true, data: { wind, precip } };
  }

  calculateWindow(date: Date, targetOrbit: { altitude: number; inclination: number }, vehicle?: string): R {
    const v = vehicle && this._vehicle[vehicle] ? this._vehicle[vehicle] : { maxDeltaV: 9500 };
    const lat = 0;
    const inclination = targetOrbit.inclination;
    const cosAzimuth = Math.cos(inclination * Math.PI / 180) / Math.cos(lat);
    if (Math.abs(cosAzimuth) > 1) return { ok: false, error: "Inclination unreachable from latitude" };
    const deltaV = 7800 + targetOrbit.altitude * 0.002;
    if (deltaV > v.maxDeltaV) return { ok: false, error: `Insufficient deltaV: need ${deltaV.toFixed(0)}` };
    const windowOpen = new Date(date);
    windowOpen.setHours(6, 0, 0, 0);
    const windowClose = new Date(windowOpen);
    windowClose.setMinutes(windowClose.getMinutes() + 45);
    return { ok: true, data: { windowOpen, windowClose, azimuth: Math.acos(cosAzimuth) * 180 / Math.PI, deltaV } };
  }

  getNextWindow(targetOrbit: { altitude: number; inclination: number }): R {
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + i);
      const res = this.calculateWindow(candidate, targetOrbit);
      if (res.ok) return res;
    }
    return { ok: false, error: "No window found in next 14 days" };
  }

  checkConstraints(launchTime: Date, constraints: { weather?: { maxWind: number; maxPrecip: number }; range?: boolean; traffic?: boolean }): R {
    const issues: string[] = [];
    if (constraints.weather) {
      if (this._weather.wind > constraints.weather.maxWind) issues.push(`Wind ${this._weather.wind.toFixed(1)} exceeds max ${constraints.weather.maxWind}`);
      if (this._weather.precip > constraints.weather.maxPrecip) issues.push(`Precipitation ${this._weather.precip.toFixed(2)} exceeds max`);
    }
    if (constraints.range === false) issues.push("Range not clear");
    if (constraints.traffic === false) issues.push("Airspace conflict");
    return issues.length ? { ok: false, error: issues.join("; ") } : { ok: true, data: { launchTime, allClear: true } };
  }

  getLaunchAzimuth(targetOrbit: { inclination: number; altitude: number }): R {
    const inc = targetOrbit.inclination;
    if (inc < 0 || inc > 180) return { ok: false, error: "Invalid inclination" };
    const azimuth = Math.atan2(Math.sin(inc * Math.PI / 180), 0) * 180 / Math.PI;
    return { ok: true, data: { azimuth: inc <= 90 ? 90 - azimuth : 90 + azimuth, inclination: inc } };
  }
}

export class GroundStationScheduler {
  private _stations: Map<string, { id: string; lat: number; lon: number; freq: number }> = new Map();
  private _passes: Array<{ satId: string; stationId: string; start: Date; end: Date; aosAz: number; losAz: number }> = [];
  private _passDefaults: { aosAz: number; losAz: number } = { aosAz: 0, losAz: 0 };

  setPassDefaults(aosAz: number, losAz: number): R {
    this._passDefaults = { aosAz, losAz };
    return { ok: true, data: { aosAz, losAz } };
  }

  addStation(id: string, lat: number, lon: number, freq: number): R {
    if (this._stations.has(id)) return { ok: false, error: "Station exists" };
    this._stations.set(id, { id, lat, lon, freq });
    return { ok: true, data: { id, lat, lon, freq } };
  }

  schedulePass(satId: string, stationId: string, startTime: Date, duration: number, aosAz?: number, losAz?: number): R {
    if (!this._stations.has(stationId)) return { ok: false, error: "Station not found" };
    const end = new Date(startTime.getTime() + duration * 60000);
    const pass = { satId, stationId, start: startTime, end, aosAz: aosAz ?? this._passDefaults.aosAz, losAz: losAz ?? this._passDefaults.losAz };
    this._passes.push(pass);
    return { ok: true, data: pass };
  }

  getNextPass(satId: string): R {
    const now = new Date();
    const upcoming = this._passes.filter(p => p.satId === satId && p.end > now).sort((a, b) => a.start.getTime() - b.start.getTime());
    return upcoming.length ? { ok: true, data: upcoming[0] } : { ok: false, error: "No upcoming passes" };
  }

  getCurrentStation(satId: string): R {
    const now = new Date();
    const active = this._passes.find(p => p.satId === satId && p.start <= now && p.end >= now);
    return active ? { ok: true, data: this._stations.get(active.stationId) } : { ok: false, error: "No active pass" };
  }

  getVisibility(satId: string, time: Date): R {
    const stationList = Array.from(this._stations.values());
    const visible = stationList.map(s => {
      const alt = 200 + Math.sin(time.getTime() / 100000) * 1800;
      const az = (Math.atan2(s.lon, s.lat) * 180 / Math.PI + 360) % 360;
      return { stationId: s.id, elevation: Math.max(0, 90 - Math.abs(az - 180)), azimuth: az, altitude: alt };
    }).filter(v => v.elevation > 0);
    return { ok: true, data: visible };
  }
}

export class StageRecovery {
  private _stages: Map<string, {
    id: string; altitude: number; velocity: number; mass: number;
    chutesDeployed: boolean; gridFinsActive: boolean; landed: boolean;
    telemetry: Array<{ t: number; alt: number; vel: number }>;
  }> = new Map();

  separateStage(stage: { id: string; mass: number }, altitude: number, velocity: number): R {
    this._stages.set(stage.id, {
      id: stage.id, altitude, velocity, mass: stage.mass,
      chutesDeployed: false, gridFinsActive: false, landed: false, telemetry: [{ t: 0, alt: altitude, vel: velocity }]
    });
    return { ok: true, data: { stageId: stage.id, altitude, velocity, separationTime: new Date() } };
  }

  deployChutes(stageId: string, altitude: number): R {
    const s = this._stages.get(stageId);
    if (!s) return { ok: false, error: "Stage not found" };
    if (altitude < 500) return { ok: false, error: "Too low for chute deployment" };
    s.chutesDeployed = true;
    s.gridFinsActive = true;
    s.velocity *= 0.3;
    return { ok: true, data: { chutesDeployed: true, velocityAfter: s.velocity } };
  }

  calculateLandingSite(stageId: string, currentConditions: { windSpeed: number; windDir: number }): R {
    const s = this._stages.get(stageId);
    if (!s) return { ok: false, error: "Stage not found" };
    const glideRatio = 3.5;
    const downrange = s.velocity / 9.81 * glideRatio;
    const windDrift = currentConditions.windSpeed * (s.velocity / 9.81) * Math.cos(currentConditions.windDir * Math.PI / 180);
    const crossRange = currentConditions.windSpeed * (s.velocity / 9.81) * Math.sin(currentConditions.windDir * Math.PI / 180);
    return { ok: true, data: { downrange: downrange + windDrift, crossRange, estimatedLandingTime: new Date(Date.now() + s.velocity / 9.81 * 1000) } };
  }

  touchdown(stageId: string, position: { lat: number; lon: number }): R {
    const s = this._stages.get(stageId);
    if (!s) return { ok: false, error: "Stage not found" };
    s.landed = true;
    s.altitude = 0;
    s.velocity = 0;
    s.telemetry.push({ t: s.telemetry.length, alt: 0, vel: 0 });
    return { ok: true, data: { stageId, position, landed: true, impactVelocity: 0 } };
  }

  assessCondition(stageId: string): R {
    const s = this._stages.get(stageId);
    if (!s) return { ok: false, error: "Stage not found" };
    const integrity = s.landed ? Math.max(0.1, 1 - (s.chutesDeployed ? 0.05 : 0.6)) : 0;
    return { ok: true, data: { stageId, integrity, reuseable: integrity > 0.7, chutesDeployed: s.chutesDeployed } };
  }
}

export class PayloadDeployment {
  private _payloads: Map<string, {
    id: string; type: string; mass: number; orbit: { altitude: number; inclination: number };
    deployed: boolean; deployTime?: Date; confirmed: boolean;
  }> = new Map();
  private _deploymentVelocity: { separationVelocity: number; spinRate: number } = { separationVelocity: 1.0, spinRate: 30 };

  setDeploymentVelocity(separationVelocity: number, spinRate: number): R {
    this._deploymentVelocity = { separationVelocity, spinRate };
    return { ok: true, data: { separationVelocity, spinRate } };
  }

  createPayload(id: string, type: string, mass: number, orbit: { altitude: number; inclination: number }): R {
    this._payloads.set(id, { id, type, mass, orbit, deployed: false, confirmed: false });
    return { ok: true, data: { id, type, mass, orbit } };
  }

  deploy(payloadId: string, time: Date, conditions: { attitude: boolean; separation: boolean }): R {
    const p = this._payloads.get(payloadId);
    if (!p) return { ok: false, error: "Payload not found" };
    if (p.deployed) return { ok: false, error: "Already deployed" };
    if (!conditions.attitude || !conditions.separation) return { ok: false, error: "Deployment conditions not met" };
    p.deployed = true;
    p.deployTime = time;
    return { ok: true, data: { payloadId, deployTime: time } };
  }

  checkClearance(payloadId: string): R {
    const p = this._payloads.get(payloadId);
    if (!p) return { ok: false, error: "Payload not found" };
    const others = Array.from(this._payloads.values()).filter(o => o.id !== payloadId && o.deployed);
    const conflict = others.some(o => Math.abs(o.orbit.altitude - p.orbit.altitude) < 10 && Math.abs(o.orbit.inclination - p.orbit.inclination) < 2);
    return { ok: true, data: { clear: !conflict, conflicts: conflict ? others.filter(o => Math.abs(o.orbit.altitude - p.orbit.altitude) < 10).map(o => o.id) : [] } };
  }

  getDeploymentVelocity(): R {
    return { ok: true, data: { ...this._deploymentVelocity } };
  }

  confirmOrbit(payloadId: string): R {
    const p = this._payloads.get(payloadId);
    if (!p) return { ok: false, error: "Payload not found" };
    if (!p.deployed) return { ok: false, error: "Not deployed yet" };
    p.confirmed = true;
    const period = 2 * Math.PI * Math.sqrt(Math.pow(EARTH_RADIUS + p.orbit.altitude, 3) / MU_EARTH);
    return { ok: true, data: { payloadId, orbit: p.orbit, period, confirmed: true } };
  }
}

export class DeorbitPlanning {
  private _currentOrbit: { altitude: number; inclination: number } = { altitude: 400, inclination: 51.6 };
  private _reentryAngle: number = -5.5;
  private _heatingRate: number = 1250;
  private _landingEllipse: { downrange: number; crossrange: number } = { downrange: 750, crossrange: 100 };

  setReentryAngle(angle: number): R {
    this._reentryAngle = angle;
    return { ok: true, data: { reentryAngle: angle } };
  }

  setHeatingRate(rate: number): R {
    this._heatingRate = rate;
    return { ok: true, data: { heatingRate: rate } };
  }

  setLandingEllipse(downrange: number, crossrange: number): R {
    this._landingEllipse = { downrange, crossrange };
    return { ok: true, data: { downrange, crossrange } };
  }

  calculateDeorbitBurn(currentOrbit: { altitude: number; inclination: number }, targetLanding: { lat: number; lon: number }): R {
    const r1 = EARTH_RADIUS + currentOrbit.altitude * 1000;
    const r2 = EARTH_RADIUS;
    const v1 = Math.sqrt(MU_EARTH / r1);
    const vPeriapsis = Math.sqrt(MU_EARTH * (2 / r2 - 1 / ((r1 + r2) / 2)));
    const deltaV = v1 - vPeriapsis;
    const burnDuration = deltaV / 0.002;
    return { ok: true, data: { deltaV, burnDuration, targetLanding, deorbitAltitude: currentOrbit.altitude } };
  }

  getDeorbitWindow(targetSite: { lat: number; lon: number }): R {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 3600000);
    const windowEnd = new Date(windowStart.getTime() + 1800000);
    return { ok: true, data: { windowStart, windowEnd, targetSite, leadTime: 3600 } };
  }

  calculateReentryAngle(): R {
    return { ok: true, data: { reentryAngle: this._reentryAngle, minAngle: -7, maxAngle: -4 } };
  }

  getHeatingRate(): R {
    return { ok: true, data: { heatingRate: this._heatingRate, unit: "W/cm2", peakTime: 30 } };
  }

  getLandingEllipse(): R {
    const { downrange, crossrange } = this._landingEllipse;
    return { ok: true, data: { downrangeKm: downrange, crossrangeKm: crossrange, semiMajor: downrange / 2, semiMinor: crossrange / 2 } };
  }
}

export class ConstellationManagement {
  private _satellites: Map<string, { id: string; orbit: { altitude: number; inclination: number; raan: number }; groundTrack: Array<{ lat: number; lon: number }> }> = new Map();

  addSatellite(id: string, orbit: { altitude: number; inclination: number; raan: number }): R {
    this._satellites.set(id, { id, orbit, groundTrack: [] });
    return { ok: true, data: { id, orbit } };
  }

  removeSatellite(id: string): R {
    if (!this._satellites.has(id)) return { ok: false, error: "Not found" };
    this._satellites.delete(id);
    return { ok: true, data: { removed: id } };
  }

  getCoverage(): R {
    const sats = Array.from(this._satellites.values());
    if (!sats.length) return { ok: false, error: "No satellites" };
    const coveragePerSat = 12;
    const total = Math.min(100, sats.length * coveragePerSat);
    const overlap = sats.length > 1 ? Math.max(0, sats.length * coveragePerSat - 100) : 0;
    return { ok: true, data: { coveragePercent: total, overlapPercent: overlap, satelliteCount: sats.length } };
  }

  getRevisitTime(targetPoint: { lat: number; lon: number }): R {
    const sats = Array.from(this._satellites.values());
    if (!sats.length) return { ok: false, error: "No satellites" };
    const orbitalPeriod = 2 * Math.PI * Math.sqrt(Math.pow(EARTH_RADIUS + sats[0].orbit.altitude * 1000, 3) / MU_EARTH);
    const revisit = orbitalPeriod / Math.max(1, sats.length) * 0.3;
    return { ok: true, data: { revisitMinutes: revisit / 60, targetPoint } };
  }

  optimizePhasing(): R {
    const sats = Array.from(this._satellites.values());
    if (sats.length < 2) return { ok: true, data: { optimized: 0 } };
    const spacing = 360 / sats.length;
    sats.forEach((s, i) => { s.orbit.raan = (spacing * i) % 360; });
    return { ok: true, data: { optimized: sats.length, spacingDegrees: spacing } };
  }

  getFormationStatus(): R {
    const sats = Array.from(this._satellites.values());
    const pairs: Array<{ a: string; b: string; separation: number }> = [];
    for (let i = 0; i < sats.length; i++) {
      for (let j = i + 1; j < sats.length; j++) {
        const sep = Math.abs(sats[i].orbit.raan - sats[j].orbit.raan) * Math.PI / 180 * (EARTH_RADIUS + sats[i].orbit.altitude * 1000);
        pairs.push({ a: sats[i].id, b: sats[j].id, separation: sep });
      }
    }
    return { ok: true, data: { pairs, totalSats: sats.length } };
  }
}

export class EclipsePrediction {
  private _solarParams = { panelEfficiency: 0.28, degradeRate: 0.01 };
  private _batteryParams = { capacity: 5000, depthOfDischarge: 0.8, cycles: 0 };

  predictEclipse(satOrbit: { altitude: number; inclination: number }, date: Date): R {
    const period = 2 * Math.PI * Math.sqrt(Math.pow(EARTH_RADIUS + satOrbit.altitude * 1000, 3) / MU_EARTH);
    const beta = 23.5 * Math.sin((date.getMonth() - 3) * Math.PI / 6);
    const eclipseFraction = satOrbit.altitude < 600 ? 0.36 * Math.cos(beta * Math.PI / 180) : 0;
    const eclipseDuration = period * eclipseFraction;
    return { ok: true, data: { period, eclipseDuration, eclipseFraction, betaAngle: beta } };
  }

  getEclipseDuration(): R {
    return { ok: true, data: { averageDuration: 2100, maxDuration: 2200, minDuration: 0 } };
  }

  getPowerBudget(solarPanelArea: number, batteryCapacity: number): R {
    const sunPower = 1361;
    const generation = solarPanelArea * sunPower * this._solarParams.panelEfficiency;
    const consumption = 200;
    const batteryLife = batteryCapacity / consumption;
    return { ok: true, data: { generationWatts: generation, consumptionWatts: consumption, surplus: generation - consumption, batteryLifeHours: batteryLife } };
  }

  recommendPowerMode(eclipseStatus: { inEclipse: boolean; timeToEclipse: number }): R {
    if (eclipseStatus.inEclipse) return { ok: true, data: { mode: "economy", nonEssentialOff: true, heaterPriority: true } };
    if (eclipseStatus.timeToEclipse < 600) return { ok: true, data: { mode: "charging", maxCharge: true, preHeat: true } };
    return { ok: true, data: { mode: "nominal", allSystems: true } };
  }
}

export class ThermalProtection {
  private _sensors: Map<string, { history: Array<{ time: number; temp: number }>; current: number }> = new Map();
  private _limits: Map<string, { min: number; max: number }> = new Map([
    ["solar_array", { min: -150, max: 150 }], ["battery", { min: -10, max: 45 }],
    ["propulsion", { min: -200, max: 200 }], ["avionics", { min: -40, max: 85 }],
  ]);

  monitorTemp(location: string, temp: number): R {
    const sensor = this._sensors.get(location) || { history: [], current: temp };
    sensor.current = temp;
    sensor.history.push({ time: Date.now(), temp });
    if (sensor.history.length > 1000) sensor.history = sensor.history.slice(-500);
    this._sensors.set(location, sensor);
    const limit = this._limits.get(location);
    const alarm = limit ? (temp > limit.max || temp < limit.min) : false;
    return { ok: true, data: { location, temp, alarm } };
  }

  checkLimits(): R {
    const violations: Array<{ location: string; temp: number; limit: { min: number; max: number } }> = [];
    this._sensors.forEach((sensor, location) => {
      const limit = this._limits.get(location);
      if (limit && (sensor.current > limit.max || sensor.current < limit.min))
        violations.push({ location, temp: sensor.current, limit });
    });
    return { ok: true, data: { healthy: violations.length === 0, violations } };
  }

  predictHeatFlux(velocity: number, altitude: number, angle: number): R {
    const rho = 1.225 * Math.exp(-altitude / 8500);
    const q = 0.5 * rho * Math.pow(velocity, 3) * 1e-6 * Math.abs(Math.cos(angle * Math.PI / 180));
    return { ok: true, data: { heatFlux: q, unit: "W/cm2", rho, angle } };
  }

  getThermalStatus(): R {
    const status: Record<string, any> = {};
    this._sensors.forEach((sensor, location) => {
      const limit = this._limits.get(location);
      status[location] = { temp: sensor.current, status: limit ? (sensor.current > limit.max ? "hot" : sensor.current < limit.min ? "cold" : "nominal") : "unknown" };
    });
    return { ok: true, data: status };
  }

  recommendAction(): R {
    const issues = this.checkLimits();
    if (!issues.ok) return issues;
    const v = (issues.data as any).violations;
    if (!v.length) return { ok: true, data: { action: "none" } };
    const hottest = v.reduce((a: any, b: any) => (a.temp > b.temp ? a : b));
    if (hottest.temp > (hottest.limit?.max ?? 100)) return { ok: true, data: { action: "activate_cooling", location: hottest.location } };
    return { ok: true, data: { action: "activate_heater", location: hottest.location } };
  }
}
