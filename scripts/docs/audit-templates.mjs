// Audit the docs corpus for claims the source cannot support.
//
// `audit-docs.mjs` deliberately skips fenced code blocks, on the theory that an
// example is for running rather than policing. That blind spot is where invented
// API survives, so this checker covers exactly the parts of a template example
// that must be real: the tag names, the attribute names, the `render*` option
// keys, and the export shape of a page class.
//
// Deliberately invalid examples are legitimate: the Rich HTML guide has to show
// `<table ngasal="x">` to explain that it fails. Those are listed in EXEMPT with
// the reason, keyed by file and tag so the entry survives an edit above it.

import {readdirSync, readFileSync, statSync} from "node:fs"
import {join, relative, resolve} from "node:path"
import {fileURLToPath} from "node:url"

const REPO = process.argv[2] ?? resolve(fileURLToPath(import.meta.url), "..", "..", "..")
const ENGINE = join(REPO, "packages/gramstax/src/template/engine.ts")
const CTX = join(REPO, "packages/gramstax/src/types/ctx.ts")
const DOCS = join(REPO, "docs-site")
const SKIP_DIRS = [`reference`]

const engine = readFileSync(ENGINE, "utf8")
const ctxTypes = readFileSync(CTX, "utf8")

function sliceBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker)
  if (start < 0) throw new Error(`missing marker: ${startMarker}`)
  const end = text.indexOf(endMarker, start)
  if (end < 0) throw new Error(`missing end marker after ${startMarker}`)
  return text.slice(start, end)
}

// The 29 PAGE blocks and the 54 Telegram tag literals (53 unique: tg-emoji is
// declared in both the legacy and the rich set).
const pageBlocks = new Set([...sliceBetween(engine, "static ALLOWED_BLOCKS_PAGE", "])").matchAll(/`<([a-z-]+)\/?>`/g)].map((m) => m[1]))
const legacy = sliceBetween(engine, "static ALLOWED_BLOCKS_TELEGRAM_LEGACY", "])")
const rich = sliceBetween(engine, "static ALLOWED_BLOCKS_TELEGRAM_RICH", "])")
const telegramBlocks = new Set([...legacy.matchAll(/`<([a-z0-9 -]+)\/?>`/g), ...rich.matchAll(/`<([a-z0-9 -]+)\/?>`/g)].map((m) => m[1].trim()))

