type R = { ok: boolean; data?: any; error?: string };

export class DashboardManager {
  private _panels: Map<string, { id: string; type: string; config: any; data: any }> = new Map();
  private _layout: string[] = [];

  createPanel(id: string, type: string, config: any): R {
    if (this._panels.has(id)) return { ok: false, error: "Panel already exists" };
    this._panels.set(id, { id, type, config, data: null });
    this._layout.push(id);
    return { ok: true, data: this._panels.get(id) };
  }

  removePanel(id: string): R {
    if (!this._panels.has(id)) return { ok: false, error: "Panel not found" };
    this._panels.delete(id);
    this._layout = this._layout.filter((pid) => pid !== id);
    return { ok: true };
  }

  updatePanel(id: string, data: any): R {
    const panel = this._panels.get(id);
    if (!panel) return { ok: false, error: "Panel not found" };
    panel.data = data;
    return { ok: true, data: panel };
  }

  getPanel(id: string): R {
    const panel = this._panels.get(id);
    if (!panel) return { ok: false, error: "Panel not found" };
    return { ok: true, data: panel };
  }

  getAllPanels(): R {
    return { ok: true, data: Array.from(this._panels.values()) };
  }

  getLayout(): R {
    return { ok: true, data: [...this._layout] };
  }

  setLayout(layout: string[]): R {
    for (const id of layout) {
      if (!this._panels.has(id)) return { ok: false, error: `Panel ${id} not found` };
    }
    this._layout = [...layout];
    return { ok: true, data: [...this._layout] };
  }
}

export class ChartEngine {
  private _charts: Map<string, { id: string; type: string; data: any; series: any[]; options: any }> = new Map();

  createChart(id: string, type: string, data: any): R {
    if (this._charts.has(id)) return { ok: false, error: "Chart already exists" };
    this._charts.set(id, { id, type, data, series: [], options: {} });
    return { ok: true, data: this._charts.get(id) };
  }

  updateData(chartId: string, data: any): R {
    const chart = this._charts.get(chartId);
    if (!chart) return { ok: false, error: "Chart not found" };
    chart.data = data;
    return { ok: true, data: chart };
  }

  addSeries(chartId: string, series: any): R {
    const chart = this._charts.get(chartId);
    if (!chart) return { ok: false, error: "Chart not found" };
    chart.series.push(series);
    return { ok: true, data: chart.series };
  }

  removeSeries(chartId: string, seriesId: string): R {
    const chart = this._charts.get(chartId);
    if (!chart) return { ok: false, error: "Chart not found" };
    const idx = chart.series.findIndex((s: any) => s.id === seriesId);
    if (idx === -1) return { ok: false, error: "Series not found" };
    chart.series.splice(idx, 1);
    return { ok: true, data: chart.series };
  }

  setOptions(chartId: string, options: any): R {
    const chart = this._charts.get(chartId);
    if (!chart) return { ok: false, error: "Chart not found" };
    chart.options = { ...chart.options, ...options };
    return { ok: true, data: chart.options };
  }

  getChart(chartId: string): R {
    const chart = this._charts.get(chartId);
    if (!chart) return { ok: false, error: "Chart not found" };
    return { ok: true, data: chart };
  }
}

export class StatusMonitor {
  private _metrics: Map<string, { id: string; name: string; unit: string; range: { min: number; max: number }; value: number; thresholds: any[] }> = new Map();
  private _alerts: { metricId: string; value: number; threshold: any; timestamp: number }[] = [];

  addMetric(id: string, name: string, unit: string, range: { min: number; max: number }): R {
    if (this._metrics.has(id)) return { ok: false, error: "Metric already exists" };
    this._metrics.set(id, { id, name, unit, range, value: 0, thresholds: [] });
    return { ok: true, data: this._metrics.get(id) };
  }

