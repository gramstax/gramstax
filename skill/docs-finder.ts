#!/usr/bin/env node
/**
 * CLI routing (AI-first, deterministic):
 * Key rules to support ALL ripgrep syntax (Bun-safe):
 * - If argv contains "--":
 *     rgArgs = argv before "--"  (forwarded verbatim to rg)
 *     terms  = argv after  "--"  (tool query terms)
 * - Else if ANY argv starts with "-":
 *     RAW rg mode: forward ALL argv verbatim to rg
 * - Else:
 *     skill mode:
 *       - no args -> list symbols (from <package>.yml)
 *       - 1 arg -> open symbol (name or uid), else keyword search
 *       - 2 args -> open member (<symbol> <member>)
 *       - 3+ args -> keyword search (AND-by-file)
 * Tip: for flags with separate values (`-C 3`, `-A 5`, `-g PAT`), always use `--`.
 */

import * as fs from "fs"
import * as path from "path"
import {spawnSync} from "child_process"

type SymbolKind = `class` | `type` | `unknown`

interface SymbolEntry {
  name: string // short name (BlockKeyboard)
  uid: string // full uid (gramstax!BlockKeyboard:class)
  kind: SymbolKind
}

type SearchResultType = `list` | `file` | `section` | `suggestions` | `rg` | `error`

interface SearchResult {
  type: SearchResultType
  data: string
}

const DEFAULT_DOCS_DIR = process.env.DOCS_DIR || `C:\\damar-files\\PROJECT-ORG-GRAMSTAX\\gramstax\\packages\\gramstax\\docs\\yaml`

const DOCS_PACKAGE = process.env.DOCS_PACKAGE || `gramstax`
const RG_PATH = process.env.RG_PATH || `rg`
const MAX_OUTPUT_LINES = clampInt(process.env.DOCS_FINDER_MAX_LINES, 1200, 100, 50000)

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return def
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function normalizeNewlines(s: string): string {
  return s.replace(/\r\n/g, `\n`)
}

function splitLines(s: string): string[] {
  const t = normalizeNewlines(s)
  if (!t.trim()) return []
  return t.split(`\n`).map((x) => x.trimEnd())
}

function allEmpty(list: string[]): boolean {
  return list.length === 0 || list.every((x) => !x || !x.trim())
}

function trimOutputByLines(text: string, maxLines: number): {text: string; omitted: number} {
  const lines = splitLines(text)
  if (lines.length <= maxLines) return {text: normalizeNewlines(text), omitted: 0}
  return {text: lines.slice(0, maxLines).join(`\n`) + `\n`, omitted: lines.length - maxLines}
}

function ensureDirExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    console.error(`❌ Docs directory not found: ${dir}`)
    process.exit(1)
  }
}

function runRg(cwd: string, args: string[]) {
  // Never use shell:true; pass args array to preserve exact rg semantics.
  return spawnSync(RG_PATH, args, {
    cwd,
    encoding: `utf8`,
    windowsHide: true,
    maxBuffer: 128 * 1024 * 1024 // 128MB
  })
}

function stripLeadingCommandNoise(argv: string[]): string[] {
  if (argv.length === 0) return argv
  const first = argv[0]
  const base = path.basename(first).toLowerCase()
  // Bun may inject the command name; strip common variants.
  const known = new Set([`docs-finder`, `docs-finder.ts`, `docs-finder.js`, `docs-finder.mjs`, `docs-finder.cjs`])
  if (known.has(base)) return argv.slice(1)
  return argv
}

type Parsed = {
  rgArgs: string[]
  terms: string[]
  rawRgMode: boolean
  help: boolean
  version: boolean
}

