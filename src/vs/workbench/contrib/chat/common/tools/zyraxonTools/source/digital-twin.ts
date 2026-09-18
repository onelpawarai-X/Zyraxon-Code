type R = { ok: boolean; data?: any; error?: string };

export class TwinManager {
    private _twins: Map<string, {
        type: string;
        state: Record<string, any>;
        initialState: Record<string, any>;
        history: Array<{ state: Record<string, any>; timestamp: number }>;
        createdAt: number;
    }> = new Map();

    createTwin(id: string, type: string, initialState: Record<string, any>): R {
        if (this._twins.has(id)) return { ok: false, error: `Twin '${id}' already exists` };
        this._twins.set(id, {
            type,
            state: { ...initialState },
            initialState: { ...initialState },
            history: [{ state: { ...initialState }, timestamp: Date.now() }],
            createdAt: Date.now(),
        });
        return { ok: true, data: { id, type, state: initialState } };
    }

    destroyTwin(id: string): R {
        if (!this._twins.has(id)) return { ok: false, error: `Twin '${id}' not found` };
        this._twins.delete(id);
        return { ok: true, data: { id, destroyed: true } };
    }

    getState(twinId: string): R {
        const twin = this._twins.get(twinId);
        if (!twin) return { ok: false, error: `Twin '${twinId}' not found` };
        return { ok: true, data: { id: twinId, state: twin.state, type: twin.type } };
    }

    setState(twinId: string, state: Record<string, any>): R {
        const twin = this._twins.get(twinId);
        if (!twin) return { ok: false, error: `Twin '${twinId}' not found` };
        twin.state = { ...twin.state, ...state };
        twin.history.push({ state: { ...twin.state }, timestamp: Date.now() });
        return { ok: true, data: { id: twinId, state: twin.state } };
    }

    syncState(twinId: string, realState: Record<string, any>): R {
        const twin = this._twins.get(twinId);
        if (!twin) return { ok: false, error: `Twin '${twinId}' not found` };
        const delta: Record<string, any> = {};
        for (const key of Object.keys(realState)) {
            if (twin.state[key] !== realState[key]) {
                delta[key] = { old: twin.state[key], new: realState[key] };
            }
        }
        twin.state = { ...realState };
        twin.history.push({ state: { ...twin.state }, timestamp: Date.now() });
        return { ok: true, data: { id: twinId, synced: true, delta, fieldsChanged: Object.keys(delta).length } };
    }

    getDelta(twinId: string): R {
        const twin = this._twins.get(twinId);
        if (!twin) return { ok: false, error: `Twin '${twinId}' not found` };
        const delta: Record<string, any> = {};
        for (const key of Object.keys(twin.initialState)) {
            if (twin.state[key] !== twin.initialState[key]) {
                delta[key] = { initial: twin.initialState[key], current: twin.state[key] };
            }
        }
        return { ok: true, data: { id: twinId, delta, fieldsChanged: Object.keys(delta).length } };
    }

    getHistory(twinId: string): R {
        const twin = this._twins.get(twinId);
        if (!twin) return { ok: false, error: `Twin '${twinId}' not found` };
        return { ok: true, data: { id: twinId, history: twin.history, entries: twin.history.length } };
    }
}

export class PhysicsEngine {
    private _bodies: Map<string, {
        mass: number;
        position: { x: number; y: number; z: number };
        velocity: { x: number; y: number; z: number };
        forces: Array<{ x: number; y: number; z: number }>;
    }> = new Map();
    private _gravity: { x: number; y: number; z: number } = { x: 0, y: -9.81, z: 0 };

    addBody(id: string, mass: number, position: { x: number; y: number; z: number }, velocity: { x: number; y: number; z: number }): R {
        if (mass <= 0) return { ok: false, error: "Mass must be positive" };
        this._bodies.set(id, { mass, position: { ...position }, velocity: { ...velocity }, forces: [] });
        return { ok: true, data: { id, mass, position, velocity } };
    }