  updateValue(id: string, value: number): R {
    const metric = this._metrics.get(id);
    if (!metric) return { ok: false, error: "Metric not found" };
    metric.value = value;
    for (const t of metric.thresholds) {
      if ((t.min !== undefined && value < t.min) || (t.max !== undefined && value > t.max)) {
        this._alerts.push({ metricId: id, value, threshold: t, timestamp: Date.now() });
      }
    }
    return { ok: true, data: metric };
  }

  getStatus(id: string): R {
    const metric = this._metrics.get(id);
    if (!metric) return { ok: false, error: "Metric not found" };
    return { ok: true, data: metric };
  }

  getAllStatus(): R {
    return { ok: true, data: Array.from(this._metrics.values()) };
  }

  getAlerts(): R {
    return { ok: true, data: [...this._alerts] };
  }

  addThreshold(id: string, min: number, max: number): R {
    const metric = this._metrics.get(id);
    if (!metric) return { ok: false, error: "Metric not found" };
    metric.thresholds.push({ min, max });
    return { ok: true, data: metric.thresholds };
  }
}

export class RealTimeStream {
  private _streams: Map<string, { id: string; source: string; callbacks: Set<(data: any) => void> }> = new Map();
  private _buffers: Map<string, any[]> = new Map();

  createStream(id: string, source: string): R {
    if (this._streams.has(id)) return { ok: false, error: "Stream already exists" };
    this._streams.set(id, { id, source, callbacks: new Set() });
    this._buffers.set(id, []);
    return { ok: true, data: { id, source } };
  }

  subscribe(streamId: string, callback: (data: any) => void): R {
    const stream = this._streams.get(streamId);
    if (!stream) return { ok: false, error: "Stream not found" };
    stream.callbacks.add(callback);
    return { ok: true, data: { subscribers: stream.callbacks.size } };
  }

  unsubscribe(streamId: string, callback: (data: any) => void): R {
    const stream = this._streams.get(streamId);
    if (!stream) return { ok: false, error: "Stream not found" };
    stream.callbacks.delete(callback);
    return { ok: true, data: { subscribers: stream.callbacks.size } };
  }

  publish(streamId: string, data: any): R {
    const stream = this._streams.get(streamId);
    if (!stream) return { ok: false, error: "Stream not found" };
    const buffer = this._buffers.get(streamId)!;
    buffer.push({ data, timestamp: Date.now() });
    if (buffer.length > 1000) buffer.shift();
    for (const cb of stream.callbacks) {
      try { cb(data); } catch {}
    }
    return { ok: true, data: { delivered: stream.callbacks.size } };
  }

  getSubscribers(streamId: string): R {
    const stream = this._streams.get(streamId);
    if (!stream) return { ok: false, error: "Stream not found" };
    return { ok: true, data: stream.callbacks.size };
  }

  getBuffer(streamId: string): R {
    const buffer = this._buffers.get(streamId);
    if (!buffer) return { ok: false, error: "Stream not found" };
    return { ok: true, data: [...buffer] };
  }
}

export class WidgetFactory {
  private _widgets: Map<string, { id: string; type: string; config: any; data: any }> = new Map();
  private _theme: any = { primary: "#000", secondary: "#fff" };

  createWidget(id: string, type: string, config: any): R {
    if (this._widgets.has(id)) return { ok: false, error: "Widget already exists" };
    this._widgets.set(id, { id, type, config, data: null });
    return { ok: true, data: this._widgets.get(id) };
  }

  updateWidget(id: string, data: any): R {
    const widget = this._widgets.get(id);
    if (!widget) return { ok: false, error: "Widget not found" };
    widget.data = data;
    return { ok: true, data: widget };
  }

  getWidget(id: string): R {
    const widget = this._widgets.get(id);
    if (!widget) return { ok: false, error: "Widget not found" };
    return { ok: true, data: widget };
  }

  getAllWidgets(): R {
    return { ok: true, data: Array.from(this._widgets.values()) };
  }

  setTheme(theme: any): R {
    this._theme = { ...this._theme, ...theme };
    return { ok: true, data: { ...this._theme } };
  }

  getTheme(): R {
    return { ok: true, data: { ...this._theme } };
  }
}