function parseArgs(argvRaw: string[]): Parsed {
  const argv = stripLeadingCommandNoise(argvRaw)

  const help = argv.includes(`-h`) || argv.includes(`--help`)
  const version = argv.includes(`-v`) || argv.includes(`--version`)
  if (help || version) return {rgArgs: [], terms: [], rawRgMode: false, help, version}

  const dashDashIdx = argv.indexOf(`--`)
  if (dashDashIdx >= 0) {
    const rgArgs = argv.slice(0, dashDashIdx)
    const terms = argv.slice(dashDashIdx + 1)
    const rawRgMode = rgArgs.length > 0 && terms.length === 0
    return {rgArgs, terms, rawRgMode, help: false, version: false}
  }

  const hasAnyDashFlag = argv.some((a) => a.startsWith(`-`))
  if (hasAnyDashFlag) {
    // RAW rg mode: forward everything verbatim to rg.
    return {rgArgs: argv, terms: [], rawRgMode: true, help: false, version: false}
  }

  return {rgArgs: [], terms: argv, rawRgMode: false, help: false, version: false}
}

function scopeArgsYml(packageName: string): string[] {
  // Keep scope tight and deterministic.
  return [`--glob`, `*.yml`, `--glob`, `!**/node_modules/**`, `--glob`, `!**/.git/**`, `--glob`, `!**/dist/**`, `--glob`, `!**/${packageName}/**/*.map`]
}

function stableOutputArgs(rgArgs: string[]): string[] {
  // If user requests JSON output, do not force formatting flags.
  if (rgArgs.includes(`--json`)) return []

  const out: string[] = []
  if (!rgArgs.some((a) => a === `--color` || a.startsWith(`--color=`))) out.push(`--color`, `never`)

  const hasHeading = rgArgs.includes(`--heading`) || rgArgs.includes(`--no-heading`)
  if (!hasHeading) out.push(`--no-heading`)

  const hasFilename = rgArgs.includes(`--with-filename`) || rgArgs.includes(`--no-filename`)
  if (!hasFilename) out.push(`--with-filename`)

  const hasLineNum = rgArgs.includes(`--line-number`) || rgArgs.includes(`-n`)
  if (!hasLineNum) out.push(`--line-number`)

  const hasCase =
    rgArgs.includes(`-i`) ||
    rgArgs.includes(`--ignore-case`) ||
    rgArgs.includes(`-s`) ||
    rgArgs.includes(`--case-sensitive`) ||
    rgArgs.includes(`-S`) ||
    rgArgs.includes(`--smart-case`) ||
    rgArgs.some((a) => a.startsWith(`--ignore-case=`)) ||
    rgArgs.some((a) => a.startsWith(`--case-sensitive=`)) ||
    rgArgs.some((a) => a.startsWith(`--smart-case=`))

  if (!hasCase) out.push(`--smart-case`)

  return out
}

function lowerAscii(s: string): string {
  return s.toLowerCase()
}

function isProbablyUid(s: string): boolean {
  return s.includes(`!`) && s.startsWith(DOCS_PACKAGE + `!`)
}

function parseUid(uid: string): {symbol?: string; member?: string; overloadIndex?: number; kind?: SymbolKind} {
  // Supported UID forms:
  // - gramstax!BlockKeyboard:class
  // - gramstax!ITInlineKb:type
  // - gramstax!BlockKeyboard._build:member(1)
  // - gramstax!Ctx#inlineKeyboard:member(1)   <-- IMPORTANT (uses '#')
  if (!isProbablyUid(uid)) return {}

  const afterBang = uid.split(`!`)[1] || ``

  // Detect member delimiter: '.' or '#'
  const dotIdx = afterBang.indexOf(`.`)
  const hashIdx = afterBang.indexOf(`#`)

  const memberDelimIdx = dotIdx >= 0 && hashIdx >= 0 ? Math.min(dotIdx, hashIdx) : dotIdx >= 0 ? dotIdx : hashIdx

  // Member UID
  if (memberDelimIdx >= 0) {
    const symbol = afterBang.slice(0, memberDelimIdx)
    const afterDelim = afterBang.slice(memberDelimIdx + 1)

    const colonIdx = afterDelim.indexOf(`:`)
    const memberName = colonIdx >= 0 ? afterDelim.slice(0, colonIdx) : afterDelim

    const m = uid.match(/:member\((\d+)\)/)
    const overloadIndex = m ? Number(m[1]) : undefined

    return {symbol, member: memberName, overloadIndex}
  }

  // Non-member UID (class/type)
  const kindPartIdx = afterBang.indexOf(`:`)
  if (kindPartIdx >= 0) {
    const symbol = afterBang.slice(0, kindPartIdx)
    const kindRaw = afterBang.slice(kindPartIdx + 1)
    const kind: SymbolKind = kindRaw.startsWith(`class`) ? `class` : kindRaw.startsWith(`type`) ? `type` : `unknown`
    return {symbol, kind}
  }

  // Fallback
  return {symbol: afterBang}
}

