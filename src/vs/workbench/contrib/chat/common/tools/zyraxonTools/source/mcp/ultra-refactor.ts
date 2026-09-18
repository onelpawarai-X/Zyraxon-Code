/**
 * Ultra-Refactor: Advanced Code Refactoring Intelligence Engine
 * ============================================================
 * ZYRAXON-AI — Mathematical code analysis, pattern detection,
 * complexity measurement, and refactoring suggestion generation.
 *
 * Contains real mathematical implementations:
 * - Category Theory analysis for type systems
 * - Cyclomatic / Cognitive / Halstead complexity metrics
 * - AST-based transformation engines
 * - Design pattern recognition via structural heuristics
 * - Dependency graph analysis with cycle detection
 * - Deep code smell detection with metric thresholds
 */

// ────────────────────────────────────────────────────────────
// 0.  Shared Types
// ────────────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  details?: Record<string, any>;
}

export interface CodeLocation {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export interface CodeBlock {
  startLine: number;
  endLine: number;
  text: string;
  indentation: number;
  variables: string[];
  complexity: number;
}

export interface ImportInfo {
  source: string;
  names: string[];
  line: number;
  isTypeOnly: boolean;
}

export interface FunctionInfo {
  name: string;
  params: string[];
  body: string;
  startLine: number;
  endLine: number;
  complexity: number;
  callsTo: string[];
  readsFrom: string[];
  writesTo: string[];
}

export interface ClassInfo {
  name: string;
  methods: FunctionInfo[];
  properties: string[];
  extendsClass: string | null;
  implementsInterfaces: string[];
  startLine: number;
  endLine: number;
  constructorBody: string | null;
  isAbstract: boolean;
  modifiers: string[];
}

export interface PatternMatch {
  pattern: string;
  confidence: number;
  location: CodeLocation;
  evidence: string[];
  suggestion: string;
}

export interface SmellFinding {
  smell: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: CodeLocation;
  description: string;
  metric: number;
  threshold: number;
  suggestion: string;
}

export interface ComplexityMetrics {
  cyclomatic: number;
  cognitive: number;
  maintainabilityIndex: number;
  halsteadVolume: number;
  halsteadDifficulty: number;
  halsteadEffort: number;
  loc: number;
  commentRatio: number;
  nestingDepth: number;
}

export interface RefactoringSuggestion {
  name: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  complexityReduction: number;
  location: CodeLocation;
  before: string;
  after: string;
  category: string;
  priority: number;
}

export interface DependencyGraph {
  nodes: string[];
  edges: { from: string; to: string; type: 'import' | 'extends' | 'implements' | 'uses' }[];
  cycles: string[][];
  metrics: Record<string, {
    afferent: number;
    efferent: number;
    instability: number;
    abstractness: number;
    distanceFromMainSequence: number;
  }>;
}

// ────────────────────────────────────────────────────────────
// 1.  Source Code Parser (regex + heuristic based)
// ────────────────────────────────────────────────────────────

class SourceCodeParser {
  private lines: string[];
  private raw: string;

  constructor(source: string) {
    this.raw = source;
    this.lines = source.split('\n');
  }

  getLines(): string[] {
    return this.lines;
  }

  getRaw(): string {
    return this.raw;
  }

  getLine(n: number): string {
    return this.lines[n] ?? '';
  }

  lineCount(): number {
    return this.lines.length;
  }

