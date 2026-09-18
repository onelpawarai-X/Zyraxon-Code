type R = { ok: boolean; data?: any; error?: string };

interface TrafficInfo {
  callsign: string;
  lat: number;
  lon: number;
  alt: number;
  heading: number;
  speed: number;
}

interface OverrideRequest {
  requested: boolean;
  active: boolean;
  by: string | null;
  reason: string | null;
  timestamp: number | null;
}

interface EngineReading {
  param: string;
  value: number;
  timestamp: number;
}

interface Engine {
  id: string;
  type: string;
  readings: EngineReading[];
  lastCheck: number;
}

interface NOTAM {
  id: string;
  airport: string;
  airspace: string | null;
  runway: string | null;
  critical: boolean;
  description: string;
  validFrom: number;
  validUntil: number;
}

interface RunwayCondition {
  condition: string;
  friction: number;
  contamination: string;
  timestamp: number;
}

interface METARData {
  station: string;
  time: string;
  wind: { direction: number; speed: number; gust: number | null };
  visibility: number;
  clouds: { type: string; altitude: number }[];
  temperature: number;
  dewpoint: number;
  altimeter: number;
  raw: string;
}

interface SIGMETData {
  id: string;
  phenomenon: string;
  area: string;
  validFrom: number;
  validUntil: number;
  altitude: { min: number | null; max: number | null };
  raw: string;
}

interface CabinStatus {
  cabinAlt: number;
  targetAlt: number;
  differentialPressure: number;
  decompression: boolean;
  outflowValve: number;
  safetyChecklist: string[];
}

interface TCASResolution {
  action: 'CLIMB' | 'DESCEND' | 'MAINTAIN' | 'TURN_LEFT' | 'TURN_RIGHT';
  verticalRate: number | null;
  headingChange: number | null;
  threat: TrafficInfo;
  separation: { vertical: number; horizontal: number };
}

export class ATCCommunication {
  private _log: string[] = [];
  private _frequency: number | null = null;
  private _callsign: string = '';
  private _connected: boolean = false;
  private _transponder: string = 'OFF';
  private _squawk: string | null = null;

  connect(callsign: string, freq: number): R {
    if (this._connected) return { ok: false, error: 'Already connected to a frequency' };
    if (!callsign || callsign.length < 2) return { ok: false, error: 'Invalid callsign' };
    if (freq < 118 || freq > 137) return { ok: false, error: 'Frequency out of valid range (118.000-136.975)' };
    this._callsign = callsign;
    this._frequency = freq;
    this._connected = true;
    this._transponder = 'STANDBY';
    const entry = `${this._timestamp()} CONNECTED: ${callsign} on ${freq.toFixed(3)} MHz`;
    this._log.push(entry);
    return { ok: true, data: { callsign, frequency: freq, status: 'connected' } };
  }

  disconnect(): R {
    if (!this._connected) return { ok: false, error: 'Not connected' };
    const entry = `${this._timestamp()} DISCONNECTED: ${this._callsign} from ${this._frequency?.toFixed(3)} MHz`;
    this._log.push(entry);
    this._frequency = null;
    this._connected = false;
    this._transponder = 'OFF';
    return { ok: true, data: { status: 'disconnected' } };
  }

  tune(freq: number): R {
    if (!this._connected) return { ok: false, error: 'Not connected' };
    if (freq < 118 || freq > 137) return { ok: false, error: 'Frequency out of valid range' };
    const oldFreq = this._frequency;
    this._frequency = freq;
    const entry = `${this._timestamp()} TUNED: ${this._callsign} ${oldFreq?.toFixed(3)} -> ${freq.toFixed(3)} MHz`;
    this._log.push(entry);
    return { ok: true, data: { frequency: freq } };
  }

  setSquawk(code: string): R {
    if (!/^\d{4}$/.test(code)) return { ok: false, error: 'Squawk must be exactly 4 digits (0-7)' };
    const entry = `${this._timestamp()} SQUAWK: ${this._callsign} set to ${code}`;
    this._log.push(entry);
    this._squawk = code;
    if (code === '7500') this._transponder = 'EMERGENCY';
    else if (code === '7600') this._transponder = 'COMMS';
    else if (code === '7700') this._transponder = 'EMERGENCY';
    else this._transponder = 'ON';
    return { ok: true, data: { squawk: code, transponder: this._transponder } };
  }

