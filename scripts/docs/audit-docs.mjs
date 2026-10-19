// Audit authored prose in docs-site/ against packages/gramstax/src/.
//
//   node scripts/docs/audit-docs.mjs [--json]
//
// `tsc`, `biome lint` and `bun test` all read code. None of them read Markdown,
// so a doc can name `handleCallbackData` for years after the method was renamed
// to `handleCallbackQueryData` and nothing notices. This is the guard.
//
// Scope: every git-tracked .md under docs-site/ EXCEPT docs-site/reference/,
// which is api-documenter output owned by docs.yml and regenerated wholesale.
// docs/research/ is not under docs-site/ and is likewise excluded.
//
// Two tiers, by how unambiguous the evidence is:
//
//   TIER 1 (exit 1) — a backticked span names an identifier that appears
//     nowhere in packages/gramstax/src/. A name in prose that is absent from
//     source is wrong, full stop. No interpretation.
//
//   TIER 2 (exit 0) — a numeric claim that contradicts source, or a file path
//     that does not exist. These drift on purpose during refactors, so they
//     warn; a maintainer triages them by hand.
//
// Fenced code blocks are excluded from TIER 1. They are runnable examples, and
// an example that does not compile is a different (also real) bug. They are
// still reported, under INFO, so the signal is not thrown away.
//
// The hard part is TIER 1 precision. A first cut flagged 944 of 1,552 symbols
// because it only accepted formal declarations, so `render` (mentioned in JSDoc
// but never declared) counted as missing. Three changes fixed it:
//
//   1. any token occurring anywhere in source counts — declaration, body,
//      comment, JSDoc, string literal;
//   2. spans that name a file go to TIER 2, where the test is existence rather
//      than vocabulary;
//   3. shapes that cannot be JavaScript identifiers are dropped outright —
//      dashed DSL tags, SCREAMING_SNAKE env vars, `render*` family wildcards —
//      and names source *composes* in a template literal rather than declares
//      (`gramstax_updates_${key}_total`) are accepted by shape, so a new
//      outcome counter needs no edit here.
//
// Plus an explicit allowlist of language keywords, CLI verbs, package names and
// config keys, and a scraped one for npm deps, Node builtins and root scripts.
// Every identifier this guard rejects in prose is a real doc defect; when that
// stops being true the allowlist is what should grow, not the tolerance. The
// report prints the counts and every suppression category, so a rising
// false-positive rate is visible rather than discovered by an author who stopped
// trusting the output.

import {execFileSync} from "node:child_process"
import {existsSync, readFileSync} from "node:fs"
import {builtinModules} from "node:module"
import {dirname, join, resolve} from "node:path"
import {fileURLToPath} from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, "..", "..")
const DOCS_SITE = "docs-site"
const SRC = "packages/gramstax/src"
const EXCLUDED_PREFIXES = ["docs-site/reference/", "docs/research/"]

// ---------------------------------------------------------------------------
// git / fs
// ---------------------------------------------------------------------------

// No shell: execFileSync keeps this working under Git Bash, cmd and CI alike.
function git(args) {
  return execFileSync("git", args, {cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024})
}

function tracked(keep) {
  return git(["ls-files"]).split("\n").filter(Boolean).filter(keep)
}

const read = rel => readFileSync(join(REPO, rel), "utf8")

const SRC_FILES = tracked(f => f.startsWith(`${SRC}/`) && f.endsWith(".ts"))
if (SRC_FILES.length === 0) throw new Error(`no tracked .ts under ${SRC}/ — run this from a full checkout`)
const SRC_TEXT = SRC_FILES.map(read).join("\n")

const DOC_FILES = tracked(f => f.endsWith(".md") && f.startsWith(`${DOCS_SITE}/`) && !EXCLUDED_PREFIXES.some(p => f.startsWith(p)))

// ---------------------------------------------------------------------------
// Markdown scanning
// ---------------------------------------------------------------------------