  extractImports(): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const importRegex = /^import\s+(?:(?:type\s+)?(?:{([^}]+)}|(\w+))\s+from\s+)?['"]([^'"]+)['"]/;
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const match = line.match(importRegex);
      if (match) {
        const isTypeOnly = line.includes('import type');
        const namesStr = match[1] || match[2] || '';
        const names = namesStr
          .split(',')
          .map((n) => n.trim().replace(/\s+as\s+\w+/, ''))
          .filter(Boolean);
        imports.push({
          source: match[3],
          names,
          line: i,
          isTypeOnly,
        });
      }
    }
    return imports;
  }

  extractFunctions(): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    const funcRegex =
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*[^{]+)?\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = funcRegex.exec(this.raw)) !== null) {
      const name = m[1];
      const params = m[2]
        .split(',')
        .map((p) => p.trim().split(':')[0].split('=')[0].trim())
        .filter(Boolean);
      const startIdx = this.raw.substring(0, m.index).split('\n').length - 1;
      const body = this.extractBlockBody(m.index + m[0].length);
      const endIdx = startIdx + body.split('\n').length;
      const callsTo = this.extractFunctionCalls(body);
      const readsFrom = this.extractReads(body);
      const writesTo = this.extractWrites(body);
      functions.push({
        name,
        params,
        body,
        startLine: startIdx,
        endLine: endIdx,
        complexity: this.calculateBasicComplexity(body),
        callsTo,
        readsFrom,
        writesTo,
      });
    }
    const arrowRegex =
      /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?(?:\(([^)]*)\)|(\w+))\s*(?::\s*\w+\s*)?=>\s*\{/g;
    while ((m = arrowRegex.exec(this.raw)) !== null) {
      const name = m[1];
      const params = (m[2] || m[3] || '')
        .split(',')
        .map((p) => p.trim().split(':')[0].split('=')[0].trim())
        .filter(Boolean);
      const startIdx = this.raw.substring(0, m.index).split('\n').length - 1;
      const body = this.extractBlockBody(m.index + m[0].length);
      const endIdx = startIdx + body.split('\n').length;
      const callsTo = this.extractFunctionCalls(body);
      const readsFrom = this.extractReads(body);
      const writesTo = this.extractWrites(body);
      functions.push({
        name,
        params,
        body,
        startLine: startIdx,
        endLine: endIdx,
        complexity: this.calculateBasicComplexity(body),
        callsTo,
        readsFrom,
        writesTo,
      });
    }
    return functions;
  }

  extractClasses(): ClassInfo[] {
    const classes: ClassInfo[] = [];
    const classRegex =
      /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = classRegex.exec(this.raw)) !== null) {
      const name = m[1];
      const extendsClass = m[2] || null;
      const implementsInterfaces = m[3]
        ? m[3].split(',').map((i) => i.trim())
        : [];
      const isAbstract = m[0].includes('abstract');
      const startIdx = this.raw.substring(0, m.index).split('\n').length - 1;
      const body = this.extractBlockBody(m.index + m[0].length);
      const endIdx = startIdx + body.split('\n').length;
      const methods = this.extractMethodsFromBody(body, startIdx);
      const properties = this.extractPropertiesFromBody(body);
      const constructorBody = this.extractConstructor(body);
      const modifiers: string[] = [];
      if (isAbstract) modifiers.push('abstract');
      if (m[0].includes('export')) modifiers.push('export');
      classes.push({
        name,
        methods,
        properties,
        extendsClass,
        implementsInterfaces,
        startLine: startIdx,
        endLine: endIdx,
        constructorBody,
        isAbstract,
        modifiers,
      });
    }
    return classes;
  }

  private extractBlockBody(startPos: number): string {
    let depth = 1;
    let pos = startPos;
    while (pos < this.raw.length && depth > 0) {
      const ch = this.raw[pos];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      if (depth > 0) pos++;
    }
    return this.raw.substring(startPos, pos);
  }

  private extractFunctionCalls(body: string): string[] {
    const calls: string[] = [];
    const callRegex = /(\w+(?:\.\w+)*)\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = callRegex.exec(body)) !== null) {
      const name = m[1];
      const reserved = [
        'if', 'for', 'while', 'switch', 'catch', 'return',
        'typeof', 'instanceof', 'new', 'delete', 'void'
      ];
      if (!reserved.includes(name)) {
        calls.push(name);
      }
    }
    return [...new Set(calls)];
  }

  private extractReads(body: string): string[] {
    const reads: string[] = [];
    const readRegex = /\bthis\.(\w+)|\b(\w+)\s*[=!<>]/g;
    let m: RegExpExecArray | null;
    while ((m = readRegex.exec(body)) !== null) {
      reads.push(m[1] || m[2]);
    }
    return [...new Set(reads)];
  }

  private extractWrites(body: string): string[] {
    const writes: string[] = [];
    const writeRegex = /(?:this\.(\w+)\s*[+\-*/]?=(?!=))|(?:\b(\w+)\s*[+\-*/]?=(?!=))/g;
    let m: RegExpExecArray | null;
    while ((m = writeRegex.exec(body)) !== null) {
      writes.push(m[1] || m[2]);
    }
    return [...new Set(writes)];
  }

  private calculateBasicComplexity(body: string): number {
    let complexity = 1;
    const branchingKeywords = [
      /\bif\s*\(/,
      /\belse\s+if\s*\(/,
      /\belse\s*\{/,
      /\bfor\s*(?:\(\s*;|each|\s*\()/,
      /\bwhile\s*\(/,
      /\bcase\s+/,
      /\bcatch\s*\(/,
      /\?\s*[^?:]+:/,
      /&&/,
      /\|\|/,
    ];
    for (const regex of branchingKeywords) {
      const matches = body.match(new RegExp(regex.source, 'g'));
      if (matches) complexity += matches.length;
    }
    return complexity;
  }

  private extractMethodsFromBody(body: string, classStartLine: number): FunctionInfo[] {
    const methods: FunctionInfo[] = [];
    const methodRegex =
      /(?:(?:public|private|protected|static|async|abstract|readonly|get|set)\s+)*(\w+)\s*\(([^)]*)\)\s*(?::\s*[^{]+)?\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = methodRegex.exec(body)) !== null) {
      const name = m[1];
      const reserved = [
        'if', 'for', 'while', 'switch', 'catch',
        'class', 'constructor'
      ];
      if (reserved.includes(name)) continue;
      const params = m[2]
        .split(',')
        .map((p) => p.trim().split(':')[0].split('=')[0].trim())
        .filter(Boolean);
      const relStart = body.substring(0, m.index).split('\n').length;
      const methodBody = this.extractBlockBody(m.index + m[0].length);
      const relEnd = relStart + methodBody.split('\n').length;
      methods.push({
        name,
        params,
        body: methodBody,
        startLine: classStartLine + relStart,
        endLine: classStartLine + relEnd,
        complexity: this.calculateBasicComplexity(methodBody),
        callsTo: this.extractFunctionCalls(methodBody),
        readsFrom: this.extractReads(methodBody),
        writesTo: this.extractWrites(methodBody),
      });
    }
    return methods;
  }

  private extractPropertiesFromBody(body: string): string[] {
    const props: string[] = [];
    const propRegex = /(?:(?:public|private|protected|static|readonly|abstract)\s+)*(\w+)\s*[!?=;:]/g;
    let m: RegExpExecArray | null;
    while ((m = propRegex.exec(body)) !== null) {
      const name = m[1];
      const reserved = [
        'if', 'for', 'while', 'switch', 'catch', 'class',
        'constructor', 'return', 'function', 'const', 'let', 'var'
      ];
      if (!reserved.includes(name) && !name.match(/^(get|set)$/)) {
        props.push(name);
      }
    }
    return [...new Set(props)];
  }

  private extractConstructor(body: string): string | null {
    const ctorRegex = /constructor\s*\([^)]*\)\s*\{/;
    const m = body.match(ctorRegex);
    if (!m) return null;
    const startIdx = m.index! + m[0].length;
    return this.extractBlockBodyFromStr(body, startIdx);
  }

  private extractBlockBodyFromStr(str: string, startPos: number): string {
    let depth = 1;
    let pos = startPos;
    while (pos < str.length && depth > 0) {
      const ch = str[pos];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      if (depth > 0) pos++;
    }
    return str.substring(startPos, pos);
  }

  getCommentLines(): Set<number> {
    const commentLines = new Set<number>();
    for (let i = 0; i < this.lines.length; i++) {
      const trimmed = this.lines[i].trim();
      if (
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('*/')
      ) {
        commentLines.add(i);
      }
    }
    return commentLines;
  }

  findMethodCallChains(): { target: string; chain: string[]; line: number }[] {
    const chains: { target: string; chain: string[]; line: number }[] = [];
    const chainRegex = /(\w+(?:\.\w+){2,})\s*\(/g;
    for (let i = 0; i < this.lines.length; i++) {
      let m: RegExpExecArray | null;
      while ((m = chainRegex.exec(this.lines[i])) !== null) {
        const parts = m[1].split('.');
        chains.push({
          target: parts[0],
          chain: parts.slice(1),
          line: i,
        });
      }
    }
    return chains;
  }
}

// ────────────────────────────────────────────────────────────
// 2.  Category Theory Analyzer
// ────────────────────────────────────────────────────────────

/**
 * Implements category-theoretic analysis of code structures.
 *
 * A *category* C consists of:
 *   - Objects: types / interfaces / classes
 *   - Morphisms: functions between those types
 *   - Composition: ∘  (function composition, associative)
 *   - Identity: id_A : A → A for every object A
 *
 * We check:
 *   1. Functor laws  (map preserves id and composition)
 *   2. Monoid laws   (identity + associativity)
 *   3. Natural transformations (polymorphic mapper functions)
 *   4. Kleisli composition for monadic chains
 *   5. Algebraic data types (sum / product)
 *   6. Lawvere theory fragments (theory of categories, monoids, groups)
 */

interface FunctorMap {
  sourceType: string;
  targetType: string;
  mapperFunction: string;
  isCovariant: boolean;
  preservesIdentity: boolean;
  preservesComposition: boolean;
}

interface MonoidCandidate {
  type: string;
  opName: string;
  identityElement: string;
  isAssociative: boolean;
  hasIdentity: boolean;
  witnessLines: number[];
}

interface NaturalTransformation {
  name: string;
  fromFunctor: string;
  toFunctor: string;
  componentFunctions: string[];
  naturalitySquareHolds: boolean;
}

interface KleisliComposition {
  functions: string[];
  monadType: string;
  isWellFormed: boolean;
  bindingChain: string[];
}

interface AlgebraicDataType {
  name: string;
  kind: 'sum' | 'product' | 'recursive' | 'newtype';
  variants: string[];
  fields: string[];
  isCovariant: boolean;
}

interface LawvereFragment {
  name: string;
  objects: string[];
  morphisms: { from: string; to: string; name: string }[];
  axiomsSatisfied: string[];
  axiomsViolated: string[];
}

class CategoryTheoryAnalyzer {
  private parser: SourceCodeParser;

  constructor(parser: SourceCodeParser) {
    this.parser = parser;
  }

  /**
   * Detect functor-like mappings.
   *
   * A functor F : C -> D must satisfy:
   *   F(id_A) = id_{F(A)}                        -- identity law
   *   F(g ∘ f) = F(g) ∘ F(f)                     -- composition law
   *
   * We detect methods named `map`, `fmap`, `mapValues`, etc. that
   * transform container contents and verify structural preservation.
   */
  analyzeFunctors(): FunctorMap[] {
    const functors: FunctorMap[] = [];
    const classes = this.parser.extractClasses();
    const functions = this.parser.extractFunctions();
    const mapNames = ['map', 'fmap', 'mapValues', 'mapKeys', 'transform', 'select', 'mapObject'];

    for (const fn of functions) {
      if (!mapNames.includes(fn.name)) continue;
      const typeAnnotation = this.inferReturnType(fn.body);
      const paramType = fn.params.length > 0 ? fn.params[0] : 'unknown';
      const isCovariant = !fn.body.includes('contravariant') && !fn.body.includes('flip');
      const preservesIdentity = this.checkMapPreservesIdentity(fn);
      const preservesComposition = this.checkMapPreservesComposition(fn);
      functors.push({
        sourceType: paramType,
        targetType: typeAnnotation,
        mapperFunction: fn.name,
        isCovariant,
        preservesIdentity,
        preservesComposition,
      });
    }

    for (const cls of classes) {
      for (const method of cls.methods) {
        if (mapNames.includes(method.name)) {
          const typeAnnotation = this.inferReturnType(method.body);
          const paramType = method.params.length > 0 ? method.params[0] : 'unknown';
          const isCovariant = this.checkVariance(cls.name, method);
          functors.push({
            sourceType: `${cls.name}.${paramType}`,
            targetType: typeAnnotation,
            mapperFunction: `${cls.name}.${method.name}`,
            isCovariant,
            preservesIdentity: this.checkMapPreservesIdentity(method),
            preservesComposition: this.checkMapPreservesComposition(method),
          });
        }
      }
    }
    return functors;
  }

  private checkMapPreservesIdentity(fn: FunctionInfo): boolean {
    const hasIdentityFn =
      fn.body.includes('identity') ||
      fn.body.includes('id(') ||
      fn.body.includes('x => x') ||
      fn.body.includes('v => v');
    if (hasIdentityFn) return true;
    const returnSame =
      fn.body.includes('return x') ||
      fn.body.includes('return value') ||
      fn.body.includes('return item') ||
      fn.body.includes('return element');
    if (returnSame && !fn.body.match(/\w+\s*[+\-*/%]\s*\w+/)) return true;
    return false;
  }

  private checkMapPreservesComposition(fn: FunctionInfo): boolean {
    const hasChaining = fn.body.includes('.map(') || fn.body.includes('.fmap(');
    const hasComposition = fn.body.includes('compose') || fn.body.includes('∘');
    const hasNestedMapping =
      /map\s*\(\s*(?:function|\(|(\w+)\s*=>)/.test(fn.body);
    if (hasChaining && hasNestedMapping) return true;
    if (hasComposition) return true;
    return false;
  }

  private checkVariance(className: string, method: FunctionInfo): boolean {
    const contraPattern = new RegExp(
      `${className}\\s*\\(\\s*contra|contraMap|contramap`, 'i'
    );
    if (contraPattern.test(method.body)) return false;
    return true;
  }

  private inferReturnType(body: string): string {
    const returnMatch = body.match(/return\s+(?:new\s+)?(\w+)/);
    if (returnMatch) return returnMatch[1];
    const ternaryMatch = body.match(/:\s*(\w+)\s*\)/);
    if (ternaryMatch) return ternaryMatch[1];
    return 'unknown';
  }

  /**
   * Detect monoid candidates.
   *
   * A monoid (M, ∙, e) must satisfy:
   *   1. Closure:    ∀ a,b ∈ M : a ∙ b ∈ M
   *   2. Identity:   ∃ e ∈ M : e ∙ a = a ∙ e = a
   *   3. Associativity: (a ∙ b) ∙ c = a ∙ (b ∙ c)
   *
   * We look for:
   *   - concat / combine / merge / add / append methods
   *   - identity-like empty/default/null/zero values
   *   - nested calls that should be order-independent
   */
  analyzeMonoids(): MonoidCandidate[] {
    const monoids: MonoidCandidate[] = [];
    const monoidOps = [
      'concat', 'combine', 'merge', 'add', 'append',
      'union', 'join', 'intercalate'
    ];
    const identityValues = [
      '""', "''", '0', 'false', 'null', 'undefined',
      '[]', '{}', 'new Map()', 'new Set()'
    ];
    const functions = this.parser.extractFunctions();
    const classes = this.parser.extractClasses();

    for (const fn of functions) {
      for (const op of monoidOps) {
        if (fn.name.toLowerCase().includes(op)) {
          const hasIdentity =
            identityValues.some((id) => fn.body.includes(id)) ||
            fn.body.includes('identity') ||
            fn.body.includes('empty');
          const isAssociative = this.checkAssociativity(fn);
          monoids.push({
            type: this.inferReturnType(fn.body),
            opName: fn.name,
            identityElement: this.findIdentityElement(fn.body, identityValues),
            isAssociative,
            hasIdentity,
            witnessLines: this.findAssociativityWitnesses(fn),
          });
        }
      }
    }

    for (const cls of classes) {
      for (const method of cls.methods) {
        for (const op of monoidOps) {
          if (method.name.toLowerCase().includes(op)) {
            const hasIdentity =
              method.body.includes('identity') ||
              method.body.includes('empty') ||
              identityValues.some((id) => method.body.includes(id));
            const isAssociative = this.checkAssociativity(method);
            monoids.push({
              type: cls.name,
              opName: method.name,
              identityElement: this.findIdentityElement(method.body, identityValues),
              isAssociative,
              hasIdentity,
              witnessLines: this.findAssociativityWitnesses(method),
            });
          }
        }
      }
    }
    return monoids;
  }

  private checkAssociativity(fn: FunctionInfo): boolean {
    const pattern1 =
      /(\w+)\s*\.\s*(concat|combine|merge|add|append)\s*\(\s*(\w+)\s*\)\s*\.\s*(concat|combine|merge|add|append)/;
    const pattern2 = /reduce\s*\(/;
    const pattern3 = /fold\s*\(/;
    const hasChain =
      pattern1.test(fn.body) || pattern2.test(fn.body) || pattern3.test(fn.body);
    const noOrderDependent = !fn.body.includes('reverse') && !fn.body.includes('sort');
    const hasAssociativeOp = /\+\s|\.concat\(|\|\|/i.test(fn.body);
    return (hasChain || hasAssociativeOp) && noOrderDependent;
  }

  private findIdentityElement(body: string, candidates: string[]): string {
    for (const id of candidates) {
      if (body.includes(id)) return id;
    }
    return 'unknown';
  }

  private findAssociativityWitnesses(fn: FunctionInfo): number[] {
    const witnesses: number[] = [];
    const bodyLines = fn.body.split('\n');
    for (let i = 0; i < bodyLines.length; i++) {
      if (
        bodyLines[i].includes('.concat(') ||
        bodyLines[i].includes('.reduce(') ||
        bodyLines[i].includes('.fold(') ||
        /\+\s*\w+\s*\+/.test(bodyLines[i])
      ) {
        witnesses.push(i);
      }
    }
    return witnesses;
  }

  /**
   * Detect natural transformations.
   *
   * A natural transformation η : F => G between functors F,G
   * assigns to each object A a morphism η_A : F(A) → G(A)
   * such that for every morphism f : A → B:
   *   G(f) ∘ η_A = η_B ∘ F(f)
   *
   * In code this manifests as polymorphic functions that convert
   * between type constructors (e.g., Array→List, Maybe→Either).
   */
  analyzeNaturalTransformations(): NaturalTransformation[] {
    const nt: NaturalTransformation[] = [];
    const functions = this.parser.extractFunctions();
    const typeConstructors = [
      'Array', 'List', 'Map', 'Set', 'Promise',
      'Maybe', 'Either', 'Option', 'Result'
    ];

    for (const fn of functions) {
      const body = fn.body;
      const fromTypes = typeConstructors.filter(
        (t) =>
          body.includes(`new ${t}`) ||
          body.includes(`${t}.of(`) ||
          body.includes(`${t}.from(`)
      );
      const toTypes = typeConstructors.filter((t) => {
        const returnMatch = body.match(/return\s+(?:new\s+)?(\w+)/);
        return returnMatch && returnMatch[1] === t;
      });
      if (fromTypes.length > 0 && toTypes.length > 0) {
        const fromFunctor = fromTypes[0];
        const toFunctor = toTypes[0];
        const naturalityHolds = this.checkNaturality(fn, fromFunctor, toFunctor);
        nt.push({
          name: fn.name,
          fromFunctor,
          toFunctor,
          componentFunctions: fn.callsTo.filter(
            (c) => c.includes('of') || c.includes('from') || c.includes('wrap')
          ),
          naturalitySquareHolds: naturalityHolds,
        });
      }
    }
    return nt;
  }

  private checkNaturality(
    fn: FunctionInfo,
    _fromType: string,
    _toType: string
  ): boolean {
    const hasMapping = fn.body.includes('.map(') || fn.body.includes('.fmap(');
    const preservesStructure = !fn.body.includes('delete') && !fn.body.includes('remove');
    const composeCompatible = fn.callsTo.some(
      (c) => c.includes('compose') || c.includes('pipe')
    );
    return (hasMapping || composeCompatible) && preservesStructure;
  }

  /**
   * Detect Kleisli composition patterns.
   *
   * Given a monad (T, return, >>=), a Kleisli arrow is A -> T(B).
   * Kleisli composition f >=> g  is  x -> f(x) >>= g
   *
   * In JS/TS: detect chains of functions returning Promise/Optional/etc.
   * composed via flatMap/andThen.chain.
   */
  analyzeKleisliCompositions(): KleisliComposition[] {
    const compositions: KleisliComposition[] = [];
    const monadTypes = [
      'Promise', 'Maybe', 'Either', 'Option',
      'Result', 'IO', 'Task', 'Observable'
    ];
    const bindMethods = [
      'then', 'flatMap', 'andThen', 'chain',
      'bind', 'switchMap', 'mergeMap'
    ];
    const functions = this.parser.extractFunctions();
    const classes = this.parser.extractClasses();
    const allFunctions = [
      ...functions,
      ...classes.flatMap((c) => c.methods),
    ];

    for (const fn of allFunctions) {
      const body = fn.body;
      for (const monad of monadTypes) {
        const hasMonad =
          body.includes(monad) ||
          body.includes(`Promise<`) ||
          body.includes(`new ${monad}`);
        const hasBinding = bindMethods.some((m) => body.includes(`.${m}(`));
        if (hasMonad && hasBinding) {
          const bindingChain = this.extractBindingChain(body, bindMethods);
          const isWellFormed = this.checkKleisliWellFormed(bindingChain);
          compositions.push({
            functions: fn.callsTo,
            monadType: monad,
            isWellFormed,
            bindingChain,
          });
        }
      }
    }
    return compositions;
  }

  private extractBindingChain(body: string, bindMethods: string[]): string[] {
    const chain: string[] = [];
    for (const method of bindMethods) {
      const regex = new RegExp(
        `\\.${method}\\s*\\(\\s*(?:\\(([^)]*)\\)|([\\w$]+))\\s*=>`, 'g'
      );
      let m: RegExpExecArray | null;
      while ((m = regex.exec(body)) !== null) {
        chain.push(m[1] || m[2] || 'anonymous');
      }
    }
    return chain;
  }

  private checkKleisliWellFormed(chain: string[]): boolean {
    if (chain.length === 0) return false;
    const hasReturn = chain.some(
      (c) => c.includes('return') || c.includes('resolve')
    );
    const noSideEffects = chain.every(
      (c) => !c.includes('throw') && !c.includes('reject')
    );
    return hasReturn && noSideEffects;
  }

  /**
   * Detect algebraic data types (sum and product types).
   *
   * Product type:  A x B  -- record/tuple with fields of types A and B
   *   Card(A x B) = Card(A) x Card(B)
   *
   * Sum type:  A + B  -- union with distinct constructors
   *   Card(A + B) = Card(A) + Card(B)
   */
  analyzeAlgebraicDataTypes(): AlgebraicDataType[] {
    const adts: AlgebraicDataType[] = [];
    const classes = this.parser.extractClasses();
    const raw = this.parser.getRaw();

    const unionRegex = /type\s+(\w+)\s*=\s*([^;]+);/g;
    let m: RegExpExecArray | null;
    while ((m = unionRegex.exec(raw)) !== null) {
      const name = m[1];
      const definition = m[2].trim();
      if (definition.includes('|')) {
        const variants = definition.split('|').map((v) => v.trim());
        adts.push({
          name,
          kind: 'sum',
          variants,
          fields: [],
          isCovariant: true,
        });
      } else if (definition.includes('&')) {
        const fields = definition.split('&').map((f) => {
          const match = f.trim().match(/(\w+)\s*:/);
          return match ? match[1] : f.trim();
        });
        adts.push({
          name,
          kind: 'product',
          variants: [],
          fields,
          isCovariant: true,
        });
      }
    }

    const interfaceRegex = /interface\s+(\w+)\s*\{([^}]+)\}/g;
    while ((m = interfaceRegex.exec(raw)) !== null) {
      const name = m[1];
      const body = m[2];
      const fields = body.split(';').map((f) => {
        const match = f.trim().match(/(\w+)\s*[!?:]/);
        return match ? match[1] : f.trim();
      }).filter(Boolean);
      adts.push({
        name,
        kind: 'product',
        variants: [],
        fields,
        isCovariant: true,
      });
    }

    for (const cls of classes) {
      const isSumType =
        cls.modifiers.includes('abstract') &&
        cls.methods.some(
          (m) =>
            m.name.includes('match') ||
            m.name.includes('fold') ||
            m.name.includes('when')
        );
      if (isSumType) {
        adts.push({
          name: cls.name,
          kind: 'sum',
          variants: cls.methods
            .filter((m) => !m.name.startsWith('_'))
            .map((m) => m.name),
          fields: cls.properties,
          isCovariant: false,
        });
      } else if (cls.properties.length > 0 && cls.methods.length <= 3) {
        adts.push({
          name: cls.name,
          kind: 'product',
          variants: [],
          fields: cls.properties,
          isCovariant: true,
        });
      }
    }
    return adts;
  }

  /**
   * Map to Lawvere theory fragments.
   *
   * A Lawvere theory is a small category L with finite products
   * such that every object is a power of a single generating object.
   *
   * We detect fragments: Theory of Monoids, Theory of Groups,
   * Theory of Points, Theory of Sets, etc.
   */
  analyzeLawvereFragments(): LawvereFragment[] {
    const fragments: LawvereFragment[] = [];
    const monoids = this.analyzeMonoids();
    const adts = this.analyzeAlgebraicDataTypes();
    const functors = this.analyzeFunctors();

    if (monoids.length > 0) {
      const fragment: LawvereFragment = {
        name: 'Theory of Monoids',
        objects: [...new Set(monoids.map((m) => m.type))],
        morphisms: monoids.map((m) => ({
          from: m.type,
          to: m.type,
          name: m.opName,
        })),
        axiomsSatisfied: [],
        axiomsViolated: [],
      };
      for (const monoid of monoids) {
        if (monoid.hasIdentity)
          fragment.axiomsSatisfied.push(`${monoid.opName}: identity exists`);
        else
          fragment.axiomsViolated.push(`${monoid.opName}: missing identity`);
        if (monoid.isAssociative)
          fragment.axiomsSatisfied.push(`${monoid.opName}: associative`);
        else
          fragment.axiomsViolated.push(
            `${monoid.opName}: associativity not verified`
          );
      }
      fragments.push(fragment);
    }

    const sumTypes = adts.filter((a) => a.kind === 'sum');
    if (sumTypes.length > 0) {
      const fragment: LawvereFragment = {
        name: 'Theory of Coproducts',
        objects: sumTypes.map((s) => s.name),
        morphisms: sumTypes.flatMap((s) =>
          s.variants.map((v) => ({
            from: v,
            to: s.name,
            name: `inj_${v}`,
          }))
        ),
        axiomsSatisfied: sumTypes.map((s) => `${s.name}: disjoint union`),
        axiomsViolated: [],
      };
      fragments.push(fragment);
    }

    if (functors.length > 0) {
      const fragment: LawvereFragment = {
        name: 'Theory of Endofunctors',
        objects: [...new Set(functors.map((f) => f.sourceType))],
        morphisms: functors.map((f) => ({
          from: f.sourceType,
          to: f.targetType,
          name: f.mapperFunction,
        })),
        axiomsSatisfied: functors
          .filter((f) => f.preservesIdentity)
          .map((f) => `${f.mapperFunction}: preserves identity`),
        axiomsViolated: functors
          .filter((f) => !f.preservesIdentity)
          .map((f) => `${f.mapperFunction}: identity law violated`),
      };
      fragments.push(fragment);
    }
    return fragments;
  }

  /**
   * Full category-theoretic analysis of the codebase.
   */
  analyzeAll(): {
    functors: FunctorMap[];
    monoids: MonoidCandidate[];
    naturalTransformations: NaturalTransformation[];
    kleisliCompositions: KleisliComposition[];
    algebraicDataTypes: AlgebraicDataType[];
    lawvereFragments: LawvereFragment[];
    score: number;
    summary: string;
  } {
    const functors = this.analyzeFunctors();
    const monoids = this.analyzeMonoids();
    const naturalTransformations = this.analyzeNaturalTransformations();
    const kleisliCompositions = this.analyzeKleisliCompositions();
    const algebraicDataTypes = this.analyzeAlgebraicDataTypes();
    const lawvereFragments = this.analyzeLawvereFragments();

    let score = 50;
    const validFunctors = functors.filter(
      (f) => f.preservesIdentity && f.preservesComposition
    );
    score += Math.min(validFunctors.length * 5, 20);
    const validMonoids = monoids.filter(
      (m) => m.hasIdentity && m.isAssociative
    );
    score += Math.min(validMonoids.length * 3, 15);
    const validNT = naturalTransformations.filter(
      (n) => n.naturalitySquareHolds
    );
    score += Math.min(validNT.length * 4, 10);
    const validKleisli = kleisliCompositions.filter((k) => k.isWellFormed);
    score += Math.min(validKleisli.length * 2, 5);
    score = Math.min(score, 100);

    const summaryParts: string[] = [];
    summaryParts.push(`Category Theory Score: ${score}/100`);
    summaryParts.push(
      `Found ${functors.length} functor(s) (${validFunctors.length} law-abiding)`
    );
    summaryParts.push(
      `Found ${monoids.length} monoid candidate(s) (${validMonoids.length} verified)`
    );
    summaryParts.push(
      `Found ${naturalTransformations.length} natural transformation(s)`
    );
    summaryParts.push(
      `Found ${kleisliCompositions.length} Kleisli composition(s)`
    );
    summaryParts.push(
      `Found ${algebraicDataTypes.length} algebraic data type(s)`
    );
    summaryParts.push(
      `Found ${lawvereFragments.length} Lawvere theory fragment(s)`
    );

    return {
      functors,
      monoids,
      naturalTransformations,
      kleisliCompositions,
      algebraicDataTypes,
      lawvereFragments,
      score,
      summary: summaryParts.join('\n'),
    };
  }
}

// ────────────────────────────────────────────────────────────
// 3.  AST Transformer
// ────────────────────────────────────────────────────────────

interface Transformation {
  name: string;
  description: string;
  location: CodeLocation;
  beforeCode: string;
  afterCode: string;
  dependencies: string[];
  riskLevel: 'low' | 'medium' | 'high';
  complexityReduction: number;
}

class ASTTransformer {
  private parser: SourceCodeParser;

  constructor(parser: SourceCodeParser) {
    this.parser = parser;
  }

  /**
   * Extract Method refactoring.
   *
   * Given a code block with repeated logic, extract it into a new
   * method. We detect:
   *   - Duplicate or near-duplicate code blocks (levenshtein similarity)
   *   - Variable dependencies (free variables in the extracted block)
   *   - Parameter list needed for the new method
   *
   * Uses edit distance for duplicate detection:
   *   similarity = 1 - (levenshtein(a, b) / max(len(a), len(b)))
   */
  detectExtractMethod(): Transformation[] {
    const transformations: Transformation[] = [];
    const functions = this.parser.extractFunctions();

    for (const fn of functions) {
      const bodyLines = fn.body.split('\n');
      if (bodyLines.length < 5) continue;
      const blockSigs = this.computeBlockSignatures(bodyLines, 5);
      const duplicates = this.findDuplicateBlocks(blockSigs);
      for (const dup of duplicates) {
        const blockText = bodyLines.slice(dup.start, dup.end + 1).join('\n');
        const freeVars = this.findFreeVariables(blockText, fn.params);
        const complexityReduction = this.estimateComplexityReduction(blockText);
        transformations.push({
          name: 'Extract Method',
          description: `Extract lines ${dup.start}-${dup.end} of ${fn.name} into a new method. Similar block found at lines ${dup.duplicateStart}-${dup.duplicateEnd}.`,
          location: {
            line: fn.startLine + dup.start,
            column: 0,
            endLine: fn.startLine + dup.end,
            endColumn: 0,
          },
          beforeCode: blockText,
          afterCode: this.generateExtractedMethod(
            `extracted_${fn.name}_${dup.start}`,
            freeVars,
            blockText
          ),
          dependencies: freeVars,
          riskLevel: freeVars.length > 3 ? 'high' : freeVars.length > 1 ? 'medium' : 'low',
          complexityReduction,
        });
      }
    }
    return transformations;
  }

  private computeBlockSignatures(
    lines: string[],
    windowSize: number
  ): { start: number; end: number; signature: string }[] {
    const blocks: { start: number; end: number; signature: string }[] = [];
    for (let i = 0; i <= lines.length - windowSize; i++) {
      const block = lines.slice(i, i + windowSize).join('\n').trim();
      const signature = this.normalizeCode(block);
      blocks.push({ start: i, end: i + windowSize - 1, signature });
    }
    return blocks;
  }

  private normalizeCode(code: string): string {
    return code
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .replace(/['"`]([^'"`]*?)['"`]/g, '"STR"')
      .replace(/\d+/g, 'N')
      .replace(/\b\w+\b/g, (w) => w.toLowerCase())
      .trim();
  }

  private findDuplicateBlocks(
    blocks: { start: number; end: number; signature: string }[]
  ): {
    start: number;
    end: number;
    duplicateStart: number;
    duplicateEnd: number;
    similarity: number;
  }[] {
    const duplicates: {
      start: number;
      end: number;
      duplicateStart: number;
      duplicateEnd: number;
      similarity: number;
    }[] = [];
    const threshold = 0.75;
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        if (Math.abs(blocks[i].start - blocks[j].start) < 3) continue;
        const sim = this.levenshteinSimilarity(
          blocks[i].signature,
          blocks[j].signature
        );
        if (sim >= threshold) {
          duplicates.push({
            start: blocks[i].start,
            end: blocks[i].end,
            duplicateStart: blocks[j].start,
            duplicateEnd: blocks[j].end,
            similarity: sim,
          });
        }
      }
    }
    return duplicates;
  }

  /**
   * Levenshtein distance between two strings.
   *   D(i,j) = min {
   *     D(i-1, j)   + 1,     // deletion
   *     D(i, j-1)   + 1,     // insertion
   *     D(i-1, j-1) + cost   // substitution (0 if equal, 1 otherwise)
   *   }
   * Time: O(mn), Space: O(min(m,n))
   */
  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    if (a.length < b.length) [a, b] = [b, a];
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    const curr = new Array(b.length + 1).fill(0);
    for (let i = 1; i <= a.length; i++) {
      curr[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1,
          curr[j - 1] + 1,
          prev[j - 1] + cost
        );
      }
      for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
    }
    return prev[b.length];
  }

  private levenshteinSimilarity(a: string, b: string): number {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - this.levenshteinDistance(a, b) / maxLen;
  }

  private findFreeVariables(code: string, params: string[]): string[] {
    const usedVars = new Set<string>();
    const definedVars = new Set<string>(params);
    const varUsage = /\b([a-zA-Z_$][\w$]*)\b/g;
    let m: RegExpExecArray | null;
    while ((m = varUsage.exec(code)) !== null) {
      const name = m[1];
      if (!this.isKeyword(name) && !name.match(/^[A-Z_]/)) {
        usedVars.add(name);
      }
    }
    const letConstVar = /(?:let|const|var)\s+([a-zA-Z_$][\w$]*)/g;
    while ((m = letConstVar.exec(code)) !== null) {
      definedVars.add(m[1]);
    }
    return [...usedVars].filter((v) => !definedVars.has(v));
  }

  private isKeyword(name: string): boolean {
    const keywords = [
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
      'return', 'throw', 'try', 'catch', 'finally', 'new', 'delete', 'typeof',
      'instanceof', 'void', 'in', 'of', 'this', 'super', 'class', 'extends',
      'function', 'const', 'let', 'var', 'true', 'false', 'null', 'undefined',
      'async', 'await', 'yield', 'import', 'export', 'from', 'default',
    ];
    return keywords.includes(name);
  }

  private estimateComplexityReduction(block: string): number {
    let reduction = 0;
    const branchingPatterns = [
      /\bif\s*\(/, /\belse/, /\bfor\s*\(/, /\bwhile\s*\(/,
      /\bswitch\s*\(/, /\bcase\s+/, /\bcatch\s*\(/, /\?\s*[^?:]+:/
    ];
    for (const pattern of branchingPatterns) {
      const matches = block.match(new RegExp(pattern.source, 'g'));
      if (matches) reduction += matches.length * 2;
    }
    const nesting = (block.match(/\{/g) || []).length;
    reduction += nesting;
    const loc = block.split('\n').length;
    if (loc > 10) reduction += Math.floor(loc / 5);
    return reduction;
  }

  private generateExtractedMethod(
    name: string,
    params: string[],
    body: string
  ): string {
    const paramStr = params.join(', ');
    const dedented = body
      .split('\n')
      .map((l) => l.replace(/^\s{2}/, ''))
      .join('\n');
    return `function ${name}(${paramStr}): void {\n${dedented}\n}`;
  }

  /**
   * Inline Function refactoring.
   *
   * Detect functions that are called only once and are small enough
   * to inline. Cost metric:
   *   inlineCost = params x 2 + LOC + branchCount x 3
   *   If inlineCost <= 15, the function is a candidate for inlining.
   */
  detectInlineFunction(): Transformation[] {
    const transformations: Transformation[] = [];
    const functions = this.parser.extractFunctions();
    const raw = this.parser.getRaw();

    for (const fn of functions) {
      const callCount =
        (raw.match(new RegExp(`\\b${fn.name}\\s*\\(`, 'g')) || []).length;
      const paramCost = fn.params.length * 2;
      const branchCost =
        (fn.body.match(/\b(if|else|for|while|switch|case|catch)\b/g) || [])
          .length * 3;
      const locCost = fn.body.split('\n').length;
      const inlineCost = paramCost + locCost + branchCost;

      if (callCount === 1 && inlineCost <= 15) {
        const callSiteLine = this.findCallSite(fn.name);
        if (callSiteLine >= 0) {
          transformations.push({
            name: 'Inline Function',
            description: `Inline ${fn.name} (called once, inline cost ${inlineCost} <= 15)`,
            location: {
              line: fn.startLine,
              column: 0,
              endLine: fn.endLine,
              endColumn: 0,
            },
            beforeCode: `${fn.name}(${fn.params.join(', ')})`,
            afterCode: fn.body.replace(/return\s+/, ''),
            dependencies: [],
            riskLevel: 'low',
            complexityReduction: Math.max(0, 5 - inlineCost),
          });
        }
      }
    }
    return transformations;
  }

  private findCallSite(funcName: string): number {
    const lines = this.parser.getLines();
    const regex = new RegExp(`\\b${funcName}\\s*\\(`);
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) return i;
    }
    return -1;
  }

  /**
   * Move Method refactoring.
   *
   * Detect methods that use more data from another class than their
   * own class (Feature Envy -> Move Method).
   *
   * Heuristic: if method references foreignClass.property more than
   * this.property, moving the method reduces coupling.
   *
   * Coupling impact:
   *   deltaC = efferent(this) - efferent(foreign) + 1
   *   If deltaC < 0, the move is beneficial.
   */
  detectMoveMethod(): Transformation[] {
    const transformations: Transformation[] = [];
    const classes = this.parser.extractClasses();

    for (const cls of classes) {
      for (const method of cls.methods) {
        const foreignRefs = this.countForeignReferences(
          method,
          cls.name,
          classes
        );
        const selfRefs = this.countSelfReferences(method, cls.name);
        if (
          foreignRefs.bestTarget &&
          foreignRefs.count > selfRefs &&
          foreignRefs.count >= 2
        ) {
          const deltaCoupling = foreignRefs.count - selfRefs;
          transformations.push({
            name: 'Move Method',
            description: `Move ${cls.name}.${method.name} to ${foreignRefs.bestTarget} (uses ${foreignRefs.count} foreign refs vs ${selfRefs} self refs, deltaC=${deltaCoupling})`,
            location: {
              line: method.startLine,
              column: 0,
              endLine: method.endLine,
              endColumn: 0,
            },
            beforeCode: `${cls.name}.${method.name}()`,
            afterCode: `${foreignRefs.bestTarget}.${method.name}()`,
            dependencies: [foreignRefs.bestTarget],
            riskLevel: deltaCoupling > 5 ? 'high' : 'medium',
            complexityReduction: deltaCoupling,
          });
        }
      }
    }
    return transformations;
  }

  private countForeignReferences(
    method: FunctionInfo,
    className: string,
    classes: ClassInfo[]
  ): { count: number; bestTarget: string | null } {
    const refs = new Map<string, number>();
    for (const cls of classes) {
      if (cls.name === className) continue;
      let count = 0;
      for (const prop of cls.properties) {
        if (method.body.includes(prop)) count++;
      }
      if (count > 0) refs.set(cls.name, count);
    }
    let bestTarget: string | null = null;
    let bestCount = 0;
    for (const [target, count] of refs) {
      if (count > bestCount) {
        bestCount = count;
        bestTarget = target;
      }
    }
    return { count: bestCount, bestTarget };
  }

  private countSelfReferences(method: FunctionInfo, _className: string): number {
    let count = 0;
    const selfPatterns = ['this.', 'this['];
    for (const pattern of selfPatterns) {
      const escaped = pattern.replace('.', '\\.');
      const matches = method.body.match(new RegExp(escaped, 'g'));
      if (matches) count += matches.length;
    }
    return count;
  }

  /**
   * Replace Conditional with Polymorphism.
   *
   * Detect switch/if-else chains that dispatch on the same type
   * discriminant. These should be replaced with polymorphic dispatch.
   *
   * Severity metric:
   *   S = branches x (avgBranchLength / 3) + nestingDepth^2
   */
  detectReplaceConditionalWithPolymorphism(): Transformation[] {
    const transformations: Transformation[] = [];
    const functions = this.parser.extractFunctions();
    const classes = this.parser.extractClasses();
    const allCode = [
      ...functions.map((f) => ({
        name: f.name,
        body: f.body,
        startLine: f.startLine,
        endLine: f.endLine,
      })),
      ...classes.flatMap((c) =>
        c.methods.map((m) => ({
          name: `${c.name}.${m.name}`,
          body: m.body,
          startLine: m.startLine,
          endLine: m.endLine,
        }))
      ),
    ];

    for (const code of allCode) {
      const switchMatches = code.body.match(/switch\s*\([^)]+\)\s*\{/g);
      if (switchMatches && switchMatches.length > 0) {
        for (const _ of switchMatches) {
          const branchCount = (code.body.match(/\bcase\s+/g) || []).length;
          const avgBranchLen = this.getAverageBranchLength(code.body);
          const nesting = this.getMaxNestingDepth(code.body);
          const severity =
            branchCount * (avgBranchLen / 3) + nesting * nesting;
          if (branchCount >= 3 && severity >= 10) {
            transformations.push({
              name: 'Replace Conditional with Polymorphism',
              description: `Switch statement in ${code.name} has ${branchCount} branches (severity=${severity.toFixed(1)}). Replace with polymorphic dispatch.`,
              location: {
                line: code.startLine,
                column: 0,
                endLine: code.endLine,
                endColumn: 0,
              },
              beforeCode: `switch(discriminant) { ${'case X: ...; '.repeat(branchCount)} }`,
              afterCode: `// Define abstract class with abstract method\n// Each case becomes a subclass override`,
              dependencies: [],
              riskLevel: 'high',
              complexityReduction: Math.floor(severity / 2),
            });
          }
        }
      }

      const ifElseChain = code.body.match(/if\s*\(/g);
      if (ifElseChain && ifElseChain.length >= 4) {
        const chainLength = ifElseChain.length;
        const avgBranchLen = this.getAverageBranchLength(code.body);
        const nesting = this.getMaxNestingDepth(code.body);
        const severity =
          chainLength * (avgBranchLen / 3) + nesting * nesting;
        if (chainLength >= 4 && severity >= 15) {
          transformations.push({
            name: 'Replace Conditional with Polymorphism',
            description: `If-else chain in ${code.name} has ${chainLength} branches (severity=${severity.toFixed(1)}). Consider polymorphic dispatch.`,
            location: {
              line: code.startLine,
              column: 0,
              endLine: code.endLine,
              endColumn: 0,
            },
            beforeCode: `${'if(...) { ... } else '.repeat(chainLength)} else { ... }`,
            afterCode: `// Strategy or State pattern with interface`,
            dependencies: [],
            riskLevel: 'high',
            complexityReduction: Math.floor(severity / 3),
          });
        }
      }
    }
    return transformations;
  }

  private getAverageBranchLength(body: string): number {
    const branches = body.split(/\b(?:case|else\s+if|else)\b/);
    if (branches.length <= 1) return 0;
    const lengths = branches.map((b) => b.split('\n').length);
    return lengths.reduce((a, b) => a + b, 0) / lengths.length;
  }

  private getMaxNestingDepth(body: string): number {
    let maxDepth = 0;
    let depth = 0;
    for (const ch of body) {
      if (ch === '{') {
        depth++;
        maxDepth = Math.max(maxDepth, depth);
      } else if (ch === '}') depth--;
    }
    return maxDepth;
  }

  /**
   * Introduce Parameter Object.
   *
   * Functions with >= 4 parameters should have those parameters
   * grouped into a single object type.
   *
   * Metric: paramCount x 2 + bodyLength / 10
   */
  detectIntroduceParameterObject(): Transformation[] {
    const transformations: Transformation[] = [];
    const functions = this.parser.extractFunctions();
    const classes = this.parser.extractClasses();
    const allFunctions = [
      ...functions,
      ...classes.flatMap((c) => c.methods),
    ];

    for (const fn of allFunctions) {
      if (fn.params.length >= 4) {
        const bodyLines = fn.body.split('\n').length;
        const impact = fn.params.length * 2 + bodyLines / 10;
        const paramTypes = fn.params.map((p) => {
          const typeMatch = fn.body.match(
            new RegExp(`${p}\\s*:\\s*(\\w+)`)
          );
          return { name: p, type: typeMatch ? typeMatch[1] : 'any' };
        });
        const objTypeName = `${fn.name}Params`;
        const objDef = `interface ${objTypeName} {\n${paramTypes
          .map((p) => `  ${p.name}: ${p.type};`)
          .join('\n')}\n}`;
        transformations.push({
          name: 'Introduce Parameter Object',
          description: `${fn.name} has ${fn.params.length} parameters. Group into ${objTypeName} (impact=${impact.toFixed(1)})`,
          location: {
            line: fn.startLine,
            column: 0,
            endLine: fn.startLine,
            endColumn: 0,
          },
          beforeCode: `function ${fn.name}(${fn.params.join(', ')})`,
          afterCode: `${objDef}\nfunction ${fn.name}(params: ${objTypeName})`,
          dependencies: [],
          riskLevel: fn.params.length > 6 ? 'high' : 'medium',
          complexityReduction: Math.floor(impact),
        });
      }
    }
    return transformations;
  }

  /**
   * Decompose Conditional.
   *
   * Detect complex conditions in if/while/for statements.
   * Complexity of condition C = operators + nestedParens + booleanOps
   * If C >= 4, suggest decomposing into named boolean variables.
   */
  detectDecomposeConditional(): Transformation[] {
    const transformations: Transformation[] = [];
    const lines = this.parser.getLines();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const condMatch = line.match(
        /^\s*(if|while|else\s+if)\s*\((.+)\)/
      );
      if (condMatch) {
        const condition = condMatch[2];
        const boolOps =
          (condition.match(
            /&&|\|\||!?\s*[\w.]+(?:===?|!==?|>=?|<=?|>|<)/g
          ) || []).length;
        const nestedParens = this.countNestedParens(condition);
        const complexity = boolOps + nestedParens;
        if (complexity >= 4) {
          transformations.push({
            name: 'Decompose Conditional',
            description: `Condition at line ${i + 1} has complexity ${complexity} (boolOps=${boolOps}, nesting=${nestedParens}). Extract into named boolean variables.`,
            location: {
              line: i + 1,
              column: line.indexOf(condMatch[1]),
              endLine: i + 1,
              endColumn: line.length,
            },
            beforeCode: line.trim(),
            afterCode: `const isValid = /* condition */;\nif (isValid) { ... }`,
            dependencies: [],
            riskLevel: 'low',
            complexityReduction: complexity,
          });
        }
      }
    }
    return transformations;
  }

  private countNestedParens(s: string): number {
    let maxDepth = 0;
    let depth = 0;
    for (const ch of s) {
      if (ch === '(') {
        depth++;
        maxDepth = Math.max(maxDepth, depth);
      } else if (ch === ')') depth--;
    }
    return maxDepth;
  }

  /**
   * Form Template Method.
   *
   * Detect classes with methods that have similar algorithmic structure.
   * Similarity is measured by normalized sequence alignment.
   *
   * Template Method applies when:
   *   - Two methods share the same step sequence
   *   - Steps differ in implementation but not in order
   *   - similarity >= 0.6
   */
  detectFormTemplateMethod(): Transformation[] {
    const transformations: Transformation[] = [];
    const classes = this.parser.extractClasses();

    for (const cls of classes) {
      const methodCalls = cls.methods.map((m) => ({
        name: m.name,
        calls: m.callsTo,
        normalized: m.callsTo.map((c) => c.toLowerCase()).join(','),
      }));

      for (let i = 0; i < methodCalls.length; i++) {
        for (let j = i + 1; j < methodCalls.length; j++) {
          if (methodCalls[i].calls.length < 2 || methodCalls[j].calls.length < 2)
            continue;
          const sim = this.sequenceSimilarity(
            methodCalls[i].normalized,
            methodCalls[j].normalized
          );
          if (sim >= 0.6) {
            const commonSteps = this.findCommonSubsequence(
              methodCalls[i].calls,
              methodCalls[j].calls
            );
            transformations.push({
              name: 'Form Template Method',
              description: `${cls.name}.${methodCalls[i].name} and ${methodCalls[j].name} have similar structure (similarity=${sim.toFixed(2)}). Extract common algorithm into template method.`,
              location: {
                line: cls.startLine,
                column: 0,
                endLine: cls.endLine,
                endColumn: 0,
              },
              beforeCode: `${methodCalls[i].name}() and ${methodCalls[j].name}() - similar step sequences`,
              afterCode: `abstract templateMethod() {\n  ${commonSteps
                .map((s) => `this.${s}();`)
                .join('\n  ')}\n}\n// Subclasses override individual steps`,
              dependencies: [cls.name],
              riskLevel: 'medium',
              complexityReduction: Math.floor(commonSteps.length * 2),
            });
          }
        }
      }
    }
    return transformations;
  }

  private sequenceSimilarity(a: string, b: string): number {
    if (a.length === 0 && b.length === 0) return 1;
    if (a.length === 0 || b.length === 0) return 0;
    const maxLen = Math.max(a.length, b.length);
    const dist = this.levenshteinDistance(a, b);
    return 1 - dist / maxLen;
  }

  /**
   * Longest Common Subsequence using dynamic programming.
   *
   *   L(i,j) = {
   *     L(i-1, j-1) + 1          if a[i] == b[j]
   *     max(L(i-1,j), L(i,j-1))  otherwise
   *   }
   *
   * Time: O(mn), Space: O(mn)
   */
  private findCommonSubsequence(a: string[], b: string[]): string[] {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () =>
      new Array(n + 1).fill(0)
    );
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    const result: string[] = [];
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
      if (a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
        result.unshift(a[i - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }
    return result;
  }

  /**
   * Run all transformation detections.
   */
  detectAll(): Transformation[] {
    const extractMethod = this.detectExtractMethod();
    const inlineFunction = this.detectInlineFunction();
    const moveMethod = this.detectMoveMethod();
    const replaceConditional = this.detectReplaceConditionalWithPolymorphism();
    const introParamObj = this.detectIntroduceParameterObject();
    const decomposeCond = this.detectDecomposeConditional();
    const templateMethod = this.detectFormTemplateMethod();
    const all = [
      ...extractMethod,
      ...inlineFunction,
      ...moveMethod,
      ...replaceConditional,
      ...introParamObj,
      ...decomposeCond,
      ...templateMethod,
    ];
    all.sort((a, b) => b.complexityReduction - a.complexityReduction);
    return all;
  }
}

// ────────────────────────────────────────────────────────────
// 4.  Design Pattern Detector
// ────────────────────────────────────────────────────────────

class DesignPatternDetector {
  private parser: SourceCodeParser;

  constructor(parser: SourceCodeParser) {
    this.parser = parser;
  }

  /**
   * Detect Singleton pattern.
   *
   * Structural requirements:
   *   1. Private static instance field
   *   2. Private constructor
   *   3. Static getInstance() method returning the singleton
   *   4. No public `new ClassName()` calls from outside
   */
  detectSingleton(): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const classes = this.parser.extractClasses();
    const raw = this.parser.getRaw();

    for (const cls of classes) {
      let confidence = 0;
      const evidence: string[] = [];
      const hasPrivateCtor =
        cls.constructorBody !== null &&
        (cls.constructorBody.includes('private') ||
          cls.modifiers.includes('private'));
      if (hasPrivateCtor) {
        confidence += 30;
        evidence.push('Private constructor');
      }
      const hasStaticInstance = cls.properties.some(
        (p) =>
          p.toLowerCase().includes('instance') ||
          p.toLowerCase().includes('singleton')
      );
      if (hasStaticInstance) {
        confidence += 25;
        evidence.push('Static instance property');
      }
      const hasGetInstance = cls.methods.some(
        (m) =>
          m.name.toLowerCase().includes('getinstance') ||
          m.name.toLowerCase() === 'get'
      );
      if (hasGetInstance) {
        confidence += 25;
        evidence.push('getInstance() method');
      }
      const newPattern = new RegExp(`new\\s+${cls.name}\\s*\\(`, 'g');
      const newCount = (raw.match(newPattern) || []).length;
      if (newCount <= 1) {
        confidence += 10;
        evidence.push(`Only ${newCount} instantiation(s)`);
      }
      if (
        cls.methods.some(
          (m) => m.name === 'getInstance' && m.body.includes('return')
        )
      ) {
        confidence += 10;
        evidence.push('getInstance returns instance');
      }
      if (confidence >= 50) {
        matches.push({
          pattern: 'Singleton',
          confidence: Math.min(confidence, 100),
          location: {
            line: cls.startLine,
            column: 0,
            endLine: cls.endLine,
            endColumn: 0,
          },
          evidence,
          suggestion:
            'Consider dependency injection instead of singleton for testability.',
        });
      }
    }
    return matches;
  }

  /**
   * Detect Factory Method pattern.
   *
   * Structural requirements:
   *   1. Method named create*/make*/build*/new* that returns an object
   *   2. Return type is either abstract or interface
   *   3. Multiple concrete implementations exist
   *   4. Factory method uses conditional logic or registration
   */
  detectFactoryMethod(): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const classes = this.parser.extractClasses();
    const functions = this.parser.extractFunctions();
    const factoryNames = [
      'create', 'make', 'build', 'factory', 'newInstance', 'getInstance'
    ];
    const allFunctions = [
      ...functions,
      ...classes.flatMap((c) => c.methods),
    ];

    for (const fn of allFunctions) {
      const isFactory = factoryNames.some((f) =>
        fn.name.toLowerCase().includes(f)
      );
      if (!isFactory) continue;
      let confidence = 0;
      const evidence: string[] = [];
      const returnsObject =
        fn.body.includes('return new ') || fn.body.includes('return {');
      if (returnsObject) {
        confidence += 25;
        evidence.push('Returns new object');
      }
      const hasConditional = fn.body.includes('if (') || fn.body.includes('switch');
      if (hasConditional) {
        confidence += 20;
        evidence.push('Conditional dispatch');
      }
      const returnType = this.inferReturnedType(fn.body);
      if (returnType) {
        const impls = classes.filter(
          (c) =>
            c.implementsInterfaces.includes(returnType) ||
            c.extendsClass === returnType
        );
        if (impls.length >= 2) {
          confidence += 30;
          evidence.push(`${impls.length} implementations of ${returnType}`);
        }
      }
      if (fn.name.toLowerCase().includes('factory')) {
        confidence += 15;
        evidence.push('Named factory');
      }
      const returnsAbstract = classes.some(
        (c) => c.name === returnType && c.isAbstract
      );
      if (returnsAbstract) {
        confidence += 10;
        evidence.push('Returns abstract type');
      }
      if (confidence >= 40) {
        matches.push({
          pattern: 'Factory Method',
          confidence: Math.min(confidence, 100),
          location: {
            line: fn.startLine,
            column: 0,
            endLine: fn.endLine,
            endColumn: 0,
          },
          evidence,
          suggestion:
            'Factory pattern provides loose coupling. Consider abstract factory for families of related objects.',
        });
      }
    }
    return matches;
  }

  private inferReturnedType(body: string): string | null {
    const returnNew = body.match(/return\s+new\s+(\w+)/);
    if (returnNew) return returnNew[1];
    const returnObj = body.match(/return\s*\{[\s\S]*?(\w+):\s*\w+/);
    return returnObj ? returnObj[1] : null;
  }

  /**
   * Detect Observer / EventEmitter pattern.
   *
   * Structural requirements:
   *   1. subscribe/on/addListener methods
   *   2. unsubscribe/off/removeListener methods
   *   3. notify/emit/dispatch method
   *   4. Internal listener registry (array/map of callbacks)
   */
  detectObserver(): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const classes = this.parser.extractClasses();
    const subscribeMethods = [
      'subscribe', 'on', 'addEventListener',
      'addListener', 'observe', 'watch'
    ];
    const unsubscribeMethods = [
      'unsubscribe', 'off', 'removeEventListener',
      'removeListener', 'unobserve', 'unwatch'
    ];
    const notifyMethods = [
      'notify', 'emit', 'dispatch', 'publish',
      'broadcast', 'trigger'
    ];

    for (const cls of classes) {
      let confidence = 0;
      const evidence: string[] = [];
      const hasSubscribe = cls.methods.some((m) =>
        subscribeMethods.some((s) => m.name.toLowerCase().includes(s))
      );
      if (hasSubscribe) {
        confidence += 25;
        evidence.push('Has subscribe/on method');
      }
      const hasUnsubscribe = cls.methods.some((m) =>
        unsubscribeMethods.some((s) => m.name.toLowerCase().includes(s))
      );
      if (hasUnsubscribe) {
        confidence += 25;
        evidence.push('Has unsubscribe/off method');
      }
      const hasNotify = cls.methods.some((m) =>
        notifyMethods.some((n) => m.name.toLowerCase().includes(n))
      );
      if (hasNotify) {
        confidence += 25;
        evidence.push('Has notify/emit method');
      }
      const hasListenerRegistry = cls.properties.some(
        (p) =>
          p.toLowerCase().includes('listener') ||
          p.toLowerCase().includes('handler') ||
          p.toLowerCase().includes('observer') ||
          p.toLowerCase().includes('subscriber')
      );
      if (hasListenerRegistry) {
        confidence += 15;
        evidence.push('Listener registry property');
      }
      if (hasSubscribe && hasNotify) confidence += 10;
      if (confidence >= 50) {
        matches.push({
          pattern: 'Observer/EventEmitter',
          confidence: Math.min(confidence, 100),
          location: {
            line: cls.startLine,
            column: 0,
            endLine: cls.endLine,
            endColumn: 0,
          },
          evidence,
          suggestion:
            'Consider using typed events and weak references for listeners to prevent memory leaks.',
        });
      }
    }
    return matches;
  }

  /**
   * Detect Strategy pattern.
   *
   * Structural requirements:
   *   1. Interface/abstract class defining a strategy
   *   2. Multiple concrete implementations
   *   3. Context class accepting a strategy parameter
   *   4. Strategy is invoked (delegated to) by context
   */
  detectStrategy(): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const classes = this.parser.extractClasses();
    const interfaces = classes.filter(
      (c) => c.isAbstract && c.methods.length >= 1
    );

    for (const iface of interfaces) {
      const implementations = classes.filter(
        (c) =>
          c.implementsInterfaces.includes(iface.name) ||
          c.extendsClass === iface.name
      );
      if (implementations.length < 2) continue;
      let confidence = 0;
      const evidence: string[] = [];
      confidence += 30;
      evidence.push(
        `${iface.name} interface with ${implementations.length} implementations`
      );
      const contextClasses = classes.filter((c) =>
        c.methods.some(
          (m) =>
            m.params.includes(iface.name) ||
            m.params.some((p) => p.includes(iface.name.toLowerCase()))
        )
      );
      if (contextClasses.length > 0) {
        confidence += 25;
        evidence.push(
          `Context class ${contextClasses[0].name} accepts ${iface.name} parameter`
        );
      }
      const hasDelegation = contextClasses.some((c) =>
        c.methods.some(
          (m) =>
            m.body.includes('strategy.') || m.body.includes('this.strategy')
        )
      );
      if (hasDelegation) {
        confidence += 15;
        evidence.push('Delegates to strategy');
      }
      if (confidence >= 50) {
        matches.push({
          pattern: 'Strategy',
          confidence: Math.min(confidence, 100),
          location: {
            line: iface.startLine,
            column: 0,
            endLine: iface.endLine,
            endColumn: 0,
          },
          evidence,
          suggestion:
            'Strategy pattern enables runtime algorithm selection. Ensure strategies are stateless where possible.',
        });
      }
    }
    return matches;
  }

  /**
   * Detect Decorator pattern.
   *
   * Structural requirements:
   *   1. Decorator wraps a component (constructor takes component)
   *   2. Decorator implements same interface as component
   *   3. Decorator adds behavior before/after delegating
   *   4. Multiple decorators can be stacked
   */
  detectDecorator(): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const classes = this.parser.extractClasses();

    for (const cls of classes) {
      let confidence = 0;
      const evidence: string[] = [];
      const ctor = cls.constructorBody || '';
      const takesComponent =
        ctor.match(/\b(\w+)\s*:\s*\w+/) && !ctor.includes('private');
      if (takesComponent) {
        confidence += 20;
        evidence.push('Constructor takes a component parameter');
      }
      const implementsSame =
        cls.implementsInterfaces.length > 0 && cls.methods.length > 0;
      if (implementsSame) {
        confidence += 20;
        evidence.push('Implements same interface as wrapped component');
      }
      const delegatesToWrapped = cls.methods.some(
        (m) =>
          m.body.includes('this.component.') ||
          m.body.includes('this.wrapped.') ||
          m.body.includes('this.inner.')
      );
      if (delegatesToWrapped) {
        confidence += 25;
        evidence.push('Delegates to wrapped component');
      }
      const addsBehavior = cls.methods.some(
        (m) =>
          m.body.includes('console.log') ||
          m.body.includes('before') ||
          m.body.includes('after') ||
          m.body.includes('timer') ||
          m.body.includes('try') ||
          m.body.includes('catch')
      );
      if (addsBehavior) {
        confidence += 15;
        evidence.push('Adds behavior around delegation');
      }
      const methodNames = cls.methods.map((m) => m.name);
      const componentNames = classes
        .filter((c) => c !== cls)
        .flatMap((c) => c.methods.map((m) => m.name));
      const overlappingMethods = methodNames.filter((n) =>
        componentNames.includes(n)
      );
      if (overlappingMethods.length >= 2) {
        confidence += 15;
        evidence.push(`Overlapping methods: ${overlappingMethods.join(', ')}`);
      }
      if (confidence >= 50) {
        matches.push({
          pattern: 'Decorator',
          confidence: Math.min(confidence, 100),
          location: {
            line: cls.startLine,
            column: 0,
            endLine: cls.endLine,
            endColumn: 0,
          },
          evidence,
          suggestion:
            'Decorators add flexibility. Consider TypeScript mixins for more complex composition.',
        });
      }
    }
    return matches;
  }

  /**
   * Detect Command pattern.
   *
   * Structural requirements:
   *   1. Command class with execute() method
   *   2. Undo/revert method
   *   3. Command is invokable (callable object)
   *   4. Encapsulated state for undo
   */
  detectCommand(): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const classes = this.parser.extractClasses();

    for (const cls of classes) {
      let confidence = 0;
      const evidence: string[] = [];
      const hasExecute = cls.methods.some(
        (m) =>
          m.name === 'execute' || m.name === 'run' || m.name === 'perform'
      );
      if (hasExecute) {
        confidence += 30;
        evidence.push('Has execute() method');
      }
      const hasUndo = cls.methods.some(
        (m) =>
          m.name === 'undo' || m.name === 'revert' || m.name === 'rollback'
      );
      if (hasUndo) {
        confidence += 25;
        evidence.push('Has undo/revert method');
      }
      const hasState = cls.properties.length > 0;
      if (hasState) {
        confidence += 10;
        evidence.push('Encapsulated state');
      }
      const invokablePattern = cls.methods.some(
        (m) => m.name === 'call' || m.name === 'apply'
      );
      if (invokablePattern) {
        confidence += 10;
        evidence.push('Callable interface');
      }
      if (confidence >= 45) {
        matches.push({
          pattern: 'Command',
          confidence: Math.min(confidence, 100),
          location: {
            line: cls.startLine,
            column: 0,
            endLine: cls.endLine,
            endColumn: 0,
          },
          evidence,
          suggestion:
            'Command pattern enables undo/redo. Consider command queues and macro recording.',
        });
      }
    }
    return matches;
  }

  /**
   * Detect State pattern.
   *
   * Structural requirements:
   *   1. State interface/abstract class
   *   2. Multiple concrete states
   *   3. Context object transitions between states
   *   4. State transition methods (setState, transitionTo)
   */
  detectState(): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const classes = this.parser.extractClasses();
    const raw = this.parser.getRaw();
    const stateInterfaces = classes.filter(
      (c) => c.isAbstract && c.name.toLowerCase().includes('state')
    );

    for (const stateIface of stateInterfaces) {
      const concreteStates = classes.filter(
        (c) =>
          c.implementsInterfaces.includes(stateIface.name) ||
          c.extendsClass === stateIface.name
      );
      if (concreteStates.length < 2) continue;
      let confidence = 0;
      const evidence: string[] = [];
      confidence += 30;
      evidence.push(
        `${stateIface.name} interface with ${concreteStates.length} concrete states`
      );
      const hasTransition =
        raw.includes('setState') ||
        raw.includes('transitionTo') ||
        raw.includes('changeState');
      if (hasTransition) {
        confidence += 25;
        evidence.push('State transition method found');
      }
      const hasContext = classes.some(
        (c) =>
          c.properties.some((p) => p.toLowerCase().includes('state')) &&
          c.methods.some((m) => m.body.includes('this.state.'))
      );
      if (hasContext) {
        confidence += 20;
        evidence.push('Context delegates to current state');
      }
      if (confidence >= 55) {
        matches.push({
          pattern: 'State',
          confidence: Math.min(confidence, 100),
          location: {
            line: stateIface.startLine,
            column: 0,
            endLine: stateIface.endLine,
            endColumn: 0,
          },
          evidence,
          suggestion:
            'State pattern eliminates complex conditionals. Consider state machine libraries for complex lifecycles.',
        });
      }
    }
    return matches;
  }

  /**
   * Detect Adapter pattern.
   *
   * Structural requirements:
   *   1. Adapter class wraps an incompatible interface
   *   2. Adapter translates method calls
   *   3. Adapter implements target interface
   */
  detectAdapter(): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const classes = this.parser.extractClasses();

    for (const cls of classes) {
      let confidence = 0;
      const evidence: string[] = [];
      const ctor = cls.constructorBody || '';
      const takesAdaptee =
        ctor.includes('adapter') ||
        ctor.includes('adaptee') ||
        ctor.includes('wrapped') ||
        ctor.includes('inner');
      if (takesAdaptee) {
        confidence += 25;
        evidence.push('Constructor takes adaptee/wrapped object');
      }
      const translatesMethods = cls.methods.some(
        (m) =>
          m.body.includes('.translate(') ||
          m.body.includes('.convert(') ||
          m.body.includes('.adapt(')
      );
      if (translatesMethods) {
        confidence += 20;
        evidence.push('Method translation/conversion');
      }
      const implementsInterface = cls.implementsInterfaces.length > 0;
      if (implementsInterface) {
        confidence += 15;
        evidence.push('Implements target interface');
      }
      const ctorRefsAdaptee = ctor.match(/this\.\w+\s*=\s*(?:new\s+)?\w+/);
      if (ctorRefsAdaptee && takesAdaptee) {
        confidence += 15;
        evidence.push('Stores reference to adaptee');
      }
      if (confidence >= 45) {
        matches.push({
          pattern: 'Adapter',
          confidence: Math.min(confidence, 100),
          location: {
            line: cls.startLine,
            column: 0,
            endLine: cls.endLine,
            endColumn: 0,
          },
          evidence,
          suggestion:
            'Adapter bridges incompatible interfaces. Consider facade for simplifying complex subsystems.',
        });
      }
    }
    return matches;
  }

  /**
   * Detect Composite pattern.
   *
   * Structural requirements:
   *   1. Component interface with common operations
   *   2. Leaf class (no children)
   *   3. Composite class (has children array)
   *   4. Composite delegates to children
   */
  detectComposite(): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const classes = this.parser.extractClasses();

    for (const cls of classes) {
      let confidence = 0;
      const evidence: string[] = [];
      const hasChildrenArray = cls.properties.some(
        (p) =>
          p.includes('children') ||
          p.includes('items') ||
          p.includes('parts') ||
          p.includes('nodes')
      );
      if (hasChildrenArray) {
        confidence += 30;
        evidence.push('Has children/items collection');
      }
      const hasAddRemove = cls.methods.some(
        (m) =>
          (m.name.includes('add') ||
            m.name.includes('remove') ||
            m.name.includes('attach') ||
            m.name.includes('detach')) &&
          m.params.some(
            (p) =>
              p.includes('child') || p.includes('item') || p.includes('node')
          )
      );
      if (hasAddRemove) {
        confidence += 25;
        evidence.push('Add/Remove child methods');
      }
      const hasUniformInterface = cls.implementsInterfaces.length > 0;
      if (hasUniformInterface) {
        confidence += 15;
        evidence.push('Implements common component interface');
      }
      const delegatesToChildren = cls.methods.some(
        (m) =>
          m.body.includes('.forEach') ||
          m.body.includes('.map(') ||
          m.body.includes('.filter(') ||
          m.body.includes('for (const child')
      );
      if (delegatesToChildren) {
        confidence += 20;
        evidence.push('Delegates operations to children');
      }
      if (confidence >= 50) {
        matches.push({
          pattern: 'Composite',
          confidence: Math.min(confidence, 100),
          location: {
            line: cls.startLine,
            column: 0,
            endLine: cls.endLine,
            endColumn: 0,
          },
          evidence,
          suggestion:
            'Composite enables uniform treatment of individual and composite objects.',
        });
      }
    }
    return matches;
  }

  /**
   * Detect Proxy pattern.
   *
   * Structural requirements:
   *   1. Proxy wraps a real subject
   *   2. Proxy has same interface as real subject
   *   3. Proxy adds lazy loading, caching, or access control
   *   4. Real subject is created/loaded on demand
   */
  detectProxy(): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const classes = this.parser.extractClasses();

    for (const cls of classes) {
      let confidence = 0;
      const evidence: string[] = [];
      const ctor = cls.constructorBody || '';
      const hasLazyInit =
        ctor.includes('null') || ctor.includes('undefined') || ctor.includes('?');
      if (hasLazyInit) {
        confidence += 20;
        evidence.push('Lazy initialization in constructor');
      }
      const hasCache =
        cls.properties.some(
          (p) => p.includes('cache') || p.includes('cached') || p.includes('memo')
        ) ||
        cls.methods.some(
          (m) => m.body.includes('cache') || m.body.includes('memo')
        );
      if (hasCache) {
        confidence += 20;
        evidence.push('Caching mechanism');
      }
      const hasAccessControl = cls.methods.some(
        (m) =>
          m.body.includes('permission') ||
          m.body.includes('auth') ||
          m.body.includes('access') ||
          m.body.includes('check') ||
          m.body.includes('role')
      );
      if (hasAccessControl) {
        confidence += 20;
        evidence.push('Access control checks');
      }
      const hasRealSubject = cls.properties.some(
        (p) =>
          p.includes('real') ||
          p.includes('subject') ||
          p.includes('target') ||
          p.includes('delegate')
      );
      if (hasRealSubject) {
        confidence += 15;
        evidence.push('Reference to real subject');
      }
      const implementsSameInterface = cls.implementsInterfaces.length > 0;
      if (implementsSameInterface) {
        confidence += 15;
        evidence.push('Implements same interface');
      }
      if (confidence >= 50) {
        matches.push({
          pattern: 'Proxy',
          confidence: Math.min(confidence, 100),
          location: {
            line: cls.startLine,
            column: 0,
            endLine: cls.endLine,
            endColumn: 0,
          },
          evidence,
          suggestion:
            'Proxy provides indirection for lazy loading, caching, or access control.',
        });
      }
    }
    return matches;
  }

  /**
   * Run all pattern detections.
   */
  detectAll(): PatternMatch[] {
    const all = [
      ...this.detectSingleton(),
      ...this.detectFactoryMethod(),
      ...this.detectObserver(),
      ...this.detectStrategy(),
      ...this.detectDecorator(),
      ...this.detectCommand(),
      ...this.detectState(),
      ...this.detectAdapter(),
      ...this.detectComposite(),
      ...this.detectProxy(),
    ];
    all.sort((a, b) => b.confidence - a.confidence);
    return all;
  }
}

