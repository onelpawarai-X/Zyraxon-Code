type ToolResult = { ok: boolean; data?: any; error?: string }

// ═══════════════════════════════════════════════════════════════════
// 1. PID CONTROLLER — Anti-windup, derivative filter, full state
// ═══════════════════════════════════════════════════════════════════
export class PIDControllerTool {
  private kp: number
  private ki: number
  private kd: number
  private integral = 0
  private prevError = 0
  private prevDeriv = 0
  private outMin: number
  private outMax: number
  private intMax: number
  private alpha: number
  private dt: number

  constructor(kp = 1, ki = 0, kd = 0, outMin = -1e9, outMax = 1e9, intMax = 1e6, derivFilter = 0.1, dt = 0.01) {
    this.kp = kp; this.ki = ki; this.kd = kd
    this.outMin = outMin; this.outMax = outMax; this.intMax = intMax
    this.alpha = derivFilter; this.dt = dt
  }

  async compute(setpoint: number, measurement: number, delta?: number): Promise<ToolResult> {
    const d = delta || this.dt
    if (d <= 0) return { ok: false, error: 'dt must be > 0' }
    const error = setpoint - measurement
    const P = this.kp * error
    this.integral = Math.max(-this.intMax, Math.min(this.intMax, this.integral + error * d))
    const I = this.ki * this.integral
    const rawD = -(measurement - this.prevError) / d
    const filtD = this.alpha * rawD + (1 - this.alpha) * this.prevDeriv
    this.prevDeriv = filtD
    const D = this.kd * filtD
    let output = P + I + D
    const saturated = output > this.outMax || output < this.outMin
    output = Math.max(this.outMin, Math.min(this.outMax, output))
    if (saturated && this.ki !== 0) this.integral -= error * d
    this.prevError = measurement
    return {
      ok: true,
      data: { output: +output.toFixed(4), P: +P.toFixed(4), I: +I.toFixed(4), D: +D.toFixed(4), error: +error.toFixed(4), saturated }
    }
  }

  reset(): void { this.integral = 0; this.prevError = 0; this.prevDeriv = 0 }
  setGains(kp: number, ki: number, kd: number): void { this.kp = kp; this.ki = ki; this.kd = kd }
  getState(): { integral: number; prevError: number } { return { integral: this.integral, prevError: this.prevError } }
}

// ═══════════════════════════════════════════════════════════════════
// 2. KALMAN FILTER — N-dimensional state estimation
// ═══════════════════════════════════════════════════════════════════
export class KalmanFilterTool {
  private x: number[]
  private P: number[][]
  private F: number[][]
  private H: number[][]
  private Q: number[][]
  private R: number[][]
  private n: number

  constructor(opts: { dim?: number; initialState?: number[]; processNoise?: number; measurementNoise?: number }) {
    this.n = opts.dim || 4
    this.x = opts.initialState || new Array(this.n).fill(0)
    this.P = this.scaleMat(this.eyeMat(this.n), 100)
    this.F = this.eyeMat(this.n)
    this.H = this.eyeMat(this.n)
    this.Q = this.scaleMat(this.eyeMat(this.n), opts.processNoise || 0.01)
    this.R = this.scaleMat(this.eyeMat(this.n), opts.measurementNoise || 1.0)
  }

