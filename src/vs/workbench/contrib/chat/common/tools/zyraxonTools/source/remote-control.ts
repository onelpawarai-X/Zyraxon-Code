type R = { ok: boolean; data?: any; error?: string };

export class WebSocketServer {
  private _clients: Map<string, { socket: any; id: string; connectedAt: number }> = new Map();
  private _port: number = 0;
  private _running: boolean = false;
  private _handlers: Map<string, (clientId: string, data: any) => void> = new Map();

  start(port: number): R {
    if (this._running) return { ok: false, error: "Server already running" };
    this._port = port;
    this._running = true;
    return { ok: true, data: { port } };
  }

  stop(): R {
    if (!this._running) return { ok: false, error: "Server not running" };
    this._running = false;
    const count = this._clients.size;
    this._clients.clear();
    return { ok: true, data: { stopped: true, disconnectedClients: count } };
  }

  broadcast(data: any): R {
    if (!this._running) return { ok: false, error: "Server not running" };
    let sent = 0;
    for (const [id, client] of this._clients) {
      try {
        client.socket.send?.(JSON.stringify(data));
        sent++;
      } catch {
        this._clients.delete(id);
      }
    }
    return { ok: true, data: { sent, total: this._clients.size } };
  }

  send(clientId: string, data: any): R {
    const client = this._clients.get(clientId);
    if (!client) return { ok: false, error: `Client ${clientId} not found` };
    try {
      client.socket.send?.(JSON.stringify(data));
      return { ok: true, data: { clientId, sent: true } };
    } catch {
      this._clients.delete(clientId);
      return { ok: false, error: "Send failed, client removed" };
    }
  }

  getClients(): R {
    const list = Array.from(this._clients.values()).map(c => ({
      id: c.id,
      connectedAt: c.connectedAt,
    }));
    return { ok: true, data: list };
  }

  onMessage(callback: (clientId: string, data: any) => void): R {
    this._handlers.set("message", callback);
    return { ok: true, data: { registered: true } };
  }

  getConnectionCount(): number {
    return this._clients.size;
  }
}

export class RESTAPI {
  private _routes: Map<string, { method: string; path: string; handler: (body: any) => R }> = new Map();
  private _port: number = 0;
  private _running: boolean = false;

  start(port: number): R {
    if (this._running) return { ok: false, error: "API already running" };
    this._port = port;
    this._running = true;
    return { ok: true, data: { port } };
  }

  stop(): R {
    if (!this._running) return { ok: false, error: "API not running" };
    this._running = false;
    return { ok: true, data: { stopped: true } };
  }

  addRoute(method: string, path: string, handler: (body: any) => R): R {
    const key = `${method.toUpperCase()}:${path}`;
    if (this._routes.has(key)) return { ok: false, error: "Route already exists" };
    this._routes.set(key, { method: method.toUpperCase(), path, handler });
    return { ok: true, data: { method: method.toUpperCase(), path } };
  }

  removeRoute(method: string, path: string): R {
    const key = `${method.toUpperCase()}:${path}`;
    if (!this._routes.has(key)) return { ok: false, error: "Route not found" };
    this._routes.delete(key);
    return { ok: true, data: { removed: true } };
  }

  getRoutes(): R {
    const routes = Array.from(this._routes.values()).map(r => ({
      method: r.method,
      path: r.path,
    }));
    return { ok: true, data: routes };
  }

  handleRequest(method: string, path: string, body?: any): R {
    const key = `${method.toUpperCase()}:${path}`;
    const route = this._routes.get(key);
    if (!route) return { ok: false, error: `No route for ${method} ${path}` };
    try {
      return route.handler(body);
    } catch (e: any) {
      return { ok: false, error: e.message ?? "Handler error" };
    }
  }

  getCORS(): { origin: string; methods: string; headers: string } {
    return {
      origin: "*",
      methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      headers: "Content-Type,Authorization",
    };
  }
}

export class NetworkAuth {
  private _clients: Map<string, { id: string; key: string; role: string; active: boolean }> = new Map();
  private _tokens: Map<string, { clientId: string; expiresAt: number; role: string }> = new Map();

  addClient(id: string, key: string, role: string): R {
    if (this._clients.has(id)) return { ok: false, error: "Client already exists" };
    this._clients.set(id, { id, key, role, active: true });
    return { ok: true, data: { id, role } };
  }

