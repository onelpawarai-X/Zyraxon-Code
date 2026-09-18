type R = { ok: boolean; data?: any; error?: string };

export class TimeSeriesDB {
  private _measurements: Map<string, { name: string; tags: any; data: { value: number; timestamp: number }[]; retention: number; downsampleInterval: number | null }> = new Map();

  createMeasurement(name: string, tags: any): R {
    if (this._measurements.has(name)) return { ok: false, error: "Measurement already exists" };
    this._measurements.set(name, { name, tags, data: [], retention: 30 * 24 * 60 * 60 * 1000, downsampleInterval: null });
    return { ok: true, data: this._measurements.get(name) };
  }

  insert(measurement: string, value: number, timestamp: number): R {
    const m = this._measurements.get(measurement);
    if (!m) return { ok: false, error: "Measurement not found" };
    m.data.push({ value, timestamp });
    m.data.sort((a, b) => a.timestamp - b.timestamp);
    const cutoff = Date.now() - m.retention;
    m.data = m.data.filter((d) => d.timestamp >= cutoff);
    return { ok: true, data: { count: m.data.length } };
  }

  query(measurement: string, startTime: number, endTime: number): R {
    const m = this._measurements.get(measurement);
    if (!m) return { ok: false, error: "Measurement not found" };
    const filtered = m.data.filter((d) => d.timestamp >= startTime && d.timestamp <= endTime);
    return { ok: true, data: filtered };
  }

  aggregate(measurement: string, fn: "avg" | "sum" | "min" | "max" | "count", period: number): R {
    const m = this._measurements.get(measurement);
    if (!m) return { ok: false, error: "Measurement not found" };
    if (m.data.length === 0) return { ok: true, data: [] };
    const buckets: Map<number, number[]> = new Map();
    for (const d of m.data) {
      const bucket = Math.floor(d.timestamp / period) * period;
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket)!.push(d.value);
    }
    const result = Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ts, values]) => {
        let aggregated: number;
        switch (fn) {
          case "avg": aggregated = values.reduce((a, b) => a + b, 0) / values.length; break;
          case "sum": aggregated = values.reduce((a, b) => a + b, 0); break;
          case "min": aggregated = Math.min(...values); break;
          case "max": aggregated = Math.max(...values); break;
          case "count": aggregated = values.length; break;
        }
        return { timestamp: ts, value: aggregated };
      });
    return { ok: true, data: result };
  }

  getRetention(): R {
    const retentions: Record<string, number> = {};
    for (const [name, m] of this._measurements) retentions[name] = m.retention;
    return { ok: true, data: retentions };
  }

  downsample(measurement: string, interval: number): R {
    const m = this._measurements.get(measurement);
    if (!m) return { ok: false, error: "Measurement not found" };
    m.downsampleInterval = interval;
    const buckets: Map<number, { sum: number; count: number }> = new Map();
    for (const d of m.data) {
      const bucket = Math.floor(d.timestamp / interval) * interval;
      if (!buckets.has(bucket)) buckets.set(bucket, { sum: 0, count: 0 });
      const b = buckets.get(bucket)!;
      b.sum += d.value;
      b.count++;
    }
    m.data = Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ts, b]) => ({ value: b.sum / b.count, timestamp: ts }));
    return { ok: true, data: { downsampled: m.data.length } };
  }
}

export class EventLogger {
  private _events: { id: string; source: string; level: string; message: string; data: any; timestamp: number }[] = [];
  private _stats: Record<string, number> = {};
  private _eventCounter: number = 0;

  log(source: string, level: string, message: string, data: any): R {
    this._eventCounter++;
    const event = {
      id: `evt_${Date.now()}_${this._eventCounter.toString(36).padStart(4, "0")}`,
      source,
      level,
      message,
      data,
      timestamp: Date.now(),
    };
    this._events.push(event);
    this._stats[level] = (this._stats[level] || 0) + 1;
    this._stats[source] = (this._stats[source] || 0) + 1;
    return { ok: true, data: event };
  }

  query(filter: { source?: string; level?: string; startTime?: number; endTime?: number }): R {
    let results = [...this._events];
    if (filter.source) results = results.filter((e) => e.source === filter.source);
    if (filter.level) results = results.filter((e) => e.level === filter.level);
    if (filter.startTime) results = results.filter((e) => e.timestamp >= filter.startTime!);
    if (filter.endTime) results = results.filter((e) => e.timestamp <= filter.endTime!);
    return { ok: true, data: results };
  }

  getRecent(n: number): R {
    return { ok: true, data: this._events.slice(-n) };
  }

  getStats(): R {
    return { ok: true, data: { ...this._stats, totalEvents: this._events.length } };
  }

  clear(): R {
    const count = this._events.length;
    this._events = [];
    this._stats = {};
    return { ok: true, data: { cleared: count } };
  }

