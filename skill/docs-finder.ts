#!/usr/bin/env node
/**
 * Gramstax Docs Finder (ripgrep-first, Bun-safe)
 *
 * Key rules to support ALL ripgrep syntax 100%:
 * - If argv contains "--":
 *     rgArgs = argv before "--"  (forwarded verbatim to rg)
 *     terms  = argv after  "--"  (skill query terms)
 * - Else if ANY argv starts with "-":
 *     RAW rg mode: forward ALL argv verbatim to rg
 * - Else:
 *     skill mode: list/open/search by docs pattern
 *
 * Docs file pattern:
 *   gramstax.<className>.<memberName>.md
 */

import * as fs from "fs"
import * as path from "path"
import {spawnSync} from "child_process"

interface DocFile {
  prefix: string
  className: string
  memberName: string
  filePath: string
  fullPath: string // prefix.className.memberName
  baseName: string // filename without .md
}

type SearchResultType = `file` | `list` | `suggestions` | `rg`

interface SearchResult {
  type: SearchResultType
  data: DocFile[] | string
}

const DEFAULT_DOCS_DIR = process.env.DOCS_DIR || `C:\\damar-files\\PROJECT-ORG-GRAMSTAX\\gramstax\\packages\\gramstax\\docs\\markdown`

const DEFAULT_PREFIX = process.env.DOCS_PREFIX || `gramstax`
const RG_PATH = process.env.RG_PATH || `rg`

const MAX_OUTPUT_LINES = clampInt(process.env.DOCS_FINDER_MAX_LINES, 800, 50, 20000)

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return def
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function normalizeNewlines(s: string): string {
  return s.replace(/\r\n/g, `\n`)
}

function splitLines(s: string): string[] {
  const t = normalizeNewlines(s).trim()
  if (!t) return []
  return t.split(`\n`).map((x) => x.trimEnd())
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}

function ensureDirExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    console.error(`❌ Docs directory not found: ${dir}`)
    process.exit(1)
  }
}

function allEmpty(list: string[]): boolean {
  return list.length === 0 || list.every((x) => !x || !x.trim())
}

function trimOutputByLines(text: string, maxLines: number): {text: string; omitted: number} {
  const lines = splitLines(text)
  if (lines.length <= maxLines) return {text: normalizeNewlines(text), omitted: 0}
  return {
    text: lines.slice(0, maxLines).join(`\n`) + `\n`,
    omitted: lines.length - maxLines
  }
}

function runRg(cwd: string, args: string[]) {
  return spawnSync(RG_PATH, args, {
    cwd,
    encoding: `utf8`,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024 // 64MB
  })
}

function scopeArgs(prefix: string): string[] {
  // Hard scope to gramstax docs environment
  return [`--glob`, `${prefix}.*.md`, `--glob`, `!**/node_modules/**`, `--glob`, `!**/.git/**`]
}

function stableOutputArgs(rgArgs: string[]): string[] {
  // In skill-mode we want stable parseable output.
  // If user uses --json, do NOT force formatting flags.
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

type Parsed = {
  rgArgs: string[]
  terms: string[]
  rawRgMode: boolean
  help: boolean
  version: boolean
}

function stripLeadingCommandNoise(argv: string[]): string[] {
  // Bun sometimes injects command/script names; we strip common variants safely.
  if (argv.length === 0) return argv

  const first = argv[0]
  const base = path.basename(first).toLowerCase()
  const known = new Set([`docs-finder`, `docs-finder.ts`, `docs-finder.js`, `docs-finder.mjs`, `docs-finder.cjs`])

  if (known.has(base)) return argv.slice(1)
  return argv
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
    // If only rgArgs exist and no terms, treat as raw-rg passthrough
    const rawRgMode = rgArgs.length > 0 && terms.length === 0
    return {rgArgs, terms, rawRgMode, help: false, version: false}
  }

  const hasAnyDashFlag = argv.some((a) => a.startsWith(`-`))
  if (hasAnyDashFlag) {
    // RAW rg mode: forward everything to rg verbatim
    return {rgArgs: argv, terms: [], rawRgMode: true, help: false, version: false}
  }

  // skill mode
  return {rgArgs: [], terms: argv, rawRgMode: false, help: false, version: false}
}

class DocsFinder {
  private docsDir: string
  private requiredPrefix: string
  private docFiles: DocFile[] = []

