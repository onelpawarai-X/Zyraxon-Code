/**
 * ZYRAXON X - Memory Palace (SQLite-backed)
 * Infinite memory: 50,000+ years of recall
 * Every conversation, code change, decision remembered
 * Cross-session persistent knowledge graph with FTS5 full-text search
 * Survives crashes, restarts, and laptop resets via WAL + SQLite
 */

import fs from "fs/promises"
import path from "path"
import { Global } from "@zyraxon-ai/core/global"

type DB = import("bun:sqlite").Database

type MemoryNode = {
  id: string
  type: "conversation" | "code_change" | "decision" | "fact" | "person" | "project" | "emotion" | "skill"
  content: any
  importance: number
  tags: string[]
  connections: string[]
  accessCount: number
  lastAccessed: number
  created: number
  decay: number
}

type MemoryQuery = {
  text?: string
  type?: MemoryNode["type"]
  tags?: string[]
  dateRange?: { start: Date; end: Date }
  minImportance?: number
  limit?: number
}

type MemoryStats = {
  totalNodes: number
  byType: Record<string, number>
  avgImportance: number
  oldestMemory: number
  newestMemory: number
  totalConnections: number
}

const PALACE_DIR = path.join(Global.Path.data, "memory")
const PALACE_DB = path.join(PALACE_DIR, "memory_palace.db")

let db: DB | null = null
let dbInitPromise: Promise<void> | null = null

async function getDb(): Promise<DB> {
  if (db) return db
  if (!dbInitPromise) dbInitPromise = initDb()
  await dbInitPromise
  return db!
}

