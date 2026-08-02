/**
 * generate-e2e-structure.ts
 *
 * Auto-create e2e test files for every page file that does not yet have
 * a matching e2e test. The e2e structure mirrors src/pages exactly.
 *
 * Convention:
 *   src/pages/foo.ts       → e2e/foo.test.ts        (same relative path)
 *   src/pages/foo/bar.ts   → e2e/foo/bar.test.ts    (same relative path)
 *   src/pages/foo/index.ts → e2e/foo/index.test.ts  (same relative path)
 *
 * Each generated e2e test contains:
 *   - Import setup with the correct relative path
 *   - Basic test: "load as a registered page in the bot"
 *   - Class name derived from the file name (PascalCase)
 *
 * Usage:
 *   bun run scripts/generate-e2e-structure.ts
 *       → Generate for this project (src/pages → e2e)
 *
 *   bun run scripts/generate-e2e-structure.ts --path ./my-app
 *       → Generate for another project
 *
 *   bun run scripts/generate-e2e-structure.ts --path ./my-app --dry-run
 *       → Preview what would be created without writing files
 *
 *   bun run scripts/generate-e2e-structure.ts --path ./my-app --force
 *       → Overwrite existing e2e tests
 *
 *   bun run scripts/generate-e2e-structure.ts --path ./my-app --check
 *       → Only check, no file creation
 *
 * Exit code: 0 if OK, 1 if any errors.
 */

import {existsSync, mkdirSync, readdirSync, writeFileSync} from "node:fs"
import {dirname, join} from "node:path"

// ── Parse CLI ─────────────────────────────────────────────────────────

const args = process.argv.slice(2)

const DRY_RUN = args.includes(`--dry-run`)
const FORCE = args.includes(`--force`)
const CHECK_ONLY = args.includes(`--check`)

const pathIndex = args.indexOf(`--path`)
const customPath = pathIndex !== -1 && pathIndex + 1 < args.length ? args[pathIndex + 1]! : null

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

function processProject(label: string, pagesDir: string, e2eDir: string): {created: number; skipped: number; errors: number} {
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
      console.log(
        content
          .split(`\n`)
          .map((l) => `     | ${l}`)
          .join(`\n`)
      )
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
  // Default: generate for this project's own pages → e2e
  const pagesDir = join(import.meta.dir, `../src/pages`)
  const e2eDir = join(import.meta.dir, `../e2e`)
  const r = processProject(`this project`, pagesDir, e2eDir)
  totalCreated += r.created
  totalSkipped += r.skipped
  totalErrors += r.errors
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