    removeBody(id: string): R {
        if (!this._bodies.has(id)) return { ok: false, error: `Body '${id}' not found` };
        this._bodies.delete(id);
        return { ok: true, data: { id, removed: true } };
    }

    applyForce(id: string, force: { x: number; y: number; z: number }): R {
        const body = this._bodies.get(id);
        if (!body) return { ok: false, error: `Body '${id}' not found` };
        body.forces.push({ ...force });
        return { ok: true, data: { id, force, totalForces: body.forces.length } };
    }

    simulate(dt: number): R {
        const snapshots: Record<string, any> = {};
        for (const [id, body] of this._bodies) {
            let totalForce = { x: this._gravity.x * body.mass, y: this._gravity.y * body.mass, z: this._gravity.z * body.mass };
            for (const f of body.forces) {
                totalForce.x += f.x;
                totalForce.y += f.y;
                totalForce.z += f.z;
            }
            const ax = totalForce.x / body.mass;
            const ay = totalForce.y / body.mass;
            const az = totalForce.z / body.mass;
            body.velocity.x += ax * dt;
            body.velocity.y += ay * dt;
            body.velocity.z += az * dt;
            body.position.x += body.velocity.x * dt;
            body.position.y += body.velocity.y * dt;
            body.position.z += body.velocity.z * dt;
            body.forces = [];
            snapshots[id] = { position: { ...body.position }, velocity: { ...body.velocity } };
        }
        return { ok: true, data: { dt, bodies: snapshots, time: Date.now() } };
    }

    getPositions(): R {
        const positions: Record<string, { x: number; y: number; z: number }> = {};
        for (const [id, body] of this._bodies) {
            positions[id] = { ...body.position };
        }
        return { ok: true, data: positions };
    }

    getVelocities(): R {
        const velocities: Record<string, { x: number; y: number; z: number }> = {};
        for (const [id, body] of this._bodies) {
            velocities[id] = { ...body.velocity };
        }
        return { ok: true, data: velocities };
    }

    checkCollisions(): R {
        const collisions: Array<{ bodyA: string; bodyB: string; distance: number }> = [];
        const ids = [...this._bodies.keys()];
        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                const a = this._bodies.get(ids[i])!;
                const b = this._bodies.get(ids[j])!;
                const dx = a.position.x - b.position.x;
                const dy = a.position.y - b.position.y;
                const dz = a.position.z - b.position.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                const minDist = (Math.cbrt(a.mass) + Math.cbrt(b.mass)) * 0.5;
                if (dist < minDist) {
                    collisions.push({ bodyA: ids[i], bodyB: ids[j], distance: +dist.toFixed(4) });
                }
            }
        }
        return { ok: true, data: { collisions, count: collisions.length } };
    }
}

export class ScenarioRunner {
    private _scenarios: Map<string, {
        initialState: Record<string, any>;
        events: Array<{ time: number; action: string; params: any }>;
        running: boolean;
        startTime: number | null;
    }> = new Map();
    private _results: Map<string, {
        frames: Array<{ time: number; state: Record<string, any>; events: string[] }>;
        completed: boolean;
    }> = new Map();

    createScenario(id: string, initialState: Record<string, any>, events: Array<{ time: number; action: string; params: any }>): R {
        if (this._scenarios.has(id)) return { ok: false, error: `Scenario '${id}' already exists` };
        this._scenarios.set(id, { initialState: { ...initialState }, events: [...events].sort((a, b) => a.time - b.time), running: false, startTime: null });
        this._results.set(id, { frames: [], completed: false });
        return { ok: true, data: { id, initialState, eventCount: events.length } };
    }