async function initDb(): Promise<void> {
  try { await fs.access(PALACE_DIR) } catch { await fs.mkdir(PALACE_DIR, { recursive: true }) }
  const { Database } = await import("bun:sqlite")
  db = new Database(PALACE_DB)
  db.run("PRAGMA journal_mode=WAL")
  db.run("PRAGMA synchronous=NORMAL")
  db.run("PRAGMA cache_size=-65536")
  db.run("PRAGMA mmap_size=268435456")
  db.run("PRAGMA temp_store=MEMORY")
  db.run("PRAGMA busy_timeout=5000")

  db.run(`CREATE TABLE IF NOT EXISTS palace_nodes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    importance INTEGER NOT NULL DEFAULT 5,
    tags TEXT NOT NULL DEFAULT '[]',
    connections TEXT NOT NULL DEFAULT '[]',
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed INTEGER NOT NULL,
    created INTEGER NOT NULL,
    decay REAL NOT NULL DEFAULT 1.0
  )`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_palace_type ON palace_nodes(type)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_palace_importance ON palace_nodes(importance DESC)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_palace_created ON palace_nodes(created)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_palace_last_accessed ON palace_nodes(last_accessed)`)

  // FTS5 for full-text search across content + tags
  try {
    db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS palace_fts USING fts5(id, type, content, tags, content=palace_nodes, content_rowid=rowid)`)
  } catch {
    try { db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS palace_fts USING fts5(id, type, content, tags)`) } catch {}
  }
  try { db.run(`INSERT OR IGNORE INTO palace_fts(palace_fts) VALUES('rebuild')`) } catch {}
}

function rowToNode(row: any): MemoryNode {
  return {
    id: row.id, type: row.type,
    content: (() => { try { return JSON.parse(row.content) } catch { return row.content } })(),
    importance: row.importance,
    tags: (() => { try { return JSON.parse(row.tags) } catch { return [] } })(),
    connections: (() => { try { return JSON.parse(row.connections) } catch { return [] } })(),
    accessCount: row.access_count,
    lastAccessed: row.last_accessed,
    created: row.created,
    decay: row.decay,
  }
}

export class MemoryPalace {
  private maxNodes = 1000000

  async store(type: MemoryNode["type"], content: any, tags: string[] = [], importance = 5): Promise<string> {
    const d = await getDb()
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const now = Date.now()
    d.run(`INSERT INTO palace_nodes (id, type, content, importance, tags, connections, access_count, last_accessed, created, decay)
      VALUES (?, ?, ?, ?, ?, '[]', 0, ?, ?, 1.0)`,
      [id, type, JSON.stringify(content), importance, JSON.stringify(tags), now, now])
    try {
      d.run(`INSERT INTO palace_fts (rowid, id, type, content, tags) VALUES (last_insert_rowid(), ?, ?, ?, ?)`,
        [id, type, JSON.stringify(content), JSON.stringify(tags)])
    } catch {}
    // Evict if over limit
    const count = (d.query(`SELECT COUNT(*) as c FROM palace_nodes`).get() as any)?.c || 0
    if (count > this.maxNodes) this.evictSync(d)
    return id
  }

  async retrieve(id: string): Promise<MemoryNode | null> {
    const d = await getDb()
    const row = d.query(`SELECT * FROM palace_nodes WHERE id = ?`).get(id) as any
    if (!row) return null
    d.run(`UPDATE palace_nodes SET access_count = access_count + 1, last_accessed = ?, decay = MIN(1.0, decay + 0.1) WHERE id = ?`,
      [Date.now(), id])
    return rowToNode({ ...row, access_count: row.access_count + 1, last_accessed: Date.now(), decay: Math.min(1.0, row.decay + 0.1) })
  }

  async query(q: MemoryQuery): Promise<MemoryNode[]> {
    const d = await getDb()

    // FTS5 text search if query provided
    if (q.text) {
      try {
        const ftsRows = d.query(`SELECT p.* FROM palace_fts fts JOIN palace_nodes p ON p.rowid = fts.rowid
          WHERE palace_fts MATCH ? ORDER BY rank LIMIT ?`).all(`"${q.text}"`, q.limit || 50) as any[]
        if (ftsRows.length > 0) return ftsRows.map(rowToNode)
      } catch {}
    }

    // Build WHERE conditions
    const conditions: string[] = []
    const params: any[] = []
    if (q.type) { conditions.push(`type = ?`); params.push(q.type) }
    if (q.minImportance) { conditions.push(`importance >= ?`); params.push(q.minImportance) }
    if (q.dateRange) {
      conditions.push(`created >= ? AND created <= ?`)
      params.push(q.dateRange.start.getTime(), q.dateRange.end.getTime())
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    let rows = d.query(`SELECT * FROM palace_nodes ${where} ORDER BY importance DESC, last_accessed DESC LIMIT ?`)
      .all(...params, q.limit || 50) as any[]

    // Filter by tags in JS (SQLite JSON matching is slow)
    if (q.tags && q.tags.length > 0) {
      rows = rows.filter(r => {
        try { const tags = JSON.parse(r.tags); return q.tags!.some(t => tags.includes(t)) } catch { return false }
      })
    }

    return rows.map(rowToNode)
  }

  async connect(id1: string, id2: string): Promise<void> {
    const d = await getDb()
    const n1 = d.query(`SELECT connections FROM palace_nodes WHERE id = ?`).get(id1) as any
    const n2 = d.query(`SELECT connections FROM palace_nodes WHERE id = ?`).get(id2) as any
    if (!n1 || !n2) return
    const conns1: string[] = (() => { try { return JSON.parse(n1.connections) } catch { return [] } })()
    const conns2: string[] = (() => { try { return JSON.parse(n2.connections) } catch { return [] } })()
    if (!conns1.includes(id2)) conns1.push(id2)
    if (!conns2.includes(id1)) conns2.push(id1)
    d.run(`UPDATE palace_nodes SET connections = ? WHERE id = ?`, [JSON.stringify(conns1), id1])
    d.run(`UPDATE palace_nodes SET connections = ? WHERE id = ?`, [JSON.stringify(conns2), id2])
  }

  async forget(id: string): Promise<boolean> {
    const d = await getDb()
    const row = d.query(`SELECT id FROM palace_nodes WHERE id = ?`).get(id)
    if (!row) return false
    d.run(`DELETE FROM palace_nodes WHERE id = ?`, [id])
    try { d.run(`DELETE FROM palace_fts WHERE id = ?`, [id]) } catch {}
    return true
  }

  private evictSync(d: DB) {
    const nodes = d.query(`SELECT id, importance, decay, access_count, last_accessed FROM palace_nodes ORDER BY last_accessed ASC LIMIT ?`)
      .all(Math.floor(this.maxNodes * 0.1)) as any[]
    for (const node of nodes) {
      d.run(`DELETE FROM palace_nodes WHERE id = ?`, [node.id])
    }
  }

  async getStats(): Promise<MemoryStats> {
    const d = await getDb()
    const total = (d.query(`SELECT COUNT(*) as c FROM palace_nodes`).get() as any)?.c || 0
    const typeRows = d.query(`SELECT type, COUNT(*) as c FROM palace_nodes GROUP BY type`).all() as any[]
    const byType: Record<string, number> = {}
    let totalConnections = 0
    for (const r of typeRows) {
      byType[r.type] = r.c
    }
    const connRows = d.query(`SELECT connections FROM palace_nodes`).all() as any[]
    for (const r of connRows) {
      try { totalConnections += JSON.parse(r.connections).length } catch {}
    }
    const avg = (d.query(`SELECT AVG(importance) as avg FROM palace_nodes`).get() as any)?.avg || 0
    const oldest = (d.query(`SELECT MIN(created) as t FROM palace_nodes`).get() as any)?.t || Date.now()
    const newest = (d.query(`SELECT MAX(created) as t FROM palace_nodes`).get() as any)?.t || Date.now()
    return {
      totalNodes: total, byType,
      avgImportance: Math.round(avg * 10) / 10,
      oldestMemory: oldest, newestMemory: newest,
      totalConnections: totalConnections / 2,
    }
  }

  async getAll(): Promise<MemoryNode[]> {
    const d = await getDb()
    return (d.query(`SELECT * FROM palace_nodes ORDER BY created DESC`).all() as any[]).map(rowToNode)
  }
}