  export(format: "json" | "csv"): R {
    if (format === "json") return { ok: true, data: JSON.stringify(this._events) };
    if (format === "csv") {
      const header = "id,source,level,message,timestamp";
      const rows = this._events.map((e) => `${e.id},${e.source},${e.level},"${e.message}",${e.timestamp}`);
      return { ok: true, data: [header, ...rows].join("\n") };
    }
    return { ok: false, error: "Unsupported format" };
  }
}

export class AuditTrail {
  private _trail: { id: string; userId: string; action: string; resource: string; details: any; timestamp: number }[] = [];
  private _auditCounter: number = 0;

  record(userId: string, action: string, resource: string, details: any): R {
    this._auditCounter++;
    const entry = {
      id: `audit_${Date.now()}_${this._auditCounter.toString(36).padStart(4, "0")}`,
      userId,
      action,
      resource,
      details,
      timestamp: Date.now(),
    };
    this._trail.push(entry);
    return { ok: true, data: entry };
  }

  getTrail(userId: string): R {
    return { ok: true, data: this._trail.filter((e) => e.userId === userId) };
  }

  getResourceTrail(resourceId: string): R {
    return { ok: true, data: this._trail.filter((e) => e.resource === resourceId) };
  }

  getRecent(n: number): R {
    return { ok: true, data: this._trail.slice(-n) };
  }

  export(format: "json" | "csv"): R {
    if (format === "json") return { ok: true, data: JSON.stringify(this._trail) };
    if (format === "csv") {
      const header = "id,userId,action,resource,timestamp";
      const rows = this._trail.map((e) => `${e.id},${e.userId},${e.action},${e.resource},${e.timestamp}`);
      return { ok: true, data: [header, ...rows].join("\n") };
    }
    return { ok: false, error: "Unsupported format" };
  }

  getStats(): R {
    const byUser: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    for (const e of this._trail) {
      byUser[e.userId] = (byUser[e.userId] || 0) + 1;
      byAction[e.action] = (byAction[e.action] || 0) + 1;
    }
    return { ok: true, data: { total: this._trail.length, byUser, byAction } };
  }
}

export class DataExporter {
  private _formats: Map<string, { extension: string; mimeType: string; serialize: (data: any) => string }> = new Map();

  exportCSV(data: any[]): R {
    if (!data.length) return { ok: true, data: "" };
    const headers = Object.keys(data[0]);
    const rows = data.map((row) => headers.map((h) => JSON.stringify(row[h] ?? "")).join(","));
    return { ok: true, data: [headers.join(","), ...rows].join("\n") };
  }

  exportJSON(data: any): R {
    return { ok: true, data: JSON.stringify(data, null, 2) };
  }

  exportParquet(data: any[]): R {
    const metadata = { format: "parquet", rows: data.length, columns: data.length > 0 ? Object.keys(data[0]) : [] };
    return { ok: true, data: { metadata, payload: JSON.stringify(data) } };
  }

  importCSV(file: string): R {
    const lines = file.trim().split("\n");
    if (lines.length < 2) return { ok: true, data: [] };
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => (obj[h] = values[i] ?? ""));
      return obj;
    });
    return { ok: true, data: rows };
  }

  importJSON(file: string): R {
    try {
      const parsed = JSON.parse(file);
      return { ok: true, data: parsed };
    } catch {
      return { ok: false, error: "Invalid JSON" };
    }
  }

  getStats(): R {
    return { ok: true, data: { supportedFormats: ["csv", "json", "parquet"], registeredFormats: Array.from(this._formats.keys()) } };
  }
}

export class StorageManager {
  private _allocations: Map<string, { name: string; size: number; compressed: boolean; createdAt: number }> = new Map();

  allocate(name: string, size: number): R {
    if (this._allocations.has(name)) return { ok: false, error: "Allocation already exists" };
    this._allocations.set(name, { name, size, compressed: false, createdAt: Date.now() });
    return { ok: true, data: this._allocations.get(name) };
  }

  deallocate(name: string): R {
    if (!this._allocations.has(name)) return { ok: false, error: "Allocation not found" };
    this._allocations.delete(name);
    return { ok: true };
  }

  getUsage(): R {
    let total = 0;
    for (const a of this._allocations.values()) total += a.size;
    return { ok: true, data: { used: total, count: this._allocations.size } };
  }

  getQuota(): R {
    return { ok: true, data: { quota: 1024 * 1024 * 1024, used: Array.from(this._allocations.values()).reduce((s, a) => s + a.size, 0) } };
  }

  compress(name: string): R {
    const alloc = this._allocations.get(name);
    if (!alloc) return { ok: false, error: "Allocation not found" };
    if (alloc.compressed) return { ok: false, error: "Already compressed" };
    const ratio = 0.6;
    alloc.size = Math.floor(alloc.size * ratio);
    alloc.compressed = true;
    return { ok: true, data: alloc };
  }

  decompress(name: string): R {
    const alloc = this._allocations.get(name);
    if (!alloc) return { ok: false, error: "Allocation not found" };
    if (!alloc.compressed) return { ok: false, error: "Not compressed" };
    alloc.size = Math.floor(alloc.size / 0.6);
    alloc.compressed = false;
    return { ok: true, data: alloc };
  }
}