  requestClearance(type: string, details: string): R {
    if (!this._connected) return { ok: false, error: 'Not connected' };
    const validTypes = ['takeoff', 'landing', 'approach', 'taxi', 'departure', 'cruise', 'diversion'];
    if (!validTypes.includes(type.toLowerCase())) return { ok: false, error: `Invalid clearance type. Valid: ${validTypes.join(', ')}` };
    const entry = `${this._timestamp()} CLEARANCE REQUEST: ${this._callsign} ${type.toUpperCase()} - ${details}`;
    this._log.push(entry);
    const clearance = {
      type,
      details,
      granted: true,
      timestamp: this._timestamp(),
      instruction: this._generateClearanceInstruction(type, details),
    };
    this._log.push(`${this._timestamp()} CLEARANCE GRANTED: ${this._callsign} ${clearance.instruction}`);
    return { ok: true, data: clearance };
  }

  readBack(clearance: string): R {
    if (!this._connected) return { ok: false, error: 'Not connected' };
    if (!clearance || clearance.length < 3) return { ok: false, error: 'Invalid clearance text' };
    const entry = `${this._timestamp()} READBACK: ${this._callsign} "${clearance}"`;
    this._log.push(entry);
    const readback = clearance.replace(/runway/gi, 'RWY').replace(/level/gi, 'FL');
    return { ok: true, data: { readback, callsign: this._callsign } };
  }

  declareEmergency(type: string, reason: string): R {
    const emergencyTypes = ['mayday', 'pan-pan', 'securite'];
    const t = type.toLowerCase();
    if (!emergencyTypes.includes(t)) return { ok: false, error: `Invalid type. Valid: ${emergencyTypes.join(', ')}` };
    const code = t === 'mayday' ? '7700' : t === 'pan-pan' ? '7600' : '7700';
    this.setSquawk(code);
    const entry = `${this._timestamp()} EMERGENCY: ${this._callsign} ${type.toUpperCase()} - ${reason}`;
    this._log.push(entry);
    return { ok: true, data: { type, reason, squawk: code, transponder: this._transponder } };
  }

  getLog(): string[] {
    return [...this._log];
  }

  getStatus(): R {
    return {
      ok: true,
      data: {
        callsign: this._callsign,
        connected: this._connected,
        frequency: this._frequency,
        squawk: this._squawk,
        transponder: this._transponder,
        logEntries: this._log.length,
      },
    };
  }

  private _timestamp(): string {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  private _generateClearanceInstruction(type: string, details: string): string {
    const templates: Record<string, string> = {
      takeoff: `cleared for takeoff runway ${details}`,
      landing: `cleared to land runway ${details}`,
      approach: `cleared ${details} approach, descend to published altitude`,
      taxi: `taxi via ${details}, hold short runway`,
      departure: `cleared ${details} departure, climb and maintain assigned altitude`,
      cruise: `cleared to cruise altitude, approved as requested`,
      diversion: `cleared for diversion to ${details}, fly heading assigned`,
    };
    return templates[type.toLowerCase()] || `clearance approved: ${details}`;
  }
}

export class WeatherSystem {
  private _metar: METARData | null = null;
  private _sigmets: SIGMETData[] = [];

  parseMETAR(raw: string): R {
    if (!raw || raw.trim().length === 0) return { ok: false, error: 'Empty METAR string' };
    const parts = raw.trim().split(/\s+/);
    if (parts.length < 5) return { ok: false, error: 'METAR too short to parse' };

    const station = parts[0].replace('METAR', '').trim();
    const time = parts[1] || '';
    const windRaw = parts.find(p => /^\d{3}\d{2,3}(G\d{2,3})?KT$/.test(p)) || '00000KT';
    const windMatch = windRaw.match(/(\d{3})(\d{2,3})(?:G(\d{2,3}))?KT/);
    const windDir = windMatch ? parseInt(windMatch[1]) : 0;
    const windSpd = windMatch ? parseInt(windMatch[2]) : 0;
    const windGust = windMatch && windMatch[3] ? parseInt(windMatch[3]) : null;

    const visRaw = parts.find(p => /^\d{4}$/.test(p));
    const visibility = visRaw ? parseInt(visRaw) : 0;

    const clouds: { type: string; altitude: number }[] = [];
    parts.forEach(p => {
      const cloudMatch = p.match(/(FEW|SCT|BKN|OVC|CLR|SKC|CAVOK)(\d{3})/);
      if (cloudMatch) {
        clouds.push({ type: cloudMatch[1], altitude: parseInt(cloudMatch[2]) * 100 });
      }
    });

    const tempRaw = parts.find(p => /^M?\d{2}\/M?\d{2}$/.test(p)) || '00/00';
    const tempParts = tempRaw.split('/');
    const temperature = tempParts[0].startsWith('M') ? -parseInt(tempParts[0].slice(1)) : parseInt(tempParts[0]);
    const dewpoint = tempParts[1].startsWith('M') ? -parseInt(tempParts[1].slice(1)) : parseInt(tempParts[1]);

    const altRaw = parts.find(p => /^A\d{4}$/.test(p));
    const altimeter = altRaw ? parseInt(altRaw.slice(1)) / 100 : 29.92;

    const metar: METARData = {
      station, time,
      wind: { direction: windDir, speed: windSpd, gust: windGust },
      visibility, clouds, temperature, dewpoint, altimeter, raw,
    };
    this._metar = metar;
    return { ok: true, data: metar };
  }

