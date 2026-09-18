type R = { ok: boolean; data?: any; error?: string };

export class AlertManager {
  private _alerts: Map<string, { id: string; condition: string; severity: string; message: string; enabled: boolean; acknowledgedBy: string | null }> = new Map();
  private _active: Set<string> = new Set();
  private _history: { alertId: string; action: string; userId?: string; timestamp: number }[] = [];

  createAlert(id: string, condition: string, severity: string, message: string): R {
    if (this._alerts.has(id)) return { ok: false, error: "Alert already exists" };
    this._alerts.set(id, { id, condition, severity, message, enabled: true, acknowledgedBy: null });
    this._active.add(id);
    this._history.push({ alertId: id, action: "created", timestamp: Date.now() });
    return { ok: true, data: this._alerts.get(id) };
  }

  enableAlert(id: string): R {
    const alert = this._alerts.get(id);
    if (!alert) return { ok: false, error: "Alert not found" };
    alert.enabled = true;
    this._active.add(id);
    return { ok: true, data: alert };
  }

  disableAlert(id: string): R {
    const alert = this._alerts.get(id);
    if (!alert) return { ok: false, error: "Alert not found" };
    alert.enabled = false;
    this._active.delete(id);
    return { ok: true, data: alert };
  }

  getActiveAlerts(): R {
    const active = Array.from(this._active)
      .map((id) => this._alerts.get(id))
      .filter(Boolean);
    return { ok: true, data: active };
  }

  acknowledgeAlert(id: string, userId: string): R {
    const alert = this._alerts.get(id);
    if (!alert) return { ok: false, error: "Alert not found" };
    alert.acknowledgedBy = userId;
    this._active.delete(id);
    this._history.push({ alertId: id, action: "acknowledged", userId, timestamp: Date.now() });
    return { ok: true, data: alert };
  }

  getHistory(n: number): R {
    return { ok: true, data: this._history.slice(-n) };
  }
}

export class NotificationEngine {
  private _channels: Map<string, { id: string; type: string; config: any }> = new Map();
  private _messages: { id: string; channelId: string; message: string; severity: string; status: string; attempts: number; retryPolicy: any; timestamp: number }[] = [];
  private _messageCounter: number = 0;

  addChannel(id: string, type: string, config: any): R {
    if (this._channels.has(id)) return { ok: false, error: "Channel already exists" };
    this._channels.set(id, { id, type, config });
    return { ok: true, data: this._channels.get(id) };
  }

  send(channelId: string, message: string, severity: string): R {
    if (!this._channels.has(channelId)) return { ok: false, error: "Channel not found" };
    this._messageCounter++;
    const msg = {
      id: `msg_${Date.now()}_${this._messageCounter.toString(36).padStart(4, "0")}`,
      channelId,
      message,
      severity,
      status: "delivered",
      attempts: 1,
      retryPolicy: null,
      timestamp: Date.now(),
    };
    this._messages.push(msg);
    return { ok: true, data: msg };
  }

  getDelivered(): R {
    return { ok: true, data: this._messages.filter((m) => m.status === "delivered") };
  }

  getPending(): R {
    return { ok: true, data: this._messages.filter((m) => m.status === "pending") };
  }

  retry(messageId: string): R {
    const msg = this._messages.find((m) => m.id === messageId);
    if (!msg) return { ok: false, error: "Message not found" };
    msg.attempts++;
    msg.status = "delivered";
    return { ok: true, data: msg };
  }

  setRetryPolicy(messageId: string, policy: any): R {
    const msg = this._messages.find((m) => m.id === messageId);
    if (!msg) return { ok: false, error: "Message not found" };
    msg.retryPolicy = policy;
    return { ok: true, data: msg };
  }
}

export class EscalationPolicy {
  private _policies: Map<string, { id: string; levels: { level: number; timeout: number; notify: string[] }[] }> = new Map();
  private _escalations: Map<string, { alertId: string; policyId: string; currentLevel: number; startedAt: number; acknowledged: boolean; snoozedUntil: number | null }> = new Map();

  createPolicy(id: string, levels: { level: number; timeout: number; notify: string[] }[]): R {
    if (this._policies.has(id)) return { ok: false, error: "Policy already exists" };
    this._policies.set(id, { id, levels: levels.sort((a, b) => a.level - b.level) });
    return { ok: true, data: this._policies.get(id) };
  }