// Same fence shape as scripts/mintlify/mdx-sanitize.mjs, so both scripts agree
// on what counts as a code block.
const FENCE = /^(\s*)(`{3,}|~{3,})/
// Same span shape as mdx-sanitize.mjs, including the run-length backtick match
// that lets a span contain a single backtick.
const CODE_SPAN = /(`+)(?:[^`]|(?!\1)`[\s\S])*?\1/g

// Every line, with its 1-based number and whether it sits inside a fenced block.
function scanLines(text) {
  const out = []
  let fenceChar = null
  let fenceLen = 0
  const all = text.replace(/\r\n/g, "\n").split("\n")
  for (let i = 0; i < all.length; i++) {
    const line = all[i]
    const fm = line.match(FENCE)
    if (fenceChar !== null) {
      if (fm && fm[2][0] === fenceChar && fm[2].length >= fenceLen && line.slice(fm[1].length).trim() === fm[2]) {
        fenceChar = null
        fenceLen = 0
      }
      out.push({no: i + 1, line, fenced: true})
      continue
    }
    if (fm) {
      fenceChar = fm[2][0]
      fenceLen = fm[2].length
      out.push({no: i + 1, line, fenced: true})
      continue
    }
    out.push({no: i + 1, line, fenced: false})
  }
  return out
}

// Every inline code span on a line, with its character offset.
function* spans(line) {
  CODE_SPAN.lastIndex = 0
  let m
  while ((m = CODE_SPAN.exec(line)) !== null) {
    yield {at: m.index, raw: m[0].replace(/^`+|`+$/g, "")}
  }
}

// ---------------------------------------------------------------------------
// Shape tests
// ---------------------------------------------------------------------------

// A span is a path claim, not a symbol claim, when it names a file: it has a
// directory separator, or it is a single dotted filename (`biome.json`,
// `AGENTS.md`). Those belong to TIER 2, which checks existence instead of
// vocabulary, so a wrong path warns instead of failing the build.
function isPathLike(raw) {
  const s = raw.trim()
  if (s === "" || s.includes("\\")) return false
  if (s.includes("/")) return true
  return /^[\w@][\w@.-]*\.[A-Za-z0-9]{1,5}$/.test(s)
}

// Kept deliberately narrow: the character set real repo paths use. This rejects
// MDX and template noise such as `<g-space/>` and `[<cwd>/src/pages]})` before
// they reach the existence check.
function pathCharsetOk(p) {
  return /^[.\w@~-][.\w@~/-]*$/.test(p)
}

// ---------------------------------------------------------------------------
// Source vocabulary
// ---------------------------------------------------------------------------

// Any occurrence counts, not just a declaration. See the header note.
const SOURCE_TOKENS = new Set(SRC_TEXT.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || [])

// ---------------------------------------------------------------------------
// Allowlist: tokens that are not gramstax API symbols
// ---------------------------------------------------------------------------

// Three groups, none of which can ever be a `packages/gramstax/src` symbol:
//
//   1. language / platform vocabulary — `console`, `bun`, `grammar`
//   2. tooling this repo runs but does not own — `tsup`, `nx`, biome.json keys
//   3. prose words authors legitimately inline in backticks — `Docs`, `Node`
//
// Kept as an explicit list rather than scraped, so a maintainer can see exactly
// what is being tolerated. AUX_TOKENS below absorbs the boring remainder.
const NON_API_TOKENS = [
  // language keywords and TS/JS builtins
  "await", "async", "any", "boolean", "const", "else", "enum", "false", "function", "import", "instanceof", "interface", "let", "never", "null", "number", "object", "readonly", "record", "string", "symbol", "this", "true", "typeof", "undefined", "unknown", "void",
  // Node platform
  "console", "process", "require", "module", "exports", "global", "Buffer", "setTimeout", "setInterval", "clearTimeout", "clearInterval", "watchFile", "watch",
  // runtimes, CLIs and build tools
  "bun", "bunfig", "npm", "pnpm", "yarn", "lts", "ci", "lint", "bench", "test", "build", "docs", "dev", "start", "preview", "deploy", "init", "add", "install", "remove", "run", "exec", "biome", "eslint", "prettier", "tsup", "nx", "vitest", "jest", "chokidar", "telegraf",
  // config-file keys and package metadata named in prose
  "AGENTS", "md", "yml", "toml", "dts", "cjs", "esm", "minify", "sourcemap", "esnext", "targetDefaults", "dependsOn", "peerDependencies", "workspaces", "trailingComma", "printWidth", "lineWidth", "quoteStyle", "semicolons", "useTabs", "indentStyle", "bracketSpacing", "asNeeded", "always", "never",
  // Biome option and rule names, in both the camelCase (json) and kebab-case
  // (rule id) spellings the docs use interchangeably
  "arrowParens", "no-explicit-any", "Biome",
  // shell verbs and filter-argument placeholders
  "rm", "ls", "cd", "mkdir", "singular", "plural", "places",
  // route and page names from the worked examples: the build guide's project in
  // prose, and the page names the example bots actually ship
  "shop", "blank",
  // external CLIs and tools named in prose
  "bunx", "gh", "k6",
  // release labels named in prose ("on v5", "v6 removed it")
  "v5", "v6",
  // generated-document layout, referenced as directories rather than files
  "extractor", "documenter", "yaml",
  // sibling packages and out-of-scope trees
  "lmdb", "worker-thread", "packages", "guides", "reference", "navigation", "docs-site", "mintlify", "mdx",
  // prose words authors legitimately inline
  "grammar", "typescript", "javascript", "Docs", "Node", "API", "REST", "JSON", "HTML", "CSS", "MDX", "SDK", "CLI", "URL", "URI", "HTTP", "HTTPS", "RPC", "LRU", "TTL"
]

// Everything reachable outside packages/gramstax/src that a doc may legitimately
// name: npm dependency names, Node builtin modules, root script names, config
// keys. Scraped rather than listed, so adding a dependency does not require
// touching this file.
const AUX_TOKENS = new Set()

function addAux(text) {
  for (const t of String(text).match(/[A-Za-z_$][A-Za-z0-9_$-]*/g) || []) AUX_TOKENS.add(t)
}

for (const rel of tracked(f => f === "package.json" || f.endsWith("/package.json"))) {
  try {
    const pkg = JSON.parse(read(rel))
    addAux(pkg.name ?? "")
    for (const field of ["scripts", "dependencies", "devDependencies", "peerDependencies"]) {
      for (const key of Object.keys(pkg[field] ?? {})) addAux(key)
    }
  } catch {
    // A malformed package.json is not this script's problem.
  }
}
for (const m of builtinModules) addAux(m)
for (const cfg of ["biome.json", "tsconfig.json", "bunfig.toml", "nx.json"]) {
  if (existsSync(join(REPO, cfg))) addAux(read(cfg))
}

// In-repo TypeScript outside packages/gramstax/src: the build scripts the AOT
// guide cites by path, the scaffold templates the configuration guide
// describes, the `@gramstax/lmdb` symbols the persistence guide uses, the
// `@gramstax/worker-thread` symbols the concurrency guide uses, and the example
// bots' own classes, which the examples guide names in prose. Not the source of
// truth — a wrong library name is still a FAIL.
//
// Harvested with the same rule as the primary corpus: any identifier token
// counts, not only a declared name. The stricter rule that used to apply here
// was the defect, not the design. It made the two corpora disagree about the
// same question — "does this word occur in the code this page documents" — and
// the answer differed by accident of which syntax the name happened to use. A
// sibling package's option key (`maxDbs`, `compression`) and the template
// author's own class field (`gindex`, `cacheData`) are exactly as real as its
// exports, yet neither is declared with `const`/`let`/`var` nor written as
// `name(...)`, so a declarations-only harvest could not see either. The same
// blindness swallowed every `@gramstax/worker-thread` symbol, because that
// package was missing from this list entirely — it is a published sibling and
// belongs beside `packages/lmdb`.
//
// The tradeoff this change accepts, and how it is paid for. Whole-token
// harvesting also reads comments, and a comment is exactly where a renamed API
// lingers, so a doc repeating a stale name would be vouched for by a comment
// repeating the same stale name. That protection was the one real thing the old
// rule bought, so it is kept explicitly: comments are stripped before the token
// regex runs (see stripComments below). Restoring it by hand buys back the
// option keys the old rule could not see.
//
// What is given up, stated plainly so the next reader does not have to guess: a
// name that survives only inside a comment is no longer accepted from these
// corpora. That is the right direction to fail in. The primary corpus still
// accepts comments on purpose, because packages/gramstax/src is code this repo
// owns and a comment there is evidence rather than an echo — but a sibling
// package's comment is neither declared nor called, and a doc naming it deserves
// the FAIL.

// Comments out, everything else through verbatim, in one pass. Two `replace`
// calls cannot do this: no regex tells the `//` in `"https://x"` from a comment
// start, and getting that wrong deletes real identifiers, which would show up as
// phantom FAILs rather than as the missing-name signal it is. The frame stack is
// what keeps the nested cases honest — a template literal's `${…}` re-enters
// code mode at brace depth zero, so a `}` closes the interpolation instead of
// running the rest of the line into a string.
function stripComments(text) {
  const out = []
  const stack = [{kind: "code", depth: 0}]
  let i = 0
  while (i < text.length) {
    const frame = stack[stack.length - 1]
    const c = text[i]

    if (frame.kind === "line") {
      // Keep the newline. Dropping it would glue the identifiers on either side
      // of the comment into one token that exists in neither file.
      if (c === "\n") {
        stack.pop()
        out.push(c)
      }
      i++
      continue
    }

    if (frame.kind === "block") {
      if (c === "*" && text[i + 1] === "/") {
        stack.pop()
        i += 2
        continue
      }
      if (c === "\n") out.push(c)
      i++
      continue
    }

    if (frame.kind === "quote") {
      if (c === "\\") {
        out.push(c, text[i + 1] ?? "")
        i += 2
        continue
      }
      if (c === frame.delim) {
        stack.pop()
        out.push(c)
        i++
        continue
      }
      if (frame.delim === "`" && c === "$" && text[i + 1] === "{") {
        stack.push({kind: "code", depth: 0})
        out.push(c, "{")
        i += 2
        continue
      }
      out.push(c)
      i++
      continue
    }

    if (c === "/" && text[i + 1] === "/") {
      stack.push({kind: "line"})
      i += 2
      continue
    }
    if (c === "/" && text[i + 1] === "*") {
      stack.push({kind: "block"})
      i += 2
      continue
    }
    if (c === `"` || c === "'" || c === "`") {
      stack.push({kind: "quote", delim: c})
      out.push(c)
      i++
      continue
    }
    if (c === "{") frame.depth++
    // Depth zero means this `}` is the one that closes an enclosing `${`, so it
    // pops back into the template literal rather than counting as a block end.
    else if (c === "}") {
      if (frame.depth === 0) stack.pop()
      else frame.depth--
    }
    out.push(c)
    i++
  }
  return out.join("")
}

for (const aux of ["packages/gramstax/scripts", "packages/create-gramstax/src", "packages/lmdb/src", "packages/worker-thread/src", "example"]) {
  for (const f of tracked(p => p.startsWith(`${aux}/`) && p.endsWith(".ts"))) {
    addAux(stripComments(read(f)))
  }
}

// Placeholder names, not API symbols: the compiler-emitted identifiers the AOT
// guide names by shape (`fN`, `__fN`) and the filename-collision example
// (`a_b`). A guard that flags these teaches authors to ignore it.
const ILLUSTRATIVE_TOKENS = new Set(["fN", "__fN", "a_b"])

// Names that are real but belong to nobody in this repository, so no source
// corpus here can ever vouch for them. Left as explicit entries because each one
// is a one-clause claim about a specific sentence, and a reader deciding whether
// to trust the guard needs to see the claim, not infer it.
const EXTERNAL_TOKENS = new Set([
  // the observability guide's own instruction to scrape `/metrics` by hand
  "curl",
  // a PromQL aggregation the reader applies to their own instrumentation
  "histogram_quantile",
  // the fixed prefix the metrics serializer composes every series name under.
  // isComposedName needs a suffix as well, and this sentence is about the prefix
  // standing alone.
  "gramstax_updates_",
  // a generic type parameter written in prose (`handleCaption<Kind>`)
  "Kind"
])

const ACCEPTED = new Set([...SOURCE_TOKENS, ...NON_API_TOKENS, ...AUX_TOKENS])

// A migration guide names the API its release removed, so the left column of a
// rename table has nothing in the current source to point at. TIER 1 is scoped
// off for one file and only for an explicit list, so an invented name in a
// migration guide still fails.
//
// Kept literal rather than scraped from a tag: `actions/checkout` in docs.yml
// runs with the default `fetch-depth: 1`, so `git show v5.0.0:...` is not
// available in CI. Each name was checked by hand with `git grep -l <name> v5.0.0`.
const MIGRATION_DOCS = new Set(["docs-site/guides/migrating-to-6.md"])

// Two groups. Sixteen shipped in v5 and were removed by v6, so they are the
// rename tables' "v5" column:
//   _webhookSecretToken, broadcastOpts, fallbackEdit, options1, options2,
//   pollingDispatcher, pollingQueue, pollingQueueInstance, renderBroadcastEdit,
//   renderBroadcastMedia, renderBroadcastPoll, renderChunked, webhookDispatcher,
//   webhookDrainTimeoutMs, webhookQueueInstance, webhookServer
// The other six never shipped at either tag. They are the pre-release param
// names and the intermediate v6 field names, and the page says so out loud in
// `## Param types carry the I prefix` and in the labelled note under the route
// rename table, so a reader is never told these were ever public API:
//   BroadcastSendParams, IRenderMode, optionsEdit1, optionsEdit2,
//   RenderMediaParams, RenderTextParams
const REMOVED_TOKENS = new Set([
  "_webhookSecretToken",
  "broadcastOpts",
  "fallbackEdit",
  "options1",
  "options2",
  "pollingDispatcher",
  "pollingQueue",
  "pollingQueueInstance",
  "renderBroadcastEdit",
  "renderBroadcastMedia",
  "renderBroadcastPoll",
  "renderChunked",
  "webhookDispatcher",
  "webhookDrainTimeoutMs",
  "webhookQueueInstance",
  "webhookServer",
  "BroadcastSendParams",
  "IRenderMode",
  "optionsEdit1",
  "optionsEdit2",
  "RenderMediaParams",
  "RenderTextParams"
])

// ---------------------------------------------------------------------------
// TIER 1 — unknown identifiers in prose spans
// ---------------------------------------------------------------------------

const SYMBOL = /^[A-Za-z_$]/
// A hyphen can never appear in a JavaScript identifier, so a hyphenated token
// is a DSL tag (`g-message`), a deploy-adapter key (`cloudflare-mod`), an HTML
// attribute (`emoji-id`) or a date-format token (`YYYY-MM-DD`). None of those
// are checkable against a TypeScript source file.
const HYPHENATED = /^[A-Za-z_$][A-Za-z0-9_$-]*-/
// SCREAMING_SNAKE is an environment-variable or secret-name convention, used
// in the docs for the reader's own deployment.
const ENV_VAR = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/

function editDistance(a, b) {
  let prev = Array.from({length: b.length + 1}, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = row
  }
  return prev[b.length]
}

// Closest real name in the repo, so the report can say what it should have
// been. Edit distance with a wide window, because the usual mistake in these
// docs is dropping or inserting a qualifier rather than misspelling a word:
// `handleArgsCallbackQueryData` written as `handleArgsCallbackData` is five
// edits, not one. Among candidates within one edit of the best score, the
// longest shared prefix wins, then the longer name — a truncated long name is
// the common failure, and its untruncated form is the answer. Two passes, so
// the result does not depend on Set iteration order. Only runs on the handful
// of failures, so cost is irrelevant.
function suggest(token) {
  const scored = []
  for (const candidate of new Set([...SOURCE_TOKENS, ...AUX_TOKENS])) {
    if (Math.abs(candidate.length - token.length) > 8) continue
    const d = editDistance(token, candidate)
    if (d > 6) continue
    let head = 0
    while (head < token.length && head < candidate.length && token[head] === candidate[head]) head++
    scored.push({candidate, d, head})
  }
  if (scored.length === 0) return null
  const min = Math.min(...scored.map(s => s.d))
  const pool = scored.filter(s => s.d <= min + 1)
  pool.sort((a, b) => a.d - b.d || b.head - a.head || Math.abs(a.candidate.length - token.length) - Math.abs(b.candidate.length - token.length))
  return pool[0].candidate
}

// `render*`, `_processScope*`, `_processG*Blocks` all name a family, not one
// member. Check that at least one source token starts with the prefix, which is
// the claim the author is actually making.
function familyExists(prefix) {
  for (const token of SOURCE_TOKENS) if (token.startsWith(prefix)) return true
  return false
}

// A name source *composes* rather than declares is just as real, and is the
// same class of error as a family wildcard one level down. `helpers/metrics.ts`
// emits `gramstax_updates_${key}_total`, so the outcome series —
// `gramstax_updates_matched_total`, `gramstax_updates_blocked_total`, and any
// `gramstax_updates_<key>_total` a future doc writes — exist nowhere in source
// as literals. Derive the shapes instead of allowlisting today's names, which
// would break the moment someone documents a new outcome.
const TEMPLATE_LITERAL = /`((?:[^`\\]|\\.)*)`/g

function composedNames() {
  const pairs = new Map()
  TEMPLATE_LITERAL.lastIndex = 0
  let t
  while ((t = TEMPLATE_LITERAL.exec(SRC_TEXT)) !== null) {
    if (!t[1].includes("${")) continue
    // Split the body into alternating literal and interpolation runs.
    const segs = []
    let lit = ""
    let i = 0
    while (i < t[1].length) {
      if (t[1][i] === "$" && t[1][i + 1] === "{") {
        segs.push(lit)
        i++
        let depth = 0
        for (; i < t[1].length; i++) {
          if (t[1][i] === "{") depth++
          else if (t[1][i] === "}") {
            depth--
            if (depth === 0) { i++; break }
          }
        }
        lit = ""
        continue
      }
      lit += t[1][i]
      i++
    }
    segs.push(lit)
    // The literal before an interpolation is the name's prefix; the literal
    // after it is the suffix. Both must be non-empty and identifier-shaped, so
    // `… ${value}` (an interpolated value, not a name) contributes nothing, and
    // a dangling `gramstax_updates_` still fails for want of a suffix.
    for (let k = 1; k < segs.length; k++) {
      const pre = /[A-Za-z0-9_$]+$/.exec(segs[k - 1])?.[0] ?? ""
      const suf = /^[A-Za-z0-9_$]+/.exec(segs[k])?.[0] ?? ""
      if (pre !== "" && suf !== "") pairs.set(`${pre}|${suf}`, {pre, suf})
    }
  }
  return [...pairs.values()]
}

const COMPOSED = composedNames()

// The interpolated middle has to be non-empty, so this cannot accept a prefix
// or a suffix on its own.
function isComposedName(token) {
  return COMPOSED.some(p => token.length > p.pre.length + p.suf.length && token.startsWith(p.pre) && token.endsWith(p.suf))
}

const failures = []
const fencedMisses = []
const shapeSkipped = new Map()
let tokensChecked = 0
let tokensAccepted = 0

function skipShape(reason) {
  shapeSkipped.set(reason, (shapeSkipped.get(reason) ?? 0) + 1)
}

for (const file of DOC_FILES) {
  for (const {no, line, fenced} of scanLines(read(file))) {
    for (const {raw, at} of spans(line)) {
      const trimmed = raw.trim()
      // Nothing symbol-shaped, or it is a path: paths belong to TIER 2, where
      // a wrong path warns instead of failing the build.
      if (trimmed === "" || !SYMBOL.test(trimmed) || isPathLike(trimmed)) continue

      // Dotted chains: the head segment names the symbol, the tail is shape
      // detail (`process.env.BOT_TOKEN`, `helper.refreshLruCache`).
      const head = trimmed.split(/[.\s]+/)[0] ?? ""
      const names = head.match(/[A-Za-z_$][A-Za-z0-9_$-]*/g) || []
      const wildcard = head.includes("*")
      tokensChecked += names.length

      for (const name of names) {
        if (ACCEPTED.has(name)) {
          tokensAccepted++
          continue
        }
        if (MIGRATION_DOCS.has(file) && REMOVED_TOKENS.has(name)) {
          skipShape("API removed by the release this guide migrates to")
          continue
        }
        if (HYPHENATED.test(name)) {
          skipShape("dashed name (DSL tag / adapter key / attribute)")
          continue
        }
        if (ENV_VAR.test(name)) {
          skipShape("SCREAMING_SNAKE (env var / secret name)")
          continue
        }
        if (ILLUSTRATIVE_TOKENS.has(name)) {
          skipShape("illustrative placeholder name")
          continue
        }
        if (EXTERNAL_TOKENS.has(name)) {
          skipShape("external name, not this repository's API")
          continue
        }
        if (isComposedName(name)) {
          skipShape("composed by a source template literal")
          continue
        }
        if (wildcard && familyExists(name)) continue
        const hit = {file, line: no, col: at + 1, token: name, span: trimmed, hint: suggest(name)}
        if (fenced) fencedMisses.push(hit)
        else failures.push(hit)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// TIER 2 — numeric claims
// ---------------------------------------------------------------------------

// Every number a doc can write: digits (with separators), decimals, and English
// words, because "the twelve route atoms" is the same claim as "the 12 route
// atoms" and must be checked the same way.
const NUM = "(?:[0-9][0-9,]*(?:\\.[0-9]+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)"
const NUMBER_WORDS = {zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100}

function parseNumber(raw) {
  if (/^[0-9]/.test(raw)) return Number(raw.replace(/,/g, ""))
  let total = 0
  for (const part of raw.split("-")) {
    if (NUMBER_WORDS[part] === undefined) return null
    total += NUMBER_WORDS[part]
  }
  return total
}

// Bracket-match starting from the first opening delimiter after `from`, so a
// `{@link ...}` inside the preceding JSDoc is not mistaken for the body.
function blockAfter(text, from) {
  const opens = [text.indexOf("{", from), text.indexOf("[", from)].filter(i => i >= 0)
  if (opens.length === 0) return ""
  const start = Math.min(...opens)
  const open = text[start]
  const close = open === "{" ? "}" : "]"
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++
    else if (text[i] === close) {
      depth--
      if (depth === 0) return text.slice(start + 1, i)
    }
  }
  return ""
}

const CTX = read(`${SRC}/core/ctx.ts`)
const TYPES_CTX = read(`${SRC}/types/ctx.ts`)
const TYPES_CONFIG = read(`${SRC}/types/config.ts`)
const ENGINE = read(`${SRC}/template/engine.ts`)

function deriveRenderMethods() {
  // Ctx members only. Two-space indent is the class-body level in that file,
  // and the type parameters sit between the name and the paren
  // (`renderMedia<T extends Exclude<IMediaBlock[…], `group`>>(…)`), including
  // nested ones, so the pattern has to tolerate a whole `<…>` rather than a
  // run of non-`>` characters.
  const names = new Set()
  const re = /^\s{2}(?:public |private |protected )?(?:static )?(?:async )?(render[A-Za-z0-9_$]*)\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\s*\(/gm
  let m
  while ((m = re.exec(CTX)) !== null) names.add(m[1])
  return names.size
}

function deriveRouteTypes() {
  return [...TYPES_CTX.matchAll(/^export type (IRoute[A-Za-z0-9_$]*)/gm)].length
}

function deriveConfigMembers() {
  const at = TYPES_CONFIG.indexOf("export type IGramstaxConfig")
  if (at < 0) return 0
  const body = blockAfter(TYPES_CONFIG, TYPES_CONFIG.indexOf("=", at))
  return body.split("\n").filter(l => /^\s{2}[A-Za-z_$][\w$]*\??:/.test(l)).length
}

function deriveBotApiVersion() {
  return /static BOT_API_VERSION\s*=\s*[`'"]([^`'"]+)/.exec(ENGINE)?.[1] ?? null
}