  parseSIGMET(raw: string): R {
    if (!raw) return { ok: false, error: 'Empty SIGMET' };
    const parts = raw.trim().split(/\s+/);
    const id = `SIGMET-${Date.now()}`;
    const phenomena = ['TS', 'TURB', 'IC', 'VA', 'ASH', 'TC', 'DS', 'SS'];
    let phenomenon = 'UNKNOWN';
    for (const ph of phenomena) {
      if (raw.toUpperCase().includes(ph)) { phenomenon = ph; break; }
    }
    const altMatch = raw.match(/FL(\d{3})\s*-\s*FL(\d{3})/);
    const altitude = altMatch
      ? { min: parseInt(altMatch[1]) * 100, max: parseInt(altMatch[2]) * 100 }
      : { min: null, max: null };

    const sigmet: SIGMETData = {
      id, phenomenon,
      area: parts.slice(0, 3).join(' '),
      validFrom: Date.now(),
      validUntil: Date.now() + 4 * 60 * 60 * 1000,
      altitude, raw,
    };
    this._sigmets.push(sigmet);
    return { ok: true, data: sigmet };
  }

  checkTurbulence(lat: number, lon: number, alt: number): R {
    const hash = Math.abs(Math.sin(lat * 0.1) * Math.cos(lon * 0.1) * Math.sin(alt * 0.0001));
    let severity: string;
    let score: number;
    if (alt < 10000) {
      severity = hash > 0.7 ? 'SEVERE' : hash > 0.4 ? 'MODERATE' : 'LIGHT';
      score = Math.round(hash * 100) / 100;
    } else if (alt < 30000) {
      severity = hash > 0.8 ? 'SEVERE' : hash > 0.5 ? 'MODERATE' : 'LIGHT';
      score = Math.round(hash * 1.2 * 100) / 100;
    } else {
      const jetstream = Math.abs(Math.sin(lat * 0.05 + lon * 0.03));
      const combined = hash * 0.6 + jetstream * 0.4;
      severity = combined > 0.75 ? 'SEVERE' : combined > 0.45 ? 'MODERATE' : 'LIGHT';
      score = Math.round(combined * 100) / 100;
    }
    return { ok: true, data: { turbulence: severity, score, location: { lat, lon, alt } } };
  }

  checkIcing(lat: number, lon: number, alt: number, temp: number): R {
    if (temp > 10) return { ok: true, data: { icing: 'NONE', risk: 0, reason: 'Temperature too high' } };
    if (temp > 0) return { ok: true, data: { icing: 'NONE', risk: 0, reason: 'Temperature above freezing' } };
    const tempFactor = Math.min(1, Math.abs(temp) / 30);
    const altFactor = alt > 18000 ? 0.3 : alt > 10000 ? 0.6 : 1.0;
    const moistureFactor = 0.5 + Math.abs(Math.sin(lat * lon * 0.001)) * 0.5;
    const risk = Math.round(tempFactor * altFactor * moistureFactor * 100) / 100;
    let severity: string;
    if (risk > 0.7) severity = 'SEVERE';
    else if (risk > 0.4) severity = 'MODERATE';
    else if (risk > 0.1) severity = 'LIGHT';
    else severity = 'TRACE';
    return { ok: true, data: { icing: severity, risk, temp, location: { lat, lon, alt } } };
  }