    run(scenarioId: string, duration: number): R {
        const scenario = this._scenarios.get(scenarioId);
        if (!scenario) return { ok: false, error: `Scenario '${scenarioId}' not found` };
        const result = this._results.get(scenarioId)!;
        let state = { ...scenario.initialState };
        const appliedEvents: string[] = [];
        for (let t = 0; t <= duration; t++) {
            for (const event of scenario.events) {
                if (event.time === t) {
                    state = { ...state, ...event.params };
                    appliedEvents.push(event.action);
                }
            }
            result.frames.push({ time: t, state: { ...state }, events: [...appliedEvents] });
            appliedEvents.length = 0;
        }
        result.completed = true;
        scenario.running = false;
        return { ok: true, data: { scenarioId, duration, frames: result.frames.length, completed: true } };
    }

    pause(scenarioId: string): R {
        const scenario = this._scenarios.get(scenarioId);
        if (!scenario) return { ok: false, error: `Scenario '${scenarioId}' not found` };
        scenario.running = false;
        return { ok: true, data: { scenarioId, paused: true } };
    }

    resume(scenarioId: string): R {
        const scenario = this._scenarios.get(scenarioId);
        if (!scenario) return { ok: false, error: `Scenario '${scenarioId}' not found` };
        scenario.running = true;
        scenario.startTime = Date.now();
        return { ok: true, data: { scenarioId, resumed: true } };
    }

    getResults(scenarioId: string): R {
        const result = this._results.get(scenarioId);
        if (!result) return { ok: false, error: `Results for '${scenarioId}' not found` };
        return { ok: true, data: { scenarioId, frames: result.frames, completed: result.completed, totalFrames: result.frames.length } };
    }

    compareScenarios(ids: string[]): R {
        const comparisons: Record<string, any> = {};
        for (const id of ids) {
            const result = this._results.get(id);
            if (!result) continue;
            const finalState = result.frames.length > 0 ? result.frames[result.frames.length - 1].state : {};
            comparisons[id] = {
                totalFrames: result.frames.length,
                completed: result.completed,
                finalState,
            };
        }
        return { ok: true, data: { scenarios: ids, comparisons } };
    }
}

export class StateSynchronizer {
    private _sources: Map<string, {
        type: string;
        connection: any;
        connected: boolean;
        lastSync: number | null;
        latency: number;
    }> = new Map();
    private _state: Map<string, any> = new Map();

    addSource(id: string, type: string, connection: any): R {
        if (this._sources.has(id)) return { ok: false, error: `Source '${id}' already exists` };
        this._sources.set(id, { type, connection, connected: false, lastSync: null, latency: 0 });
        return { ok: true, data: { id, type, connected: false } };
    }

    connect(sourceId: string): R {
        const source = this._sources.get(sourceId);
        if (!source) return { ok: false, error: `Source '${sourceId}' not found` };
        source.connected = true;
        source.lastSync = Date.now();
        return { ok: true, data: { id: sourceId, connected: true } };
    }

    disconnect(sourceId: string): R {
        const source = this._sources.get(sourceId);
        if (!source) return { ok: false, error: `Source '${sourceId}' not found` };
        source.connected = false;
        return { ok: true, data: { id: sourceId, connected: false } };
    }

    getState(): R {
        const state: Record<string, any> = {};
        for (const [k, v] of this._state) state[k] = v;
        return { ok: true, data: state };
    }

    sync(): R {
        const synced: string[] = [];
        const now = Date.now();
        for (const [id, source] of this._sources) {
            if (!source.connected) continue;
            const latency = now - (source.lastSync || now);
            source.latency = latency;
            source.lastSync = now;
            this._state.set(id, { type: source.type, lastSync: now, latency });
            synced.push(id);
        }
        return { ok: true, data: { synced, count: synced.length, timestamp: now } };
    }

    getLatency(sourceId: string): R {
        const source = this._sources.get(sourceId);
        if (!source) return { ok: false, error: `Source '${sourceId}' not found` };
        return { ok: true, data: { id: sourceId, latency: source.latency, lastSync: source.lastSync } };
    }

