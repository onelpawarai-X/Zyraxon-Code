/**
 * ZYRAXON X - Code Guardian
 * Real-time code intelligence — detects errors while AI writes
 * 
 * Components:
 * - Scanner: Detects fake data, Math.random, errors, security issues
 * - Monaco Bridge: Red underlines, hover details, auto-fix actions
 * - AI Feedback: Background signal loop — AI fixes errors automatically
 * 
 * Flow:
 * 1. AI writes code in Monaco Editor
 * 2. Scanner runs in background (every keystroke, debounced)
 * 3. Errors shown as red squiggly underlines
 * 4. AI receives error signals automatically
 * 5. AI adjusts code to fix errors
 * 6. No interruption, no manual intervention
 */

export { CodeGuardianScanner } from "./scanner"
export type { CodeIssue, ScanResult, IssueSeverity } from "./scanner"

export { CodeGuardianMonaco } from "./monaco-bridge"
export type { MonacoMarker, HoverInfo } from "./monaco-bridge"

export { CodeGuardianAIFeedback } from "./ai-feedback"
export type { FeedbackMessage, AIFixResult, FeedbackChannel } from "./ai-feedback"

import { CodeGuardianScanner } from "./scanner"
import { CodeGuardianMonaco } from "./monaco-bridge"
import { CodeGuardianAIFeedback } from "./ai-feedback"
import type { ScanResult, CodeIssue } from "./scanner"

/**
 * Main Code Guardian instance
 * Connects scanner, Monaco, and AI feedback
 */
export class CodeGuardian {
  private scanner: CodeGuardianScanner
  private monaco: CodeGuardianMonaco | null = null
  private feedback: CodeGuardianAIFeedback
  private scanInterval: ReturnType<typeof setInterval> | null = null
  private currentFile = ""
  private currentCode = ""

  constructor() {
    this.scanner = new CodeGuardianScanner()
    this.feedback = new CodeGuardianAIFeedback()
  }

  /**
   * Initialize with Monaco Editor instance
   */
  initMonaco(editor: any, monaco: any, language = "typescript") {
    this.monaco = new CodeGuardianMonaco(editor, monaco)

    // Register hover provider — shows error details on hover
    this.monaco.registerHoverProvider(language)

    // Register code actions — auto-fix suggestions
    this.monaco.registerCodeActions(language)

    // Register definition provider — click to see context
    this.monaco.registerDefinitionProvider(language)

    // Listen for editor changes — scan in real-time
    editor.onDidChangeModelContent(() => {
      const model = editor.getModel()
      if (model) {
        this.scan(model.uri.path, model.getValue())
      }
    })

    // Initial scan
    const model = editor.getModel()
    if (model) {
      this.scan(model.uri.path, model.getValue())
    }
  }

  /**
   * Scan code and apply results
   */
  scan(file: string, code: string): ScanResult {
    this.currentFile = file
    this.currentCode = code

    const result = this.scanner.scan(file, code)

    // Apply to Monaco (red underlines)
    if (this.monaco) {
      this.monaco.applyScanResult(result)
    }

    // Send errors to AI feedback channel
    for (const issue of result.issues) {
      if (issue.severity === "error") {
        this.feedback.signalError(issue, file, code)
      }
    }

    return result
  }

  /**
   * Get AI context for pending errors
   * AI reads this to know what to fix
   */
  getAIContext(): string {
    return this.feedback.generateAIContext()
  }

  /**
   * Check if there are errors AI should fix
   */
  hasErrors(): boolean {
    return this.feedback.hasPendingErrors()
  }

  /**
   * Get error summary
   */
  getSummary(): { errors: number; warnings: number; info: number } {
    return this.feedback.getErrorCounts()
  }

  /**
   * Subscribe to error signals
   */
  onIssue(callback: (issue: CodeIssue) => void): () => void {
    return this.feedback.subscribe((msg) => {
      callback(msg.issue)
    })
  }

  /**
   * Get scanner instance (for custom rules)
   */
  getScanner(): CodeGuardianScanner {
    return this.scanner
  }

  /**
   * Get feedback instance
   */
  getFeedback(): CodeGuardianAIFeedback {
    return this.feedback
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval)
    }
    this.feedback.clear()
  }
}