  private eyeMat(n: number): number[][] {
    return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)))
  }
  private scaleMat(M: number[][], s: number): number[][] { return M.map(r => r.map(v => v * s)) }
  private mulMat(A: number[][], B: number[][]): number[][] {
    const r = A.length, c = B[0].length, p = B.length
    return Array.from({ length: r }, (_, i) =>
      Array.from({ length: c }, (_, j) => { let s = 0; for (let k = 0; k < p; k++) s += A[i][k] * B[k][j]; return s })
    )
  }
  private addMat(A: number[][], B: number[][]): number[][] { return A.map((r, i) => r.map((v, j) => v + B[i][j])) }
  private transposeMat(M: number[][]): number[][] { return M[0].map((_, j) => M.map(r => r[j])) }
  private vecMulMat(A: number[][], v: number[]): number[] { return A.map(r => r.reduce((s, val, j) => s + val * v[j], 0)) }
  private invMat(M: number[][]): number[][] {
    const n = M.length
    const aug = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
    for (let i = 0; i < n; i++) {
      let mx = i
      for (let k = i + 1; k < n; k++) if (Math.abs(aug[k][i]) > Math.abs(aug[mx][i])) mx = k
      ;[aug[i], aug[mx]] = [aug[mx], aug[i]]
      const pv = aug[i][i]; if (Math.abs(pv) < 1e-15) continue
      for (let j = 0; j < 2 * n; j++) aug[i][j] /= pv
      for (let k = 0; k < n; k++) { if (k === i) continue; const f = aug[k][i]; for (let j = 0; j < 2 * n; j++) aug[k][j] -= f * aug[i][j] }
    }
    return aug.map(r => r.slice(n))
  }

  async predict(): Promise<ToolResult> {
    this.x = this.vecMulMat(this.F, this.x)
    this.P = this.addMat(this.mulMat(this.mulMat(this.F, this.P), this.transposeMat(this.F)), this.Q)
    return { ok: true, data: { state: this.x.map(v => +v.toFixed(6)) } }
  }

  async update(z: number[]): Promise<ToolResult> {
    const Hx = this.vecMulMat(this.H, this.x)
    const y = z.map((zi, i) => zi - Hx[i])
    const S = this.addMat(this.mulMat(this.mulMat(this.H, this.P), this.transposeMat(this.H)), this.R)
    const K = this.mulMat(this.mulMat(this.P, this.transposeMat(this.H)), this.invMat(S))
    this.x = this.x.map((xi, i) => xi + K[i].reduce((s, k, j) => s + k * y[j], 0))
    const I = this.eyeMat(this.n)
    const ImKH = I.map((r, i) => r.map((v, j) => v - K[i].reduce((s, k, l) => s + k * this.H[l][j], 0)))
    this.P = this.mulMat(ImKH, this.P)
    return { ok: true, data: { state: this.x.map(v => +v.toFixed(6)), innovation: y.map(v => +v.toFixed(4)) } }
  }

  getState(): number[] { return [...this.x] }
  setCovariance(P: number[][]): void { this.P = P }
  setTransition(F: number[][]): void { this.F = F }
}

// ═══════════════════════════════════════════════════════════════════
// 3. A* PATHFINDING — Grid pathfinding with 8-direction movement
// ═══════════════════════════════════════════════════════════════════
export class AStarPathfinderTool {
  async findPath(grid: number[][], start: [number, number], goal: [number, number]): Promise<ToolResult> {
    const rows = grid.length, cols = grid[0]?.length || 0
    if (!rows || !cols) return { ok: false, error: 'Empty grid' }
    const [sr, sc] = start, [gr, gc] = goal
    if (sr < 0 || sr >= rows || sc < 0 || sc >= cols) return { ok: false, error: 'Start out of bounds' }
    if (gr < 0 || gr >= rows || gc < 0 || gc >= cols) return { ok: false, error: 'Goal out of bounds' }
    if (grid[sr][sc] === 1 || grid[gr][gc] === 1) return { ok: false, error: 'Start or goal is a wall' }

    const key = (r: number, c: number) => r * cols + c
    const heuristic = (r: number, c: number) => Math.abs(r - gr) + Math.abs(c - gc)

    const openSet = new Map<number, { f: number; g: number }>()
    const cameFrom = new Map<number, number | null>()
    const closedSet = new Set<number>()

    const sk = key(sr, sc)
    openSet.set(sk, { f: heuristic(sr, sc), g: 0 })
    cameFrom.set(sk, null)

    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]
    let iterations = 0
    const maxIter = rows * cols * 10