  getWindsAloft(alt: number): R {
    if (alt < 0) return { ok: false, error: 'Altitude cannot be negative' };
    const baseWind = 250 + Math.round(alt / 1000) * 15;
    const direction = baseWind % 360;
    const speed = 10 + Math.round(alt / 5000) * 8;
    const temp = 15 - (alt / 1000) * 2;
    const layer = alt < 6000 ? 'LOW' : alt < 18000 ? 'MID' : 'HIGH';
    return {
      ok: true,
      data: {
        altitude: alt, direction, speed, temperature: Math.round(temp),
        layer: layer,
        turbulence: alt > 25000 ? 'POSSIBLE JET STREAM' : 'NONE',
      },
    };
  }

  getMETAR(): METARData | null {
    return this._metar;
  }

  getSIGMETS(): SIGMETData[] {
    return [...this._sigmets];
  }
}

export class NOTAMSystem {
  private _notams: NOTAM[] = [];
  private _notamCounter: number = 0;

  addNOTAM(notam: Omit<NOTAM, 'id'>): R {
    if (!notam.airport) return { ok: false, error: 'Airport is required' };
    if (!notam.description) return { ok: false, error: 'Description is required' };
    this._notamCounter++;
    const id = `NOTAM-${Date.now()}-${this._notamCounter.toString(36).padStart(4, "0").toUpperCase()}`;
    const entry: NOTAM = { ...notam, id };
    this._notams.push(entry);
    return { ok: true, data: entry };
  }

  getByLocation(airport: string): R {
    const found = this._notams.filter(n => n.airport.toUpperCase() === airport.toUpperCase());
    return { ok: true, data: found };
  }

  getCritical(): R {
    const critical = this._notams.filter(n => n.critical);
    return { ok: true, data: critical };
  }

  checkRunwayStatus(airport: string, runway: string): R {
    const closed = this._notams.filter(
      n => n.airport.toUpperCase() === airport.toUpperCase()
        && n.runway === runway
        && n.description.toUpperCase().includes('CLOSED')
    );
    const restricted = this._notams.filter(
      n => n.airport.toUpperCase() === airport.toUpperCase()
        && n.runway === runway
        && (n.description.toUpperCase().includes('RESTRICTED') || n.description.toUpperCase().includes('LIMITED'))
    );
    return {
      ok: true,
      data: {
        airport,
        runway,
        closed: closed.length > 0,
        restricted: restricted.length > 0,
        closedNotams: closed,
        restrictedNotams: restricted,
      },
    };
  }

  checkAirspace(airspace: string): R {
    const found = this._notams.filter(
      n => n.airspace && n.airspace.toUpperCase().includes(airspace.toUpperCase())
    );
    return { ok: true, data: { airspace, notams: found, count: found.length } };
  }

  getAll(): NOTAM[] {
    return [...this._notams];
  }

  removeNOTAM(id: string): R {
    const idx = this._notams.findIndex(n => n.id === id);
    if (idx === -1) return { ok: false, error: 'NOTAM not found' };
    this._notams.splice(idx, 1);
    return { ok: true, data: { removed: id } };
  }
}

export class RunwayConditionSystem {
  private _conditions: Map<string, RunwayCondition> = new Map();

  private _key(airport: string, runway: string): string {
    return `${airport.toUpperCase()}_${runway.toUpperCase()}`;
  }

  setCondition(airport: string, runway: string, condition: string, friction: number, contamination: string): R {
    if (friction < 0 || friction > 1) return { ok: false, error: 'Friction must be between 0 and 1' };
    const key = this._key(airport, runway);
    const entry: RunwayCondition = { condition, friction, contamination, timestamp: Date.now() };
    this._conditions.set(key, entry);
    return { ok: true, data: entry };
  }

  getCondition(airport: string, runway: string): R {
    const entry = this._conditions.get(this._key(airport, runway));
    if (!entry) return { ok: false, error: 'No condition data for this runway' };
    return { ok: true, data: entry };
  }

  calculateLandingDistance(airport: string, runway: number, weight: number, speed: number): R {
    const cond = this._conditions.get(this._key(airport, String(runway)));
    const baseDistance = (weight / 1000) * 15 + (speed * 0.5);
    let conditionFactor = 1.0;
    if (cond) {
      const frictionMap: Record<string, number> = {
        DRY: 1.0, WET: 1.15, 'WET-COMPACTED': 1.2,
        'CONTAMINATED-SNOW': 1.4, 'CONTAMINATED-SLUSH': 1.5, 'CONTAMINATED-ICE': 1.6,
        'CONTAMINATED-WATER-STANDING': 1.35, DRY_SNOW: 1.25,
      };
      conditionFactor = frictionMap[cond.condition.toUpperCase()] || (1.0 + (1 - cond.friction) * 0.8);
    }
    const distance = Math.round(baseDistance * conditionFactor);
    return {
      ok: true,
      data: {
        airport, runway, weight, speed,
        distance, conditionFactor,
        condition: cond?.condition || 'UNKNOWN',
        margin: Math.round(distance * 0.15),
      },
    };
  }

