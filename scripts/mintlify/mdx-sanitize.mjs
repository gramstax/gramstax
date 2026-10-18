import {readdirSync, readFileSync, statSync, writeFileSync} from "node:fs"
import {join, resolve} from "node:path"
import {fileURLToPath} from "node:url"

// Make api-documenter Markdown safe for the MDX parser.
//
// api-documenter emits two things MDX cannot parse:
//   1. HTML comments used as autolink escape spacers
//   2. bare <g-*> / <tg-*> block tags in prose, and inline `{` type literals
//
// Two escaping contexts, because they need different escapes:
//   - markdown text: a backslash escape works
//   - JSX/HTML children: a backslash is a literal character, so `{` still
//     opens an expression. HTML entities are the only escape that works there.
//
// Transforms are skipped inside fenced code blocks and inline code spans, so no
// code sample is ever altered. Escaping rather than backtick-wrapping keeps this
// a rendering fix rather than a content edit.

const ESC = String.fromCharCode(92) // "\"
const LBRACE_ENTITY = "&#123;"
const RBRACE_ENTITY = "&#125;"

const CODE_SPAN = /(`+)(?:[^`]|(?!\1)`[\s\S])*?\1/g
// Guards use a negative lookbehind so a second run is a no-op. Without it,
// running build:docs twice would escape the same page twice.
const PSEUDO_TAG = /(?<!\\)<([a-z][a-z0-9-]*)\/?>/g
const UNESCAPED_BRACE = /(?<!\\)\{/g

// Real HTML elements that api-documenter emits on purpose. Anything else that
// looks like a tag — `<g-venue>`, `<tg-emoji>`, the `<token>` in a Telegram
// API URL like /bot<token>/getMe — is prose that MDX would read as JSX.
const HTML_ELEMENTS = new Set([
  "a", "abbr", "b", "blockquote", "br", "code", "div", "em", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "i", "img", "li", "ol", "p", "pre", "span", "strong", "sub", "sup",
  "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul"
])
const FENCE = /^(\s*)(`{3,}|~{3,})/
const HTML_TAG = /<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*>/g

const stats = {files: 0, changed: 0, comments: 0, tags: 0, braces: 0, titles: 0}

function outsideCodeSpans(segment, fn) {
  let out = ""
  let last = 0
  CODE_SPAN.lastIndex = 0
  let m
  while ((m = CODE_SPAN.exec(segment)) !== null) {
    out += fn(segment.slice(last, m.index)) + m[0]
    last = m.index + m[0].length
  }
  return out + fn(segment.slice(last))
}

function stripComments(segment) {
  return segment.replace(/<!--[\s\S]*?-->/g, () => {
    stats.comments++
    return ""
  })
}

function escapePseudoTags(segment) {
  return segment.replace(PSEUDO_TAG, (match, name) => {
    if (HTML_ELEMENTS.has(name)) return match
    stats.tags++
    return ESC + match
  })
}

function escapeMarkdownText(segment) {
  return escapePseudoTags(segment).replace(UNESCAPED_BRACE, () => {
    stats.braces++
    return `${ESC}{`
  })
}

function escapeJsxChildren(segment) {
  return escapePseudoTags(segment).replace(UNESCAPED_BRACE, () => {
    stats.braces++
    return LBRACE_ENTITY
  }).replace(/\}/g, () => RBRACE_ENTITY)
}

// Track whether the cursor sits inside raw HTML, where children are JSX rather
// than markdown text. Self-closing and void tags do not open a block.
function htmlDelta(line) {
  let delta = 0
  HTML_TAG.lastIndex = 0
  let m
  while ((m = HTML_TAG.exec(line)) !== null) {
    const tag = m[0]
    if (tag.startsWith("</")) delta--
    else if (tag.endsWith("/>")) continue
    else if (/^<(br|hr|img|input|meta|link|source|area|base|col|embed|param|track|wbr)\b/i.test(tag)) continue
    else delta++
  }
  return delta
}

function sanitize(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const out = []
  let fenceChar = null
  let fenceLen = 0
  let htmlDepth = 0
  for (const line of lines) {
    const fm = line.match(FENCE)
    if (fenceChar !== null) {
      out.push(line)
      if (fm && fm[2][0] === fenceChar && fm[2].length >= fenceLen && line.slice(fm[1].length).trim() === fm[2]) {
        fenceChar = null
        fenceLen = 0
      }
      continue
    }
    if (fm) {
      fenceChar = fm[2][0]
      fenceLen = fm[2].length
      out.push(line)
      continue
    }
    const inJsx = htmlDepth > 0
    let result = outsideCodeSpans(line, stripComments)
    result = outsideCodeSpans(result, inJsx ? escapeJsxChildren : escapeMarkdownText)
    out.push(result)
    htmlDepth = Math.max(0, htmlDepth + htmlDelta(line))
  }
  return out.join("\n")
}

// Mintlify falls back to deriving a title from the file path, replacing dashes
// and underscores with spaces. Dots are not in that set, so every generated
// page would be titled "Gramstax.irouteauto" instead of "IRouteAuto" — wrong in
// the browser tab, in search results and in the social preview. The real name is
// already in the page's own heading, so take it from there.
const TITLE_KIND = /\s+(class|type|interface|function|variable|enum|namespace|package|method|property)\s*$/

function deriveTitle(text) {
  const heading = text.match(/^## (.+)$/m)
  if (!heading) return null
  const name = heading[1].replace(TITLE_KIND, "").replace(/\\/g, "").trim()
  return name.length > 0 ? name : null
}

// Double-quoted YAML, so any quote or backslash in a symbol name is escaped
// rather than silently terminating the scalar.
function yamlQuote(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

function addFrontmatter(text) {
  if (text.startsWith("---")) return text
  const title = deriveTitle(text)
  if (!title) return text
  stats.titles++
  return `---\ntitle: ${yamlQuote(title)}\n---\n\n${text.replace(/^\n+/, "")}`
}

function resetStats() {
  stats.files = 0
  stats.changed = 0
  stats.comments = 0
  stats.tags = 0
  stats.braces = 0
  stats.titles = 0
}

export function report(label) {
  console.log(`  ${label}: ${stats.files} file, ${stats.changed} berubah`)
  console.log(`    komentar HTML dibuang: ${stats.comments}`)
  console.log(`    tag semu di-escape   : ${stats.tags}`)
  console.log(`    '{' di-escape        : ${stats.braces}`)
  console.log(`    judul ditambahkan    : ${stats.titles}`)
}

export function runFile(p) {
  const before = readFileSync(p, "utf8")
  const after = addFrontmatter(sanitize(before))
  if (after !== before) writeFileSync(p, after, "utf8")
  stats.files++
  if (after !== before) stats.changed++
}

export function run(dir) {
  resetStats()
  for (const f of readdirSync(dir).filter(f => f.endsWith(".md"))) runFile(join(dir, f))
  report(dir)
}

// Direct invocation: sanitize a directory or a single file.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2]
  if (!target) {
    console.error(" usage: node mdx-sanitize.mjs <dir|file>")
    process.exit(1)
  }
  if (statSync(target).isDirectory()) run(target)
  else {
    resetStats()
    runFile(target)
    report(target)
  }
}