function deriveRichTags() {
  const count = name => {
    const at = ENGINE.indexOf(`${name}:`)
    if (at < 0) return 0
    return blockAfter(ENGINE, at)
      .split("\n")
      .map(s => s.trim().replace(/,$/, "").trim())
      .filter(s => s.startsWith("`") && s.endsWith("`")).length
  }
  return count("ALLOWED_BLOCKS_TELEGRAM_LEGACY") + count("ALLOWED_BLOCKS_TELEGRAM_RICH")
}

function deriveReferencePages() {
  return tracked(f => f.startsWith(`${DOCS_SITE}/reference/`) && f.endsWith(".md")).length
}

// anchor: regex the claim must sit near. claim: regex capturing the claimed
// number. window: how far apart, in characters, the two may be. A check with
// `direct` skips the anchor entirely and relies on a capturing regex instead,
// which is the right shape when the anchor itself is ambiguous — "Bot API"
// alone appears in dozens of sentences that state no version.
const NUMERIC_CHECKS = [
  {
    id: "render-methods",
    label: "`render*` methods on Ctx",
    derive: deriveRenderMethods,
    // The span is written `render*()`, `render*()` or `render*` depending on
    // the sentence, so anchor on the backticked family name, not a fixed span.
    anchor: /`render\*[^`]*`/g,
    claim: [new RegExp(`\\b(${NUM})\\s+methods?\\b`, "gi"), new RegExp(`\\b(${NUM})\\s+render\\*`, "gi")],
    window: 160
  },
  {
    id: "route-atoms",
    label: "`export type IRoute*` in src/types/ctx.ts",
    derive: deriveRouteTypes,
    anchor: /route\s+(?:atoms|unions|types)/g,
    claim: [new RegExp(`\\b(${NUM})\\s+route\\s+(?:atoms|unions|types)\\b`, "gi"), new RegExp(`\\bas\\s+(${NUM})\\s+atoms\\b`, "gi")],
    window: 160
  },
  {
    id: "config-members",
    label: "members of `IGramstaxConfig`",
    derive: deriveConfigMembers,
    anchor: /`?IGramstaxConfig`?|`?GramstaxConfig`?|gramstax\.config\.ts/g,
    claim: [new RegExp(`\\b(${NUM})\\s+keys\\b`, "gi"), new RegExp(`\\b(${NUM})\\s+(?:fields|members|properties)\\b`, "gi")],
    window: 420
  },
  {
    id: "bot-api-version",
    label: "TemplateEngine.BOT_API_VERSION",
    derive: deriveBotApiVersion,
    direct: [new RegExp(`Bot API\\s*\\*\\*(${NUM})\\*\\*`, "gi"), new RegExp(`\\\`BOT_API_VERSION\\\`\\D{0,12}(${NUM})`, "gi"), new RegExp(`Bot API version\\D{0,12}(${NUM})`, "gi")]
  },
  {
    id: "rich-tags",
    label: "ALLOWED_BLOCKS_TELEGRAM_LEGACY + _RICH",
    derive: deriveRichTags,
    anchor: /Rich HTML|rich tags/gi,
    claim: [new RegExp(`\\b(${NUM})\\s+(?:Telegram Rich HTML\\s+)?tags\\b`, "gi")],
    window: 420
  },
  {
    id: "reference-pages",
    label: ".md pages under docs-site/reference/",
    derive: deriveReferencePages,
    anchor: /API reference|\breference\b/g,
    claim: [new RegExp(`\\b(${NUM})\\s+pages\\b`, "gi")],
    window: 420
  }
]