  constructor(docsDir: string = DEFAULT_DOCS_DIR, prefix: string = DEFAULT_PREFIX) {
    this.docsDir = path.resolve(docsDir)
    this.requiredPrefix = prefix
    ensureDirExists(this.docsDir)
    this.indexDocs()
  }

  private indexDocs(): void {
    // Use rg --files to list files (fast) with scope globs
    const args = [`--files`, ...scopeArgs(this.requiredPrefix)]
    const res = runRg(this.docsDir, args)

    if ((res as any).error) {
      const msg = (res as any).error?.message || `Unknown error`
      console.error([`❌ ripgrep (rg) not available or failed to run.`, `   Error: ${msg}`, ``, `Fix: install ripgrep and ensure "rg" is on PATH, or set RG_PATH to full path.`].join(`\n`))
      process.exit(1)
    }

    if (res.status !== 0 && (res.stderr || ``).trim()) {
      console.error(`❌ rg error while indexing:\n${res.stderr}`)
      process.exit(1)
    }

    const files = splitLines(res.stdout || ``)
    for (const rel of files) {
      const abs = path.isAbsolute(rel) ? rel : path.join(this.docsDir, rel)
      const base = path.basename(abs)
      if (!base.endsWith(`.md`)) continue

      const baseName = base.slice(0, -3)
      const parts = baseName.split(`.`)
      if (parts.length < 3) continue

      const prefix = parts[0]
      if (prefix !== this.requiredPrefix) continue

      const className = parts[1]
      const memberName = parts.slice(2).join(`.`)

      this.docFiles.push({
        prefix,
        className,
        memberName,
        filePath: abs,
        fullPath: `${prefix}.${className}.${memberName}`,
        baseName
      })
    }

    if (this.docFiles.length === 0) {
      console.warn(`⚠️  No documentation files found with prefix "${this.requiredPrefix}" in ${this.docsDir}`)
    }
  }

  private listAllClasses(): SearchResult {
    const classes = uniq(this.docFiles.map((d) => d.className)).sort((a, b) => a.localeCompare(b))
    let out = `📚 Available Classes (${classes.length}) [prefix=${this.requiredPrefix}]\n\n`
    for (const c of classes) {
      const count = this.docFiles.filter((d) => d.className === c).length
      out += `  • ${c} (${count} members)\n`
    }
    out += `\n💡 Usage:\n`
    out += `  bun docs-finder\n`
    out += `  bun docs-finder <className>\n`
    out += `  bun docs-finder <className> <memberName>\n`
    out += `  bun docs-finder <word...>\n`
    out += `  bun docs-finder <rgArgs...> -- <word...>\n`
    return {type: `list`, data: out}
  }

  private listClassMembers(className: string): SearchResult {
    const docs = this.docFiles.filter((d) => d.className.toLowerCase() === className.toLowerCase())
    const members = docs.map((d) => d.memberName).sort((a, b) => a.localeCompare(b))

    let out = `📖 Members of '${className}' (${members.length}) [prefix=${this.requiredPrefix}]\n\n`
    for (const m of members) out += `  • ${m}\n`
    out += `\n💡 Usage: bun docs-finder ${className} <memberName>\n`
    return {type: `list`, data: out}
  }

  private getExactDoc(className: string, memberName: string): SearchResult {
    const doc = this.docFiles.find((d) => d.className.toLowerCase() === className.toLowerCase() && d.memberName.toLowerCase() === memberName.toLowerCase())

    if (!doc) {
      const c = className.toLowerCase()
      const m = memberName.toLowerCase()
      const suggestions = this.docFiles.filter((d) => d.className.toLowerCase().includes(c) || d.memberName.toLowerCase().includes(m)).slice(0, 10)

      let out = `❌ Not found: ${className}.${memberName}\n\n`
      if (suggestions.length) {
        out += `Did you mean:\n`
        for (const s of suggestions) out += `  • ${this.requiredPrefix}.${s.className}.${s.memberName}\n`
      } else {
        out += `💡 Try:\n  bun docs-finder ${className}\n  bun docs-finder <word...>\n`
      }
      return {type: `suggestions`, data: out}
    }

    return {type: `file`, data: [doc]}
  }