  authenticate(id: string, key: string): R {
    const client = this._clients.get(id);
    if (!client) return { ok: false, error: "Client not found" };
    if (!client.active) return { ok: false, error: "Client revoked" };
    if (client.key !== key) return { ok: false, error: "Invalid key" };
    const token = this.generateToken(id, client.role);
    return { ok: true, data: { token, role: client.role } };
  }

  revokeClient(id: string): R {
    const client = this._clients.get(id);
    if (!client) return { ok: false, error: "Client not found" };
    client.active = false;
    for (const [tk, val] of this._tokens) {
      if (val.clientId === id) this._tokens.delete(tk);
    }
    return { ok: true, data: { id, revoked: true } };
  }

  getRole(id: string): R {
    const client = this._clients.get(id);
    if (!client) return { ok: false, error: "Client not found" };
    return { ok: true, data: { role: client.role } };
  }

  authorize(clientId: string, permission: string): R {
    const client = this._clients.get(clientId);
    if (!client) return { ok: false, error: "Client not found" };
    if (!client.active) return { ok: false, error: "Client revoked" };
    const rolePerms: Record<string, string[]> = {
      admin: ["read", "write", "delete", "execute", "manage"],
      operator: ["read", "write", "execute"],
      viewer: ["read"],
    };
    const perms = rolePerms[client.role] ?? [];
    if (!perms.includes(permission)) {
      return { ok: false, error: `Role ${client.role} lacks permission: ${permission}` };
    }
    return { ok: true, data: { clientId, permission, granted: true } };
  }

  getToken(clientId: string): R {
    for (const [token, val] of this._tokens) {
      if (val.clientId === clientId && val.expiresAt > Date.now()) {
        return { ok: true, data: { token, expiresAt: val.expiresAt } };
      }
    }
    return { ok: false, error: "No valid token" };
  }

  validateToken(token: string): R {
    const data = this._tokens.get(token);
    if (!data) return { ok: false, error: "Invalid token" };
    if (data.expiresAt <= Date.now()) {
      this._tokens.delete(token);
      return { ok: false, error: "Token expired" };
    }
    return { ok: true, data: { clientId: data.clientId, role: data.role } };
  }

  private generateToken(clientId: string, role: string): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    const base = `${clientId}-${role}-${Date.now()}`;
    for (let i = 0; i < 48; i++) {
      token += chars[(base.charCodeAt(i % base.length) + i) % chars.length];
    }
    this._tokens.set(token, { clientId, expiresAt: Date.now() + 3600000, role });
    return token;
  }
}

export class RemoteSession {
  private _target: string = "";
  private _connected: boolean = false;
  private _latency: number = 0;
  private _lastResponse: any = null;
  private _reconnectPolicy: { maxRetries: number; delayMs: number; backoff: number } = {
    maxRetries: 3,
    delayMs: 1000,
    backoff: 2,
  };
  private _connectTime: number = 0;

  connect(target: string, credentials: { token?: string; key?: string }): R {
    if (this._connected) return { ok: false, error: "Already connected" };
    if (!target) return { ok: false, error: "Invalid target" };
    this._target = target;
    this._connected = true;
    this._connectTime = Date.now();
    this._latency = 10;
    return { ok: true, data: { target, connected: true, latency: this._latency } };
  }

  disconnect(): R {
    if (!this._connected) return { ok: false, error: "Not connected" };
    const was = this._target;
    this._connected = false;
    this._target = "";
    return { ok: true, data: { disconnectedFrom: was } };
  }

  sendCommand(cmd: string, args?: Record<string, any>): R {
    if (!this._connected) return { ok: false, error: "Not connected" };
    this._lastResponse = {
      command: cmd,
      args: args ?? {},
      result: `executed:${cmd}`,
      timestamp: Date.now(),
    };
    this._latency = 5 + Math.min(cmd.length, 30);
    return { ok: true, data: this._lastResponse };
  }

  getResponse(): any {
    return this._lastResponse;
  }

  isActive(): boolean {
    return this._connected;
  }

  getLatency(): number {
    return this._latency;
  }

  getReconnectPolicy(): { maxRetries: number; delayMs: number; backoff: number } {
    return { ...this._reconnectPolicy };
  }
}

export class CommandProtocol {
  private _commands: Map<string, { name: string; handler: (args: any, clientId: string) => R; allowedRoles: string[] }> = new Map();
  private _history: Array<{ name: string; args: any; clientId: string; result: R; timestamp: number }> = [];

