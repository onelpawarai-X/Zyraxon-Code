/**
 * ZYRAXON X - Time Manipulator
 * Codebase time travel: past reconstruction, future prediction
 * Git history analysis, dependency evolution, bug archaeology
 */

type TimeRange = { start: Date; end: Date }

type CodeSnapshot = {
  commit: string
  date: Date
  message: string
  author: string
  files: { path: string; action: "added" | "modified" | "deleted"; linesAdded: number; linesRemoved: number }[]
  stats: { totalFiles: number; totalLines: number; languages: Record<string, number> }
}

type DependencyChange = {
  date: Date
  package: string
  fromVersion: string
  toVersion: string
  breaking: boolean
}

type BugArchaeology = {
  commit: string
  date: Date
  bugType: string
  severity: "low" | "medium" | "high" | "critical"
  description: string
  fixCommit?: string
  fixDate?: Date
  timeToFix?: number
}

type TimelineEvent = {
  date: Date
  type: "commit" | "bug" | "refactor" | "feature" | "dependency" | "milestone"
  title: string
  description: string
  impact: "positive" | "negative" | "neutral"
}

export class TimeManipulator {
  private snapshots: CodeSnapshot[] = []
  private depChanges: DependencyChange[] = []
  private bugs: BugArchaeology[] = []
  private timeline: TimelineEvent[] = []

  addSnapshot(snapshot: CodeSnapshot) {
    this.snapshots.push(snapshot)
    this.timeline.push({ date: snapshot.date, type: "commit", title: snapshot.message, description: `Commit ${snapshot.commit} by ${snapshot.author}`, impact: "neutral" })
  }

  addDependencyChange(change: DependencyChange) {
    this.depChanges.push(change)
    this.timeline.push({ date: change.date, type: "dependency", title: `${change.package} ${change.fromVersion} → ${change.toVersion}`, description: change.breaking ? "Breaking change" : "Minor update", impact: change.breaking ? "negative" : "positive" })
  }

  addBug(bug: BugArchaeology) {
    this.bugs.push(bug)
    this.timeline.push({ date: bug.date, type: "bug", title: `${bug.bugType} bug detected`, description: bug.description, impact: "negative" })
  }

  reconstructTimeline(range?: TimeRange): TimelineEvent[] {
    let events = [...this.timeline].sort((a, b) => a.date.getTime() - b.date.getTime())
    if (range) {
      events = events.filter((e) => e.date >= range.start && e.date <= range.end)
    }
    return events
  }

  getSnapshotAt(date: Date): CodeSnapshot | null {
    const sorted = [...this.snapshots].sort((a, b) => a.date.getTime() - b.date.getTime())
    let latest: CodeSnapshot | null = null
    for (const snap of sorted) {
      if (snap.date <= date) latest = snap
      else break
    }
    return latest
  }

  analyzeEvolution(): {
    totalCommits: number
    totalBugs: number
    avgTimeToFix: number
    depUpdates: number
    breakingChanges: number
    linesAdded: number
    linesRemoved: number
    topAuthors: Record<string, number>
  } {
    const totalCommits = this.snapshots.length
    const totalBugs = this.bugs.length
    const fixedBugs = this.bugs.filter((b) => b.fixDate)
    const avgTimeToFix = fixedBugs.length > 0
      ? fixedBugs.reduce((sum, b) => sum + (b.timeToFix || 0), 0) / fixedBugs.length
      : 0
    const depUpdates = this.depChanges.length
    const breakingChanges = this.depChanges.filter((d) => d.breaking).length
    const linesAdded = this.snapshots.reduce((sum, s) => sum + s.files.reduce((fs, f) => fs + f.linesAdded, 0), 0)
    const linesRemoved = this.snapshots.reduce((sum, s) => sum + s.files.reduce((fs, f) => fs + f.linesRemoved, 0), 0)
    const topAuthors: Record<string, number> = {}
    for (const snap of this.snapshots) {
      topAuthors[snap.author] = (topAuthors[snap.author] || 0) + 1
    }
    return { totalCommits, totalBugs, avgTimeToFix, depUpdates, breakingChanges, linesAdded, linesRemoved, topAuthors }
  }

  predictFuture(commitsAhead = 10): { predictedCommits: { date: Date; estimatedFiles: number }[]; riskAreas: string[] } {
    const recent = this.snapshots.slice(-20)
    if (recent.length < 2) return { predictedCommits: [], riskAreas: [] }

    const avgInterval = (recent[recent.length - 1].date.getTime() - recent[0].date.getTime()) / (recent.length - 1)
    const avgFiles = recent.reduce((sum, s) => sum + s.files.length, 0) / recent.length

    const predictedCommits = []
    const lastDate = recent[recent.length - 1].date
    for (let i = 1; i <= commitsAhead; i++) {
      predictedCommits.push({
        date: new Date(lastDate.getTime() + avgInterval * i),
        estimatedFiles: Math.round(avgFiles),
      })
    }

    const riskAreas: string[] = []
    if (this.bugs.filter((b) => b.severity === "critical").length > 3) riskAreas.push("High critical bug frequency")
    if (this.depChanges.filter((d) => d.breaking).length > 5) riskAreas.push("Frequent breaking changes")
    const churnFiles = new Map<string, number>()
    for (const snap of this.snapshots) {
      for (const f of snap.files) {
        churnFiles.set(f.path, (churnFiles.get(f.path) || 0) + 1)
      }
    }
    for (const [path, count] of churnFiles) {
      if (count > 10) riskAreas.push(`High churn: ${path}`)
    }

    return { predictedCommits, riskAreas }
  }

  findBugPatterns(): { type: string; count: number; avgFixTime: number; severity: string }[] {
    const patterns = new Map<string, { count: number; totalFixTime: number }>()
    for (const bug of this.bugs) {
      const existing = patterns.get(bug.bugType) || { count: 0, totalFixTime: 0 }
      existing.count++
      existing.totalFixTime += bug.timeToFix || 0
      patterns.set(bug.bugType, existing)
    }
    return Array.from(patterns.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      avgFixTime: data.count > 0 ? data.totalFixTime / data.count : 0,
      severity: data.count > 5 ? "high" : data.count > 2 ? "medium" : "low",
    }))
  }

  getSnapshots() { return this.snapshots }
  getDepChanges() { return this.depChanges }
  getBugs() { return this.bugs }
}