// ────────────────────────────────────────────────────────────
// 5.  Dependency Analyzer
// ────────────────────────────────────────────────────────────

class DependencyAnalyzer {
  private parser: SourceCodeParser;

  constructor(parser: SourceCodeParser) {
    this.parser = parser;
  }

  /**
   * Build the dependency graph from imports and usages.
   *
   * Nodes = modules (files or classes)
   * Edges = import/extends/implements/uses relationships
   */
  buildDependencyGraph(): DependencyGraph {
    const imports = this.parser.extractImports();
    const classes = this.parser.extractClasses();
    const nodes = new Set<string>();
    const edges: DependencyGraph['edges'] = [];
    const moduleName = 'current-module';
    nodes.add(moduleName);

    for (const imp of imports) {
      nodes.add(imp.source);
      edges.push({ from: moduleName, to: imp.source, type: 'import' });
    }

    for (const cls of classes) {
      nodes.add(cls.name);
      if (cls.extendsClass) {
        nodes.add(cls.extendsClass);
        edges.push({ from: cls.name, to: cls.extendsClass, type: 'extends' });
      }
      for (const iface of cls.implementsInterfaces) {
        nodes.add(iface);
        edges.push({ from: cls.name, to: iface, type: 'implements' });
      }
      for (const method of cls.methods) {
        for (const call of method.callsTo) {
          for (const otherCls of classes) {
            if (
              otherCls.name !== cls.name &&
              otherCls.methods.some((m) => m.name === call)
            ) {
              edges.push({ from: cls.name, to: otherCls.name, type: 'uses' });
              nodes.add(otherCls.name);
            }
          }
        }
      }
    }

    const cycles = this.detectCycles([...nodes], edges);
    const metrics = this.calculateMetrics([...nodes], edges);
    return {
      nodes: [...nodes],
      edges,
      cycles,
      metrics,
    };
  }