class YmlDocsFinder {
  private docsDir: string
  private packageName: string
  private packageIndexPath: string
  private symbolDir: string
  private symbolsByName: Map<string, SymbolEntry> = new Map()
  private symbolsList: SymbolEntry[] = []

  constructor(docsDir: string, packageName: string) {
    this.docsDir = path.resolve(docsDir)
    this.packageName = packageName
    ensureDirExists(this.docsDir)

    this.packageIndexPath = path.join(this.docsDir, `${this.packageName}.yml`)
    this.symbolDir = path.join(this.docsDir, this.packageName)

    if (!fs.existsSync(this.packageIndexPath)) {
      console.error(`❌ Package index not found: ${this.packageIndexPath}`)
      process.exit(1)
    }
    if (!fs.existsSync(this.symbolDir)) {
      console.error(`❌ Package symbol folder not found: ${this.symbolDir}`)
      process.exit(1)
    }

    this.indexSymbolsFromPackageYml()
  }

  private indexSymbolsFromPackageYml(): void {
    const raw = fs.readFileSync(this.packageIndexPath, `utf8`)
    const lines = splitLines(raw)

    // Example lines:
    // classes:
    //   - gramstax!BlockKeyboard:class
    // typeAliases:
    //   - gramstax!ITInlineKb:type
    const entries: SymbolEntry[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith(`- `)) continue

      const uid = trimmed.slice(2).trim()
      if (!uid.startsWith(this.packageName + `!`)) continue

      const parsed = parseUid(uid)
      const name = parsed.symbol
      if (!name) continue

      let kind: SymbolKind = `unknown`
      if (uid.includes(`:class`)) kind = `class`
      else if (uid.includes(`:type`)) kind = `type`

      entries.push({name, uid, kind})
    }

    // Deduplicate by name (keep first occurrence)
    const byName = new Map<string, SymbolEntry>()
    for (const e of entries) {
      if (!byName.has(e.name)) byName.set(e.name, e)
    }

