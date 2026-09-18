/**
 * ZYRAXON X - Code Guardian Scanner
 * Real-time code analysis — detects fake data, Math.random, errors
 * Designed to run in background while AI writes code
 */

export type IssueSeverity = "error" | "warning" | "info"

export type CodeIssue = {
  id: string
  line: number
  column: number
  endLine: number
  endColumn: number
  message: string
  severity: IssueSeverity
  ruleId: string
  category: "fake-data" | "error" | "security" | "quality" | "convention"
  suggestion: string
  autoFix: { range: [number, number, number, number]; newText: string } | null
}

export type ScanResult = {
  file: string
  issues: CodeIssue[]
  totalLines: number
  scanTimeMs: number
  timestamp: number
  summary: { errors: number; warnings: number; info: number }
}

type Rule = {
  id: string
  pattern: RegExp
  message: string
  severity: IssueSeverity
  category: CodeIssue["category"]
  suggestion: string
  getAutoFix?: (line: number, col: number) => CodeIssue["autoFix"]
}

const RULES: Rule[] = [
  {
    id: "no-math-random",
    pattern: /Math\.random\(\)/g,
    message: "Math.random() FORBIDDEN — use deterministic values or real data",
    severity: "error",
    category: "fake-data",
    suggestion: "Use: timestamp, counter, or real data source",
  },
  {
    id: "no-placeholder",
    pattern: /["'`](placeholder|mock|fake|dummy|sample|lorem|TODO_data)["'`]/gi,
    message: "Placeholder/mock data — all data must be real",
    severity: "error",
    category: "fake-data",
    suggestion: "Remove placeholder, use actual data or leave empty",
  },
  {
    id: "no-fake-success",
    pattern: /success:\s*true.*(?:placeholder|mock|fake|dummy)/gi,
    message: "Fake success response — return real results or error",
    severity: "error",
    category: "fake-data",
    suggestion: "Return { success: false, error: 'Not implemented' }",
  },
  {
    id: "no-console-log",
    pattern: /console\.(log|warn|error|debug|info)\s*\(/g,
    message: "console.log() in production — use structured logging",
    severity: "warning",
    category: "quality",
    suggestion: "Replace with logger or remove",
    getAutoFix: (line, col) => ({ range: [line, col, line, col + 100], newText: "/* removed */" }),
  },
  {
    id: "no-empty-catch",
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/g,
    message: "Empty catch — errors silently swallowed",
    severity: "error",
    category: "error",
    suggestion: "Add error handling or rethrow",
  },
  {
    id: "no-var",
    pattern: /\bvar\s+/g,
    message: "var — use const or let instead",
    severity: "warning",
    category: "convention",
    suggestion: "Replace 'var' with 'const' or 'let'",
    getAutoFix: (line, col) => ({ range: [line, col, line, col + 4], newText: "const" }),
  },
  {
    id: "no-eval",
    pattern: /\beval\s*\(/g,
    message: "eval() is dangerous — use safer alternatives",
    severity: "error",
    category: "security",
    suggestion: "Use JSON.parse() or specific parser",
  },
  {
    id: "no-inner-html",
    pattern: /\.innerHTML\s*=/g,
    message: "innerHTML — XSS vulnerable",
    severity: "error",
    category: "security",
    suggestion: "Use .textContent or safe DOM methods",
  },
  {
    id: "no-document-write",
    pattern: /document\.write\s*\(/g,
    message: "document.write() forbidden",
    severity: "error",
    category: "security",
    suggestion: "Use DOM manipulation methods",
  },
  {
    id: "no-hardcoded-secret",
    pattern: /(?:password|secret|api_key|token|private_key)\s*[:=]\s*["'][^"']+["']/gi,
    message: "Hardcoded secret — use environment variables",
    severity: "error",
    category: "security",
    suggestion: "Move to .env file",
  },
  {
    id: "no-debugger",
    pattern: /\bdebugger\b/g,
    message: "debugger statement left in code",
    severity: "error",
    category: "quality",
    suggestion: "Remove debugger statement",
    getAutoFix: (line, col) => ({ range: [line, col, line, col + 9], newText: "" }),
  },
  {
    id: "no-todo",
    pattern: /(?:TODO|FIXME|HACK|XXX)\b/g,
    message: "Unresolved TODO/FIXME",
    severity: "info",
    category: "quality",
    suggestion: "Complete implementation or create tracked issue",
  },
  {
    id: "no-any-type",
    pattern: /:\s*any\b/g,
    message: "TypeScript 'any' — use specific types",
    severity: "warning",
    category: "convention",
    suggestion: "Replace with specific type",
  },
]

export class CodeGuardianScanner {
  private rules: Rule[]

  constructor(customRules?: Rule[]) {
    this.rules = customRules || RULES
  }

  scan(filePath: string, code: string): ScanResult {
    const start = Date.now()
    const lines = code.split("\n")
    const issues: CodeIssue[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNum = i + 1

      for (const rule of this.rules) {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags)
        let match: RegExpMatchArray | null

        while ((match = regex.exec(line)) !== null) {
          const col = match.index! + 1
          const endCol = col + match[0].length

          issues.push({
            id: `${rule.id}_${lineNum}_${col}`,
            line: lineNum,
            column: col,
            endLine: lineNum,
            endColumn: endCol,
            message: rule.message,
            severity: rule.severity,
            ruleId: rule.id,
            category: rule.category,
            suggestion: rule.suggestion,
            autoFix: rule.getAutoFix ? rule.getAutoFix(lineNum - 1, col - 1) : null,
          })
        }
      }
    }

    const scanTimeMs = Date.now() - start
    return {
      file: filePath,
      issues,
      totalLines: lines.length,
      scanTimeMs,
      timestamp: Date.now(),
      summary: {
        errors: issues.filter((i) => i.severity === "error").length,
        warnings: issues.filter((i) => i.severity === "warning").length,
        info: issues.filter((i) => i.severity === "info").length,
      },
    }
  }

  addRule(rule: Rule) {
    this.rules.push(rule)
  }

  getRules(): Rule[] {
    return [...this.rules]
  }
}