    getSourceStatus(sourceId: string): R {
        const source = this._sources.get(sourceId);
        if (!source) return { ok: false, error: `Source '${sourceId}' not found` };
        return {
            ok: true,
            data: {
                id: sourceId,
                type: source.type,
                connected: source.connected,
                lastSync: source.lastSync,
                latency: source.latency,
            },
        };
    }
}

export class SimulationScheduler {
    private _tasks: Map<string, {
        interval: number;
        fn: (...args: any[]) => any;
        timer: any | null;
        runs: number;
        lastRun: number | null;
        errors: number;
    }> = new Map();
    private _running: boolean = false;
    private _stats = { totalRuns: 0, totalErrors: 0, uptime: 0, startTime: 0 };

    addTask(id: string, interval: number, fn: (...args: any[]) => any): R {
        if (this._tasks.has(id)) return { ok: false, error: `Task '${id}' already exists` };
        if (interval <= 0) return { ok: false, error: "Interval must be positive" };
        this._tasks.set(id, { interval, fn, timer: null, runs: 0, lastRun: null, errors: 0 });
        return { ok: true, data: { id, interval, registered: true } };
    }

    removeTask(id: string): R {
        const task = this._tasks.get(id);
        if (!task) return { ok: false, error: `Task '${id}' not found` };
        if (task.timer) clearInterval(task.timer);
        this._tasks.delete(id);
        return { ok: true, data: { id, removed: true } };
    }

    start(): R {
        if (this._running) return { ok: false, error: "Already running" };
        this._running = true;
        this._stats.startTime = Date.now();
        for (const [id, task] of this._tasks) {
            task.timer = setInterval(() => {
                try {
                    task.fn();
                    task.runs++;
                    task.lastRun = Date.now();
                    this._stats.totalRuns++;
                } catch {
                    task.errors++;
                    this._stats.totalErrors++;
                }
            }, task.interval);
        }
        return { ok: true, data: { running: true, tasks: this._tasks.size } };
    }

    stop(): R {
        if (!this._running) return { ok: false, error: "Not running" };
        this._running = false;
        this._stats.uptime = Date.now() - this._stats.startTime;
        for (const [, task] of this._tasks) {
            if (task.timer) clearInterval(task.timer);
            task.timer = null;
        }
        return { ok: true, data: { running: false, uptime: this._stats.uptime } };
    }

    pause(): R {
        if (!this._running) return { ok: false, error: "Not running" };
        for (const [, task] of this._tasks) {
            if (task.timer) clearInterval(task.timer);
            task.timer = null;
        }
        this._running = false;
        return { ok: true, data: { paused: true } };
    }

    resume(): R {
        if (this._running) return { ok: false, error: "Already running" };
        this._running = true;
        for (const [id, task] of this._tasks) {
            task.timer = setInterval(() => {
                try {
                    task.fn();
                    task.runs++;
                    task.lastRun = Date.now();
                    this._stats.totalRuns++;
                } catch {
                    task.errors++;
                    this._stats.totalErrors++;
                }
            }, task.interval);
        }
        return { ok: true, data: { resumed: true, tasks: this._tasks.size } };
    }

    getTaskStatus(id: string): R {
        const task = this._tasks.get(id);
        if (!task) return { ok: false, error: `Task '${id}' not found` };
        return {
            ok: true,
            data: {
                id,
                interval: task.interval,
                runs: task.runs,
                errors: task.errors,
                lastRun: task.lastRun,
                active: task.timer !== null,
            },
        };
    }

    getPerformance(): R {
        const uptime = this._running ? Date.now() - this._stats.startTime : this._stats.uptime;
        const tasks: Record<string, any> = {};
        for (const [id, task] of this._tasks) {
            tasks[id] = { runs: task.runs, errors: task.errors, lastRun: task.lastRun, active: task.timer !== null };
        }
        return {
            ok: true,
            data: {
                running: this._running,
                uptime,
                totalRuns: this._stats.totalRuns,
                totalErrors: this._stats.totalErrors,
                tasks,
            },
        };
    }
}
