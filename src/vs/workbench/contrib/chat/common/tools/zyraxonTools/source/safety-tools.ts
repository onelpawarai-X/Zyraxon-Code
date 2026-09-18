type R = { ok: boolean; data?: any; error?: string };

interface FailSafeRule {
    id: string;
    condition: (state: any) => boolean;
    action: (state: any) => any;
}

export class FailSafeSystem {
    private _rules: Map<string, FailSafeRule> = new Map();
    private _log: Array<{ timestamp: number; ruleId: string; action: any; state: any }> = [];
    private _active: Set<string> = new Set();

    addRule(id: string, condition: (state: any) => boolean, action: (state: any) => any): R {
        if (this._rules.has(id)) return { ok: false, error: "rule already exists" };
        this._rules.set(id, { id, condition, action });
        return { ok: true, data: { id, totalRules: this._rules.size } };
    }

    removeRule(id: string): R {
        if (!this._rules.has(id)) return { ok: false, error: "rule not found" };
        this._rules.delete(id);
        this._active.delete(id);
        return { ok: true, data: { removed: id, totalRules: this._rules.size } };
    }

    evaluate(state: any): R {
        const triggered: string[] = [];
        this._rules.forEach((rule, id) => {
            if (rule.condition(state)) {
                this._active.add(id);
                const actionResult = rule.action(state);
                this._log.push({ timestamp: Date.now(), ruleId: id, action: actionResult, state });
                triggered.push(id);
            } else {
                this._active.delete(id);
            }
        });
        return { ok: true, data: { triggered, activeRules: Array.from(this._active) } };
    }

    getActiveRules(): R {
        return { ok: true, data: { active: Array.from(this._active), count: this._active.size } };
    }

    trigger(ruleId: string): R {
        const rule = this._rules.get(ruleId);
        if (!rule) return { ok: false, error: "rule not found" };
        const result = rule.action(null);
        this._active.add(ruleId);
        this._log.push({ timestamp: Date.now(), ruleId, action: result, state: null });
        return { ok: true, data: { ruleId, result } };
    }

    getLog(): R {
        return { ok: true, data: { log: this._log, count: this._log.length } };
    }
}

export class WatchdogTimer {
    private _timeout: number = 0;
    private _lastKick: number = 0;
    private _active: boolean = false;
    private _expired: boolean = false;
    private _callback: (() => void) | null = null;

    start(timeoutMs: number): R {
        if (this._active) return { ok: false, error: "already running" };
        if (timeoutMs <= 0) return { ok: false, error: "invalid timeout" };
        this._timeout = timeoutMs;
        this._lastKick = Date.now();
        this._active = true;
        this._expired = false;
        return { ok: true, data: { started: true, timeoutMs } };
    }

    stop(): R {
        if (!this._active) return { ok: false, error: "not active" };
        this._active = false;
        const elapsed = Date.now() - this._lastKick;
        return { ok: true, data: { stopped: true, elapsed } };
    }

    kick(): R {
        if (!this._active) return { ok: false, error: "not active" };
        this._lastKick = Date.now();
        this._expired = false;
        return { ok: true, data: { kicked: true, remaining: this._timeout } };
    }

    getRemaining(): R {
        if (!this._active) return { ok: false, error: "not active" };
        const remaining = Math.max(0, this._timeout - (Date.now() - this._lastKick));
        if (remaining <= 0 && !this._expired) {
            this._expired = true;
            if (this._callback) this._callback();
        }
        return { ok: true, data: { remaining, expired: this._expired } };
    }

    isExpired(): R {
        if (!this._active) return { ok: false, error: "not active" };
        const elapsed = Date.now() - this._lastKick;
        const expired = elapsed >= this._timeout;
        if (expired && !this._expired) {
            this._expired = true;
            if (this._callback) this._callback();
        }
        return { ok: true, data: { expired } };
    }

    setCallback(fn: () => void): R {
        this._callback = fn;
        return { ok: true, data: { callbackSet: true } };
    }

    getStatus(): R {
        return { ok: true, data: { active: this._active, expired: this._expired, timeout: this._timeout, lastKick: this._lastKick } };
    }
}

export class EmergencyShutdown {
    private _zones: Map<string, { triggers: string[]; active: boolean }> = new Map();
    private _activated: Set<string> = new Set();
    private _log: Array<{ timestamp: number; zoneId: string; action: string; userId?: string }> = [];

    addZone(id: string, triggers: string[]): R {
        if (this._zones.has(id)) return { ok: false, error: "zone already exists" };
        this._zones.set(id, { triggers, active: true });
        return { ok: true, data: { id, triggers } };
    }