  escalate(alertId: string): R {
    const esc = this._escalations.get(alertId);
    if (!esc) return { ok: false, error: "Escalation not found" };
    if (esc.acknowledged) return { ok: false, error: "Already acknowledged" };
    if (esc.snoozedUntil && Date.now() < esc.snoozedUntil) return { ok: false, error: "Currently snoozed" };
    const policy = this._policies.get(esc.policyId);
    if (!policy) return { ok: false, error: "Policy not found" };
    if (esc.currentLevel < policy.levels.length - 1) {
      esc.currentLevel++;
      return { ok: true, data: esc };
    }
    return { ok: false, error: "Max escalation level reached" };
  }

  getLevel(alertId: string): R {
    const esc = this._escalations.get(alertId);
    if (!esc) return { ok: false, error: "Escalation not found" };
    return { ok: true, data: { level: esc.currentLevel, alertId } };
  }

  acknowledge(alertId: string): R {
    const esc = this._escalations.get(alertId);
    if (!esc) return { ok: false, error: "Escalation not found" };
    esc.acknowledged = true;
    return { ok: true, data: esc };
  }

  snooze(alertId: string, duration: number): R {
    const esc = this._escalations.get(alertId);
    if (!esc) return { ok: false, error: "Escalation not found" };
    esc.snoozedUntil = Date.now() + duration;
    return { ok: true, data: esc };
  }

  getActiveEscalations(): R {
    const active = Array.from(this._escalations.values()).filter(
      (e) => !e.acknowledged && (!e.snoozedUntil || Date.now() >= e.snoozedUntil)
    );
    return { ok: true, data: active };
  }
}

export class AnomalyAlerter {
  private _metrics: Map<string, { id: string; baseline: number; threshold: number; values: number[] }> = new Map();
  private _anomalies: { id: string; metricId: string; value: number; baseline: number; deviation: number; timestamp: number; acknowledged: boolean }[] = [];
  private _anomalyCounter: number = 0;

  addMetric(id: string, baseline: number, threshold: number): R {
    if (this._metrics.has(id)) return { ok: false, error: "Metric already exists" };
    this._metrics.set(id, { id, baseline, threshold, values: [] });
    return { ok: true, data: this._metrics.get(id) };
  }

  detect(metricId: string, value: number): R {
    const metric = this._metrics.get(metricId);
    if (!metric) return { ok: false, error: "Metric not found" };
    metric.values.push(value);
    if (metric.values.length > 100) metric.values.shift();
    const deviation = Math.abs(value - metric.baseline);
    if (deviation > metric.threshold) {
      this._anomalyCounter++;
      const anomaly = {
        id: `anom_${Date.now()}_${this._anomalyCounter.toString(36).padStart(4, "0")}`,
        metricId,
        value,
        baseline: metric.baseline,
        deviation,
        timestamp: Date.now(),
        acknowledged: false,
      };
      this._anomalies.push(anomaly);
      return { ok: true, data: { anomalyDetected: true, anomaly } };
    }
    return { ok: true, data: { anomalyDetected: false } };
  }

  getAnomalies(): R {
    return { ok: true, data: [...this._anomalies] };
  }

  acknowledge(anomalyId: string): R {
    const anomaly = this._anomalies.find((a) => a.id === anomalyId);
    if (!anomaly) return { ok: false, error: "Anomaly not found" };
    anomaly.acknowledged = true;
    return { ok: true, data: anomaly };
  }

  getPattern(metricId: string): R {
    const metric = this._metrics.get(metricId);
    if (!metric) return { ok: false, error: "Metric not found" };
    const vals = metric.values;
    if (vals.length === 0) return { ok: true, data: { pattern: "insufficient_data" } };
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    const std = Math.sqrt(variance);
    return { ok: true, data: { mean, std, min: Math.min(...vals), max: Math.max(...vals), count: vals.length } };
  }

  predictNext(metricId: string): R {
    const metric = this._metrics.get(metricId);
    if (!metric) return { ok: false, error: "Metric not found" };
    const vals = metric.values;
    if (vals.length < 2) return { ok: true, data: { prediction: vals[0] ?? metric.baseline } };
    const n = vals.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += vals[i];
      sumXY += i * vals[i];
      sumXX += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return { ok: true, data: { prediction: slope * n + intercept } };
  }
}