    const finalList = Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
    this.symbolsList = finalList
    this.symbolsByName = byName
  }

  private resolveSymbolName(input: string): {name?: string; member?: string; overloadIndex?: number} {
    const s = input.trim()

    // UID handling
    if (isProbablyUid(s)) {
      const p = parseUid(s)
      return {name: p.symbol, member: p.member, overloadIndex: p.overloadIndex}
    }

    // "Class.member" OR "Class#member" shorthand
    const dotIdx = s.indexOf(`.`)
    const hashIdx = s.indexOf(`#`)
    const splitIdx = dotIdx > 0 && hashIdx > 0 ? Math.min(dotIdx, hashIdx) : dotIdx > 0 ? dotIdx : hashIdx

    if (splitIdx > 0) {
      const name = s.slice(0, splitIdx).trim()
      const member = s.slice(splitIdx + 1).trim()
      if (name && member) return {name, member}
    }

    // plain symbol
    if (this.symbolsByName.has(s)) return {name: s}

    // case-insensitive match (common)
    const lowered = lowerAscii(s)
    const hit = this.symbolsList.find((x) => lowerAscii(x.name) === lowered)
    if (hit) return {name: hit.name}

    return {}
  }

  private symbolFilePath(symbolName: string): string {
    // Guaranteed mapping: ./<package>/<lower(symbol)>.yml
    return path.join(this.symbolDir, `${lowerAscii(symbolName)}.yml`)
  }

  private listSymbols(): SearchResult {
    const classes = this.symbolsList.filter((s) => s.kind === `class`)
    const types = this.symbolsList.filter((s) => s.kind === `type`)
    const unknown = this.symbolsList.filter((s) => s.kind === `unknown`)

    let out = `📦 Package: ${this.packageName}\n`
    out += `📄 Index: ${this.packageName}.yml\n\n`

    out += `Classes (${classes.length}):\n`
    for (const c of classes) out += `  - ${c.name}  (${c.uid})\n`

    out += `\nType Aliases (${types.length}):\n`
    for (const t of types) out += `  - ${t.name}  (${t.uid})\n`

    if (unknown.length) {
      out += `\nOther (${unknown.length}):\n`
      for (const u of unknown) out += `  - ${u.name}  (${u.uid})\n`
    }

    out += `\n💡 Usage:\n`
    out += `  bun docs-finder <SymbolName>\n`
    out += `  bun docs-finder <SymbolName> <memberName>\n`
    out += `  bun docs-finder -- <keyword...>\n`
    out += `  bun docs-finder <rgArgs...> -- <keyword...>\n`

    return {type: `list`, data: out}
  }

  private suggestSymbols(query: string): SearchResult {
    const q = lowerAscii(query)
    const matches = this.symbolsList.filter((s) => lowerAscii(s.name).includes(q) || lowerAscii(s.uid).includes(q)).slice(0, 12)

    if (!matches.length) {
      return {
        type: `suggestions`,
        data: `❌ Not found: ${query}\n\n` + `Try:\n` + `  bun docs-finder\n` + `  bun docs-finder -- ${query}\n`
      }
    }

    let out = `❌ Not found: ${query}\n\nDid you mean:\n`
    for (const m of matches) out += `  - ${m.name}  (${m.uid})\n`
    return {type: `suggestions`, data: out}
  }

  private openSymbol(symbolName: string): SearchResult {
    const file = this.symbolFilePath(symbolName)
    if (!fs.existsSync(file)) {
      return {
        type: `error`,
        data: `❌ Symbol file missing: ${file}\n` + `Expected mapping: ./${this.packageName}/${lowerAscii(symbolName)}.yml`
      }
    }

    const content = fs.readFileSync(file, `utf8`)
    return {
      type: `file`,
      data: `\n${`=`.repeat(60)}\n` + `📄 ${this.packageName}!${symbolName}\n` + `${`=`.repeat(60)}\n\n` + content
    }
  }

  private extractMemberBlock(symbolName: string, memberName: string, overloadIndex?: number): SearchResult {
    const file = this.symbolFilePath(symbolName)
    if (!fs.existsSync(file)) {
      return {
        type: `error`,
        data: `❌ Symbol file missing: ${file}\n` + `Expected mapping: ./${this.packageName}/${lowerAscii(symbolName)}.yml`
      }
    }

    const raw = fs.readFileSync(file, `utf8`)
    const lines = splitLines(raw)

    // We search within "methods:" and "properties:" sections.
    // Items look like:
    // methods:
    //   - name: _build(key,...)
    //     uid: gramstax!BlockKeyboard._build:member(1)
    //     ...
    // properties:
    //   - name: label
    //     uid: gramstax!BlockKeyboard.label:member
    //
    // Strategy:
    // - detect section start at column 0: "methods:" or "properties:"
    // - inside a section, find item lines matching /^\s{2}- name:\s+<member>/
    // - capture from that item line until the next item line in same section (same indent) OR until section ends.

    const want = memberName.trim()
    const wantLower = lowerAscii(want)

    type Found = {start: number; end: number; section: `methods` | `properties`; uidLine?: string}
    const found: Found[] = []

    let section: `methods` | `properties` | null = null

    const isTopLevel = (line: string) => /^[A-Za-z0-9_]+:/.test(line) && !line.startsWith(` `)

    const isItemNameLine = (line: string) => {
      // exactly two-space indent then "- name:"
      return /^ {2}- name: /.test(line)
    }

    const getItemName = (line: string) => {
      // "  - name: _build(key, ...)" -> take first token up to space or "("
      const m = line.match(/^ {2}- name:\s*(.+)\s*$/)
      const full = m ? m[1] : ``
      const token = full.split(/\s|\(/)[0]
      return token
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (isTopLevel(line)) {
        if (line === `methods:`) {
          section = `methods`
          continue
        }
        if (line === `properties:`) {
          section = `properties`
          continue
        }
        // any other top-level ends these sections
        if (section) section = null
      }

      if (!section) continue

      if (isItemNameLine(line)) {
        const itemName = getItemName(line)
        if (lowerAscii(itemName) === wantLower) {
          // find end
          let end = lines.length
          for (let j = i + 1; j < lines.length; j++) {
            const l2 = lines[j]
            if (isTopLevel(l2)) {
              end = j
              break
            }
            if (isItemNameLine(l2)) {
              end = j
              break
            }
          }

          // try to locate uid line inside [i, end)
          let uidLine: string | undefined
          for (let k = i; k < end; k++) {
            const lk = lines[k].trim()
            if (lk.startsWith(`uid: `)) {
              uidLine = lk.slice(`uid: `.length).trim()
              break
            }
          }

          found.push({start: i, end, section, uidLine})
        }
      }
    }

    if (!found.length) {
      return {
        type: `suggestions`,
        data: `❌ Member not found: ${symbolName}.${memberName}\n\n` + `Try searching:\n` + `  bun docs-finder -- ${memberName}\n` + `Or open the symbol doc:\n` + `  bun docs-finder ${symbolName}\n`
      }
    }

    // overload selection:
    // - if overloadIndex given (1-based), pick that occurrence; else pick first.
    let chosen = found[0]
    if (typeof overloadIndex === `number` && Number.isFinite(overloadIndex) && overloadIndex >= 1) {
      const idx = overloadIndex - 1
      chosen = found[Math.min(idx, found.length - 1)]
    }

    const block = lines.slice(chosen.start, chosen.end).join(`\n`)
    const uidInfo = chosen.uidLine ? ` (${chosen.uidLine})` : ``

    return {
      type: `section`,
      data: `\n${`=`.repeat(60)}\n` + `📄 ${this.packageName}!${symbolName}.${memberName}${uidInfo}\n` + `${`=`.repeat(60)}\n\n` + block + `\n`
    }
  }

  private rgSearch(terms: string[], rgArgs: string[]): SearchResult {
    // If user provides -e/-f/--regexp etc, do not do AND-by-file intersection.
    const userHasPattern = rgArgs.includes(`-e`) || rgArgs.includes(`--regexp`) || rgArgs.includes(`-f`) || rgArgs.includes(`--file`)

    const base = [...scopeArgsYml(this.packageName), ...stableOutputArgs(rgArgs), ...rgArgs]

    if (terms.length === 0) {
      return {type: `error`, data: `❌ No search terms provided.`}
    }

    // Raw-pattern mode: run rg as user intends, append extra terms as -e (optional).
    if (userHasPattern) {
      const args = [...base]
      for (const t of terms) args.push(`-e`, t)
      args.push(`.`)
      const res = runRg(this.docsDir, args)
      return formatRgResult(res, terms, rgArgs, `raw-pattern`)
    }

    // AND-by-file for 2+ terms (fast, deterministic)
    if (terms.length >= 2) {
      const files = intersectFilesContainingAllTerms(this.docsDir, this.packageName, terms, rgArgs)
      if (files.length === 0) {
        return {
          type: `rg`,
          data: `❌ No matches where ALL terms appear in the same file.\n\n` + `Try:\n` + `  bun docs-finder -i -- ${terms.join(` `)}\n` + `  bun docs-finder -- ${terms[0]}\n`
        }
      }

      const args = [...base, `--fixed-strings`]
      for (const t of terms) args.push(`-e`, t)
      args.push(...files)

      const res = runRg(this.docsDir, args)
      return formatRgResult(res, terms, rgArgs, `and-by-file`, files.length)
    }

    // Single term default fixed string unless user wants regex
    const single = terms[0]
    const wantsRegex = rgArgs.includes(`--pcre2`) || rgArgs.includes(`--regexp`) || rgArgs.includes(`-e`)
    const args = [...base]
    if (!wantsRegex && !rgArgs.includes(`--fixed-strings`) && !rgArgs.includes(`-F`)) {
      args.push(`--fixed-strings`)
    }
    args.push(single, `.`)

    const res = runRg(this.docsDir, args)
    return formatRgResult(res, terms, rgArgs, `single`)
  }

  public runSkillMode(terms: string[], rgArgsFromDashDash: string[]): SearchResult {
    // NOTE:
    // - rgArgsFromDashDash are only present when user uses "<rgArgs...> -- <terms...>"
    // - If rgArgsFromDashDash is non-empty and terms empty: caller may choose raw mode; handled outside.

    if (terms.length === 0) return this.listSymbols()

    // 2 args -> open member (<symbol> <member>) (only when user did NOT pass rgArgs)
    if (rgArgsFromDashDash.length === 0 && terms.length === 2) {
      const sym = this.resolveSymbolName(terms[0])
      if (sym.name) {
        return this.extractMemberBlock(sym.name, terms[1], sym.overloadIndex)
      }
      // if first isn't a symbol, treat as search
      return this.rgSearch(terms, [])
    }

    // 1 arg -> open symbol or open member if arg contains UID member or "Class.member"
    if (rgArgsFromDashDash.length === 0 && terms.length === 1) {
      const resolved = this.resolveSymbolName(terms[0])
      if (resolved.name && resolved.member) {
        return this.extractMemberBlock(resolved.name, resolved.member, resolved.overloadIndex)
      }
      if (resolved.name) {
        return this.openSymbol(resolved.name)
      }
      // not a symbol: keyword search
      return this.rgSearch([terms[0]], [])
    }

    // 3+ args -> keyword search
    if (rgArgsFromDashDash.length === 0) {
      return this.rgSearch(terms, [])
    }

    // If user provided rgArgs via "--", always do rg search with those rgArgs.
    return this.rgSearch(terms, rgArgsFromDashDash)
  }

  public helpText(): string {
    return [
      `Gramstax YAML Docs Finder (ripgrep-first, Bun-safe)`,
      ``,
      `DocsDir : ${this.docsDir}`,
      `Package : ${this.packageName}`,
      `Index   : ${this.packageName}.yml`,
      `Symbols : ./${this.packageName}/<lower(symbol)>.yml`,
      ``,
      `Skill mode:`,
      `  bun docs-finder`,
      `  bun docs-finder <SymbolName>`,
      `  bun docs-finder <SymbolName> <memberName>`,
      `  bun docs-finder <SymbolName.memberName>`,
      `  bun docs-finder "<uid>"`,
      ``,
      `Forced search (recommended):`,
      `  bun docs-finder -- <terms...>`,
      `  bun docs-finder <rgArgs...> -- <terms...>`,
      ``,
      `Examples:`,
      `  bun docs-finder BlockKeyboard`,
      `  bun docs-finder BlockKeyboard _build`,
      `  bun docs-finder "gramstax!BlockKeyboard._build:member(1)"`,
      `  bun docs-finder -- inlineKeyboard`,
      `  bun docs-finder -i -C 3 -- inlineKeyboard`,
      `  bun docs-finder -A 5 -B 2 -- inlineKeyboard`,
      ``,
      `RAW rg mode (any '-' arg, no '--'):`,
      `  bun docs-finder --pcre2 -n -e "\\\\binlineKeyboard\\\\b" .`,
      ``,
      `Env: DOCS_DIR, DOCS_PACKAGE, RG_PATH, DOCS_FINDER_MAX_LINES`,
      ``
    ].join(`\n`)
  }
}