    activate(zoneId: string): R {
        const zone = this._zones.get(zoneId);
        if (!zone) return { ok: false, error: "zone not found" };
        if (!zone.active) return { ok: false, error: "zone disabled" };
        this._activated.add(zoneId);
        this._log.push({ timestamp: Date.now(), zoneId, action: "activated" });
        return { ok: true, data: { zoneId, activated: true, triggers: zone.triggers } };
    }

    deactivate(zoneId: string): R {
        if (!this._activated.has(zoneId)) return { ok: false, error: "zone not activated" };
        this._activated.delete(zoneId);
        this._log.push({ timestamp: Date.now(), zoneId, action: "deactivated" });
        return { ok: true, data: { zoneId, deactivated: true } };
    }

    isActivated(zoneId: string): R {
        return { ok: true, data: { zoneId, activated: this._activated.has(zoneId) } };
    }

    getShutdownSequence(): R {
        const sequence: Array<{ zoneId: string; triggers: string[]; priority: number }> = [];
        let priority = 0;
        this._activated.forEach(zoneId => {
            const zone = this._zones.get(zoneId);
            if (zone) {
                sequence.push({ zoneId, triggers: zone.triggers, priority: priority++ });
            }
        });
        return { ok: true, data: { sequence, activeZones: this._activated.size } };
    }

    overrideAuthorization(userId: string): R {
        if (!userId) return { ok: false, error: "invalid userId" };
        this._activated.forEach(zoneId => {
            this._log.push({ timestamp: Date.now(), zoneId, action: "override", userId });
        });
        this._activated.clear();
        return { ok: true, data: { override: true, userId, zonesCleared: true } };
    }

    getStatus(): R {
        const zones: Record<string, { active: boolean; triggered: boolean }> = {};
        this._zones.forEach((zone, id) => {
            zones[id] = { active: zone.active, triggered: this._activated.has(id) };
        });
        return { ok: true, data: { zones, activatedCount: this._activated.size, logCount: this._log.length } };
    }
}

export class RedundancyManager {
    private _channels: Map<string, { priority: number; active: boolean; failCount: number; lastTest: number }> = new Map();
    private _activeChannel: string | null = null;
    private _rules: Array<(status: any) => string | null> = [];

    addChannel(id: string, priority: number): R {
        if (this._channels.has(id)) return { ok: false, error: "channel already exists" };
        this._channels.set(id, { priority, active: true, failCount: 0, lastTest: 0 });
        if (!this._activeChannel) this._activeChannel = id;
        return { ok: true, data: { id, priority, totalChannels: this._channels.size } };
    }

    removeChannel(id: string): R {
        if (!this._channels.has(id)) return { ok: false, error: "channel not found" };
        this._channels.delete(id);
        if (this._activeChannel === id) {
            this._activeChannel = this.getBestChannel();
        }
        return { ok: true, data: { removed: id, activeChannel: this._activeChannel } };
    }

    getActiveChannel(): R {
        if (!this._activeChannel) return { ok: false, error: "no active channel" };
        const ch = this._channels.get(this._activeChannel);
        return { ok: true, data: { channel: this._activeChannel, ...ch } };
    }

    switchTo(channelId: string): R {
        const ch = this._channels.get(channelId);
        if (!ch) return { ok: false, error: "channel not found" };
        if (!ch.active) return { ok: false, error: "channel inactive" };
        const prev = this._activeChannel;
        this._activeChannel = channelId;
        return { ok: true, data: { previous: prev, current: channelId } };
    }

    testChannel(channelId: string): R {
        const ch = this._channels.get(channelId);
        if (!ch) return { ok: false, error: "channel not found" };
        ch.lastTest = Date.now();
        const healthy = ch.failCount < 3;
        if (!healthy) ch.active = false;
        return { ok: true, data: { channelId, healthy, failCount: ch.failCount, lastTest: ch.lastTest } };
    }

    getChannelStatus(): R {
        const channels: Record<string, any> = {};
        this._channels.forEach((ch, id) => {
            channels[id] = { ...ch, isCurrent: id === this._activeChannel };
        });
        return { ok: true, data: { channels, activeChannel: this._activeChannel } };
    }

    addVotingRule(rule: (status: any) => string | null): R {
        this._rules.push(rule);
        return { ok: true, data: { totalRules: this._rules.length } };
    }

    private getBestChannel(): string | null {
        let best: string | null = null;
        let bestPriority = Infinity;
        this._channels.forEach((ch, id) => {
            if (ch.active && ch.priority < bestPriority) {
                bestPriority = ch.priority;
                best = id;
            }
        });
        return best;
    }
}