  getBrakingRecommendation(airport: string, runway: string): R {
    const cond = this._conditions.get(this._key(airport, runway));
    if (!cond) return { ok: false, error: 'No condition data available' };

    let autobrake: string;
    let reverseThrust: boolean;
    const friction = cond.friction;

    if (friction > 0.8) {
      autobrake = 'LOW';
      reverseThrust = false;
    } else if (friction > 0.6) {
      autobrake = 'MEDIUM';
      reverseThrust = false;
    } else if (friction > 0.4) {
      autobrake = 'HIGH';
      reverseThrust = true;
    } else {
      autobrake = 'MAX';
      reverseThrust = true;
    }
    return {
      ok: true,
      data: {
        airport, runway, autobrake, reverseThrust,
        condition: cond.condition, friction: cond.friction,
        recommendation: `Use ${autobrake} autobrake, ${reverseThrust ? 'deploy' : 'no need for'} reverse thrust`,
      },
    };
  }

  getAllConditions(): Record<string, RunwayCondition> {
    const out: Record<string, RunwayCondition> = {};
    this._conditions.forEach((v, k) => { out[k] = v; });
    return out;
  }
}

export class TCASResolution {
  private _traffic: TrafficInfo[] = [];
  private _ownPosition: TrafficInfo | null = null;

  detectTraffic(own: TrafficInfo, intruder: TrafficInfo): R {
    this._ownPosition = own;
    this._traffic.push(intruder);
    const hSep = this._horizontalSeparation(own, intruder);
    const vSep = Math.abs(own.alt - intruder.alt);
    const tcasRange = 5 * 1852;
    const threat = hSep < tcasRange && vSep < 2700;

    let level: string;
    if (hSep < 1.5 * 1852 && vSep < 1200) level = 'RESOLUTION';
    else if (hSep < 3 * 1852 && vSep < 1800) level = 'PROXIMATE';
    else if (threat) level = 'OTHER';
    else level = 'NONE';

    return {
      ok: true,
      data: {
        intruder, separation: { horizontal: Math.round(hSep), vertical: vSep },
        threatLevel: level,
        bearing: this._bearing(own, intruder),
      },
    };
  }

  calculateResolution(): R {
    if (this._traffic.length === 0 || !this._ownPosition) {
      return { ok: false, error: 'No traffic detected' };
    }
    const closest = this._traffic.reduce((c, t) => {
      const dC = this._horizontalSeparation(this._ownPosition!, c);
      const dT = this._horizontalSeparation(this._ownPosition!, t);
      return dT < dC ? t : c;
    });
    const own = this._ownPosition;
    const altDiff = closest.alt - own.alt;
    const hSep = this._horizontalSeparation(own, closest);
    const closingRate = this._closingRate(own, closest);
    let action: TCASResolution['action'];
    let verticalRate: number | null = null;
    let headingChange: number | null = null;

    if (altDiff > 200 && hSep < 3 * 1852) {
      action = 'DESCEND';
      verticalRate = -1500;
    } else if (altDiff < -200 && hSep < 3 * 1852) {
      action = 'CLIMB';
      verticalRate = 1500;
    } else if (hSep < 2 * 1852) {
      const bearing = this._bearing(own, closest);
      if (bearing > 0 && bearing < 180) {
        action = 'TURN_RIGHT';
        headingChange = 30;
      } else {
        action = 'TURN_LEFT';
        headingChange = -30;
      }
    } else {
      action = 'MAINTAIN';
    }

    const resolution: TCASResolution = {
      action, verticalRate, headingChange,
      threat: closest,
      separation: { vertical: Math.abs(altDiff), horizontal: Math.round(hSep) },
    };
    return { ok: true, data: resolution };
  }

  getVerticalSeparation(): R {
    if (!this._ownPosition || this._traffic.length === 0) {
      return { ok: false, error: 'No data' };
    }
    const seps = this._traffic.map(t => ({
      callsign: t.callsign,
      vertical: Math.abs(this._ownPosition!.alt - t.alt),
    }));
    return { ok: true, data: seps };
  }