  private suggestByMember(term: string): SearchResult {
    const q = term.toLowerCase()
    const exact = this.docFiles.filter((d) => d.memberName.toLowerCase() === q)
    const partial = this.docFiles.filter((d) => d.memberName.toLowerCase().includes(q) && !exact.includes(d))
    const fuzzy = this.docFiles.filter((d) => d.fullPath.toLowerCase().includes(q))

    const matches = [...exact, ...partial, ...fuzzy].slice(0, 12)

    if (matches.length === 0) {
      return {
        type: `suggestions`,
        data: `❌ Not found: ${term}\n\n` + `💡 Try:\n` + `  bun docs-finder\n` + `  bun docs-finder <className>\n` + `  bun docs-finder <word...>\n`
      }
    }

    let out = `❌ Not found: ${term}\n\nDid you mean:\n`
    for (const d of matches) out += `  • ${this.requiredPrefix}.${d.className}.${d.memberName}\n`
    return {type: `suggestions`, data: out}
  }

  private intersectFilesContainingAllTerms(terms: string[], rgArgs: string[]): string[] {
    let current: Set<string> | null = null

    // Use safe args for file filtering: we keep user rgArgs verbatim because
    // in this branch user explicitly provided args before "--".
    // But we force fixed-string and files-with-matches per-term.
    const base = [...scopeArgs(this.requiredPrefix), ...stableOutputArgs(rgArgs), ...rgArgs]

    for (const term of terms) {
      const args = [...base, `--files-with-matches`, `--fixed-strings`, term, `.`]
      const res = runRg(this.docsDir, args)
      if ((res as any).error) return []

      const list = splitLines(res.stdout || ``).map((p) => path.normalize(p))
      if (res.status === 1 || res.status === null || allEmpty(list)) return []

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

  private rgSearch(terms: string[], rgArgs: string[]): SearchResult {
    const base = [...scopeArgs(this.requiredPrefix), ...stableOutputArgs(rgArgs), ...rgArgs]

    if (terms.length === 0) {
      return {type: `rg`, data: `❌ No terms provided. Use: bun docs-finder <rgArgs...> -- <terms...>`}
    }

    if (terms.length >= 2) {
      const files = this.intersectFilesContainingAllTerms(terms, rgArgs)
      if (files.length === 0) {
        return {
          type: `rg`,
          data: `❌ No matches where ALL terms exist in the same doc file.\n\n` + `Try:\n` + `  bun docs-finder -i -- ${terms.join(` `)}\n` + `  bun docs-finder ${terms[0]}\n`
        }
      }

      const args = [...base, `--fixed-strings`]
      for (const t of terms) args.push(`-e`, t)
      args.push(...files)

      const res = runRg(this.docsDir, args)
      if ((res as any).error) {
        return {type: `rg`, data: `❌ rg failed: ${(res as any).error?.message || `Unknown error`}`}
      }

      const {text, omitted} = trimOutputByLines(res.stdout || ``, MAX_OUTPUT_LINES)
      const meta = `🔎 rg (AND-by-file) [prefix=${this.requiredPrefix}]\n` + `    terms: ${terms.join(` `)}\n` + (rgArgs.length ? `    rgArgs: ${rgArgs.join(` `)}\n` : ``) + `    filesMatchedAllTerms: ${files.length}\n\n`

      return {type: `rg`, data: meta + text + (omitted ? `\n…omitted ${omitted} more lines\n` : ``)}
    }

    // single term
    const single = terms[0]
    const wantsRegex = rgArgs.includes(`--pcre2`) || rgArgs.includes(`--regexp`) || rgArgs.includes(`-e`)
    const args = [...base]
    if (!wantsRegex && !rgArgs.includes(`--fixed-strings`) && !rgArgs.includes(`-F`)) {
      args.push(`--fixed-strings`)
    }
    args.push(single, `.`)

    const res = runRg(this.docsDir, args)
    if ((res as any).error) {
      return {type: `rg`, data: `❌ rg failed: ${(res as any).error?.message || `Unknown error`}`}
    }
    if (res.status === 1 && !(res.stdout || ``).trim()) {
      return {type: `rg`, data: `❌ No matches.\n`}
    }

    const {text, omitted} = trimOutputByLines(res.stdout || ``, MAX_OUTPUT_LINES)
    const meta = `🔎 rg [prefix=${this.requiredPrefix}]\n` + `    term: ${single}\n` + (rgArgs.length ? `    rgArgs: ${rgArgs.join(` `)}\n` : ``) + `\n`

    return {type: `rg`, data: meta + text + (omitted ? `\n…omitted ${omitted} more lines\n` : ``)}
  }

  public searchSkillMode(rgArgs: string[], terms: string[]): SearchResult {
    if (terms.length === 0) return this.listAllClasses()

    // Only do exact doc open when user did NOT pass any rg args (unambiguous)
    if (rgArgs.length === 0 && terms.length === 2) {
      const exact = this.getExactDoc(terms[0], terms[1])
      if (exact.type === `file`) return exact
      return this.rgSearch(terms, rgArgs)
    }

    if (rgArgs.length === 0 && terms.length === 1) {
      const q = terms[0]
      const classExists = this.docFiles.some((d) => d.className.toLowerCase() === q.toLowerCase())
      if (classExists) return this.listClassMembers(q)
      return this.suggestByMember(q)
    }

    return this.rgSearch(terms, rgArgs)
  }

  public output(result: SearchResult): void {
    if (result.type === `list` || result.type === `suggestions` || result.type === `rg`) {
      console.log(result.data)
      return
    }

    const docs = result.data as DocFile[]
    for (const doc of docs) {
      const content = fs.readFileSync(doc.filePath, `utf8`)
      console.log(`\n${`=`.repeat(60)}`)
      console.log(`📄 ${doc.prefix}.${doc.className}.${doc.memberName}`)
      console.log(`${`=`.repeat(60)}\n`)
      console.log(content)
    }
  }

  public static helpText(prefix: string, docsDir: string): string {
    return [
      `Gramstax Docs Finder (ripgrep-first, Bun-safe)`,
      ``,
      `DocsDir: ${docsDir}`,
      `Prefix : ${prefix}`,
      ``,
      `Skill mode (no flags):`,
      `  bun docs-finder`,
      `  bun docs-finder <className>`,
      `  bun docs-finder <className> <memberName>`,
      `  bun docs-finder <word...>`,
      ``,
      `100% rg syntax passthrough (use "--"):`,
      `  bun docs-finder -A 5 -B 2 -- inlineKeyboard`,
      `  bun docs-finder -C 3 -- inlineKeyboard`,
      `  bun docs-finder -g "gramstax.ctx.*.md" -- inlineKeyboard`,
      `  bun docs-finder --pcre2 -- "\\\\binlineKeyboard\\\\b"`,
      ``,
      `RAW rg mode (no "--", but any "-flag" exists):`,
      `  bun docs-finder --pcre2 -n -e "\\\\binlineKeyboard\\\\b"`,
      ``,
      `Env: DOCS_DIR, DOCS_PREFIX, RG_PATH, DOCS_FINDER_MAX_LINES`,
      ``
    ].join(`\n`)
  }
}

// CLI
function main(): void {
  const argvRaw = process.argv.slice(2)
  const parsed = parseArgs(argvRaw)

  const docsDir = DEFAULT_DOCS_DIR
  const prefix = DEFAULT_PREFIX

  if (parsed.version) {
    console.log(`gramstax-docs-finder 1.0.0`)
    return
  }

  if (parsed.help) {
    console.log(DocsFinder.helpText(prefix, docsDir))
    return
  }

  const finder = new DocsFinder(docsDir, prefix)

  // RAW rg mode: forward args verbatim to rg, inside docsDir and scoped.
  if (parsed.rawRgMode) {
    const args = [...scopeArgs(prefix), ...parsed.rgArgs]
    const res = runRg(path.resolve(docsDir), args)

    if ((res as any).error) {
      console.error(`❌ rg failed: ${(res as any).error?.message || `Unknown error`}`)
      process.exit(1)
    }

    const {text, omitted} = trimOutputByLines(res.stdout || ``, MAX_OUTPUT_LINES)
    const meta = `🔎 rg (RAW MODE) [prefix=${prefix}]\n    rgArgs: ${parsed.rgArgs.join(` `)}\n\n`
    process.stdout.write(meta + text + (omitted ? `\n…omitted ${omitted} more lines\n` : ``))
    return
  }

  // Skill mode (includes rg passthrough via "--")
  const result = finder.searchSkillMode(parsed.rgArgs, parsed.terms)
  finder.output(result)
}

if (require.main === module) {
  main()
}

export {DocsFinder}