interface FMEAFailureMode {
    mode: string;
    severity: number;
    occurrence: number;
    detection: number;
    rpn?: number;
}

export class FMEAAnalyzer {
    private _components: Map<string, { failureModes: FMEAFailureMode[] }> = new Map();

    addComponent(id: string, failureModes: Array<{ mode: string; severity: number; occurrence: number; detection: number }>): R {
        if (this._components.has(id)) return { ok: false, error: "component already exists" };
        const modes = failureModes.map(f => ({ ...f, rpn: f.severity * f.occurrence * f.detection }));
        this._components.set(id, { failureModes: modes });
        return { ok: true, data: { id, failureModes: modes.length } };
    }

    calculateRPN(): R {
        const results: Array<{ component: string; mode: string; rpn: number; severity: number; occurrence: number; detection: number }> = [];
        this._components.forEach((comp, id) => {
            comp.failureModes.forEach(f => {
                f.rpn = f.severity * f.occurrence * f.detection;
                results.push({ component: id, mode: f.mode, rpn: f.rpn, severity: f.severity, occurrence: f.occurrence, detection: f.detection });
            });
        });
        results.sort((a, b) => b.rpn - a.rpn);
        return { ok: true, data: { results, total: results.length } };
    }

    getHighestRisk(): R {
        let highest: FMEAFailureMode | null = null;
        let highestComponent = "";
        this._components.forEach((comp, id) => {
            comp.failureModes.forEach(f => {
                const rpn = f.severity * f.occurrence * f.detection;
                if (!highest || rpn > (highest.rpn || 0)) {
                    highest = { ...f, rpn };
                    highestComponent = id;
                }
            });
        });
        if (!highest) return { ok: false, error: "no components" };
        return { ok: true, data: { component: highestComponent, ...highest } };
    }

    getRecommendations(): R {
        const recs: Array<{ component: string; mode: string; rpn: number; suggestion: string }> = [];
        this._components.forEach((comp, id) => {
            comp.failureModes.forEach(f => {
                const rpn = (f.severity * f.occurrence * f.detection);
                if (rpn > 200) {
                    recs.push({ component: id, mode: f.mode, rpn, suggestion: "CRITICAL: Immediate redesign required" });
                } else if (rpn > 100) {
                    recs.push({ component: id, mode: f.mode, rpn, suggestion: "High risk: Improve detection or reduce occurrence" });
                } else if (rpn > 50) {
                    recs.push({ component: id, mode: f.mode, rpn, suggestion: "Moderate: Monitor and review periodically" });
                }
            });
        });
        recs.sort((a, b) => b.rpn - a.rpn);
        return { ok: true, data: { recommendations: recs, count: recs.length } };
    }

    updateSeverity(componentId: string, mode: string, severity: number): R {
        const comp = this._components.get(componentId);
        if (!comp) return { ok: false, error: "component not found" };
        const f = comp.failureModes.find(m => m.mode === mode);
        if (!f) return { ok: false, error: "failure mode not found" };
        f.severity = severity;
        f.rpn = f.severity * f.occurrence * f.detection;
        return { ok: true, data: { componentId, mode, severity, newRpn: f.rpn } };
    }

    updateDetection(componentId: string, mode: string, detection: number): R {
        const comp = this._components.get(componentId);
        if (!comp) return { ok: false, error: "component not found" };
        const f = comp.failureModes.find(m => m.mode === mode);
        if (!f) return { ok: false, error: "failure mode not found" };
        f.detection = detection;
        f.rpn = f.severity * f.occurrence * f.detection;
        return { ok: true, data: { componentId, mode, detection, newRpn: f.rpn } };
    }
}

export class SafetyInterlock {
    private _interlocks: Map<string, { condition: () => boolean; lockedState: any; overrideUser: string | null }> = new Map();
    private _locked: Set<string> = new Set();

    addInterlock(id: string, condition: () => boolean, lockedState: any): R {
        if (this._interlocks.has(id)) return { ok: false, error: "interlock already exists" };
        this._interlocks.set(id, { condition, lockedState, overrideUser: null });
        return { ok: true, data: { id, lockedState } };
    }

    lock(id: string): R {
        if (!this._interlocks.has(id)) return { ok: false, error: "interlock not found" };
        this._locked.add(id);
        return { ok: true, data: { id, locked: true } };
    }