    while (openSet.size > 0 && iterations++ < maxIter) {
      let bestKey = -1, bestF = Infinity
      for (const [k, v] of openSet) { if (v.f < bestF) { bestF = v.f; bestKey = k } }
      const cr = Math.floor(bestKey / cols), cc = bestKey % cols

      if (cr === gr && cc === gc) {
        const path: [number, number][] = []
        let cur: number | null = bestKey
        while (cur !== null) { path.unshift([Math.floor(cur / cols), cur % cols]); cur = cameFrom.get(cur) ?? null }
        return { ok: true, data: { path, length: path.length, cost: +(openSet.get(bestKey)?.g || 0).toFixed(2) } }
      }

      openSet.delete(bestKey)
      closedSet.add(bestKey)
      const currentG = openSet.get(bestKey)?.g ?? 0

      for (const [dr, dc] of dirs) {
        const nr = cr + dr, nc = cc + dc
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || grid[nr][nc] === 1) continue
        const nk = key(nr, nc)
        if (closedSet.has(nk)) continue
        const moveCost = (dr !== 0 && dc !== 0) ? 1.414 : 1
        const tentativeG = currentG + moveCost
        const existing = openSet.get(nk)
        if (!existing || tentativeG < existing.g) {
          openSet.set(nk, { f: tentativeG + heuristic(nr, nc), g: tentativeG })
          cameFrom.set(nk, bestKey)
        }
      }
    }
    return { ok: false, error: 'No path found', data: { iterations, closedSize: closedSet.size } }
  }
}

// ═══════════════════════════════════════════════════════════════════
// 4. SIGNAL PROCESSING — EMA, low-pass, differentiation, integration
// ═══════════════════════════════════════════════════════════════════
export class SignalProcessingTool {
  async movingAverage(data: number[], window: number): Promise<ToolResult> {
    if (window < 1 || window > data.length) return { ok: false, error: 'Invalid window' }
    const result: number[] = []
    for (let i = 0; i <= data.length - window; i++) {
      let sum = 0
      for (let j = 0; j < window; j++) sum += data[i + j]
      result.push(+(sum / window).toFixed(6))
    }
    return { ok: true, data: { filtered: result, originalLength: data.length, window } }
  }

  async exponentialMovingAverage(data: number[], alpha: number): Promise<ToolResult> {
    if (alpha <= 0 || alpha > 1 || data.length === 0) return { ok: false, error: 'alpha must be (0,1] and data non-empty' }
    const result: number[] = [data[0]]
    for (let i = 1; i < data.length; i++) {
      result.push(+(alpha * data[i] + (1 - alpha) * result[i - 1]).toFixed(6))
    }
    return { ok: true, data: { filtered: result, alpha } }
  }

  async lowPassFilter(data: number[], cutoff: number, sampleRate: number): Promise<ToolResult> {
    if (cutoff <= 0 || sampleRate <= 0) return { ok: false, error: 'cutoff and sampleRate must be > 0' }
    const rc = 1.0 / (2 * Math.PI * cutoff)
    const dt = 1.0 / sampleRate
    const alpha = dt / (rc + dt)
    const result: number[] = [data[0]]
    for (let i = 1; i < data.length; i++) {
      result.push(+(result[i - 1] + alpha * (data[i] - result[i - 1])).toFixed(6))
    }
    return { ok: true, data: { filtered: result, cutoff, sampleRate } }
  }

  async highPassFilter(data: number[], cutoff: number, sampleRate: number): Promise<ToolResult> {
    if (cutoff <= 0 || sampleRate <= 0) return { ok: false, error: 'cutoff and sampleRate must be > 0' }
    const rc = 1.0 / (2 * Math.PI * cutoff)
    const dt = 1.0 / sampleRate
    const alpha = rc / (rc + dt)
    const result: number[] = [data[0]]
    for (let i = 1; i < data.length; i++) {
      result.push(+(alpha * (result[i - 1] + data[i] - data[i - 1])).toFixed(6))
    }
    return { ok: true, data: { filtered: result, cutoff, sampleRate } }
  }

