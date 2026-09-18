type R = { ok: boolean; data?: any; error?: string };

export class RBACManager {
  _roles: Map<string, { id: string; permissions: string[] }>;
  _assignments: Map<string, Set<string>>;

  constructor() {
    this._roles = new Map();
    this._assignments = new Map();
  }

  addRole(id: string, permissions: string[]): R {
    if (this._roles.has(id)) return { ok: false, error: "Role exists" };
    this._roles.set(id, { id, permissions: [...permissions] });
    return { ok: true, data: { id, permissions } };
  }

  removeRole(id: string): R {
    if (!this._roles.has(id)) return { ok: false, error: "Role not found" };
    this._roles.delete(id);
    for (const [, roles] of this._assignments) roles.delete(id);
    return { ok: true, data: { removed: id } };
  }

  assignRole(userId: string, roleId: string): R {
    if (!this._roles.has(roleId)) return { ok: false, error: "Role not found" };
    if (!this._assignments.has(userId)) this._assignments.set(userId, new Set());
    this._assignments.get(userId)!.add(roleId);
    return { ok: true, data: { userId, roleId } };
  }

  revokeRole(userId: string, roleId: string): R {
    const roles = this._assignments.get(userId);
    if (!roles || !roles.has(roleId)) return { ok: false, error: "Assignment not found" };
    roles.delete(roleId);
    return { ok: true, data: { userId, roleId } };
  }

  hasPermission(userId: string, permission: string): R {
    const roles = this._assignments.get(userId);
    if (!roles) return { ok: true, data: { granted: false } };
    for (const roleId of roles) {
      const role = this._roles.get(roleId);
      if (role && role.permissions.includes(permission)) return { ok: true, data: { granted: true } };
    }
    return { ok: true, data: { granted: false } };
  }

  getRoles(userId: string): R {
    const roles = this._assignments.get(userId);
    return { ok: true, data: roles ? Array.from(roles) : [] };
  }

  getPermissions(roleId: string): R {
    const role = this._roles.get(roleId);
    if (!role) return { ok: false, error: "Role not found" };
    return { ok: true, data: role.permissions };
  }
}

export class AuthenticationEngine {
  _users: Map<string, { id: string; passwordHash: string; mfa: boolean; mfaSecret: string }>;
  _sessions: Map<string, { sessionId: string; userId: string; createdAt: number; expiresAt: number; mfaVerified: boolean }>;
  private _sessionCounter: number = 0;
  private _mfaCounter: number = 0;

  constructor() {
    this._users = new Map();
    this._sessions = new Map();
  }

  private hashPassword(password: string): string {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `h_${Math.abs(hash).toString(36)}`;
  }

  private generateSessionId(): string {
    this._sessionCounter++;
    return `s_${Date.now().toString(36)}_${this._sessionCounter.toString(36).padStart(6, "0")}`;
  }

  private generateMfaSecret(): string {
    this._mfaCounter++;
    return `mfa_${this._mfaCounter.toString(36).padStart(8, "0")}${Date.now().toString(36)}`;
  }

  addUser(id: string, password: string, mfa: boolean): R {
    if (this._users.has(id)) return { ok: false, error: "User exists" };
    const passwordHash = this.hashPassword(password);
    const mfaSecret = mfa ? this.generateMfaSecret() : "";
    this._users.set(id, { id, passwordHash, mfa, mfaSecret });
    return { ok: true, data: { id, mfa } };
  }

  authenticate(id: string, password: string, mfaCode?: string): R {
    const user = this._users.get(id);
    if (!user) return { ok: false, error: "User not found" };
    if (user.passwordHash !== this.hashPassword(password)) return { ok: false, error: "Invalid password" };
    if (user.mfa) {
      if (!mfaCode) return { ok: false, error: "MFA code required" };
      const validCode = user.mfaSecret.slice(-6);
      if (mfaCode !== validCode) return { ok: false, error: "Invalid MFA code" };
    }
    const sessionId = this.generateSessionId();
    const now = Date.now();
    const session = { sessionId, userId: id, createdAt: now, expiresAt: now + 3600000, mfaVerified: user.mfa };
    this._sessions.set(sessionId, session);
    return { ok: true, data: { sessionId, userId: id, expiresAt: session.expiresAt } };
  }

  logout(sessionId: string): R {
    if (!this._sessions.has(sessionId)) return { ok: false, error: "Session not found" };
    this._sessions.delete(sessionId);
    return { ok: true, data: { sessionId } };
  }

  getSession(sessionId: string): R {
    const session = this._sessions.get(sessionId);
    if (!session) return { ok: false, error: "Session not found" };
    if (Date.now() > session.expiresAt) { this._sessions.delete(sessionId); return { ok: false, error: "Session expired" }; }
    return { ok: true, data: session };
  }

  refreshToken(sessionId: string): R {
    const session = this._sessions.get(sessionId);
    if (!session) return { ok: false, error: "Session not found" };
    session.expiresAt = Date.now() + 3600000;
    return { ok: true, data: { sessionId, expiresAt: session.expiresAt } };
  }