    unlock(id: string): R {
        if (!this._locked.has(id)) return { ok: false, error: "not locked" };
        this._locked.delete(id);
        return { ok: true, data: { id, locked: false } };
    }

    isLocked(id: string): R {
        return { ok: true, data: { id, locked: this._locked.has(id) } };
    }

    checkCondition(id: string): R {
        const interlock = this._interlocks.get(id);
        if (!interlock) return { ok: false, error: "interlock not found" };
        const met = interlock.condition();
        return { ok: true, data: { id, conditionMet: met, locked: this._locked.has(id) } };
    }

    getStatus(): R {
        const status: Record<string, { locked: boolean; overrideUser: string | null }> = {};
        this._interlocks.forEach((interlock, id) => {
            status[id] = { locked: this._locked.has(id), overrideUser: interlock.overrideUser };
        });
        return { ok: true, data: { interlocks: status, lockedCount: this._locked.size } };
    }

    override(id: string, userId: string): R {
        const interlock = this._interlocks.get(id);
        if (!interlock) return { ok: false, error: "interlock not found" };
        if (!userId) return { ok: false, error: "userId required" };
        interlock.overrideUser = userId;
        this._locked.delete(id);
        return { ok: true, data: { id, overridden: true, userId } };
    }
}

interface CircuitState {
    state: "closed" | "open" | "half-open";
    tripCount: number;
    failureCount: number;
    successCount: number;
    lastTrip: number;
    lastReset: number;
    lastStateChange: number;
}

export class CircuitBreaker {
    private _circuits: Map<string, {
        threshold: number;
        timeout: number;
        state: CircuitState;
    }> = new Map();

    addCircuit(id: string, threshold: number, timeout: number): R {
        if (this._circuits.has(id)) return { ok: false, error: "circuit already exists" };
        if (threshold <= 0 || timeout <= 0) return { ok: false, error: "invalid params" };
        this._circuits.set(id, {
            threshold,
            timeout,
            state: {
                state: "closed",
                tripCount: 0,
                failureCount: 0,
                successCount: 0,
                lastTrip: 0,
                lastReset: 0,
                lastStateChange: Date.now()
            }
        });
        return { ok: true, data: { id, threshold, timeout } };
    }

    trip(id: string): R {
        const circuit = this._circuits.get(id);
        if (!circuit) return { ok: false, error: "circuit not found" };
        circuit.state.tripCount++;
        circuit.state.failureCount++;
        circuit.state.state = "open";
        circuit.state.lastTrip = Date.now();
        circuit.state.lastStateChange = Date.now();
        return { ok: true, data: { id, tripped: true, tripCount: circuit.state.tripCount } };
    }

    reset(id: string): R {
        const circuit = this._circuits.get(id);
        if (!circuit) return { ok: false, error: "circuit not found" };
        circuit.state.state = "closed";
        circuit.state.failureCount = 0;
        circuit.state.lastReset = Date.now();
        circuit.state.lastStateChange = Date.now();
        return { ok: true, data: { id, reset: true, state: "closed" } };
    }

    isTripped(id: string): R {
        const circuit = this._circuits.get(id);
        if (!circuit) return { ok: false, error: "circuit not found" };
        if (circuit.state.state === "open") {
            const elapsed = Date.now() - circuit.state.lastTrip;
            if (elapsed >= circuit.timeout) {
                circuit.state.state = "half-open";
                circuit.state.lastStateChange = Date.now();
                return { ok: true, data: { id, tripped: false, state: "half-open", elapsed } };
            }
        }
        return { ok: true, data: { id, tripped: circuit.state.state === "open", state: circuit.state.state } };
    }

    record(id: string): R {
        const circuit = this._circuits.get(id);
        if (!circuit) return { ok: false, error: "circuit not found" };
        circuit.state.successCount++;
        if (circuit.state.state === "half-open") {
            circuit.state.state = "closed";
            circuit.state.failureCount = 0;
            circuit.state.lastStateChange = Date.now();
        }
        return { ok: true, data: { id, success: true, state: circuit.state.state, successCount: circuit.state.successCount } };
    }

    getStats(id: string): R {
        const circuit = this._circuits.get(id);
        if (!circuit) return { ok: false, error: "circuit not found" };
        const uptime = circuit.state.successCount + circuit.state.failureCount;
        const failureRate = uptime > 0 ? circuit.state.failureCount / uptime : 0;
        return {
            ok: true,
            data: {
                id,
                ...circuit.state,
                uptime,
                failureRate: Number(failureRate.toFixed(4)),
                threshold: circuit.threshold,
                timeout: circuit.timeout
            }
        };
    }
}