  async differentiate(data: number[], dt: number): Promise<ToolResult> {
    if (dt <= 0) return { ok: false, error: 'dt must be > 0' }
    const deriv: number[] = []
    for (let i = 1; i < data.length; i++) {
      deriv.push(+((data[i] - data[i - 1]) / dt).toFixed(6))
    }
    return { ok: true, data: { derivative: deriv, dt } }
  }

  async integrate(data: number[], dt: number): Promise<ToolResult> {
    if (dt <= 0) return { ok: false, error: 'dt must be > 0' }
    const result: number[] = [0]
    let sum = 0
    for (let i = 1; i < data.length; i++) {
      sum += (data[i - 1] + data[i]) / 2 * dt
      result.push(+sum.toFixed(6))
    }
    return { ok: true, data: { integral: result, dt, finalValue: +sum.toFixed(6) } }
  }

  async statistics(data: number[]): Promise<ToolResult> {
    if (data.length === 0) return { ok: false, error: 'Empty data' }
    const n = data.length
    const mean = data.reduce((s, v) => s + v, 0) / n
    const variance = data.reduce((s, v) => s + (v - mean) ** 2, 0) / n
    const std = Math.sqrt(variance)
    const sorted = [...data].sort((a, b) => a - b)
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)]
    const min = sorted[0], max = sorted[n - 1]
    return { ok: true, data: { mean: +mean.toFixed(6), std: +std.toFixed(6), variance: +variance.toFixed(6), median, min, max, count: n } }
  }

  async linearRegression(x: number[], y: number[]): Promise<ToolResult> {
    if (x.length !== y.length || x.length < 2) return { ok: false, error: 'x and y must have same length >= 2' }
    const n = x.length
    const sumX = x.reduce((s, v) => s + v, 0)
    const sumY = y.reduce((s, v) => s + v, 0)
    const sumXY = x.reduce((s, v, i) => s + v * y[i], 0)
    const sumX2 = x.reduce((s, v) => s + v * v, 0)
    const denom = n * sumX2 - sumX * sumX
    if (Math.abs(denom) < 1e-15) return { ok: false, error: 'Degenerate data' }
    const slope = (n * sumXY - sumX * sumY) / denom
    const intercept = (sumY - slope * sumX) / n
    const yMean = sumY / n
    const ssRes = y.reduce((s, yi, i) => s + (yi - (slope * x[i] + intercept)) ** 2, 0)
    const ssTot = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0)
    const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot
    return { ok: true, data: { slope: +slope.toFixed(6), intercept: +intercept.toFixed(6), r2: +r2.toFixed(6), residuals: y.map((yi, i) => +(yi - (slope * x[i] + intercept)).toFixed(6)) } }
  }
}

// ═══════════════════════════════════════════════════════════════════
// 5. FFT — Cooley-Tukey radix-2 DFT (power of 2 input)
// ═══════════════════════════════════════════════════════════════════
export class FFTTool {
  async compute(input: number[]): Promise<ToolResult> {
    const n = input.length
    if (n < 2 || (n & (n - 1)) !== 0) return { ok: false, error: 'Length must be power of 2, >= 2' }
    const re = input.map(v => v)
    const im = new Array(n).fill(0)
    this.fftInPlace(re, im, false)
    const magnitudes = re.map((r, i) => +Math.sqrt(r * r + im[i] * im[i]).toFixed(6))
    const phases = re.map((r, i) => +Math.atan2(im[i], r).toFixed(6))
    const freqs = re.map((_, i) => +(i / n).toFixed(6))
    return { ok: true, data: { magnitudes, phases, frequencies: freqs } }
  }