  getHorizontalSeparation(): R {
    if (!this._ownPosition || this._traffic.length === 0) {
      return { ok: false, error: 'No data' };
    }
    const seps = this._traffic.map(t => ({
      callsign: t.callsign,
      horizontal: Math.round(this._horizontalSeparation(this._ownPosition!, t)),
    }));
    return { ok: true, data: seps };
  }

  getTraffic(): TrafficInfo[] {
    return [...this._traffic];
  }

  clearTraffic(): void {
    this._traffic = [];
  }

  private _horizontalSeparation(a: TrafficInfo, b: TrafficInfo): number {
    const R_earth = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lon - a.lon) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    return 2 * R_earth * Math.asin(Math.sqrt(h));
  }

  private _bearing(a: TrafficInfo, b: TrafficInfo): number {
    const dLon = ((b.lon - a.lon) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180) / Math.PI;
  }

  private _closingRate(a: TrafficInfo, b: TrafficInfo): number {
    const dist = this._horizontalSeparation(a, b);
    const relAlt = b.alt - a.alt;
    return Math.sqrt(dist * dist + relAlt * relAlt);
  }
}

export class PilotOverride {
  private _overrideActive: boolean = false;
  private _overrideBy: string | null = null;
  private _overrideReason: string | null = null;
  private _overrideHistory: OverrideRequest[] = [];

  requestOverride(reason: string): R {
    if (this._overrideActive) return { ok: false, error: 'Override already active' };
    if (!reason) return { ok: false, error: 'Reason required' };
    this._overrideActive = true;
    this._overrideBy = 'PILOT';
    this._overrideReason = reason;
    const req: OverrideRequest = {
      requested: true, active: true, by: 'PILOT', reason, timestamp: Date.now(),
    };
    this._overrideHistory.push(req);
    return { ok: true, data: { active: true, by: 'PILOT', reason } };
  }

  grantOverride(): R {
    if (!this._overrideActive) return { ok: false, error: 'No pending override request' };
    return { ok: true, data: { active: true, by: this._overrideBy, reason: this._overrideReason } };
  }

  releaseOverride(): R {
    if (!this._overrideActive) return { ok: false, error: 'No override active' };
    const released = { by: this._overrideBy, reason: this._overrideReason };
    this._overrideActive = false;
    this._overrideBy = null;
    this._overrideReason = null;
    return { ok: true, data: { released, status: 'AI control resumed' } };
  }

  getOverrideStatus(): R {
    return {
      ok: true,
      data: {
        active: this._overrideActive,
        by: this._overrideBy,
        reason: this._overrideReason,
        historyCount: this._overrideHistory.length,
      },
    };
  }

  handoffToAI(reason: string): R {
    if (!this._overrideActive) return { ok: false, error: 'Cannot handoff — no active override' };
    if (!reason) return { ok: false, error: 'Handoff reason required' };
    this._overrideActive = false;
    this._overrideBy = null;
    this._overrideReason = null;
    return {
      ok: true,
      data: {
        handoff: true, reason, from: 'PILOT', to: 'AI',
        timestamp: Date.now(), status: 'AI control resumed',
      },
    };
  }

  getHistory(): OverrideRequest[] {
    return [...this._overrideHistory];
  }
}

export class CabinPressure {
  private _cabinAlt: number = 0;
  private _targetAlt: number = 0;
  private _decompression: boolean = false;
  private _differentialPressure: number = 0;
  private _outflowValve: number = 0;
  private _mode: string = 'GROUND';

  setAltitude(target: number): R {
    if (target < 0 || target > 50000) return { ok: false, error: 'Target altitude out of range' };
    this._targetAlt = target;
    this._mode = 'CRUISE';
    const climbRate = target > this._cabinAlt ? 500 : -500;
    this._cabinAlt = Math.round(this._cabinAlt + Math.sign(climbRate) * 100);
    if ((climbRate > 0 && this._cabinAlt > target) || (climbRate < 0 && this._cabinAlt < target)) {
      this._cabinAlt = target;
    }
    this._differentialPressure = Math.max(0, 8.66 - (target / 10000) * 0.5);
    return { ok: true, data: this._getStatusData() };
  }

  getStatus(): R {
    return { ok: true, data: this._getStatusData() };
  }