const numericWarnings = []
// How many claims each check actually located. A check whose anchor silently
// stops matching reads as "0 warnings" while checking nothing, which is worse
// than a broken build: this line makes it visible.
const numericCoverage = []

// `10.3` from source and `10.3` from prose are the same claim even though one
// is a string and the other a float.
function sameValue(claimed, actual) {
  return claimed === actual || (actual !== null && Number(actual) === claimed)
}

for (const check of NUMERIC_CHECKS) {
  const actual = check.derive()
  if (actual === 0 || actual === null || actual === undefined) throw new Error(`cannot derive "${check.label}" from source — fix the derivation, do not disable the check`)
  let seenClaims = 0
  const seenValues = new Set()
  for (const file of DOC_FILES) {
    const text = read(file)

    const hit = (claimed, index, span) => {
      const line = text.slice(0, index).split("\n").length
      if (sameValue(claimed, actual)) return
      numericWarnings.push({file, line, check: check.id, label: check.label, claimed, actual, span: span.trim()})
    }

    // Direct mode: the regex captures both the anchor and the number.
    if (check.direct) {
      const seenDirect = new Set()
      for (const re of check.direct) {
        re.lastIndex = 0
        let m
        while ((m = re.exec(text)) !== null) {
          const claimed = parseNumber(m[1])
          if (claimed === null) continue
          const key = `${m.index}:${claimed}`
          if (seenDirect.has(key)) continue
          seenDirect.add(key)
          seenClaims++
          seenValues.add(claimed)
          hit(claimed, m.index, m[0])
        }
      }
      continue
    }

    const anchors = []
    check.anchor.lastIndex = 0
    let a
    while ((a = check.anchor.exec(text)) !== null) {
      if (a[0].length === 0) check.anchor.lastIndex++
      anchors.push({at: a.index, end: a.index + a[0].length})
    }
    if (anchors.length === 0) continue

    const seen = new Set()
    for (const claimRe of check.claim) {
      claimRe.lastIndex = 0
      let c
      while ((c = claimRe.exec(text)) !== null) {
        const claimed = parseNumber(c[1])
        if (claimed === null) continue
        // Nearest anchor, but only if the claim is inside its window.
        let nearest = null
        for (const x of anchors) {
          const gap = x.end <= c.index ? c.index - x.end : x.at >= c.index ? x.at - c.index : 0
          if (gap <= check.window && (nearest === null || gap < nearest.gap)) nearest = {gap}
        }
        if (nearest === null) continue
        const line = text.slice(0, c.index).split("\n").length
        const key = `${line}:${claimed}`
        if (seen.has(key)) continue
        seen.add(key)
        seenClaims++
        seenValues.add(claimed)
        hit(claimed, c.index, c[0])
      }
    }
  }
  numericCoverage.push({id: check.id, label: check.label, actual, seenClaims, seenValues: [...seenValues].sort((a, b) => a - b)})
}