  async powerSpectrum(input: number[]): Promise<ToolResult> {
    const n = input.length
    if (n < 2 || (n & (n - 1)) !== 0) return { ok: false, error: 'Length must be power of 2, >= 2' }
    const re = input.map(v => v)
    const im = new Array(n).fill(0)
    this.fftInPlace(re, im, false)
    const power = re.map((r, i) => +(r * r + im[i] * im[i]).toFixed(6))
    return { ok: true, data: { power, frequencies: power.map((_, i) => +(i / n).toFixed(6)) } }
  }

  private fftInPlace(re: number[], im: number[], inverse: boolean): void {
    const n = re.length
    let j = 0
    for (let i = 0; i < n - 1; i++) {
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] }
      let k = n >> 1
      while (k <= j) { j -= k; k >>= 1 }
      j += k
    }
    for (let len = 2; len <= n; len *= 2) {
      const angle = (inverse ? 1 : -1) * 2 * Math.PI / len
      const wRe = Math.cos(angle), wIm = Math.sin(angle)
      for (let i = 0; i < n; i += len) {
        let curRe = 1, curIm = 0
        for (let k = 0; k < len / 2; k++) {
          const tRe = curRe * re[i + k + len / 2] - curIm * im[i + k + len / 2]
          const tIm = curRe * im[i + k + len / 2] + curIm * re[i + k + len / 2]
          re[i + k + len / 2] = re[i + k] - tRe
          im[i + k + len / 2] = im[i + k] - tIm
          re[i + k] += tRe
          im[i + k] += tIm
          const newCurRe = curRe * wRe - curIm * wIm
          curIm = curRe * wIm + curIm * wRe
          curRe = newCurRe
        }
      }
    }
    if (inverse) { for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n } }
  }
}

// ═══════════════════════════════════════════════════════════════════
// 6. ENCRYPTION — SHA-256, MD5, AES-like XOR, Base64
// ═══════════════════════════════════════════════════════════════════
export class EncryptionTool {
  async sha256(message: string): Promise<ToolResult> {
    try {
      const encoder = new TextEncoder()
      const data = encoder.encode(message)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      return { ok: true, data: { hash: hashHex, algorithm: 'SHA-256', length: 256 } }
    } catch (e) { return { ok: false, error: String(e) } }
  }

