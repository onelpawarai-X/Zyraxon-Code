/**
 * ZYRAXON X - Code Guardian Monaco Bridge
 * Connects scanner to Monaco Editor:
 * - Red squiggly underlines for errors
 * - Yellow underlines for warnings
 * - Hover tooltip with details + suggestion
 * - Click to see full context
 * - Auto-fix code actions
 */

import type { CodeIssue, ScanResult } from "./scanner"

export type MonacoMarker = {
  severity: number
  message: string
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
  source: string
  tags?: number[]
}

export type HoverInfo = {
  issue: CodeIssue
  markdown: string
  actions: { label: string; command: string; args: any[] }[]
}

export class CodeGuardianMonaco {
  private editor: any
  private monaco: any
  private issues: Map<string, CodeIssue> = new Map()
  private lastScan: ScanResult | null = null
  private onIssueDetected: ((issue: CodeIssue) => void) | null = null
  private fixQueue: CodeIssue[] = []

  constructor(editor: any, monaco: any) {
    this.editor = editor
    this.monaco = monaco
  }

  /**
   * Called after every scan — updates Monaco markers
   */
  applyScanResult(result: ScanResult) {
    this.lastScan = result
    this.issues.clear()
    this.fixQueue = []

    const markers: MonacoMarker[] = []

    for (const issue of result.issues) {
      this.issues.set(issue.id, issue)

      if (issue.severity === "error") {
        this.fixQueue.push(issue)
      }

      markers.push({
        severity: this.getMonacoSeverity(issue.severity),
        message: issue.message,
        startLineNumber: issue.line,
        startColumn: issue.column,
        endLineNumber: issue.endLine,
        endColumn: issue.endColumn,
        source: `Code Guardian [${issue.ruleId}]`,
        tags: issue.severity === "error" ? [1] : undefined,
      })

      // Notify callback for AI feedback
      if (this.onIssueDetected) {
        this.onIssueDetected(issue)
      }
    }

    // Apply markers to Monaco
    const model = this.editor.getModel()
    if (model) {
      this.monaco.editor.setModelMarkers(model, "code-guardian", markers)
    }
  }

  /**
   * Register hover provider — shows details when hovering over errors
   */
  registerHoverProvider(language: string) {
    this.monaco.languages.registerHoverProvider(language, {
      provideHover: (model: any, position: any) => {
        const issue = this.findIssueAtPosition(position.lineNumber, position.column)
        if (!issue) return null

        return {
          range: new this.monaco.Range(
            issue.line, issue.column,
            issue.endLine, issue.endColumn
          ),
          contents: [
            { value: `**Code Guardian** — \`${issue.ruleId}\`` },
            { value: issue.message },
            { value: `**Category:** ${issue.category}\n\n**Suggestion:** ${issue.suggestion}` },
            issue.autoFix ? { value: `💡 *Auto-fix available*` } : undefined,
          ].filter(Boolean),
        }
      },
    })
  }

  /**
   * Register code action provider — auto-fix suggestions
   */
  registerCodeActions(language: string) {
    this.monaco.languages.registerCodeActionProvider(language, {
      provideCodeActions: (model: any, range: any) => {
        const actions: any[] = []
        const issues = this.findIssuesInRange(range)

        for (const issue of issues) {
          if (issue.autoFix) {
            actions.push({
              title: `Fix: ${issue.ruleId}`,
              kind: "quickfix",
              diagnostics: [{
                severity: this.getMonacoSeverity(issue.severity),
                message: issue.message,
                range: new this.monaco.Range(
                  issue.line, issue.column,
                  issue.endLine, issue.endColumn
                ),
              }],
              edit: {
                edits: [{
                  resource: model.uri,
                  edit: {
                    range: new this.monaco.Range(
                      issue.autoFix.range[0] + 1,
                      issue.autoFix.range[1] + 1,
                      issue.autoFix.range[2] + 1,
                      issue.autoFix.range[3] + 1,
                    ),
                    text: issue.autoFix.newText,
                  },
                }],
              },
            })
          }
        }

        return { actions, dispose: () => {} }
      },
    })
  }

  /**
   * Register definition provider — click to see what something is
   */
  registerDefinitionProvider(language: string) {
    this.monaco.languages.registerDefinitionProvider(language, {
      provideDefinition: (model: any, position: any) => {
        // Find what's at this position and provide context
        const word = model.getWordAtPosition(position)
        if (!word) return null

        // For now, return the same location (can be enhanced with AST parsing)
        return {
          uri: model.uri,
          range: new this.monaco.Range(
            position.lineNumber, word.startColumn,
            position.lineNumber, word.endColumn
          ),
        }
      },
    })
  }

  /**
   * Set callback for when issues are detected (for AI feedback)
   */
  onIssue(callback: (issue: CodeIssue) => void) {
    this.onIssueDetected = callback
  }

  /**
   * Get all pending fixes (for AI auto-fix)
   */
  getFixQueue(): CodeIssue[] {
    return [...this.fixQueue]
  }

  /**
   * Clear a fix from queue after AI handles it
   */
  clearFix(issueId: string) {
    this.fixQueue = this.fixQueue.filter((i) => i.id !== issueId)
  }

  /**
   * Get summary of current issues
   */
  getSummary(): { errors: number; warnings: number; info: number; total: number } {
    if (!this.lastScan) return { errors: 0, warnings: 0, info: 0, total: 0 }
    return {
      errors: this.lastScan.summary.errors,
      warnings: this.lastScan.summary.warnings,
      info: this.lastScan.summary.info,
      total: this.lastScan.issues.length,
    }
  }

  /**
   * Apply a fix directly to the editor
   */
  applyFix(issue: CodeIssue) {
    if (!issue.autoFix) return

    const model = this.editor.getModel()
    if (!model) return

    const [startLine, startCol, endLine, endCol] = issue.autoFix.range
    const range = new this.monaco.Range(
      startLine + 1, startCol + 1,
      endLine + 1, endCol + 1
    )

    this.editor.executeEdits("code-guardian-fix", [{
      range,
      text: issue.autoFix.newText,
    }])

    this.clearFix(issue.id)
  }

  private findIssueAtPosition(line: number, column: number): CodeIssue | null {
    for (const issue of this.issues.values()) {
      if (
        issue.line === line &&
        issue.column <= column &&
        issue.endColumn >= column
      ) {
        return issue
      }
    }
    return null
  }

  private findIssuesInRange(range: any): CodeIssue[] {
    const startLine = range.startLineNumber || range.start?.line || 1
    const endLine = range.endLineNumber || range.end?.line || 1

    return Array.from(this.issues.values()).filter(
      (i) => i.line >= startLine && i.line <= endLine
    )
  }

  private getMonacoSeverity(severity: string): number {
    // 1=Error, 2=Warning, 3=Info, 4=Hint
    switch (severity) {
      case "error": return 1
      case "warning": return 2
      case "info": return 3
      default: return 4
    }
  }
}