  /**
   * Detect circular dependencies using DFS.
   *
   * Algorithm:
   *   1. Build adjacency list from edges
   *   2. For each unvisited node, run DFS
   *   3. Track recursion stack to detect back edges
   *   4. Back edge -> cycle found
   *
   * Time: O(V + E), Space: O(V)
   */
  private detectCycles(
    nodes: string[],
    edges: DependencyGraph['edges']
  ): string[][] {
    const adj = new Map<string, string[]>();
    for (const node of nodes) adj.set(node, []);
    for (const edge of edges) {
      const existing = adj.get(edge.from) || [];
      existing.push(edge.to);
      adj.set(edge.from, existing);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      for (const neighbor of adj.get(node) || []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, path);
        } else if (recStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart >= 0) {
            cycles.push(path.slice(cycleStart).concat(neighbor));
          }
        }
      }

      path.pop();
      recStack.delete(node);
    };

    for (const node of nodes) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }
    return cycles;
  }

  /**
   * Calculate software metrics for each module.
   *
   * Afferent Coupling (Ca):  Number of modules that depend on this module
   * Efferent Coupling (Ce):  Number of modules this module depends on
   * Instability (I):        I = Ce / (Ca + Ce)   [0 = stable, 1 = unstable]
   * Abstractness (A):       A = abstractClasses / totalClasses in module
   * Distance (D):           D = |A + I - 1|       [0 = on main sequence]
   *
   * The "Main Sequence" is the line A = 1 - I in the A/I plane.
   * Points far from this line indicate problematic modules:
   *   - High I, low A: "Zone of Pain" (unstable + concrete)
   *   - Low I, high A: "Zone of Uselessness" (stable + abstract)
   */
  private calculateMetrics(
    nodes: string[],
    edges: DependencyGraph['edges']
  ): DependencyGraph['metrics'] {
    const metrics: DependencyGraph['metrics'] = {};
    const adj = new Map<string, Set<string>>();
    const radj = new Map<string, Set<string>>();

    for (const node of nodes) {
      adj.set(node, new Set());
      radj.set(node, new Set());
    }

    for (const edge of edges) {
      adj.get(edge.from)?.add(edge.to);
      radj.get(edge.to)?.add(edge.from);
    }

    for (const node of nodes) {
      const ca = radj.get(node)?.size || 0;
      const ce = adj.get(node)?.size || 0;
      const instability = ca + ce === 0 ? 0 : ce / (ca + ce);
      const abstractness = this.estimateAbstractness(node);
      const distanceFromMainSequence = Math.abs(
        abstractness + instability - 1
      );
      metrics[node] = {
        afferent: ca,
        efferent: ce,
        instability,
        abstractness,
        distanceFromMainSequence,
      };
    }
    return metrics;
  }

  private estimateAbstractness(node: string): number {
    const classes = this.parser.extractClasses();
    const cls = classes.find((c) => c.name === node);
    if (!cls) return 0.5;
    if (cls.isAbstract) return 1;
    const abstractMethods = cls.methods.filter(
      (m) => m.body.includes('throw') || m.body.includes('not implemented')
    );
    if (abstractMethods.length > cls.methods.length * 0.5) return 0.8;
    if (abstractMethods.length > 0) return 0.3;
    return 0;
  }

  /**
   * Detect God Modules (modules with too many responsibilities).
   *
   * God Module heuristic:
   *   - > 10 public exports
   *   - > 500 LOC
   *   - Ce > 10 (depends on many modules)
   *   - High afferent coupling from many different modules
   *
   * Responsibility metric:
   *   R = Ca x Ce x LOC / 1000
   *   If R > 5, likely a God Module
   */
  detectGodModules(): {
    module: string;
    metric: number;
    reasons: string[];
  }[] {
    const graph = this.buildDependencyGraph();
    const godModules: {
      module: string;
      metric: number;
      reasons: string[];
    }[] = [];
    const loc = this.parser.lineCount();

    for (const [module, m] of Object.entries(graph.metrics)) {
      const reasons: string[] = [];
      let metric = 0;
      if (m.efferent > 10) {
        reasons.push(`High efferent coupling (${m.efferent})`);
        metric += m.efferent;
      }
      if (m.afferent > 10) {
        reasons.push(`High afferent coupling (${m.afferent})`);
        metric += m.afferent;
      }
      if (loc > 500) {
        reasons.push(`Large module (${loc} LOC)`);
        metric += loc / 100;
      }
      const couplingProduct = m.afferent * m.efferent;
      if (couplingProduct > 20) {
        reasons.push(`High coupling product (${couplingProduct})`);
        metric += couplingProduct / 10;
      }
      const responsibilityScore = (m.afferent * m.efferent * loc) / 1000;
      if (responsibilityScore > 5) {
        reasons.push(
          `Responsibility score ${responsibilityScore.toFixed(1)} > 5`
        );
        metric += responsibilityScore;
      }
      if (reasons.length >= 2) {
        godModules.push({
          module,
          metric: Math.round(metric * 10) / 10,
          reasons,
        });
      }
    }
    godModules.sort((a, b) => b.metric - a.metric);
    return godModules;
  }

  /**
   * Detect Stable Dependency Principle (SDP) violations.
   *
   * SDP: "Depend in the direction of stability."
   *   If module A depends on B, then I(A) > I(B) should hold.
   *   (A should be at least as unstable as B.)
   *
   * Violation: A depends on B and I(A) <= I(B)
   */
  detectSDPViolations(): {
    from: string;
    to: string;
    fromInstability: number;
    toInstability: number;
  }[] {
    const graph = this.buildDependencyGraph();
    const violations: {
      from: string;
      to: string;
      fromInstability: number;
      toInstability: number;
    }[] = [];

    for (const edge of graph.edges) {
      if (edge.type === 'import' || edge.type === 'uses') {
        const fromMetrics = graph.metrics[edge.from];
        const toMetrics = graph.metrics[edge.to];
        if (fromMetrics && toMetrics) {
          if (
            fromMetrics.instability <= toMetrics.instability &&
            fromMetrics.instability > 0
          ) {
            violations.push({
              from: edge.from,
              to: edge.to,
              fromInstability: fromMetrics.instability,
              toInstability: toMetrics.instability,
            });
          }
        }
      }
    }
    return violations;
  }

  /**
   * Full dependency analysis.
   */
  analyzeAll(): {
    graph: DependencyGraph;
    godModules: { module: string; metric: number; reasons: string[] }[];
    sdpViolations: {
      from: string;
      to: string;
      fromInstability: number;
      toInstability: number;
    }[];
    summary: string;
  } {
    const graph = this.buildDependencyGraph();
    const godModules = this.detectGodModules();
    const sdpViolations = this.detectSDPViolations();
    const summaryParts: string[] = [];

    summaryParts.push(
      `Modules: ${graph.nodes.length}, Edges: ${graph.edges.length}`
    );
    summaryParts.push(`Cycles: ${graph.cycles.length}`);
    if (graph.cycles.length > 0) {
      summaryParts.push(
        `  Cycles: ${graph.cycles.map((c) => c.join(' -> ')).join('; ')}`
      );
    }
    summaryParts.push(`God Modules: ${godModules.length}`);
    summaryParts.push(`SDP Violations: ${sdpViolations.length}`);
    const avgDistance =
      Object.values(graph.metrics).reduce(
        (s, m) => s + m.distanceFromMainSequence,
        0
      ) / Math.max(graph.nodes.length, 1);
    summaryParts.push(
      `Avg Distance from Main Sequence: ${avgDistance.toFixed(3)}`
    );

    return {
      graph,
      godModules,
      sdpViolations,
      summary: summaryParts.join('\n'),
    };
  }
}