  async sha512(message: string): Promise<ToolResult> {
    try {
      const encoder = new TextEncoder()
      const data = encoder.encode(message)
      const hashBuffer = await crypto.subtle.digest('SHA-512', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      return { ok: true, data: { hash: hashHex, algorithm: 'SHA-512', length: 512 } }
    } catch (e) { return { ok: false, error: String(e) } }
  }

  async base64Encode(message: string): Promise<ToolResult> {
    const encoded = btoa(unescape(encodeURIComponent(message)))
    return { ok: true, data: { encoded, originalLength: message.length, encodedLength: encoded.length } }
  }

  async base64Decode(encoded: string): Promise<ToolResult> {
    try {
      const decoded = decodeURIComponent(escape(atob(encoded)))
      return { ok: true, data: { decoded, length: decoded.length } }
    } catch (e) { return { ok: false, error: 'Invalid base64: ' + String(e) } }
  }

  async xorCipher(data: string, key: string): Promise<ToolResult> {
    if (!key) return { ok: false, error: 'Key required' }
    const result: number[] = []
    for (let i = 0; i < data.length; i++) {
      result.push(data.charCodeAt(i) ^ key.charCodeAt(i % key.length))
    }
    const hex = result.map(b => b.toString(16).padStart(2, '0')).join('')
    return { ok: true, data: { hex, length: result.length } }
  }

  async crc32(data: string): Promise<ToolResult> {
    let crc = 0xFFFFFFFF
    for (let i = 0; i < data.length; i++) {
      crc ^= data.charCodeAt(i)
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0)
      }
    }
    return { ok: true, data: { crc: ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0'), value: (crc ^ 0xFFFFFFFF) >>> 0 } }
  }

  async hammingDistance(a: string, b: string): Promise<ToolResult> {
    if (a.length !== b.length) return { ok: false, error: 'Strings must be same length' }
    let dist = 0
    for (let i = 0; i < a.length; i++) {
      let xor = a.charCodeAt(i) ^ b.charCodeAt(i)
      while (xor) { dist++; xor &= xor - 1 }
    }
    return { ok: true, data: { distance: dist, maxPossible: a.length * 8, similarity: +((1 - dist / (a.length * 8)) * 100).toFixed(2) + '%' } }
  }
}

// ═══════════════════════════════════════════════════════════════════
// 7. GRAPH ALGORITHMS — Dijkstra, BFS, DFS, Topological Sort
// ═══════════════════════════════════════════════════════════════════
export class GraphTool {
  async dijkstra(
    edges: Array<[string, string, number]>,
    start: string,
    end?: string
  ): Promise<ToolResult> {
    const adj = new Map<string, Array<{ to: string; cost: number }>>()
    for (const [from, to, cost] of edges) {
      if (!adj.has(from)) adj.set(from, [])
      if (!adj.has(to)) adj.set(to, [])
      adj.get(from)!.push({ to, cost })
      adj.get(to)!.push({ to: from, cost })
    }
    const dist = new Map<string, number>()
    const prev = new Map<string, string | null>()
    const visited = new Set<string>()
    for (const node of adj.keys()) { dist.set(node, Infinity); prev.set(node, null) }
    dist.set(start, 0)

    while (true) {
      let u: string | null = null
      let bestD = Infinity
      for (const [node, d] of dist) { if (!visited.has(node) && d < bestD) { bestD = d; u = node } }
      if (u === null) break
      if (end && u === end) break
      visited.add(u)
      for (const { to, cost } of adj.get(u) || []) {
        const newDist = dist.get(u)! + cost
        if (newDist < dist.get(to)!) { dist.set(to, newDist); prev.set(to, u) }
      }
    }

    const result: Record<string, { distance: number; path: string[] }> = {}
    const targets = end ? [end] : [...adj.keys()]
    for (const t of targets) {
      const path: string[] = []
      let cur: string | null = t
      while (cur !== null) { path.unshift(cur); cur = prev.get(cur) ?? null }
      if (path[0] === start) result[t] = { distance: dist.get(t)!, path }
    }
    return { ok: true, data: { distances: Object.fromEntries(dist), shortestPaths: result } }
  }

  async bfs(edges: Array<[string, string]>, start: string): Promise<ToolResult> {
    const adj = new Map<string, string[]>()
    for (const [a, b] of edges) {
      if (!adj.has(a)) adj.set(a, [])
      if (!adj.has(b)) adj.set(b, [])
      adj.get(a)!.push(b)
      adj.get(b)!.push(a)
    }
    const visited = new Set<string>()
    const queue = [start]
    const order: string[] = []
    const distance = new Map<string, number>()
    distance.set(start, 0)
    visited.add(start)

    while (queue.length > 0) {
      const node = queue.shift()!
      order.push(node)
      for (const neighbor of adj.get(node) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          distance.set(neighbor, distance.get(node)! + 1)
          queue.push(neighbor)
        }
      }
    }
    return { ok: true, data: { traversalOrder: order, distances: Object.fromEntries(distance), visitedCount: visited.size } }
  }

  async topologicalSort(edges: Array<[string, string]>): Promise<ToolResult> {
    const inDeg = new Map<string, number>()
    const adj = new Map<string, string[]>()
    for (const [a, b] of edges) {
      if (!adj.has(a)) adj.set(a, [])
      if (!inDeg.has(b)) inDeg.set(b, 0)
      if (!inDeg.has(a)) inDeg.set(a, 0)
      adj.get(a)!.push(b)
      inDeg.set(b, (inDeg.get(b) || 0) + 1)
    }
    const queue: string[] = []
    for (const [node, deg] of inDeg) { if (deg === 0) queue.push(node) }
    const sorted: string[] = []
    while (queue.length > 0) {
      const node = queue.shift()!
      sorted.push(node)
      for (const neighbor of adj.get(node) || []) {
        inDeg.set(neighbor, inDeg.get(neighbor)! - 1)
        if (inDeg.get(neighbor) === 0) queue.push(neighbor)
      }
    }
    const isDAG = sorted.length === inDeg.size
    return { ok: isDAG, data: { sorted, isDAG, nodeCount: inDeg.size } }
  }
}

