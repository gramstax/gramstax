/**
 * generate-e2e-structure.ts
 *
 * AUTO-CREATE: Membuat file e2e test untuk setiap page file yang belum
 * memiliki e2e test yang sesuai. Struktur e2e akan identik dengan pages.
 *
 * Konvensi:
 *   pages/foo.ts       → e2e/foo.ts        (sama persis path & filename)
 *   pages/foo/bar.ts   → e2e/foo/bar.ts    (sama persis)
 *   pages/foo/index.ts → e2e/foo/index.ts  (sama persis)
 *
 * Setiap e2e test yang dibuat otomatis berisi:
 *   - Import setup dengan relative path yang benar
 *   - Test dasar "load as a registered page in the bot"
 *   - Nama class diambil dari nama file (PascalCase)
 *
 * Penggunaan:
 *   bun run scripts/generate-e2e-structure.ts                        # semua project
 *   bun run scripts/generate-e2e-structure.ts 7-crud                 # satu project
 *   bun run scripts/generate-e2e-structure.ts 1-complex 5-interactive-menu  # beberapa project
 *
 * --dry-run: tampilkan apa yang akan dibuat tanpa menulis file
 * --force:   overwrite e2e test yang sudah ada
 * --check:   hanya check, tidak membuat apapun (alias dari check-e2e-mirror.ts)
 *
 * Exit code: 0 jika semua OK, 1 jika ada masalah.
 */

import {existsSync, readdirSync, mkdirSync, writeFileSync, readFileSync} from "node:fs"
import {join, dirname} from "node:path"

// ── Konfigurasi ───────────────────────────────────────────────────────

const ALL_PROJECTS = [
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

// ── Helper ─────────────────────────────────────────────────────────────

/** Walk directory recursively, return relative file paths */
function walkFiles(dir: string, prefix = ``): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, prefix ? `${prefix}/${entry.name}` : entry.name))
    } else if (entry.isFile() && /\.(ts|js)$/.test(entry.name) && !entry.name.endsWith(`.test`)) {
      results.push(prefix ? `${prefix}/${entry.name}` : entry.name)
    }
  }
  return results
}

/** Determine test file extension based on page file extension */
function testExt(rel: string): string {
  return rel.endsWith(`.js`) ? `.test.js` : `.test.ts`
}

/** Build the correct relative import path from a test file to setup */
function setupImport(rel: string): string {
  const depth = rel.split(`/`).length - 1
  if (depth === 0) return `./`
  let prefix = ``
  for (let i = 0; i < depth; i++) prefix += `../`
  return prefix
}

/** Convert a filename to a PascalCase class name */
function toClassName(name: string): string {
  return name
    .split(/[-_/]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(` `)
    .replace(/\s+/g, ``)
}

/** Generate the content for an e2e test file */
function generateTestContent(pageRel: string): string {
  const baseName = pageRel.replace(/\.(ts|js)$/, ``)
  const parts = baseName.split(`/`)
  const fileName = parts[parts.length - 1] || `index`
  const className = toClassName(fileName) + `Page`
  const importPath = setupImport(baseName + testExt(pageRel))

  return [
    `import {describe, it, expect} from "bun:test"`,
    `import {bot} from "${importPath}setup"`,
    ``,
    `describe(\`E2E: ${className}\`, () => {`,
    `  it(\`load as a registered page in the bot\`, () => {`,
    `    const allPages = bot.pages.all`,
    `    expect(allPages[\`${baseName}\`]).toBeDefined()`,
    `  })`,
    `})`,
    ``
  ].join(`\n`)
}

// ── Parse CLI arguments ────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY_RUN = args.includes(`--dry-run`)
const FORCE = args.includes(`--force`)
const CHECK_ONLY = args.includes(`--check`)

// Filter out flags to get project names
const projectFilter = args.filter((a) => !a.startsWith(`--`))
const selectedProjects = projectFilter.length > 0 ? projectFilter : ALL_PROJECTS

// ── Main ────────────────────────────────────────────────────────────────

let hasMissing = false
let created = 0
let skipped = 0
let errors = 0

for (const proj of selectedProjects) {
  const pagesDir = `example/${proj}/src/pages`
  const e2eDir = `example/${proj}/e2e`

  if (!existsSync(pagesDir)) {
    console.log(`  ⏭️  ${proj}: pages directory not found at ${pagesDir}`)
    errors++
    continue
  }
  if (!existsSync(e2eDir)) {
    if (!DRY_RUN) {
      mkdirSync(e2eDir, {recursive: true})
      if (!CHECK_ONLY) console.log(`  📁 ${proj}: created e2e directory`)
    } else {
      console.log(`  📁 ${proj}: would create e2e directory`)
    }
  }

  const pageFiles = walkFiles(pagesDir)
  let projMissing = 0

  for (const pageRel of pageFiles) {
    const ext = testExt(pageRel)
    const expectedE2E = pageRel.replace(/\.(ts|js)$/, ``) + ext
    const e2ePath = join(e2eDir, expectedE2E)

    if (existsSync(e2ePath) && !FORCE) {
      skipped++
      continue
    }

    projMissing++

    if (CHECK_ONLY) {
      console.log(`  ❌ ${proj}: e2e/${expectedE2E} (for pages/${pageRel})`)
      hasMissing = true
      continue
    }

    const content = generateTestContent(pageRel)

    if (DRY_RUN) {
      console.log(`  📝 ${proj}: would create e2e/${expectedE2E}`)
      console.log(content.split(`\n`).map((l) => `     | ${l}`).join(`\n`))
      console.log(``)
      created++
      continue
    }

    // Write the file
    try {
      mkdirSync(dirname(e2ePath), {recursive: true})
      writeFileSync(e2ePath, content)
      console.log(`  ✅ ${proj}: created e2e/${expectedE2E}`)
      created++
    } catch (err) {
      console.log(`  ❌ ${proj}: failed to create e2e/${expectedE2E}: ${err}`)
      errors++
    }
  }

  if (projMissing === 0 && !CHECK_ONLY) {
    console.log(`  ✅ ${proj}: all ${pageFiles.length} pages already have matching e2e tests`)
  }
}

// ── Summary ────────────────────────────────────────────────────────────

console.log(``)
console.log(`Summary:`)
console.log(`  Created: ${created}`)
console.log(`  Skipped (already exists): ${skipped}`)
console.log(`  Errors: ${errors}`)
console.log(`  Missing (--check mode): ${hasMissing ? `YES` : `NONE`}`)

if (hasMissing) {
  console.log(`\nRun without --check to auto-create missing files.`)
  process.exit(1)
}

if (errors > 0) {
  process.exit(1)
}

process.exit(0)