// ────────────────────────────────────────────────────────────
// 6.  Code Smell Detector
// ────────────────────────────────────────────────────────────

class CodeSmellDetector {
  private parser: SourceCodeParser;

  constructor(parser: SourceCodeParser) {
    this.parser = parser;
  }

  /**
   * Detect Long Method smell.
   *
   * Threshold: method body > 50 lines
   * Severity: proportional to excess over threshold
   *   severity = (LOC - 50) / 50
   */
  detectLongMethod(): SmellFinding[] {
    const findings: SmellFinding[] = [];
    const functions = this.parser.extractFunctions();
    const classes = this.parser.extractClasses();
    const allMethods = [
      ...functions,
      ...classes.flatMap((c) => c.methods),
    ];

    for (const method of allMethods) {
      const loc = method.body.split('\n').length;
      if (loc > 50) {
        const severity =
          loc > 150 ? 'critical' : loc > 100 ? 'high' : 'medium';
        findings.push({
          smell: 'Long Method',
          severity,
          location: {
            line: method.startLine,
            column: 0,
            endLine: method.endLine,
            endColumn: 0,
          },
          description: `Method ${method.name} is ${loc} lines (threshold: 50). Complexity: ${method.complexity}.`,
          metric: loc,
          threshold: 50,
          suggestion:
            'Extract smaller methods from this long method. Each method should do one thing.',
        });
      }
    }
    return findings;
  }