  getActiveSessions(): R {
    const now = Date.now();
    const active: any[] = [];
    for (const [id, session] of this._sessions) {
      if (now <= session.expiresAt) active.push(session);
      else this._sessions.delete(id);
    }
    return { ok: true, data: active };
  }
}

export class PolicyEngine {
  _policies: Map<string, { id: string; rules: Array<{ resource: string; action: string; conditions: Record<string, any> }>; effect: "allow" | "deny" }>;
  _audit: Array<{ timestamp: number; policyId: string; resource: string; action: string; result: string }>;

  constructor() {
    this._policies = new Map();
    this._audit = [];
  }

  addPolicy(id: string, rules: Array<{ resource: string; action: string; conditions: Record<string, any> }>, effect: "allow" | "deny"): R {
    if (this._policies.has(id)) return { ok: false, error: "Policy exists" };
    this._policies.set(id, { id, rules, effect });
    return { ok: true, data: { id, effect, ruleCount: rules.length } };
  }

  evaluate(resource: string, action: string, context: Record<string, any>): R {
    let decision: "allow" | "deny" | null = null;
    let matchedPolicy = "";
    for (const [, policy] of this._policies) {
      for (const rule of policy.rules) {
        const resourceMatch = rule.resource === "*" || resource.startsWith(rule.resource);
        const actionMatch = rule.action === "*" || action === rule.action;
        if (resourceMatch && actionMatch) {
          let conditionsMet = true;
          for (const [key, val] of Object.entries(rule.conditions)) {
            if (context[key] !== val) { conditionsMet = false; break; }
          }
          if (conditionsMet) { decision = policy.effect; matchedPolicy = policy.id; }
        }
      }
    }
    const result = decision || "deny";
    this._audit.push({ timestamp: Date.now(), policyId: matchedPolicy, resource, action, result });
    return { ok: true, data: { decision: result, matchedPolicy } };
  }

  getPolicies(): R {
    const policies = Array.from(this._policies.values()).map(p => ({ id: p.id, effect: p.effect, ruleCount: p.rules.length }));
    return { ok: true, data: policies };
  }

  removePolicy(id: string): R {
    if (!this._policies.has(id)) return { ok: false, error: "Policy not found" };
    this._policies.delete(id);
    return { ok: true, data: { removed: id } };
  }

  updatePolicy(id: string, rules: Array<{ resource: string; action: string; conditions: Record<string, any> }>): R {
    const policy = this._policies.get(id);
    if (!policy) return { ok: false, error: "Policy not found" };
    policy.rules = rules;
    return { ok: true, data: { id, ruleCount: rules.length } };
  }

  getAudit(): R {
    return { ok: true, data: this._audit.slice(-100) };
  }
}

export class AccessLog {
  _logs: Array<{ timestamp: number; userId: string; resource: string; action: string; result: string }>;

  constructor() {
    this._logs = [];
  }

  log(userId: string, resource: string, action: string, result: string): R {
    const entry = { timestamp: Date.now(), userId, resource, action, result };
    this._logs.push(entry);
    return { ok: true, data: entry };
  }

  query(userId?: string, resource?: string, timeRange?: { start: number; end: number }): R {
    let filtered = this._logs;
    if (userId) filtered = filtered.filter(l => l.userId === userId);
    if (resource) filtered = filtered.filter(l => l.resource === resource);
    if (timeRange) filtered = filtered.filter(l => l.timestamp >= timeRange.start && l.timestamp <= timeRange.end);
    return { ok: true, data: filtered.slice(-1000) };
  }

  getStats(): R {
    const total = this._logs.length;
    const byResult: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    for (const log of this._logs) {
      byResult[log.result] = (byResult[log.result] || 0) + 1;
      byUser[log.userId] = (byUser[log.userId] || 0) + 1;
      byAction[log.action] = (byAction[log.action] || 0) + 1;
    }
    return { ok: true, data: { total, byResult, byUser, byAction } };
  }

  getAnomalies(): R {
    const userCounts: Record<string, number> = {};
    const userFails: Record<string, number> = {};
    for (const log of this._logs) {
      userCounts[log.userId] = (userCounts[log.userId] || 0) + 1;
      if (log.result === "deny") userFails[log.userId] = (userFails[log.userId] || 0) + 1;
    }
    const anomalies: Array<{ userId: string; reason: string; count: number }> = [];
    for (const [userId, count] of Object.entries(userCounts)) {
      if (count > 100) anomalies.push({ userId, reason: "High volume", count });
      const fails = userFails[userId] || 0;
      if (fails > 10) anomalies.push({ userId, reason: "Multiple failures", count: fails });
    }
    return { ok: true, data: anomalies };
  }

  export(format: "json" | "csv"): R {
    if (format === "json") return { ok: true, data: JSON.stringify(this._logs) };
    const header = "timestamp,userId,resource,action,result\n";
    const rows = this._logs.map(l => `${l.timestamp},${l.userId},${l.resource},${l.action},${l.result}`).join("\n");
    return { ok: true, data: header + rows };
  }