// ---------------------------
// AND-by-file helper (rg)
// ---------------------------

function intersectFilesContainingAllTerms(docsDir: string, packageName: string, terms: string[], userRgArgs: string[]): string[] {
  // Use a minimal base for file filtering.
  // We do NOT add stableOutputArgs here (not needed).
  const base = [...scopeArgsYml(packageName), ...userRgArgs]

  let current: Set<string> | null = null

  for (const term of terms) {
    const args = [...base, `--files-with-matches`, `--fixed-strings`, term, `.`]
    const res = runRg(docsDir, args)

    if ((res as any).error) return []
    const status: number | null = (res as any).status ?? null

    const list = splitLines(res.stdout || ``).map((p) => path.normalize(p))

    // rg exit 1 => no matches
    if (status === 1 || status === null || allEmpty(list)) return []

    const next = new Set(list)

    if (current === null) {
      current = next
    } else {
      const intersect = new Set<string>()
      for (const x of current) {
        if (next.has(x)) intersect.add(x)
      }
      current = intersect
    }

    if (current.size === 0) return []
  }

  return current ? [...current] : []
}

function formatRgResult(res: any, terms: string[], rgArgs: string[], mode: `single` | `and-by-file` | `raw-pattern`, filesMatchedAllTerms?: number): SearchResult {
  if (res?.error) {
    return {type: `error`, data: `❌ rg failed: ${res.error?.message || `Unknown error`}`}
  }

  const status: number | null = res?.status ?? null
  const stdout = String(res?.stdout || ``)
  const stderr = String(res?.stderr || ``)

  if (status === 1 && !stdout.trim()) {
    return {type: `rg`, data: `❌ No matches.\n`}
  }

  if (status !== 0 && status !== 1 && stderr.trim()) {
    return {type: `error`, data: `❌ rg error:\n${stderr}`}
  }

  const {text, omitted} = trimOutputByLines(stdout, MAX_OUTPUT_LINES)

  let meta = `🔎 rg search (${mode})\n`
  meta += `    terms: ${terms.join(` `)}\n`
  if (rgArgs.length) meta += `    rgArgs: ${rgArgs.join(` `)}\n`
  if (typeof filesMatchedAllTerms === `number`) meta += `    filesMatchedAllTerms: ${filesMatchedAllTerms}\n`
  meta += `\n`

  return {type: `rg`, data: meta + text + (omitted ? `\n…omitted ${omitted} more lines\n` : ``)}
}