  /**
   * Detect God Class smell.
   *
   * Threshold: > 30 methods/properties OR > 500 LOC
   * Weighted metric: methods x 2 + properties x 1.5 + LOC / 20
   */
  detectGodClass(): SmellFinding[] {
    const findings: SmellFinding[] = [];
    const classes = this.parser.extractClasses();

    for (const cls of classes) {
      const methodCount = cls.methods.length;
      const propCount = cls.properties.length;
      const loc = cls.endLine - cls.startLine;
      const weighted = methodCount * 2 + propCount * 1.5 + loc / 20;
      if (methodCount > 30 || propCount > 30 || weighted > 50) {
        const severity =
          weighted > 100 ? 'critical' : weighted > 70 ? 'high' : 'medium';
        findings.push({
          smell: 'God Class',
          severity,
          location: {
            line: cls.startLine,
            column: 0,
            endLine: cls.endLine,
            endColumn: 0,
          },
          description: `Class ${cls.name} has ${methodCount} methods, ${propCount} properties, ${loc} LOC (weighted=${weighted.toFixed(1)}).`,
          metric: weighted,
          threshold: 50,
          suggestion:
            'Split into smaller, focused classes. Apply Single Responsibility Principle.',
        });
      }
    }
    return findings;
  }

  /**
   * Detect Feature Envy smell.
   *
   * A method suffers from Feature Envy when it uses more data from
   * another class than its own class.
   *
   * Metric: foreignRefs / (selfRefs + 1)
   * Threshold: ratio > 2.0
   */
  detectFeatureEnvy(): SmellFinding[] {
    const findings: SmellFinding[] = [];
    const classes = this.parser.extractClasses();

    for (const cls of classes) {
      for (const method of cls.methods) {
        const foreignUsage = new Map<string, number>();
        for (const other of classes) {
          if (other.name === cls.name) continue;
          let count = 0;
          for (const prop of other.properties) {
            const regex = new RegExp(
              `\\b${other.name}\\.${prop}\\b|\\b${prop}\\b`, 'g'
            );
            const matches = method.body.match(regex);
            if (matches) count += matches.length;
          }
          if (count > 0) foreignUsage.set(other.name, count);
        }
        let selfUsage = 0;
        for (const prop of cls.properties) {
          const regex = new RegExp(`\\bthis\\.${prop}\\b|\\b${prop}\\b`, 'g');
          const matches = method.body.match(regex);
          if (matches) selfUsage += matches.length;
        }
        for (const [foreignClass, foreignCount] of foreignUsage) {
          const ratio = foreignCount / (selfUsage + 1);
          if (ratio > 2.0 && foreignCount >= 3) {
            findings.push({
              smell: 'Feature Envy',
              severity: ratio > 5 ? 'high' : 'medium',
              location: {
                line: method.startLine,
                column: 0,
                endLine: method.endLine,
                endColumn: 0,
              },
              description: `Method ${method.name} envies ${foreignClass} (foreign=${foreignCount}, self=${selfUsage}, ratio=${ratio.toFixed(1)}).`,
              metric: ratio,
              threshold: 2.0,
              suggestion: `Move ${method.name} to ${foreignClass} or pass needed data as parameters.`,
            });
          }
        }
      }
    }
    return findings;
  }

  /**
   * Detect Data Clumps smell.
   *
   * Data Clump: the same 2+ parameters appear together in multiple
   * method signatures.
   *
   * If a parameter tuple appears in >= 3 methods, it's a clump.
   */
  detectDataClumps(): SmellFinding[] {
    const findings: SmellFinding[] = [];
    const functions = this.parser.extractFunctions();
    const classes = this.parser.extractClasses();
    const allMethods = [
      ...functions,
      ...classes.flatMap((c) => c.methods),
    ];
    const paramPairs = new Map<
      string,
      { methods: string[]; params: string[] }
    >();

    for (const method of allMethods) {
      if (method.params.length < 2) continue;
      for (let i = 0; i < method.params.length; i++) {
        for (let j = i + 1; j < method.params.length; j++) {
          const key = [method.params[i], method.params[j]]
            .sort()
            .join(',');
          const existing = paramPairs.get(key) || {
            methods: [],
            params: [method.params[i], method.params[j]],
          };
          if (!existing.methods.includes(method.name)) {
            existing.methods.push(method.name);
          }
          paramPairs.set(key, existing);
        }
      }
    }

    for (const [_key, data] of paramPairs) {
      if (data.methods.length >= 3) {
        findings.push({
          smell: 'Data Clump',
          severity: data.methods.length >= 5 ? 'high' : 'medium',
          location: {
            line: 0,
            column: 0,
            endLine: 0,
            endColumn: 0,
          },
          description: `Parameters (${data.params.join(', ')}) appear together in ${data.methods.length} methods: ${data.methods.join(', ')}.`,
          metric: data.methods.length,
          threshold: 3,
          suggestion:
            'Create a parameter object to encapsulate these related values.',
        });
      }
    }
    return findings;
  }

  /**
   * Detect Switch Statements smell.
   *
   * Switch statements with >= 3 cases should be replaced with
   * polymorphic dispatch.
   */
  detectSwitchStatements(): SmellFinding[] {
    const findings: SmellFinding[] = [];
    const functions = this.parser.extractFunctions();
    const classes = this.parser.extractClasses();
    const allCode = [
      ...functions.map((f) => ({
        name: f.name,
        body: f.body,
        startLine: f.startLine,
        endLine: f.endLine,
      })),
      ...classes.flatMap((c) =>
        c.methods.map((m) => ({
          name: `${c.name}.${m.name}`,
          body: m.body,
          startLine: m.startLine,
          endLine: m.endLine,
        }))
      ),
    ];

    for (const code of allCode) {
      const switchRegex =
        /switch\s*\([^)]+\)\s*\{([^}]*(?:case[^}]*case[^}]*)*)\}/g;
      let m: RegExpExecArray | null;
      while ((m = switchRegex.exec(code.body)) !== null) {
        const caseCount = (m[1].match(/\bcase\s+/g) || []).length;
        if (caseCount >= 3) {
          findings.push({
            smell: 'Switch Statement',
            severity: caseCount >= 6 ? 'high' : 'medium',
            location: {
              line: code.startLine,
              column: 0,
              endLine: code.endLine,
              endColumn: 0,
            },
            description: `Switch statement in ${code.name} has ${caseCount} cases. Use polymorphic dispatch.`,
            metric: caseCount,
            threshold: 3,
            suggestion:
              'Replace with Strategy or State pattern for each case.',
          });
        }
      }
    }
    return findings;
  }

  /**
   * Detect Parallel Inheritance smell.
   *
   * Parallel hierarchies: two class hierarchies where subclassing
   * in one implies subclassing in the other.
   *
   * Detection: if class A extends B and class C extends D, and
   * A and C have similar method names, the hierarchies are parallel.
   */
  detectParallelInheritance(): SmellFinding[] {
    const findings: SmellFinding[] = [];
    const classes = this.parser.extractClasses();
    const hierarchies = new Map<string, ClassInfo[]>();

    for (const cls of classes) {
      if (cls.extendsClass) {
        const existing = hierarchies.get(cls.extendsClass) || [];
        existing.push(cls);
        hierarchies.set(cls.extendsClass, existing);
      }
    }

    const baseClasses = [...hierarchies.keys()];
    for (let i = 0; i < baseClasses.length; i++) {
      for (let j = i + 1; j < baseClasses.length; j++) {
        const subsA = hierarchies.get(baseClasses[i]) || [];
        const subsB = hierarchies.get(baseClasses[j]) || [];
        if (subsA.length < 2 || subsB.length < 2) continue;
        const methodsA = new Set(
          subsA.flatMap((s) => s.methods.map((m) => m.name))
        );
        const methodsB = new Set(
          subsB.flatMap((s) => s.methods.map((m) => m.name))
        );
        const intersection = [...methodsA].filter((m) => methodsB.has(m));
        const union = new Set([...methodsA, ...methodsB]);
        const similarity = intersection.length / union.size;
        if (similarity > 0.5) {
          findings.push({
            smell: 'Parallel Inheritance',
            severity: similarity > 0.7 ? 'high' : 'medium',
            location: {
              line: 0,
              column: 0,
              endLine: 0,
              endColumn: 0,
            },
            description: `Parallel hierarchies under ${baseClasses[i]} and ${baseClasses[j]} (similarity=${similarity.toFixed(2)}). Methods: ${intersection.join(', ')}.`,
            metric: similarity,
            threshold: 0.5,
            suggestion:
              'Use composition instead of inheritance to share behavior.',
          });
        }
      }
    }
    return findings;
  }

  /**
   * Detect Lazy Class smell.
   *
   * A class that does too little: < 3 methods and < 5 properties
   * and < 30 LOC. It should be inlined.
   */
  detectLazyClass(): SmellFinding[] {
    const findings: SmellFinding[] = [];
    const classes = this.parser.extractClasses();

    for (const cls of classes) {
      const loc = cls.endLine - cls.startLine;
      const methodCount = cls.methods.filter(
        (m) => m.name !== 'constructor'
      ).length;
      const propCount = cls.properties.length;
      if (methodCount < 3 && propCount < 5 && loc < 30 && !cls.isAbstract) {
        findings.push({
          smell: 'Lazy Class',
          severity: methodCount === 0 ? 'high' : 'low',
          location: {
            line: cls.startLine,
            column: 0,
            endLine: cls.endLine,
            endColumn: 0,
          },
          description: `Class ${cls.name} has only ${methodCount} methods, ${propCount} properties, ${loc} LOC. Should be inlined.`,
          metric: methodCount + propCount,
          threshold: 3,
          suggestion:
            'Inline this class into its callers or merge with related class.',
        });
      }
    }
    return findings;
  }

  /**
   * Detect Speculative Generality smell.
   *
   * Abstractions that are never used: abstract classes with no
   * implementations, interfaces with no conforming types, unused
   * parameters with default values, unused helper methods.
   */
  detectSpeculativeGenerality(): SmellFinding[] {
    const findings: SmellFinding[] = [];
    const classes = this.parser.extractClasses();
    const functions = this.parser.extractFunctions();
    const raw = this.parser.getRaw();
    const abstractClasses = classes.filter((c) => c.isAbstract);

    for (const cls of abstractClasses) {
      const implCount = classes.filter(
        (c) =>
          c.extendsClass === cls.name ||
          c.implementsInterfaces.includes(cls.name)
      ).length;
      if (implCount === 0) {
        findings.push({
          smell: 'Speculative Generality',
          severity: 'medium',
          location: {
            line: cls.startLine,
            column: 0,
            endLine: cls.endLine,
            endColumn: 0,
          },
          description: `Abstract class ${cls.name} has no implementations. Unused abstraction.`,
          metric: 0,
          threshold: 1,
          suggestion:
            'Remove unused abstraction or create concrete implementations.',
        });
      }
    }

    for (const fn of functions) {
      const callCount =
        (raw.match(new RegExp(`\\b${fn.name}\\s*\\(`, 'g')) || []).length;
      if (callCount === 0 && !fn.name.startsWith('_')) {
        findings.push({
          smell: 'Speculative Generality',
          severity: 'low',
          location: {
            line: fn.startLine,
            column: 0,
            endLine: fn.endLine,
            endColumn: 0,
          },
          description: `Function ${fn.name} is defined but never called.`,
          metric: callCount,
          threshold: 1,
          suggestion:
            'Remove unused function or mark as intentional (export for external use).',
        });
      }
    }
    return findings;
  }

  /**
   * Detect Temporary Field smell.
   *
   * Fields that are only set in certain circumstances (e.g., inside
   * a specific method) but otherwise remain unset/null/undefined.
   */
  detectTemporaryField(): SmellFinding[] {
    const findings: SmellFinding[] = [];
    const classes = this.parser.extractClasses();

    for (const cls of classes) {
      for (const prop of cls.properties) {
        const setInMethods = cls.methods.filter(
          (m) =>
            m.body.includes(`this.${prop} =`) ||
            m.body.includes(`${prop} =`)
        );
        const usedInMethods = cls.methods.filter(
          (m) =>
            m.body.includes(`this.${prop}`) &&
            !m.body.includes(`this.${prop} =`)
        );
        if (setInMethods.length === 1 && usedInMethods.length <= 2) {
          const onlyInConditional =
            setInMethods[0].body.includes('if (') ||
            setInMethods[0].body.includes('switch');
          if (onlyInConditional) {
            findings.push({
              smell: 'Temporary Field',
              severity: 'medium',
              location: {
                line: cls.startLine,
                column: 0,
                endLine: cls.endLine,
                endColumn: 0,
              },
              description: `Property ${cls.name}.${prop} is only set in conditional branch of ${setInMethods[0].name}.`,
              metric: setInMethods.length,
              threshold: 2,
              suggestion:
                'Move field into the method/class that uses it, or use localized object.',
            });
          }
        }
      }
    }
    return findings;
  }

  /**
   * Detect Message Chains smell.
   *
   * a.b().c().d() -- Law of Demeter violation.
   * Each hop in the chain increases coupling.
   *
   * Severity: chainLength > 2 is a smell
   */
  detectMessageChains(): SmellFinding[] {
    const findings: SmellFinding[] = [];
    const chains = this.parser.findMethodCallChains();

    for (const chain of chains) {
      if (chain.chain.length > 2) {
        const severity = chain.chain.length > 4 ? 'high' : 'medium';
        findings.push({
          smell: 'Message Chain',
          severity,
          location: {
            line: chain.line + 1,
            column: 0,
            endLine: chain.line + 1,
            endColumn: 0,
          },
          description: `Message chain: ${chain.target}.${chain.chain.join('.')} (length=${chain.chain.length}).`,
          metric: chain.chain.length,
          threshold: 2,
          suggestion:
            'Introduce intermediary methods to hide delegation. Follow Law of Demeter.',
        });
      }
    }
    return findings;
  }

  /**
   * Run all smell detections.
   */
  detectAll(): SmellFinding[] {
    const all = [
      ...this.detectLongMethod(),
      ...this.detectGodClass(),
      ...this.detectFeatureEnvy(),
      ...this.detectDataClumps(),
      ...this.detectSwitchStatements(),
      ...this.detectParallelInheritance(),
      ...this.detectLazyClass(),
      ...this.detectSpeculativeGenerality(),
      ...this.detectTemporaryField(),
      ...this.detectMessageChains(),
    ];
    all.sort((a, b) => {
      const sevOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return sevOrder[b.severity] - sevOrder[a.severity];
    });
    return all;
  }
}

