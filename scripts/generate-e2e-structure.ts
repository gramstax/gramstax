/**
 * generate-e2e-structure.ts
 *
 * Auto-create e2e test files untuk setiap page file yang belum memiliki
 * e2e test yang sesuai. Struktur e2e akan identik dengan pages.
 * Bisa digunakan untuk project mana pun, tidak terbatas pada example/.
 *
 * Konvensi:
 *   pages/foo.ts       → e2e/foo.ts        (sama persis path & filename)
 *   pages/foo/bar.ts   → e2e/foo/bar.ts    (sama persis)
 *   pages/foo/index.ts → e2e/foo/index.ts  (sama persis)
 *
 * Setiap e2e test berisi:
 *   - Import setup dengan relative path yang benar
 *   - Test dasar "load as a registered page in the bot"
 *   - Nama class diambil dari nama file (PascalCase)
 *
 * Penggunaan:
 *   bun run scripts/generate-e2e-structure.ts
 *       → Generate untuk semua project di example/
 *
 *   bun run scripts/generate-e2e-structure.ts --path ./my-app
 *       → Generate untuk project my-app
 *
 *   bun run scripts/generate-e2e-structure.ts --path ./my-app --dry-run
 *       → Lihat apa yang akan dibuat tanpa menulis file
 *
 *   bun run scripts/generate-e2e-structure.ts --path ./my-app --force
 *       → Overwrite e2e test yang sudah ada
 *
 *   bun run scripts/generate-e2e-structure.ts --path ./my-app --check
 *       → Cek saja tanpa membuat apapun
 *
 *   bun run scripts/generate-e2e-structure.ts 7-crud 10-http-request
 *       → Generate untuk subset project di example/
 *
 * Exit code: 0 jika semua OK, 1 jika ada masalah.
 */

import {existsSync, readdirSync, mkdirSync, writeFileSync} from "node:fs"
import {join, dirname} from "node:path"

// ── Static list untuk mode default (tanpa --path) ─────────────────────

const DEFAULT_PROJECTS = [
  `1-complex`,
  `2-helloworld`,
  `3-helloworld-js`,
  `4-echo`,
  `5-interactive-menu`,
  `6-bank-system`,
  `7-crud`,
  `8-newsletter`,
  `9-substore-bot`,
  `10-http-request`
]

// ── Parse CLI ─────────────────────────────────────────────────────────

const args = process.argv.slice(2)

const DRY_RUN = args.includes(`--dry-run`)
const FORCE = args.includes(`--force`)
const CHECK_ONLY = args.includes(`--check`)

const pathIndex = args.indexOf(`--path`)
const customPath = pathIndex !== -1 && pathIndex + 1 < args.length ? args[pathIndex + 1]! : null

const projectNames = customPath
  ? []
  : args.filter((a) => !a.startsWith(`--`) && a !== args[pathIndex + 1])

// ── Helpers ───────────────────────────────────────────────────────────

/** Walk directory recursively, return relative file paths of all pages */
function walkFiles(dir: string, prefix = ``): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, prefix ? `${prefix}/${entry.name}` : entry.name))
    } else if (entry.isFile() && /\.(ts|js)$/.test(entry.name) && !/\.test\.(ts|js)$/.test(entry.name)) {
      results.push(prefix ? `${prefix}/${entry.name}` : entry.name)
    }
  }
  return results
}

/** Determine test file extension based on page file extension */
function testExt(rel: string): string {
  return rel.endsWith(`.js`) ? `.test.js` : `.test.ts`
}

/** Build correct relative import path from a test file to setup */
function setupImport(rel: string): string {
  const depth = rel.split(`/`).length - 1
  if (depth === 0) return `./`
  let prefix = ``
  for (let i = 0; i < depth; i++) prefix += `../`
  return prefix
}