  registerCommand(name: string, handler: (args: any, clientId: string) => R, allowedRoles: string[] = ["admin", "operator"]): R {
    if (this._commands.has(name)) return { ok: false, error: "Command already registered" };
    this._commands.set(name, { name, handler, allowedRoles });
    return { ok: true, data: { name, roles: allowedRoles } };
  }

  unregisterCommand(name: string): R {
    if (!this._commands.has(name)) return { ok: false, error: "Command not found" };
    this._commands.delete(name);
    return { ok: true, data: { name, unregistered: true } };
  }

  executeCommand(name: string, args: any, clientId: string): R {
    const cmd = this._commands.get(name);
    if (!cmd) return { ok: false, error: `Command ${name} not found` };
    let result: R;
    try {
      result = cmd.handler(args, clientId);
    } catch (e: any) {
      result = { ok: false, error: e.message ?? "Execution error" };
    }
    this._history.push({ name, args, clientId, result, timestamp: Date.now() });
    return result;
  }

  getCommands(): R {
    const cmds = Array.from(this._commands.values()).map(c => ({
      name: c.name,
      roles: c.allowedRoles,
    }));
    return { ok: true, data: cmds };
  }

  getHistory(): Array<{ name: string; args: any; clientId: string; result: R; timestamp: number }> {
    return [...this._history];
  }

  hasPermission(commandName: string, role: string): boolean {
    const cmd = this._commands.get(commandName);
    if (!cmd) return false;
    return cmd.allowedRoles.includes(role);
  }
}

export class HeartbeatMonitor {
  private _monitors: Map<string, { target: string; intervalMs: number; intervalId: any; timeoutMs: number; callback: ((status: any) => void) | null }> = new Map();
  private _statuses: Map<string, { target: string; lastCheck: number; alive: boolean; history: Array<{ timestamp: number; alive: boolean; latency: number }> }> = new Map();
  private _heartbeatCount: Map<string, number> = new Map();

  start(target: string, intervalMs: number): R {
    if (this._monitors.has(target)) return { ok: false, error: "Monitor already exists" };
    const monitor = { target, intervalMs, intervalId: null as any, timeoutMs: 5000, callback: null as ((status: any) => void) | null };
    this._statuses.set(target, { target, lastCheck: 0, alive: true, history: [] });
    this._heartbeatCount.set(target, 0);
    monitor.intervalId = setInterval(() => {
      const status = this._statuses.get(target);
      if (!status) return;
      const count = (this._heartbeatCount.get(target) ?? 0) + 1;
      this._heartbeatCount.set(target, count);
      const latency = (count * 7) % 100;
      const alive = latency < (monitor.timeoutMs / 2);
      status.lastCheck = Date.now();
      status.alive = alive;
      status.history.push({ timestamp: Date.now(), alive, latency });
      if (status.history.length > 100) status.history.shift();
      monitor.callback?.({ target, alive, latency, timestamp: Date.now() });
    }, intervalMs);
    this._monitors.set(target, monitor);
    return { ok: true, data: { target, intervalMs } };
  }

  stop(target?: string): R {
    if (target) {
      const mon = this._monitors.get(target);
      if (!mon) return { ok: false, error: "Monitor not found" };
      clearInterval(mon.intervalId);
      this._monitors.delete(target);
      return { ok: true, data: { target, stopped: true } };
    }
    for (const [t, mon] of this._monitors) {
      clearInterval(mon.intervalId);
    }
    const count = this._monitors.size;
    this._monitors.clear();
    return { ok: true, data: { stoppedAll: count } };
  }

  getStatus(target: string): R {
    const status = this._statuses.get(target);
    if (!status) return { ok: false, error: "No status for target" };
    return { ok: true, data: { target: status.target, alive: status.alive, lastCheck: status.lastCheck, historyLength: status.history.length } };
  }

  getHistory(target: string): R {
    const status = this._statuses.get(target);
    if (!status) return { ok: false, error: "No status for target" };
    return { ok: true, data: [...status.history] };
  }

  setCallback(target: string, fn: (status: any) => void): R {
    const mon = this._monitors.get(target);
    if (!mon) return { ok: false, error: "Monitor not found" };
    mon.callback = fn;
    return { ok: true, data: { target, callbackSet: true } };
  }

  setTimeout(target: string, ms: number): R {
    const mon = this._monitors.get(target);
    if (!mon) return { ok: false, error: "Monitor not found" };
    mon.timeoutMs = ms;
    return { ok: true, data: { target, timeoutMs: ms } };
  }
}
