/**
 * check-e2e-handlers.ts
 *
 * Verifies that e2e/COVERAGE.md accounts for every route handler under
 * src/pages and every test file under e2e/.
 *
 * Convention:
 *   src/pages/foo.ts        -> e2e/foo.test.ts
 *   src/pages/foo/bar.ts    -> e2e/foo/bar.test.ts
 *   src/pages/foo/index.ts  -> e2e/foo/index.test.ts
 *
 * Ledger row shape (Markdown table):
 *   | Page | Handler / state | Trigger | Test | Asserts |
 *   | foo  | handleCallbackQueryData | callback `foo` | foo.test.ts > callback | editMessageText |
 *
 * Checks:
 *   - every handle* defined in src/pages appears in a COVERAGE.md row for its page
 *   - every row that names a handler also names a test file
 *   - every referenced test file exists
 *   - every e2e/*.test.ts file is referenced by at least one row
 *
 * Usage:
 *   bun run scripts/check-e2e-handlers.ts
 *       -> Check this project (src/pages, e2e/COVERAGE.md, e2e/)
 *
 *   bun run scripts/check-e2e-handlers.ts --path ./my-app
 *       -> Check another project
 *
 * Exit code: 0 if all handlers and tests are accounted for, 1 otherwise.
 */

import {existsSync, readFileSync, readdirSync} from "node:fs"
import {join, relative} from "node:path"

const args = process.argv.slice(2)
const pathIndex = args.indexOf(`--path`)
const requestedRoot = pathIndex !== -1 && args[pathIndex + 1] !== undefined ? args[pathIndex + 1]! : `.`
const root = requestedRoot
const pagesDir = join(root, `src`, `pages`)
const e2eDir = join(root, `e2e`)
const ledgerPath = join(e2eDir, `COVERAGE.md`)
const label = relative(process.cwd(), root).replace(/\\/g, `/`) || `.`

type LedgerRow = {
  line: number
  page: string
  handlerCell: string
  handlers: string[]
  test: string | undefined
}

const errors: string[] = []

function walk(dir: string, accept: (name: string) => boolean): string[] {
  return readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return walk(full, accept)
    return entry.isFile() && accept(entry.name) ? [full] : []
  })
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ``).replace(/(^|[^:])\/\/.*$/gm, `$1`)
}

/** Route name as the router sees it: `start/index.ts` -> `start`, root `index.ts` -> `index`. */
function routeName(relativePath: string): string {
  return relativePath
    .replace(/\\/g, `/`)
    .replace(/\.(ts|js)$/, ``)
    .replace(/\/index$/, ``)
}

function normalizeTestPath(value: string): string {
  return value
    .replace(/\\/g, `/`)
    .replace(/^\.\//, ``)
    .replace(/^e2e\//, ``)
}

function parseLedger(): LedgerRow[] {
  if (!existsSync(ledgerPath)) {
    errors.push(`e2e/COVERAGE.md is missing (expected at ${ledgerPath})`)
    return []
  }

  const rows: LedgerRow[] = []
  const lines = readFileSync(ledgerPath, `utf8`).split(/\r?\n/)
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim()
    if (!trimmed.startsWith(`|`)) continue
    const cells = trimmed
      .split(`|`)
      .slice(1, -1)
      .map((cell) => cell.replace(/`/g, ``).trim())
    if (cells.length < 4) continue
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue

    const [page = ``, handlerCell = ``, , testCell = ``] = cells
    const handlers = handlerCell.match(/handle[A-Za-z0-9_]+/g) ?? []
    const test = testCell.match(/[\w./-]+\.test\.(?:ts|js)/)?.[0]
    rows.push({line: index + 1, page, handlerCell, handlers, test})
  }
  return rows
}

if (!existsSync(pagesDir)) {
  console.log(`  Skipped ${label}: pages directory not found at ${pagesDir}`)
  process.exit(0)
}

const pages = walk(pagesDir, (name) => /\.(ts|js)$/.test(name) && !/\.test\.(ts|js)$/.test(name))
const handlers: Array<{page: string; handler: string; file: string}> = []
for (const page of pages) {
  const relativePath = relative(pagesDir, page).replace(/\\/g, `/`)
  const source = stripComments(readFileSync(page, `utf8`))
  const found = new Set([...source.matchAll(/^\s*(?:(?:public|protected|private|static|override|async)\s+)*(handle[A-Za-z0-9_]+)\??\s*(?:\(|=)/gm)].map((match) => match[1]!))
  for (const handler of found) {
    handlers.push({page: routeName(relativePath), handler, file: relativePath})
  }
}

const rows = parseLedger()
const referencedTests = new Set<string>()

for (const row of rows) {
  if (row.test === undefined) {
    if (row.handlers.length > 0) {
      errors.push(`e2e/COVERAGE.md:${row.line}: handler row for "${row.page}" has no test file`)
    }
    continue
  }
  const test = normalizeTestPath(row.test)
  referencedTests.add(test)
  if (!existsSync(join(e2eDir, test))) {
    errors.push(`e2e/COVERAGE.md:${row.line}: test file "${test}" does not exist`)
  }
}

for (const {page, handler, file} of handlers) {
  const row = rows.find((candidate) => candidate.page === page && candidate.handlers.includes(handler))
  if (row === undefined) {
    errors.push(`${file}: ${handler} (page "${page}") has no row in e2e/COVERAGE.md`)
  }
}

const testFiles = existsSync(e2eDir) ? walk(e2eDir, (name) => /\.test\.(ts|js)$/.test(name)).map((file) => relative(e2eDir, file).replace(/\\/g, `/`)) : []
for (const test of testFiles) {
  if (!referencedTests.has(test)) {
    errors.push(`e2e/${test} is not referenced by e2e/COVERAGE.md`)
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`  ❌ ${error}`)
  console.error(`\n${errors.length} coverage gap(s). Add a row to e2e/COVERAGE.md for each item above.`)
  process.exit(1)
}

console.log(`  ✅ ${label}: ${pages.length} pages, ${handlers.length} handlers, ${testFiles.length} tests, all covered by e2e/COVERAGE.md`)
