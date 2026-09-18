/**
 * ZYRAXON X - Code Guardian AI Feedback
 * Real-time error feedback loop with AI
 * 
 * How it works:
 * 1. Code Guardian detects error in background
 * 2. Error sent to AI via feedback channel (non-blocking)
 * 3. AI receives error context + suggestion
 * 4. AI automatically adjusts next code output
 * 5. No interruption, no manual message
 * 
 * Like Cursor/VS Code Copilot — AI knows about errors while working
 */

import type { CodeIssue } from "./scanner"

export type FeedbackMessage = {
  id: string
  type: "error-detected" | "fix-suggestion" | "fix-applied" | "fix-failed"
  issue: CodeIssue
  context: {
    file: string
    line: number
    code: string
    surroundingCode: string
    suggestion: string
  }
  timestamp: number
  handled: boolean
}

export type AIFixResult = {
  issueId: string
  success: boolean
  fixedCode: string | null
  explanation: string
}

export type FeedbackChannel = {
  id: string
  active: boolean
  messages: FeedbackMessage[]
  lastActivity: number
  onMessage: ((msg: FeedbackMessage) => void) | null
}

export class CodeGuardianAIFeedback {
  private channel: FeedbackChannel
  private messageQueue: FeedbackMessage[] = []
  private processedIds: Set<string> = new Set()
  private debounceMs = 100 // Debounce rapid signals
  private lastSignalTime = 0

  constructor() {
    this.channel = {
      id: `ai-feedback-${Date.now()}`,
      active: true,
      messages: [],
      lastActivity: Date.now(),
      onMessage: null,
    }
  }

  /**
   * Send error signal to AI — non-blocking, debounced
   * Called automatically when Code Guardian detects error
   */
  signalError(issue: CodeIssue, file: string, code: string): FeedbackMessage | null {
    // Deduplicate — don't send same error twice
    if (this.processedIds.has(issue.id)) return null

    // Debounce — don't flood AI with rapid signals
    const now = Date.now()
    if (now - this.lastSignalTime < this.debounceMs) return null
    this.lastSignalTime = now

    const surroundingCode = this.extractSurroundingCode(code, issue.line, 3)

    const message: FeedbackMessage = {
      id: `fb-${Date.now()}-${issue.id}`,
      type: "error-detected",
      issue,
      context: {
        file,
        line: issue.line,
        code: code.split("\n")[issue.line - 1] || "",
        surroundingCode,
        suggestion: issue.suggestion,
      },
      timestamp: now,
      handled: false,
    }

    this.messageQueue.push(message)
    this.channel.messages.push(message)
    this.channel.lastActivity = now

    // Notify listener (AI agent)
    if (this.channel.onMessage) {
      this.channel.onMessage(message)
    }

    return message
  }

  /**
   * Receive fix from AI — called when AI processes the error
   */
  receiveFix(result: AIFixResult): void {
    this.processedIds.add(result.issueId)

    const msg = this.channel.messages.find(
      (m) => m.issue.id === result.issueId
    )
    if (msg) {
      msg.handled = true
      msg.type = result.success ? "fix-applied" : "fix-failed"
    }

    // Remove from queue
    this.messageQueue = this.messageQueue.filter(
      (m) => m.issue.id !== result.issueId
    )
  }

  /**
   * Get pending errors for AI to fix
   */
  getPendingErrors(): FeedbackMessage[] {
    return this.messageQueue.filter((m) => !m.handled)
  }

  /**
   * Generate AI prompt context from pending errors
   * This is what the AI receives as "background signal"
   */
  generateAIContext(): string {
    const pending = this.getPendingErrors()
    if (pending.length === 0) return ""

    const errors = pending.map((msg) => {
      return `[ERROR] ${msg.issue.ruleId}: ${msg.issue.message}
  File: ${msg.context.file}
  Line: ${msg.context.line}
  Code: ${msg.context.code.trim()}
  Fix: ${msg.context.suggestion}
  Severity: ${msg.issue.severity}`
    }).join("\n\n")

    return `CODE_GUARDIAN_ALERT: ${pending.length} issue(s) detected. Fix these before continuing:\n\n${errors}`
  }

  /**
   * Check if AI should be notified about errors
   */
  hasPendingErrors(): boolean {
    return this.messageQueue.some((m) => !m.handled)
  }

  /**
   * Get error count by severity
   */
  getErrorCounts(): { errors: number; warnings: number; info: number } {
    const pending = this.getPendingErrors()
    return {
      errors: pending.filter((m) => m.issue.severity === "error").length,
      warnings: pending.filter((m) => m.issue.severity === "warning").length,
      info: pending.filter((m) => m.issue.severity === "info").length,
    }
  }

  /**
   * Subscribe to error signals
   */
  subscribe(callback: (msg: FeedbackMessage) => void): () => void {
    this.channel.onMessage = callback
    return () => {
      this.channel.onMessage = null
    }
  }

  /**
   * Get channel status
   */
  getStatus(): {
    active: boolean
    pending: number
    processed: number
    lastActivity: number
  } {
    return {
      active: this.channel.active,
      pending: this.messageQueue.filter((m) => !m.handled).length,
      processed: this.processedIds.size,
      lastActivity: this.channel.lastActivity,
    }
  }

  /**
   * Clear all messages
   */
  clear() {
    this.messageQueue = []
    this.processedIds.clear()
    this.channel.messages = []
  }

  private extractSurroundingCode(code: string, line: number, context: number): string {
    const lines = code.split("\n")
    const start = Math.max(0, line - context - 1)
    const end = Math.min(lines.length, line + context)
    return lines.slice(start, end).join("\n")
  }
}