// ---------------------------
// CLI
// ---------------------------

function main(): void {
  const parsed = parseArgs(process.argv.slice(2))

  const docsDir = DEFAULT_DOCS_DIR
  const packageName = DOCS_PACKAGE

  if (parsed.version) {
    console.log(`gramstax-yml-docs-finder 1.0.0`)
    return
  }

  const finder = new YmlDocsFinder(docsDir, packageName)

  if (parsed.help) {
    console.log(finder.helpText())
    return
  }

  // RAW rg mode: forward args verbatim to rg, scoped by *.yml globs.
  if (parsed.rawRgMode) {
    const args = [...scopeArgsYml(packageName), ...parsed.rgArgs]
    const res = runRg(path.resolve(docsDir), args)

    const result = formatRgResult(res, [], parsed.rgArgs, `raw-pattern`)
    console.log(result.data)
    return
  }

  // Skill mode:
  // - If user used "<rgArgs...> -- <terms...>" then parsed.rgArgs are rgArgs and parsed.terms are terms
  // - If user did not use "--" then parsed.rgArgs = [] and parsed.terms are terms (skill)
  const result = finder.runSkillMode(parsed.terms, parsed.rgArgs)
  console.log(result.data)
}

if (require.main === module) {
  main()
}

export {YmlDocsFinder}