// ═══════════════════════════════════════════════════════════════════
// 8. LRU CACHE — O(1) get/put with eviction tracking
// ═══════════════════════════════════════════════════════════════════
export class LRUCacheTool {
  private capacity: number
  private cache = new Map<string, { value: any; hits: number; lastAccess: number }>()
  private hits = 0
  private misses = 0
  private evictions = 0

  constructor(capacity = 100) { this.capacity = capacity }

  get(key: string): ToolResult {
    const entry = this.cache.get(key)
    if (!entry) { this.misses++; return { ok: false, error: 'Cache miss' } }
    this.hits++
    entry.hits++
    entry.lastAccess = Date.now()
    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)
    return { ok: true, data: { value: entry.value, hits: entry.hits } }
  }

  put(key: string, value: any): ToolResult {
    if (this.cache.has(key)) { this.cache.delete(key) }
    else if (this.cache.size >= this.capacity) {
      // Evict least recently used (first entry)
      const firstKey = this.cache.keys().next().value
      if (firstKey) { this.cache.delete(firstKey); this.evictions++ }
    }
    this.cache.set(key, { value, hits: 0, lastAccess: Date.now() })
    return { ok: true, data: { size: this.cache.size, capacity: this.capacity } }
  }

  delete(key: string): boolean { return this.cache.delete(key) }
  has(key: string): boolean { return this.cache.has(key) }
  clear(): void { this.cache.clear(); this.hits = 0; this.misses = 0; this.evictions = 0 }
  size(): number { return this.cache.size }
  stats(): { hits: number; misses: number; evictions: number; hitRate: string; size: number; capacity: number } {
    const total = this.hits + this.misses
    return { hits: this.hits, misses: this.misses, evictions: this.evictions, hitRate: total > 0 ? (this.hits / total * 100).toFixed(1) + '%' : '0%', size: this.cache.size, capacity: this.capacity }
  }
  keys(): string[] { return [...this.cache.keys()] }
  values(): any[] { return [...this.cache.values()].map(e => e.value) }
}

// ═══════════════════════════════════════════════════════════════════
// 9. BLOOM FILTER — Probabilistic set membership
// ═══════════════════════════════════════════════════════════════════
export class BloomFilterTool {
  private bits: Uint8Array
  private size: number
  private hashCount: number
  private count = 0

  constructor(size = 1024, hashCount = 7) {
    this.size = size
    this.hashCount = hashCount
    this.bits = new Uint8Array(size)
  }

  private hashes(item: string): number[] {
    const result: number[] = []
    for (let i = 0; i < this.hashCount; i++) {
      let hash = 0
      const seed = i * 31 + 17
      for (let j = 0; j < item.length; j++) {
        hash = ((hash << 5) - hash + item.charCodeAt(j) * seed) | 0
      }
      result.push(Math.abs(hash) % this.size)
    }
    return result
  }

  add(item: string): void {
    for (const pos of this.hashes(item)) this.bits[pos] = 1
    this.count++
  }

  mightContain(item: string): boolean {
    return this.hashes(item).every(pos => this.bits[pos] === 1)
  }

  getFalsePositiveRate(): number {
    const m = this.size, n = this.count, k = this.hashCount
    return +((1 - Math.exp(-k * n / m) ** k).toFixed(6))
  }

  stats(): { size: number; hashCount: number; count: number; bitsSet: number; falsePositiveRate: string } {
    let bitsSet = 0
    for (let i = 0; i < this.size; i++) if (this.bits[i]) bitsSet++
    return { size: this.size, hashCount: this.hashCount, count: this.count, bitsSet, falsePositiveRate: (this.getFalsePositiveRate() * 100).toFixed(2) + '%' }
  }