// ---------------------------------------------------------------------------
// TIER 2 — path claims
// ---------------------------------------------------------------------------

// A bare `src/core/ctx.ts` in an ADR is relative to the package, while
// `admin/ban.ts` is relative to a page directory. Try every base that could
// legitimately own the path before calling it missing.
const PATH_BASES = ["", `${SRC}/`, "packages/gramstax/", "packages/create-gramstax/src/templates/"]

// Route-shaped examples resolve against the example workspaces.
const EXAMPLE_PAGES = new Set(tracked(f => f.includes("/src/pages/")).map(f => f.slice(f.indexOf("/src/pages/") + "/src/pages/".length)))

// Build artifacts and generated trees: real paths on disk at runtime, absent
// from git, so their absence is not a doc defect.
const ARTIFACT_PREFIXES = [".gramstax/", "dist/", "gen/", "server/", "docs/markdown", "docs/yaml", "docs/extractor"]

// The reader's own bot project, not this repository. `src/pages/home.ts` is a
// file every reader will create and none will find here.
const READER_PREFIXES = ["src/pages", "src/mock", "src/templates", "src/helpers", "src/base", "e2e/", "bench/", "shop/"]

function pathResolves(p) {
  for (const base of PATH_BASES) {
    if (existsSync(join(REPO, base, p))) return base || "."
  }
  if (EXAMPLE_PAGES.has(p)) return "example/*/src/pages/"
  return null
}