/** Convert a filename segment to PascalCase */
function toClassName(name: string): string {
  return name
    .split(/[-_/]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(` `)
    .replace(/\s+/g, ``)
}

/** Build page key access: dotted for identifier-like keys, computed otherwise (useLiteralKeys-safe) */
function pageKeyAccess(baseName: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(baseName) ? `.${baseName}` : `[\`${baseName}\`]`
}

/** Generate the content for an e2e test file */
function generateTestContent(pageRel: string): string {
  const baseName = pageRel.replace(/\.(ts|js)$/, ``)
  const parts = baseName.split(`/`)
  const fileName = parts[parts.length - 1] || `index`
  const className = `${toClassName(fileName)}Page`
  const importPath = setupImport(baseName + testExt(pageRel))

  return [
    `import {describe, it, expect} from "bun:test"`,
    `import {bot} from "${importPath}setup"`,
    ``,
    `describe(\`E2E: ${className}\`, () => {`,
    `  it(\`load as a registered page in the bot\`, () => {`,
    `    const allPages = bot.pages.all`,
    `    expect(allPages${pageKeyAccess(baseName)}).toBeDefined()`,
    `  })`,
    `})`,
    ``
  ].join(`\n`)
}

// ── Process one project ───────────────────────────────────────────────

function processProject(
  label: string,
  pagesDir: string,
  e2eDir: string
): {created: number; skipped: number; errors: number} {
  const result = {created: 0, skipped: 0, errors: 0}

  if (!existsSync(pagesDir)) {
    console.log(`  ⏭️  ${label}: pages directory not found at ${pagesDir}`)
    result.errors++
    return result
  }

  if (!existsSync(e2eDir)) {
    if (CHECK_ONLY) {
      console.log(`  ⏭️  ${label}: e2e directory not found at ${e2eDir}`)
      result.errors++
      return result
    }
    if (!DRY_RUN) {
      mkdirSync(e2eDir, {recursive: true})
      console.log(`  📁 ${label}: created e2e directory`)
    } else {
      console.log(`  📁 ${label}: would create e2e directory`)
    }
  }

  const pageFiles = walkFiles(pagesDir)

  for (const pageRel of pageFiles) {
    const ext = testExt(pageRel)
    const expectedE2E = pageRel.replace(/\.(ts|js)$/, ``) + ext
    const e2ePath = join(e2eDir, expectedE2E)

    if (existsSync(e2ePath) && !FORCE) {
      result.skipped++
      continue
    }

    if (CHECK_ONLY) {
      console.log(`  ❌ ${label}: e2e/${expectedE2E} (for pages/${pageRel})`)
      continue
    }

    const content = generateTestContent(pageRel)

    if (DRY_RUN) {
      console.log(`  📝 ${label}: would create e2e/${expectedE2E}`)
      console.log(content.split(`\n`).map((l) => `     | ${l}`).join(`\n`))
      console.log(``)
      result.created++
      continue
    }

    try {
      mkdirSync(dirname(e2ePath), {recursive: true})
      writeFileSync(e2ePath, content)
      console.log(`  ✅ ${label}: created e2e/${expectedE2E}`)
      result.created++
    } catch (err) {
      console.log(`  ❌ ${label}: failed to create e2e/${expectedE2E}: ${err}`)
      result.errors++
    }
  }

  if (result.created === 0 && result.errors === 0 && !CHECK_ONLY) {
    console.log(`  ✅ ${label}: all ${pageFiles.length} pages already have matching e2e tests`)
  }

  return result
}

// ── Main ──────────────────────────────────────────────────────────────

let totalCreated = 0
let totalSkipped = 0
let totalErrors = 0

if (customPath) {
  const label = customPath.replace(/\\/g, `/`).replace(/\/+$/, ``)
  const pagesDir = join(customPath, `src`, `pages`)
  const e2eDir = join(customPath, `e2e`)
  const r = processProject(label, pagesDir, e2eDir)
  totalCreated += r.created
  totalSkipped += r.skipped
  totalErrors += r.errors
} else {
  const selected = projectNames.length > 0 ? projectNames : DEFAULT_PROJECTS
  for (const proj of selected) {
    const r = processProject(proj, `example/${proj}/src/pages`, `example/${proj}/e2e`)
    totalCreated += r.created
    totalSkipped += r.skipped
    totalErrors += r.errors
  }
}

// ── Summary ───────────────────────────────────────────────────────────

console.log(``)
console.log(`Summary:`)
console.log(`  Created: ${totalCreated}`)
console.log(`  Skipped (already exists): ${totalSkipped}`)
console.log(`  Errors: ${totalErrors}`)

if (totalErrors > 0) {
  process.exit(1)
}