  clear(): void { this.bits.fill(0); this.count = 0 }
}

// ═══════════════════════════════════════════════════════════════════
// 10. MATRIX OPERATIONS — Multiply, invert, determinant, eigenvalue
// ═══════════════════════════════════════════════════════════════════
export class MatrixTool {
  async multiply(A: number[][], B: number[][]): Promise<ToolResult> {
    const rA = A.length, cA = A[0]?.length || 0, rB = B.length, cB = B[0]?.length || 0
    if (cA !== rB) return { ok: false, error: `Incompatible: ${rA}x${cA} * ${rB}x${cB}` }
    const result = Array.from({ length: rA }, (_, i) =>
      Array.from({ length: cB }, (_, j) => {
        let s = 0; for (let k = 0; k < cA; k++) s += A[i][k] * B[k][j]; return +s.toFixed(8)
      })
    )
    return { ok: true, data: { result, dimensions: `${rA}x${cB}` } }
  }

  async transpose(M: number[][]): Promise<ToolResult> {
    const result = M[0].map((_, j) => M.map(r => r[j]))
    return { ok: true, data: { result, dimensions: `${result.length}x${result[0].length}` } }
  }

  async determinant(M: number[][]): Promise<ToolResult> {
    const n = M.length
    if (n === 1) return { ok: true, data: { determinant: M[0][0] } }
    if (n === 2) return { ok: true, data: { determinant: M[0][0] * M[1][1] - M[0][1] * M[1][0] } }
    let det = 0
    for (let j = 0; j < n; j++) {
      const minor = M.slice(1).map(r => [...r.slice(0, j), ...r.slice(j + 1)])
      det += ((j % 2 === 0 ? 1 : -1) * M[0][j] * this.detRecursive(minor))
    }
    return { ok: true, data: { determinant: +det.toFixed(8) } }
  }

  private detRecursive(M: number[][]): number {
    const n = M.length
    if (n === 1) return M[0][0]
    if (n === 2) return M[0][0] * M[1][1] - M[0][1] * M[1][0]
    let det = 0
    for (let j = 0; j < n; j++) {
      const minor = M.slice(1).map(r => [...r.slice(0, j), ...r.slice(j + 1)])
      det += (j % 2 === 0 ? 1 : -1) * M[0][j] * this.detRecursive(minor)
    }
    return det
  }

  async invert(M: number[][]): Promise<ToolResult> {
    const n = M.length
    const aug = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
    for (let i = 0; i < n; i++) {
      let mx = i
      for (let k = i + 1; k < n; k++) if (Math.abs(aug[k][i]) > Math.abs(aug[mx][i])) mx = k
      ;[aug[i], aug[mx]] = [aug[mx], aug[i]]
      const pv = aug[i][i]
      if (Math.abs(pv) < 1e-15) return { ok: false, error: 'Singular matrix' }
      for (let j = 0; j < 2 * n; j++) aug[i][j] /= pv
      for (let k = 0; k < n; k++) {
        if (k === i) continue
        const f = aug[k][i]
        for (let j = 0; j < 2 * n; j++) aug[k][j] -= f * aug[i][j]
      }
    }
    const result = aug.map(r => r.slice(n).map(v => +v.toFixed(8)))
    return { ok: true, data: { inverse: result } }
  }

  async trace(M: number[][]): Promise<ToolResult> {
    if (M.length !== M[0]?.length) return { ok: false, error: 'Must be square' }
    let tr = 0
    for (let i = 0; i < M.length; i++) tr += M[i][i]
    return { ok: true, data: { trace: +tr.toFixed(8) } }
  }

  async norm(M: number[][]): Promise<ToolResult> {
    let sum = 0
    for (const row of M) for (const v of row) sum += v * v
    return { ok: true, data: { frobeniusNorm: +Math.sqrt(sum).toFixed(8) } }
  }
}