  detectDecompression(): R {
    const expectedDp = Math.max(0, 8.66 - (this._targetAlt / 10000) * 0.5);
    const dpDrop = expectedDp - this._differentialPressure;
    if (dpDrop > 0.5 || this._differentialPressure < 2.0) {
      this._decompression = true;
      return {
        ok: true, data: {
          decompression: true, severity: dpDrop > 1.0 ? 'RAPID' : 'SLOW',
          currentDP: this._differentialPressure, expectedDP: expectedDp,
          alert: 'DECOMPRESSION DETECTED — INITIATE EMERGENCY DESCENT',
        },
      };
    }
    return { ok: true, data: { decompression: false, currentDP: this._differentialPressure } };
  }

  initiateEmergencyDescent(targetAlt: number): R {
    if (targetAlt < 0 || targetAlt > 15000) return { ok: false, error: 'Emergency target must be 0-15000 ft' };
    this._decompression = true;
    this._targetAlt = targetAlt;
    this._outflowValve = 100;
    this._mode = 'EMERGENCY';
    return {
      ok: true,
      data: {
        emergency: true, targetAlt,
        actions: [
          'OXYGEN MASKS ON',
          'OUTFLOW VALVE FULL OPEN',
          `EMERGENCY DESCENT TO ${targetAlt} FT`,
          'SPEED BRAKE DEPLOYED',
          'NOTIFY ATC: MAYDAY — DECOMPRESSION',
        ],
        status: 'EMERGENCY DESCENT IN PROGRESS',
      },
    };
  }

  getSafetyChecklist(): R {
    const checklist: string[] = [
      'PASSSENGER OXYGEN MASKS DEPLOYED',
      'CREW OXYGEN ON',
      'OUTFLOW VALVE AUTO/MANUAL CHECK',
      'PRESSURIZATION MODE SELECTOR CHECK',
      'EMERGENCY DESCENT INITIATED',
      'ATC NOTIFIED — MAYDAY DECOMPRESSION',
      'NEARESTSuitable AIRPORT IDENTIFIED',
      'PASSENGER BRIEFING COMPLETED',
      'EMERGENCY EQUIPMENT VERIFIED',
      `CABIN ALTITUDE: ${this._cabinAlt} FT`,
      `DIFFERENTIAL PRESSURE: ${this._differentialPressure.toFixed(2)} PSI`,
      `STATUS: ${this._mode}`,
    ];
    return { ok: true, data: { checklist, mode: this._mode, decompression: this._decompression } };
  }

  private _getStatusData() {
    return {
      cabinAlt: this._cabinAlt,
      targetAlt: this._targetAlt,
      differentialPressure: Math.round(this._differentialPressure * 100) / 100,
      decompression: this._decompression,
      outflowValve: this._outflowValve,
      mode: this._mode,
    };
  }
}

export class EngineHealthMonitoring {
  private _engines: Map<string, Engine> = new Map();

  addEngine(id: string, type: string): R {
    if (this._engines.has(id)) return { ok: false, error: `Engine ${id} already exists` };
    this._engines.set(id, { id, type, readings: [], lastCheck: Date.now() });
    return { ok: true, data: { id, type, status: 'registered' } };
  }

  updateReading(engineId: string, param: string, value: number): R {
    const engine = this._engines.get(engineId);
    if (!engine) return { ok: false, error: `Engine ${engineId} not found` };
    const validParams = ['egt', 'nit', 'vibration', 'oil_pressure', 'oil_temp', 'fuel_flow', 'np', 'nh'];
    if (!validParams.includes(param.toLowerCase())) return { ok: false, error: `Invalid param. Valid: ${validParams.join(', ')}` };
    engine.readings.push({ param: param.toLowerCase(), value, timestamp: Date.now() });
    if (engine.readings.length > 200) engine.readings = engine.readings.slice(-200);
    return { ok: true, data: { engineId, param, value, totalReadings: engine.readings.length } };
  }

  checkHealth(engineId: string): R {
    const engine = this._engines.get(engineId);
    if (!engine) return { ok: false, error: `Engine ${engineId} not found` };
    const params = ['egt', 'nit', 'vibration', 'oil_pressure', 'oil_temp', 'fuel_flow'];
    const health: Record<string, { value: number; status: string; trend: string }> = {};
    let overallStatus = 'HEALTHY';
    const warnings: string[] = [];

    for (const param of params) {
      const readings = engine.readings.filter(r => r.param === param);
      if (readings.length === 0) continue;
      const latest = readings[readings.length - 1].value;
      const prev = readings.length > 3 ? readings[readings.length - 4].value : latest;
      const trend = latest > prev * 1.05 ? 'INCREASING' : latest < prev * 0.95 ? 'DECREASING' : 'STABLE';
      const status = this._getParamStatus(param, latest);

      if (status === 'CRITICAL') { overallStatus = 'CRITICAL'; warnings.push(`${param}: ${status}`); }
      else if (status === 'WARNING' && overallStatus !== 'CRITICAL') { overallStatus = 'WARNING'; warnings.push(`${param}: ${status}`); }
      health[param] = { value: latest, status, trend };
    }

    this._engines.get(engineId)!.lastCheck = Date.now();
    return { ok: true, data: { engineId, type: engine.type, overallStatus, health, warnings, totalReadings: engine.readings.length } };
  }