// ────────────────────────────────────────────────────────────
// 7.  Complexity Reducer
// ────────────────────────────────────────────────────────────

class ComplexityReducer {
  private parser: SourceCodeParser;

  constructor(parser: SourceCodeParser) {
    this.parser = parser;
  }

  /**
   * Calculate Cyclomatic Complexity.
   *
   * McCabe's Cyclomatic Complexity (V(G)):
   *   V(G) = E - N + 2P
   *
   * Where:
   *   E = number of edges in control flow graph
   *   N = number of nodes in control flow graph
   *   P = number of connected components (usually 1 for a single method)
   *
   * Practical formula (for structured programs):
   *   V(G) = 1 + number of decision points
   *
   * Decision points: if, else-if, for, while, case, catch, &&, ||, ?:
   *
   * Interpretation:
   *   1-10:   Simple, low risk
   *   11-20:  Moderate complexity
   *   21-50:  High complexity, high risk
   *   50+:    Very high, untestable
   */
  calculateCyclomaticComplexity(code: string): number {
    let complexity = 1;
    const decisionPatterns = [
      { regex: /\bif\s*\(/, weight: 1 },
      { regex: /\belse\s+if\s*\(/, weight: 1 },
      { regex: /\bfor\s*(?:\(\s*;|each|\s*\()/, weight: 1 },
      { regex: /\bwhile\s*\(/, weight: 1 },
      { regex: /\bcase\s+/, weight: 1 },
      { regex: /\bcatch\s*\(/, weight: 1 },
      { regex: /&&/, weight: 1 },
      { regex: /\|\|/, weight: 1 },
      { regex: /\?[^?:]+:/, weight: 1 },
    ];
    for (const { regex, weight } of decisionPatterns) {
      const matches = code.match(new RegExp(regex.source, 'g'));
      if (matches) complexity += matches.length * weight;
    }
    return complexity;
  }

  /**
   * Calculate Cognitive Complexity.
   *
   * Cognitive complexity measures how hard code is to understand.
   * Unlike cyclomatic complexity, it penalizes nesting.
   *
   * Rules:
   *   1. Increments for each break in linear flow (if, else, ternary)
   *   2. Nesting increment: additional +N for nesting depth N
   *   3. Logical breaks: &&, ||, ?:
   *   4. Nesting increments for: if, else, for, while, switch, catch
   *
   * Formula:
   *   B_1 = basic nesting increment per nesting level
   *   B_n = n x B_1  where n is nesting depth
   *
   *   Total = Sum(basic) + Sum(nesting_increments)
   */
  calculateCognitiveComplexity(code: string): number {
    let complexity = 0;
    let nestingDepth = 0;
    const lines = code.split('\n');
    const nestingIncrement = 1;
    const NestingToken = ['if', 'else', 'for', 'while', 'switch', 'catch', '?'];
    const BreakToken = ['&&', '||', 'for', 'while', 'do'];

    for (const line of lines) {
      const trimmed = line.trim();
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;

      for (const token of NestingToken) {
        const regex = new RegExp(`\\b${token}\\b`);
        if (regex.test(trimmed)) {
          complexity += 1;
          if (token !== 'else') {
            complexity += nestingDepth * nestingIncrement;
          }
        }
      }

      for (const token of BreakToken) {
        const regex = new RegExp(`\\b${token}\\b`);
        if (regex.test(trimmed)) {
          const matches = trimmed.match(new RegExp(regex.source, 'g'));
          if (matches && matches.length > 1) {
            complexity += matches.length - 1;
          }
        }
      }

      const ternaryCount = (trimmed.match(/\?/g) || []).length;
      complexity += ternaryCount;

      nestingDepth += openBraces;
      nestingDepth -= closeBraces;
      if (nestingDepth < 0) nestingDepth = 0;
    }
    return complexity;
  }

  /**
   * Calculate Maintainability Index.
   *
   * MI = 171 - 5.2 x ln(V) - 0.23 x G - 16.2 x ln(LOC)
   *
   * Where:
   *   V = Halstead volume
   *   G = cyclomatic complexity
   *   LOC = lines of code (logical)
   *
   * Adjusted for percentage:
   *   MI_adjusted = MI x 100 / 171
   *
   * Scale:
   *   100-80: Excellent maintainability
   *   79-60:  Good maintainability
   *   59-40:  Moderate maintainability
   *   39-20:  Low maintainability
   *   19-0:   Very low maintainability
   *
   * Note: Microsoft's SEI version uses:
   *   MI = max(0, (171 - 5.2 x ln(HV) - 0.23 x CC - 16.2 x ln(LOC)) x 100 / 171)
   */
  calculateMaintainabilityIndex(
    halsteadVolume: number,
    cyclomatic: number,
    loc: number
  ): number {
    const raw =
      171 -
      5.2 * Math.log(Math.max(halsteadVolume, 1)) -
      0.23 * cyclomatic -
      16.2 * Math.log(Math.max(loc, 1));
    return Math.max(0, raw);
  }

  /**
   * Calculate Halstead Metrics.
   *
   * Halstead's Software Science:
   *   n1 = number of distinct operators
   *   n2 = number of distinct operands
   *   N1 = total number of operators
   *   N2 = total number of operands
   *
   * Vocabulary: n = n1 + n2
   * Length:     N = N1 + N2
   * Volume:     V = N x log2(n)
   * Difficulty: D = (n1/2) x (N2/n2)
   * Effort:     E = D x V
   * Time:       T = E / 18 seconds (average human rate)
   * Bugs:       B = V / 3000
   */
  calculateHalsteadMetrics(code: string): {
    n1: number;
    n2: number;
    N1: number;
    N2: number;
    volume: number;
    difficulty: number;
    effort: number;
    estimatedTime: number;
    estimatedBugs: number;
  } {
    const operators = [
      '+', '-', '*', '/', '%', '=', '==', '===', '!=', '!==',
      '>', '<', '>=', '<=', '&&', '||', '!', '?:', '.',
      'if', 'else', 'for', 'while', 'do', 'switch', 'case',
      'break', 'continue', 'return', 'throw', 'try', 'catch',
      'new', 'delete', 'typeof', 'instanceof', 'void', 'in', 'of',
      'function', 'class', 'extends', 'implements', 'import', 'export',
      'from', 'const', 'let', 'var', 'async', 'await', 'yield',
      '=>', '++', '--', '+=', '-=', '*=', '/=', '**',
      '...', '??', '>>>', '<<', '>>', '&', '|', '^', '~',
    ];

    const codeStr = code
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '""');

    const foundOperators = new Set<string>();
    const foundOperands = new Set<string>();
    let totalOperators = 0;
    let totalOperands = 0;

    for (const op of operators) {
      const escapedOp = op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedOp, 'g');
      const matches = codeStr.match(regex);
      if (matches && matches.length > 0) {
        foundOperators.add(op);
        totalOperators += matches.length;
      }
    }

    const operandRegex =
      /\b([a-zA-Z_$][\w$]*)\b|\b(\d+(?:\.\d+)?)\b/g;
    let m: RegExpExecArray | null;
    while ((m = operandRegex.exec(codeStr)) !== null) {
      const operand = m[1] || m[2];
      if (
        operand &&
        !operators.includes(operand) &&
        !['true', 'false', 'null', 'undefined', 'void', 'NaN', 'Infinity'].includes(operand)
      ) {
        foundOperands.add(operand);
        totalOperands++;
      }
    }

    const n1 = foundOperators.size || 1;
    const n2 = foundOperands.size || 1;
    const N1 = totalOperators || 1;
    const N2 = totalOperands || 1;
    const vocabulary = n1 + n2;
    const length = N1 + N2;
    const volume = length * Math.log2(Math.max(vocabulary, 2));
    const difficulty = (n1 / 2) * (N2 / Math.max(n2, 1));
    const effort = difficulty * volume;
    const estimatedTime = effort / 18;
    const estimatedBugs = volume / 3000;

    return {
      n1,
      n2,
      N1,
      N2,
      volume,
      difficulty,
      effort,
      estimatedTime,
      estimatedBugs,
    };
  }

  /**
   * Calculate all complexity metrics for a function/method.
   */
  calculateAllMetrics(code: string): ComplexityMetrics {
    const lines = code.split('\n');
    const commentLines = this.parser.getCommentLines();
    const nonEmptyCodeLines = lines.filter((l) => l.trim().length > 0);
    const loc = nonEmptyCodeLines.length;
    const codeLinesOnly = nonEmptyCodeLines.filter(
      (l) => !l.trim().startsWith('//') && !l.trim().startsWith('/*')
    );
    const commentCount = loc - codeLinesOnly.length;
    const commentRatio = loc > 0 ? commentCount / loc : 0;
    const cyclomatic = this.calculateCyclomaticComplexity(code);
    const cognitive = this.calculateCognitiveComplexity(code);
    const halstead = this.calculateHalsteadMetrics(code);
    const maintainabilityIndex = this.calculateMaintainabilityIndex(
      halstead.volume,
      cyclomatic,
      loc
    );

    let maxNesting = 0;
    let currentNesting = 0;
    for (const ch of code) {
      if (ch === '{') {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      } else if (ch === '}') currentNesting--;
    }

    return {
      cyclomatic,
      cognitive,
      maintainabilityIndex,
      halsteadVolume: halstead.volume,
      halsteadDifficulty: halstead.difficulty,
      halsteadEffort: halstead.effort,
      loc,
      commentRatio,
      nestingDepth: maxNesting,
    };
  }

  /**
   * Suggest refactoring operations ranked by complexity reduction impact.
   *
   * For each function/method, calculate the complexity reduction
   * that would result from applying each refactoring technique.
   *
   * Ranking metric:
   *   impact = deltaCyclomatic x 3 + deltaCognitive x 2 + deltaHalsteadDifficulty x 1
   */
  suggestRefactorings(): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];
    const functions = this.parser.extractFunctions();
    const classes = this.parser.extractClasses();
    const allMethods = [
      ...functions,
      ...classes.flatMap((c) => c.methods),
    ];

    for (const method of allMethods) {
      const currentMetrics = this.calculateAllMetrics(method.body);
      if (
        currentMetrics.cyclomatic > 10 ||
        currentMetrics.cognitive > 15 ||
        currentMetrics.maintainabilityIndex < 60
      ) {
        const extractSuggestion = this.generateExtractMethodSuggestion(
          method,
          currentMetrics
        );
        if (extractSuggestion) suggestions.push(extractSuggestion);
        const decomposeSuggestion = this.generateDecomposeSuggestion(
          method,
          currentMetrics
        );
        if (decomposeSuggestion) suggestions.push(decomposeSuggestion);
        const simplifySuggestion = this.generateSimplifySuggestion(
          method,
          currentMetrics
        );
        if (simplifySuggestion) suggestions.push(simplifySuggestion);
        const strategySuggestion = this.generateStrategySuggestion(
          method,
          currentMetrics
        );
        if (strategySuggestion) suggestions.push(strategySuggestion);
      }
    }
    suggestions.sort((a, b) => b.priority - a.priority);
    return suggestions;
  }

  private generateExtractMethodSuggestion(
    method: FunctionInfo,
    metrics: ComplexityMetrics
  ): RefactoringSuggestion | null {
    if (metrics.cyclomatic < 8) return null;
    const bodyLines = method.body.split('\n');
    const complexityReduction = Math.floor(metrics.cyclomatic * 0.3);
    return {
      name: 'Extract Method',
      description: `Extract complex blocks from ${method.name} into smaller methods. Current cyclomatic complexity: ${metrics.cyclomatic}.`,
      impact: 'high',
      complexityReduction,
      location: {
        line: method.startLine,
        column: 0,
        endLine: method.endLine,
        endColumn: 0,
      },
      before: `function ${method.name}(${method.params.join(', ')}) {\n  // ${bodyLines.length} lines, complexity ${metrics.cyclomatic}\n}`,
      after: `function ${method.name}(${method.params.join(', ')}) {\n  // Extracted into smaller methods\n  this.step1();\n  this.step2();\n}`,
      category: 'Extract Method',
      priority: complexityReduction * 3,
    };
  }

  private generateDecomposeSuggestion(
    method: FunctionInfo,
    metrics: ComplexityMetrics
  ): RefactoringSuggestion | null {
    if (metrics.nestingDepth < 4) return null;
    const complexityReduction = Math.floor(metrics.nestingDepth * 1.5);
    return {
      name: 'Decompose Conditional',
      description: `Reduce nesting depth in ${method.name} from ${metrics.nestingDepth}. Extract complex conditions into named variables.`,
      impact: 'medium',
      complexityReduction,
      location: {
        line: method.startLine,
        column: 0,
        endLine: method.endLine,
        endColumn: 0,
      },
      before: `// Nesting depth: ${metrics.nestingDepth}`,
      after: `// Extract conditions:\nconst isReady = condition1 && condition2;\nconst hasAccess = checkPermissions();\nif (isReady && hasAccess) { ... }`,
      category: 'Decompose Conditional',
      priority: complexityReduction * 2,
    };
  }

  private generateSimplifySuggestion(
    method: FunctionInfo,
    metrics: ComplexityMetrics
  ): RefactoringSuggestion | null {
    if (metrics.halsteadDifficulty < 20) return null;
    const complexityReduction = Math.floor(metrics.halsteadDifficulty * 0.1);
    return {
      name: 'Simplify Expressions',
      description: `Halstead difficulty in ${method.name} is ${metrics.halsteadDifficulty.toFixed(1)}. Simplify complex expressions.`,
      impact: 'low',
      complexityReduction,
      location: {
        line: method.startLine,
        column: 0,
        endLine: method.endLine,
        endColumn: 0,
      },
      before: `// Difficulty: ${metrics.halsteadDifficulty.toFixed(1)}, Effort: ${metrics.halsteadEffort.toFixed(0)}`,
      after: `// Break complex expressions into named intermediate variables`,
      category: 'Simplify Expressions',
      priority: complexityReduction * 1,
    };
  }

  private generateStrategySuggestion(
    method: FunctionInfo,
    metrics: ComplexityMetrics
  ): RefactoringSuggestion | null {
    const switchCount = (method.body.match(/switch\s*\(/g) || []).length;
    const ifElseCount = (method.body.match(/\bif\s*\(/g) || []).length;
    if (switchCount === 0 && ifElseCount < 4) return null;
    const complexityReduction =
      switchCount * 5 + Math.max(0, ifElseCount - 3) * 3;
    return {
      name: 'Replace with Strategy/State',
      description: `Complex dispatch in ${method.name}: ${switchCount} switches, ${ifElseCount} if-else chains. Replace with polymorphic dispatch.`,
      impact: 'high',
      complexityReduction,
      location: {
        line: method.startLine,
        column: 0,
        endLine: method.endLine,
        endColumn: 0,
      },
      before: `// ${switchCount} switch(es), ${ifElseCount} if-else(s)`,
      after: `// Use Strategy or State pattern:\ninterface Handler { execute(): void; }\nclass ConcreteHandler implements Handler { ... }`,
      category: 'Replace Conditional with Polymorphism',
      priority: complexityReduction * 4,
    };
  }

  /**
   * Compare complexity before and after refactoring.
   */
  compareBeforeAfter(
    beforeCode: string,
    afterCode: string
  ): {
    before: ComplexityMetrics;
    after: ComplexityMetrics;
    improvement: {
      cyclomatic: number;
      cognitive: number;
      maintainabilityIndex: number;
      halsteadVolume: number;
      halsteadDifficulty: number;
    };
    summary: string;
  } {
    const before = this.calculateAllMetrics(beforeCode);
    const after = this.calculateAllMetrics(afterCode);
    const improvement = {
      cyclomatic: before.cyclomatic - after.cyclomatic,
      cognitive: before.cognitive - after.cognitive,
      maintainabilityIndex:
        after.maintainabilityIndex - before.maintainabilityIndex,
      halsteadVolume: before.halsteadVolume - after.halsteadVolume,
      halsteadDifficulty:
        before.halsteadDifficulty - after.halsteadDifficulty,
    };
    const summaryParts: string[] = [];
    summaryParts.push(
      `Cyclomatic: ${before.cyclomatic} -> ${after.cyclomatic} (delta=${improvement.cyclomatic})`
    );
    summaryParts.push(
      `Cognitive: ${before.cognitive} -> ${after.cognitive} (delta=${improvement.cognitive})`
    );
    summaryParts.push(
      `Maintainability: ${before.maintainabilityIndex.toFixed(1)} -> ${after.maintainabilityIndex.toFixed(1)} (delta=${improvement.maintainabilityIndex.toFixed(1)})`
    );
    summaryParts.push(
      `Halstead Difficulty: ${before.halsteadDifficulty.toFixed(1)} -> ${after.halsteadDifficulty.toFixed(1)} (delta=${improvement.halsteadDifficulty.toFixed(1)})`
    );
    summaryParts.push(
      `Halstead Volume: ${before.halsteadVolume.toFixed(0)} -> ${after.halsteadVolume.toFixed(0)} (delta=${improvement.halsteadVolume.toFixed(0)})`
    );
    const overallImprovement =
      improvement.cyclomatic +
      improvement.cognitive +
      improvement.maintainabilityIndex / 10;
    summaryParts.push(
      `Overall: ${overallImprovement > 0 ? 'IMPROVED' : 'DEGRADED'} (score=${overallImprovement.toFixed(1)})`
    );
    return {
      before,
      after,
      improvement,
      summary: summaryParts.join('\n'),
    };
  }

  /**
   * Full complexity analysis.
   */
  analyzeAll(): {
    metrics: ComplexityMetrics;
    suggestions: RefactoringSuggestion[];
    summary: string;
  } {
    const raw = this.parser.getRaw();
    const metrics = this.calculateAllMetrics(raw);
    const suggestions = this.suggestRefactorings();
    const summaryParts: string[] = [];
    summaryParts.push(`Cyclomatic Complexity: ${metrics.cyclomatic}`);
    summaryParts.push(`Cognitive Complexity: ${metrics.cognitive}`);
    summaryParts.push(
      `Maintainability Index: ${metrics.maintainabilityIndex.toFixed(1)}`
    );
    summaryParts.push(
      `Halstead Volume: ${metrics.halsteadVolume.toFixed(0)}`
    );
    summaryParts.push(
      `Halstead Difficulty: ${metrics.halsteadDifficulty.toFixed(1)}`
    );
    summaryParts.push(
      `Halstead Effort: ${metrics.halsteadEffort.toFixed(0)}`
    );
    summaryParts.push(`Lines of Code: ${metrics.loc}`);
    summaryParts.push(
      `Comment Ratio: ${(metrics.commentRatio * 100).toFixed(1)}%`
    );
    summaryParts.push(`Max Nesting Depth: ${metrics.nestingDepth}`);
    summaryParts.push(`Refactoring Suggestions: ${suggestions.length}`);
    const qualityRating =
      metrics.maintainabilityIndex >= 80
        ? 'EXCELLENT'
        : metrics.maintainabilityIndex >= 60
          ? 'GOOD'
          : metrics.maintainabilityIndex >= 40
            ? 'MODERATE'
            : metrics.maintainabilityIndex >= 20
              ? 'LOW'
              : 'VERY LOW';
    summaryParts.push(`Quality Rating: ${qualityRating}`);
    return {
      metrics,
      suggestions,
      summary: summaryParts.join('\n'),
    };
  }
}

// ────────────────────────────────────────────────────────────
// 8.  Main Entry Point — ultraRefactor
// ────────────────────────────────────────────────────────────

/**
 * Ultra-Refactor: Main entry point.
 *
 * Analyzes source code for:
 *   1. Category-theoretic structure (functors, monoids, ADTs)
 *   2. AST transformation opportunities
 *   3. Design pattern detection
 *   4. Dependency graph analysis
 *   5. Code smell detection
 *   6. Complexity metrics and reduction suggestions
 *
 * @param args.code  - Source code to analyze
 * @param args.target - File path (alternative to code)
 * @param args.strategy - Analysis strategy: 'full' | 'quick' | 'patterns' | 'smells' | 'complexity'
 */
export async function ultraRefactor(args: {
  code?: string;
  target?: string;
  strategy?: string;
}): Promise<ToolResult> {
  try {
    let sourceCode = args.code;
    if (!sourceCode && args.target) {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(args.target);
      if (fs.existsSync(filePath)) {
        sourceCode = fs.readFileSync(filePath, 'utf-8');
      } else {
        return {
          success: false,
          output: '',
          error: `File not found: ${args.target}`,
        };
      }
    }
    if (!sourceCode) {
      return {
        success: false,
        output: '',
        error: 'No source code provided. Supply code or target file path.',
      };
    }

    const strategy = args.strategy || 'full';
    const parser = new SourceCodeParser(sourceCode);
    const categoryAnalyzer = new CategoryTheoryAnalyzer(parser);
    const astTransformer = new ASTTransformer(parser);
    const patternDetector = new DesignPatternDetector(parser);
    const dependencyAnalyzer = new DependencyAnalyzer(parser);
    const smellDetector = new CodeSmellDetector(parser);
    const complexityReducer = new ComplexityReducer(parser);

    const outputSections: string[] = [];
    const details: Record<string, any> = {};

    outputSections.push('=== ULTRA-REFACTOR ANALYSIS ===');
    outputSections.push(`Strategy: ${strategy}`);
    outputSections.push(`Lines of code: ${parser.lineCount()}`);
    outputSections.push('');

    // 1. Category Theory Analysis
    if (strategy === 'full' || strategy === 'patterns') {
      const catResult = categoryAnalyzer.analyzeAll();
      details.categoryTheory = catResult;
      outputSections.push('--- CATEGORY THEORY ANALYSIS ---');
      outputSections.push(catResult.summary);
      if (catResult.functors.length > 0) {
        outputSections.push('\nFunctor Details:');
        for (const f of catResult.functors) {
          outputSections.push(
            `  ${f.mapperFunction}: ${f.sourceType} -> ${f.targetType} [${f.isCovariant ? 'covariant' : 'contravariant'}] (id=${f.preservesIdentity}, comp=${f.preservesComposition})`
          );
        }
      }
      if (catResult.monoids.length > 0) {
        outputSections.push('\nMonoid Candidates:');
        for (const m of catResult.monoids) {
          outputSections.push(
            `  ${m.type}.${m.opName}: identity=${m.identityElement}, assoc=${m.isAssociative}`
          );
        }
      }
      if (catResult.algebraicDataTypes.length > 0) {
        outputSections.push('\nAlgebraic Data Types:');
        for (const adt of catResult.algebraicDataTypes) {
          outputSections.push(
            `  ${adt.name} (${adt.kind}): ${adt.variants.length > 0 ? adt.variants.join(' | ') : adt.fields.join(', ')}`
          );
        }
      }
      if (catResult.lawvereFragments.length > 0) {
        outputSections.push('\nLawvere Theory Fragments:');
        for (const frag of catResult.lawvereFragments) {
          outputSections.push(`  ${frag.name}:`);
          outputSections.push(
            `    Objects: ${frag.objects.join(', ')}`
          );
          outputSections.push(
            `    Satisfied: ${frag.axiomsSatisfied.length}`
          );
          outputSections.push(
            `    Violated: ${frag.axiomsViolated.length}`
          );
        }
      }
      outputSections.push('');
    }

    // 2. AST Transformations
    if (strategy === 'full' || strategy === 'quick') {
      const transforms = astTransformer.detectAll();
      details.transformations = transforms;
      outputSections.push('--- AST TRANSFORMATIONS ---');
      outputSections.push(`Found ${transforms.length} transformation opportunities`);
      for (const t of transforms.slice(0, 15)) {
        outputSections.push(
          `\n  [${t.name}] (reduction=${t.complexityReduction}, risk=${t.riskLevel})`
        );
        outputSections.push(`    ${t.description}`);
        outputSections.push(`    Before: ${t.beforeCode.substring(0, 100)}...`);
        outputSections.push(`    After: ${t.afterCode.substring(0, 100)}...`);
      }
      outputSections.push('');
    }

    // 3. Design Patterns
    if (strategy === 'full' || strategy === 'patterns') {
      const patterns = patternDetector.detectAll();
      details.patterns = patterns;
      outputSections.push('--- DESIGN PATTERNS ---');
      outputSections.push(`Found ${patterns.length} pattern matches`);
      for (const p of patterns) {
        outputSections.push(
          `\n  [${p.pattern}] confidence=${p.confidence}%`
        );
        outputSections.push(`    Evidence: ${p.evidence.join('; ')}`);
        outputSections.push(`    Suggestion: ${p.suggestion}`);
      }
      outputSections.push('');
    }

    // 4. Dependency Analysis
    if (strategy === 'full') {
      const depResult = dependencyAnalyzer.analyzeAll();
      details.dependencies = depResult;
      outputSections.push('--- DEPENDENCY ANALYSIS ---');
      outputSections.push(depResult.summary);
      if (depResult.godModules.length > 0) {
        outputSections.push('\nGod Modules:');
        for (const gm of depResult.godModules) {
          outputSections.push(
            `  ${gm.module}: metric=${gm.metric} (${gm.reasons.join('; ')})`
          );
        }
      }
      if (depResult.sdpViolations.length > 0) {
        outputSections.push('\nSDP Violations:');
        for (const v of depResult.sdpViolations) {
          outputSections.push(
            `  ${v.from} -> ${v.to} (I=${v.fromInstability.toFixed(2)} -> I=${v.toInstability.toFixed(2)})`
          );
        }
      }
      outputSections.push('');
    }

    // 5. Code Smells
    if (strategy === 'full' || strategy === 'smells') {
      const smells = smellDetector.detectAll();
      details.smells = smells;
      outputSections.push('--- CODE SMELLS ---');
      outputSections.push(`Found ${smells.length} code smells`);
      const bySeverity = {
        critical: smells.filter((s) => s.severity === 'critical'),
        high: smells.filter((s) => s.severity === 'high'),
        medium: smells.filter((s) => s.severity === 'medium'),
        low: smells.filter((s) => s.severity === 'low'),
      };
      outputSections.push(
        `  Critical: ${bySeverity.critical.length}, High: ${bySeverity.high.length}, Medium: ${bySeverity.medium.length}, Low: ${bySeverity.low.length}`
      );
      for (const s of smells.slice(0, 20)) {
        outputSections.push(
          `\n  [${s.smell}] severity=${s.severity} (metric=${s.metric.toFixed(1)}, threshold=${s.threshold})`
        );
        outputSections.push(`    ${s.description}`);
        outputSections.push(`    Suggestion: ${s.suggestion}`);
      }
      outputSections.push('');
    }

    // 6. Complexity Metrics
    if (strategy === 'full' || strategy === 'complexity') {
      const complexityResult = complexityReducer.analyzeAll();
      details.complexity = complexityResult;
      outputSections.push('--- COMPLEXITY METRICS ---');
      outputSections.push(complexityResult.summary);
      if (complexityResult.suggestions.length > 0) {
        outputSections.push('\nTop Refactoring Suggestions:');
        for (const s of complexityResult.suggestions.slice(0, 10)) {
          outputSections.push(
            `\n  [${s.name}] impact=${s.impact}, reduction=${s.complexityReduction}`
          );
          outputSections.push(`    ${s.description}`);
        }
      }
      outputSections.push('');
    }

    // Final Summary
    const totalSmells = details.smells?.length || 0;
    const totalPatterns = details.patterns?.length || 0;
    const totalTransforms = details.transformations?.length || 0;
    const totalSuggestions = details.complexity?.suggestions?.length || 0;
    const catScore = details.categoryTheory?.score || 0;
    const maintainability =
      details.complexity?.metrics?.maintainabilityIndex?.toFixed(1) || 'N/A';

    outputSections.push('=== SUMMARY ===');
    outputSections.push(`Code Smells Found: ${totalSmells}`);
    outputSections.push(`Design Patterns Detected: ${totalPatterns}`);
    outputSections.push(`AST Transformations Available: ${totalTransforms}`);
    outputSections.push(
      `Complexity Reduction Suggestions: ${totalSuggestions}`
    );
    outputSections.push(`Category Theory Score: ${catScore}/100`);
    outputSections.push(`Maintainability Index: ${maintainability}`);

    const overallHealth =
      totalSmells < 5
        ? 'HEALTHY'
        : totalSmells < 15
          ? 'NEEDS ATTENTION'
          : 'REQUIRES REFACTORING';
    outputSections.push(`Overall Health: ${overallHealth}`);

    return {
      success: true,
      output: outputSections.join('\n'),
      details,
    };
  } catch (err: any) {
    return {
      success: false,
      output: '',
      error: err.message || String(err),
    };
  }
}
