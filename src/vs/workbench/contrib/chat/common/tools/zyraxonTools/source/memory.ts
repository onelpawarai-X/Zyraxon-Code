/**
 * ZYRAXON X - Persistent Memory System
 * Key-value store with TTL, search, history
 * Works in both browser (localStorage) and Node.js (in-memory)
 */

type MemoryEntry = {
  key: string
  value: any
  created: number
  accessed: number
  ttl: number | null
}

const isBrowser = typeof window !== "undefined" && typeof localStorage !== "undefined"

export class ZyraxonMemory {
  private data: Map<string, MemoryEntry> = new Map()
  private maxEntries = 5000
  private _storageKey = "zyraxon-x-memory"

  init() {
    if (!isBrowser) return
    try {
      const saved = localStorage.getItem(this._storageKey)
      if (saved) {
        const entries = JSON.parse(saved) as MemoryEntry[]
        for (const entry of entries) {
          if (!entry.ttl || Date.now() - entry.created < entry.ttl) {
            this.data.set(entry.key, entry)
          }
        }
      }
    } catch {}
  }

  store(key: string, value: any, ttlMs: number | null = null): void {
    const existing = this.data.get(key)
    this.data.set(key, {
      key, value,
      created: existing?.created || Date.now(),
      accessed: Date.now(),
      ttl: ttlMs,
    })
    if (this.data.size > this.maxEntries) this.evict()
    this.save()
  }

  retrieve(key: string): any | null {
    const entry = this.data.get(key)
    if (!entry) return null
    if (entry.ttl && Date.now() - entry.created > entry.ttl) {
      this.data.delete(key)
      return null
    }
    entry.accessed = Date.now()
    return entry.value
  }

  has(key: string): boolean { return this.retrieve(key) !== null }

  remove(key: string): boolean {
    const deleted = this.data.delete(key)
    if (deleted) this.save()
    return deleted
  }

  search(query: string): Array<{ key: string; value: any }> {
    const q = query.toLowerCase()
    const results: Array<{ key: string; value: any }> = []
    for (const [key, entry] of this.data) {
      if (key.toLowerCase().includes(q) || JSON.stringify(entry.value).toLowerCase().includes(q)) {
        results.push({ key, value: entry.value })
      }
    }
    return results
  }

  keys(): string[] { return Array.from(this.data.keys()) }

  size(): number { return this.data.size }

  private evict() {
    const entries = Array.from(this.data.values())
      .sort((a, b) => a.accessed - b.accessed)
    const toRemove = Math.floor(this.maxEntries * 0.1)
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.data.delete(entries[i].key)
    }
  }

  private save() {
    if (!isBrowser) return
    try {
      const d = Array.from(this.data.values()).slice(-1000)
      localStorage.setItem(this._storageKey, JSON.stringify(d))
    } catch {}
  }
}