// Allowed attributes per PAGE block: each validator hands its allow-set to
// `_validateBlockAttributes`. `g-media` is hard-coded because its call spans
// lines and reads badly through a regex.
const pageAttrs = new Map()
for (const m of engine.matchAll(/this\._validateBlockAttributes\(\s*template,\s*`([a-z-]+)`,\s*new Set\(\[([^\]]*)\]/g)) {
  pageAttrs.set(m[1], new Set([...m[2].matchAll(/`([^`]+)`/g)].map((a) => a[1])))
}
pageAttrs.set(`g-media`, new Set([`lang`, `type`, `src`, `shared`, `filename`, `latitude`, `longitude`, `live`, `phone`, `first_name`, `last_name`, `vcard`]))

// Telegram allow-lists, from the `_TELEGRAM_ALLOWED_ATTRS` object literal.
const telegramAttrs = new Map()
for (const m of sliceBetween(engine, "static _TELEGRAM_ALLOWED_ATTRS", "\n  }").matchAll(/([a-z0-9-]+|"[a-z0-9-]+"):\s*\[([^\]]*)\]/g)) {
  telegramAttrs.set(m[1].replaceAll(`"`, ``), new Set([...m[2].matchAll(/`([^`]+)`/g)].map((a) => a[1])))
}

// Keys accepted by a `render*` call. Each method takes a different param type,
// so this is the union over every render-related type rather than one union: the
// question is only "does this key exist anywhere the render API accepts
// options", which catches an invented `args` without pretending to model each
// overload. Prefixes that name result types (IKb*, IAnswer*, ICallback*) are
// excluded on purpose, because their keys are not options.
const ROUTE_KEYS = new Set()
const RENDER_TYPES = /^export type I(Render|Opt|Route|Content|Broadcast|Media|Poll|Edit|Inline|Bottom)/gm
for (const m of ctxTypes.matchAll(RENDER_TYPES)) {
  const start = m.index
  const nextExport = ctxTypes.indexOf(`\nexport `, start + 1)
  const body = ctxTypes.slice(start, nextExport < 0 ? ctxTypes.length : nextExport)
  for (const k of body.matchAll(/^\s{2}([a-zA-Z]+)\??:/gm)) ROUTE_KEYS.add(k[1])
}

// Examples whose whole point is that they are rejected. Keyed by file and tag so
// inserting a paragraph above does not silently disable the exemption.
const EXEMPT = new Map([
  [`concepts/templates.md|table`, `shows an unknown attribute being rejected, in a sentence that says so`],
  [`guides/rich-html.md|table`, `shows the rejection the comment below it quotes`],
  [`guides/rich-html.md|b`, `shows the rejection the comment below it quotes`]
])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.includes(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.mdx?$/.test(full)) out.push(full)
  }
  return out
}

const problems = []
const TAG = /<(g-[a-z-]+|tg-[a-z-]+|[a-z][a-z0-9]*)(\s[^<>]*?)?\/?>/g
const files = walk(DOCS)

for (const file of files) {
  const rel = relative(REPO, file).replaceAll(`\\`, `/`).replace(/^docs-site\//, ``)
  const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n")
  const lines = text.split("\n")
  const lineOf = (index) => text.slice(0, index).split("\n").length
  const push = (line, kind, detail) => problems.push({rel, line, kind, detail, snippet: lines[line - 1]?.trim().slice(0, 78) ?? ``})

  for (const m of text.matchAll(TAG)) {
    const tag = m[1]
    const attrText = m[2] ?? ``
    const isG = tag.startsWith(`g-`)
    const isTg = tag.startsWith(`tg-`) || telegramBlocks.has(tag)
    if (!isG && !isTg) continue
    const line = lineOf(m.index)
    if (EXEMPT.has(`${rel}|${tag}`)) continue

    if (isG && !pageBlocks.has(tag)) {
      push(line, `unknown PAGE block`, `<${tag}>`)
      continue
    }
    if (!isG && !telegramBlocks.has(tag)) {
      push(line, `unknown Telegram block`, `<${tag}>`)
      continue
    }
    const allowed = isG ? pageAttrs.get(tag) : telegramAttrs.get(tag)
    if (!allowed) continue
    for (const a of attrText.matchAll(/([a-zA-Z_][a-zA-Z0-9_:.-]*)\s*=/g)) {
      if (a[1].startsWith(`{{`)) continue
      if (allowed.has(a[1])) continue
      push(line, `${isG ? `PAGE` : `Telegram`} attribute not allowed`, `<${tag} ${a[1]}=...>`)
    }
  }

  // A page class may be a default export and still load: `_getFile` takes
  // `Object.values(mod)[0]`, so the real hazard is a second export, not the
  // default. Flag the shape only when a page-shaped class uses it, which is the
  // form every guide recommends against.
  for (const m of text.matchAll(/export\s+default\s+class/g)) {
    push(lineOf(m.index), `default page export`, `export default class`)
  }

  for (const m of text.matchAll(/\brender[A-Z]\w*\(\s*\{/g)) {
    const open = text.indexOf(`{`, m.index)
    let depth = 0
    let end = open
    for (let i = open; i < text.length; i++) {
      if (text[i] === `{`) depth++
      else if (text[i] === `}`) {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    const body = text.slice(open + 1, end)
    let d = 0
    let start = 0
    const chunks = []
    for (let i = 0; i < body.length; i++) {
      const c = body[i]
      if (`{[(`.includes(c)) d++
      else if (`}])`.includes(c)) d--
      else if (c === `,` && d === 0) {
        chunks.push(body.slice(start, i))
        start = i + 1
      }
    }
    chunks.push(body.slice(start))
    for (const chunk of chunks) {
      const key = chunk.match(/^\s*(?:\/\/[^\n]*\n\s*)*([a-zA-Z_$][\w$]*)\s*[:(]/)
      if (!key || ROUTE_KEYS.has(key[1])) continue
      push(lineOf(m.index), `unknown render option`, `${m[0].replace(/\(\s*$/, ``)}${key[1]}`)
    }
  }
}

// Coverage floor: a registry entry that never appears anywhere in the corpus is
// undocumented. This is presence, not depth: it catches a block added to the
// engine and never written down, which is the failure a reader actually hits.
const corpusText = files.map((f) => readFileSync(f, "utf8")).join("\n")
const mentioned = (name) => corpusText.includes(`<${name}>`) || corpusText.includes(`<${name} `) || corpusText.includes(`\`${name}\``)
for (const name of pageBlocks) {
  if (!mentioned(name)) problems.push({rel: `docs-site (coverage)`, line: 0, kind: `undocumented PAGE block`, detail: `<${name}>`, snippet: ``})
}
for (const name of telegramBlocks) {
  if (!mentioned(name)) problems.push({rel: `docs-site (coverage)`, line: 0, kind: `undocumented Telegram tag`, detail: `<${name}>`, snippet: ``})
}
for (const name of ROUTE_KEYS) {
  if (!new RegExp(`\\b${name}\\b`).test(corpusText)) problems.push({rel: `docs-site (coverage)`, line: 0, kind: `undocumented render option`, detail: name, snippet: ``})
}

const byFile = new Map()
for (const p of problems) {
  if (!byFile.has(p.rel)) byFile.set(p.rel, [])
  byFile.get(p.rel).push(p)
}

console.log(`PAGE blocks ${pageBlocks.size} · Telegram blocks ${telegramBlocks.size} · render option keys ${ROUTE_KEYS.size}`)
console.log(`Corpus: ${files.length} pages`)

if (problems.length === 0) {
  console.log(`\nOK  every registry entry is mentioned, and no example uses one that is not real`)
  process.exit(0)
}

console.log(`\nFAIL  ${problems.length} finding(s) in ${byFile.size} file(s)\n`)
for (const [rel, list] of [...byFile.entries()].sort()) {
  console.log(`  ${rel}  (${list.length})`)
  for (const p of list) console.log(`    ${String(p.line).padStart(5)}  ${p.kind.padEnd(27)} ${p.detail}`)
  console.log()
}
process.exit(1)