  getPredictedFailure(engineId: string): R {
    const engine = this._engines.get(engineId);
    if (!engine) return { ok: false, error: `Engine ${engineId} not found` };
    const predictions: { component: string; risk: string; etaHours: number }[] = [];
    const components = [
      { param: 'vibration', name: 'BEARING', threshold: 4.0, etaBase: 500 },
      { param: 'egt', name: 'TURBINE BLADE', threshold: 900, etaBase: 1200 },
      { param: 'oil_pressure', name: 'OIL PUMP', threshold: 20, etaBase: 800 },
      { param: 'oil_temp', name: 'OIL COOLER', threshold: 140, etaBase: 1000 },
      { param: 'nit', name: 'COMPRESSOR', threshold: 850, etaBase: 1500 },
    ];

    for (const comp of components) {
      const readings = engine.readings.filter(r => r.param === comp.param);
      if (readings.length < 3) continue;
      const values = readings.slice(-5).map(r => r.value);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const slope = (values[values.length - 1] - values[0]) / values.length;
      const riskPct = avg / comp.threshold;
      if (riskPct > 0.9 || slope > 0) {
        const etaHours = slope > 0 ? Math.max(0, Math.round((comp.threshold - avg) / slope)) : comp.etaBase;
        const risk = riskPct > 0.95 ? 'IMMINENT' : riskPct > 0.8 ? 'HIGH' : riskPct > 0.6 ? 'MEDIUM' : 'LOW';
        predictions.push({ component: comp.name, risk, etaHours });
      }
    }

    predictions.sort((a, b) => a.etaHours - b.etaHours);
    return { ok: true, data: { engineId, predictions, totalReadings: engine.readings.length } };
  }

  getMaintenanceSchedule(): R {
    const schedule: { engineId: string; type: string; nextAction: string; priority: string; readings: number }[] = [];
    this._engines.forEach((engine, id) => {
      const lastCheck = engine.lastCheck;
      const hoursSinceCheck = (Date.now() - lastCheck) / (1000 * 60 * 60);
      const totalReadings = engine.readings.length;
      let nextAction: string;
      let priority: string;

      if (totalReadings > 150) {
        nextAction = 'IMMEDIATE INSPECTION — High data volume';
        priority = 'HIGH';
      } else if (hoursSinceCheck > 24) {
        nextAction = 'ROUTINE CHECK — Scheduled maintenance window';
        priority = 'MEDIUM';
      } else if (hoursSinceCheck > 72) {
        nextAction = 'OVERDUE — Extended maintenance required';
        priority = 'CRITICAL';
      } else {
        nextAction = 'CONTINUE MONITORING — Next check in 24h';
        priority = 'LOW';
      }
      schedule.push({ engineId: id, type: engine.type, nextAction, priority, readings: totalReadings });
    });
    return { ok: true, data: schedule };
  }

  private _getParamStatus(param: string, value: number): string {
    const thresholds: Record<string, { warning: number; critical: number; lowWarning?: number }> = {
      egt: { warning: 800, critical: 900 },
      nit: { warning: 750, critical: 850 },
      vibration: { warning: 3, critical: 4 },
      oil_pressure: { warning: 25, critical: 15, lowWarning: 30 },
      oil_temp: { warning: 120, critical: 140 },
      fuel_flow: { warning: 800, critical: 950 },
    };
    const t = thresholds[param];
    if (!t) return 'UNKNOWN';
    if (value > t.critical || (t.lowWarning && value < t.critical)) return 'CRITICAL';
    if (value > t.warning || (t.lowWarning && value < t.lowWarning)) return 'WARNING';
    return 'NORMAL';
  }
}

export type {
  R, TrafficInfo, OverrideRequest, EngineReading, Engine,
  NOTAM, RunwayCondition, METARData, SIGMETData, CabinStatus,
  TCASResolution as TCASResolutionType,
};