  clear(): R {
    const count = this._logs.length;
    this._logs = [];
    return { ok: true, data: { cleared: count } };
  }
}

export class TokenManager {
  _tokens: Map<string, { token: string; userId: string; permissions: string[]; createdAt: number; expiresAt: number; revoked: boolean }>;
  private _tokenCounter: number = 0;

  constructor() {
    this._tokens = new Map();
  }

  private generateToken(): string {
    this._tokenCounter++;
    const ts = Date.now().toString(36);
    const cnt = this._tokenCounter.toString(36).padStart(8, "0");
    return `tok_${ts}_${cnt}`;
  }

  createToken(userId: string, permissions: string[], expiry: number): R {
    const token = this.generateToken();
    const now = Date.now();
    this._tokens.set(token, { token, userId, permissions: [...permissions], createdAt: now, expiresAt: now + expiry, revoked: false });
    return { ok: true, data: { token, userId, expiresAt: now + expiry } };
  }

  validateToken(token: string): R {
    const t = this._tokens.get(token);
    if (!t) return { ok: false, error: "Token not found" };
    if (t.revoked) return { ok: false, error: "Token revoked" };
    if (Date.now() > t.expiresAt) return { ok: false, error: "Token expired" };
    return { ok: true, data: { userId: t.userId, permissions: t.permissions } };
  }

  refresh(token: string): R {
    const t = this._tokens.get(token);
    if (!t) return { ok: false, error: "Token not found" };
    if (t.revoked) return { ok: false, error: "Token revoked" };
    const newExpiry = Date.now() + 3600000;
    t.expiresAt = newExpiry;
    return { ok: true, data: { token, expiresAt: newExpiry } };
  }

  revoke(token: string): R {
    const t = this._tokens.get(token);
    if (!t) return { ok: false, error: "Token not found" };
    t.revoked = true;
    return { ok: true, data: { token, revoked: true } };
  }

  getActiveTokens(): R {
    const now = Date.now();
    const active: any[] = [];
    for (const [token, t] of this._tokens) {
      if (!t.revoked && now <= t.expiresAt) active.push({ token, userId: t.userId, expiresAt: t.expiresAt });
    }
    return { ok: true, data: active };
  }

  getStats(): R {
    let total = 0;
    let active = 0;
    let revoked = 0;
    let expired = 0;
    const now = Date.now();
    for (const [, t] of this._tokens) {
      total++;
      if (t.revoked) revoked++;
      else if (now > t.expiresAt) expired++;
      else active++;
    }
    return { ok: true, data: { total, active, revoked, expired } };
  }
}

export class CertificateManager {
  _certs: Map<string, { serial: string; subject: string; issuedAt: number; expiresAt: number; fingerprint: string }>;
  _revoked: Set<string>;
  private _serialCounter: number = 0;
  private _fingerprintCounter: number = 0;

  constructor() {
    this._certs = new Map();
    this._revoked = new Set();
  }

  private generateSerial(): string {
    this._serialCounter++;
    return `CERT_${Date.now().toString(36)}_${this._serialCounter.toString(36).padStart(6, "0")}`;
  }

  private generateFingerprint(): string {
    this._fingerprintCounter++;
    const base = this._fingerprintCounter.toString(16).padStart(16, "0");
    return (base.repeat(4)).slice(0, 64);
  }

  generateCert(subject: string, validDays: number): R {
    const serial = this.generateSerial();
    const now = Date.now();
    const cert = { serial, subject, issuedAt: now, expiresAt: now + validDays * 86400000, fingerprint: this.generateFingerprint() };
    this._certs.set(serial, cert);
    return { ok: true, data: { serial, subject, expiresAt: cert.expiresAt } };
  }

  verifyCert(serial: string): R {
    const cert = this._certs.get(serial);
    if (!cert) return { ok: false, error: "Certificate not found" };
    if (this._revoked.has(serial)) return { ok: false, data: { valid: false, reason: "revoked" } };
    if (Date.now() > cert.expiresAt) return { ok: false, data: { valid: false, reason: "expired" } };
    return { ok: true, data: { valid: true, subject: cert.subject, expiresAt: cert.expiresAt } };
  }

  revokeCert(serial: string): R {
    if (!this._certs.has(serial)) return { ok: false, error: "Certificate not found" };
    this._revoked.add(serial);
    return { ok: true, data: { serial, revoked: true } };
  }

  getRevoked(): R {
    return { ok: true, data: Array.from(this._revoked) };
  }

  isRevoked(serial: string): R {
    if (!this._certs.has(serial)) return { ok: false, error: "Certificate not found" };
    return { ok: true, data: { revoked: this._revoked.has(serial) } };
  }

  getExpiring(days: number): R {
    const cutoff = Date.now() + days * 86400000;
    const expiring: any[] = [];
    for (const [serial, cert] of this._certs) {
      if (!this._revoked.has(serial) && cert.expiresAt <= cutoff) {
        expiring.push({ serial, subject: cert.subject, expiresAt: cert.expiresAt });
      }
    }
    return { ok: true, data: expiring };
  }
}