function pathSkipReason(p) {
  if (p === "//" || p === "/") return "separator"
  if (/[*?]/.test(p)) return "glob"
  if (p.startsWith("@")) return "npm package"
  if (p.startsWith("/")) return "url path"
  if (p.startsWith("./") || p.startsWith("../")) return "relative to the reader's project"
  if (p.endsWith("/")) return "directory"
  if (!pathCharsetOk(p)) return "not a path"
  // `E2eHelper.gmsg/gkb/gmedia` is one span listing three fields, not a path.
  if (p.slice(0, p.indexOf("/")).includes(".")) return "dotted receiver"
  // `admin/ban`, `start/random/number` are route names, not files. This check
  // is about file claims.
  if (!/\.[A-Za-z0-9]{1,5}$/.test(p)) return "route name"
  for (const a of ARTIFACT_PREFIXES) if (p.startsWith(a)) return "build artifact"
  for (const r of READER_PREFIXES) if (p.startsWith(r)) return "reader's own project"
  return null
}

const pathWarnings = []
const pathSkipped = new Map()

for (const file of DOC_FILES) {
  for (const {no, line, fenced} of scanLines(read(file))) {
    for (const {raw, at} of spans(line)) {
      const trimmed = raw.trim()
      if (!trimmed.includes("/")) continue
      // One span can list several paths (`a/x`, `b/y`) or fold a dotted
      // receiver into them (`E2eHelper.gmsg/gkb/gmedia`).
      for (const piece of trimmed.split(/[\s,;|]+/)) {
        // Strip bracketing quotes and a trailing `:12` / `:12-40` line anchor.
        const p = piece.replace(/^["'(]+|["')]+$/g, "").replace(/[:(][\d].*$/, "").replace(/[.,;:]+$/, "")
        if (!p.includes("/")) continue
        const skip = pathSkipReason(p)
        if (skip) {
          pathSkipped.set(skip, (pathSkipped.get(skip) ?? 0) + 1)
          continue
        }
        if (pathResolves(p)) continue
        pathWarnings.push({file, line: no, col: at + 1, path: p, fenced})
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function groupByFile(list) {
  const map = new Map()
  for (const item of list) {
    if (!map.has(item.file)) map.set(item.file, [])
    map.get(item.file).push(item)
  }
  return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])))
}

// `git ls-files` is the corpus, as specified. A doc written but not yet
// committed would therefore be invisible, so say so rather than let the run
// look complete.
function untrackedDocs() {
  const known = new Set(DOC_FILES)
  try {
    return git(["ls-files", "--others", "--exclude-standard", DOCS_SITE]).split("\n").filter(f => f.endsWith(".md") && !known.has(f))
  } catch {
    return []
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({failures, numericWarnings, pathWarnings, fencedMisses}, null, 2))
  process.exit(failures.length > 0 ? 1 : 0)
}

console.log("docs audit — authored prose vs packages/gramstax/src")
console.log(`  corpus: ${DOC_FILES.length} authored .md, ${SRC_FILES.length} source .ts`)

console.log("")
console.log(`FAIL  TIER 1 — identifier named in prose that is absent from source (${failures.length})`)
if (failures.length === 0) {
  console.log("  none")
} else {
  for (const [file, list] of groupByFile(failures)) {
    console.log("")
    console.log(`  ${file}  (${list.length})`)
    for (const f of list) console.log(`    ${`${f.line}:${f.col}`.padEnd(9)} ${f.token}${f.hint ? `   -> did you mean \`${f.hint}\`?` : ""}`)
  }
}

console.log("")
console.log(`WARN  TIER 2 — numeric claim contradicts source (${numericWarnings.length})`)
if (numericWarnings.length === 0) {
  console.log("  none")
} else {
  for (const [file, list] of groupByFile(numericWarnings)) {
    console.log("")
    console.log(`  ${file}  (${list.length})`)
    for (const w of list) console.log(`    ${String(w.line).padEnd(9)} ${w.label}: docs say ${w.claimed}, source has ${w.actual}   [${w.span}]`)
  }
}
console.log("  derived from source, claims located in the corpus:")
for (const c of numericCoverage) {
  const where = c.seenValues.length === 0 ? "NONE LOCATED — the anchor is not matching" : c.seenValues.join(", ")
  console.log(`    ${c.id.padEnd(16)} source=${String(c.actual).padEnd(6)} docs=${where}`)
}

console.log("")
console.log(`WARN  TIER 2 — path claim points at a file that does not exist (${pathWarnings.length})`)
if (pathWarnings.length === 0) {
  console.log("  none")
} else {
  for (const [file, list] of groupByFile(pathWarnings)) {
    console.log("")
    console.log(`  ${file}  (${list.length} claim${list.length === 1 ? "" : "s"}, ${new Set(list.map(w => w.path)).size} distinct)`)
    const shown = new Set()
    for (const w of list) {
      if (shown.has(w.path)) continue
      shown.add(w.path)
      console.log(`    ${`${w.line}:${w.col}`.padEnd(9)} ${w.path}`)
    }
  }
}

const fencedTokens = [...new Set(fencedMisses.map(f => f.token))].sort()
console.log("")
console.log(`INFO  unknown identifiers inside fenced code blocks (${fencedTokens.length}) — not failing, but check the examples`)
console.log(`  ${fencedTokens.join(", ") || "none"}`)

console.log("")
console.log("  suppressed before comparison:")
for (const [reason, n] of [...shapeSkipped.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${`shape: ${reason}`.padEnd(52)} ${n}`)
for (const [reason, n] of [...pathSkipped.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${`path: ${reason}`.padEnd(52)} ${n}`)
console.log(`    ${"composed name shapes derived from source".padEnd(52)} ${COMPOSED.length}: ${COMPOSED.map(p => `${p.pre}\${…}${p.suf}`).join(", ") || "none"}`)
const untracked = untrackedDocs()
if (untracked.length > 0) console.log(`    ${"untracked .md under docs-site/ (not scanned)".padEnd(52)} ${untracked.length}: ${untracked.join(", ")}`)

const distinctFails = new Set(failures.map(f => f.token)).size
console.log("")
console.log(`SUMMARY  ${failures.length} FAIL (${distinctFails} distinct) · ${numericWarnings.length + pathWarnings.length} WARN · ${fencedTokens.length} INFO · exit ${failures.length > 0 ? 1 : 0}`)
console.log(`         ${tokensChecked} identifier tokens checked, ${tokensAccepted} accepted (${failures.length} rejected in prose, ${fencedMisses.length} in code blocks)`)

process.exit(failures.length > 0 ? 1 : 0)