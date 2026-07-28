/**
 * check-e2e-mirror.ts
 *
 * Ensures the e2e/ directory structure mirrors src/pages exactly.
 *
 * Convention:
 *   src/pages/foo.ts       → e2e/foo.test.ts        (same relative path, same name)
 *   src/pages/foo/bar.ts   → e2e/foo/bar.test.ts    (same relative path)
 *   src/pages/foo/index.ts → e2e/foo/index.test.ts  (same relative path)
 *
 * Usage:
 *   bun run scripts/check-e2e-mirror.ts
 *       → Check this project (src/pages vs e2e)
 *
 *   bun run scripts/check-e2e-mirror.ts --path ./my-app
 *       → Check another project (pages: ./my-app/src/pages, e2e: ./my-app/e2e)
 *
 *   bun run scripts/check-e2e-mirror.ts --path ./my-app --fix
 *       → Check + auto-create missing e2e test files
 *
 * Exit code: 0 if all OK, 1 if any mismatch.
 */

import {existsSync, readdirSync, mkdirSync, writeFileSync} from "node:fs"
import {join, dirname} from "node:path"

// ── Parse CLI ─────────────────────────────────────────────────────────

const args = process.argv.slice(2)

const FIX_MODE = args.includes(`--fix`)

const pathIndex = args.indexOf(`--path`)
const customPath = pathIndex !== -1 && pathIndex + 1 < args.length ? args[pathIndex + 1]! : null

// ── Helpers ───────────────────────────────────────────────────────────

function walkPages(dir: string, prefix = ``): Array<{rel: string}> {
  const results: Array<{rel: string}> = []
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkPages(full, prefix ? `${prefix}/${entry.name}` : entry.name))
    } else if (entry.isFile() && /\.(ts|js)$/.test(entry.name) && !entry.name.endsWith(`.test`)) {
      results.push({rel: prefix ? `${prefix}/${entry.name}` : entry.name})
    }
  }
  return results
}

function getTestExt(rel: string): string {
  return rel.endsWith(`.js`) ? `.test.js` : `.test.ts`
}

function getSetupImportPrefix(rel: string): string {
  const depth = rel.split(`/`).length - 1
  if (depth === 0) return `./`
  let prefix = ``
  for (let i = 0; i < depth; i++) prefix += `../`
  return prefix
}

function generateTestContent(pageRel: string): string {
  const baseName = pageRel.replace(/\.(ts|js)$/, ``)
  const parts = baseName.split(`/`)
  const pageName = parts[parts.length - 1] || parts[parts.length - 2] || `Page`
  const className = pageName
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(``) + `Page`

  return [
    `import {describe, it, expect} from "bun:test"`,
    `import {bot} from "./setup"`,
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

function checkProject(label: string, pagesDir: string, e2eDir: string): boolean {
  if (!existsSync(pagesDir)) {
    console.log(`  ⏭️  ${label}: pages directory not found at ${pagesDir}`)
    return true
  }
  if (!existsSync(e2eDir)) {
    console.log(`  ⏭️  ${label}: e2e directory not found at ${e2eDir}`)
    return true
  }

  const pages = walkPages(pagesDir)
  let ok = true

  for (const page of pages) {
    const ext = getTestExt(page.rel)
    const expectedE2E = page.rel.replace(/\.(ts|js)$/, ``) + ext
    const e2ePath = join(e2eDir, expectedE2E)

    if (!existsSync(e2ePath)) {
      console.log(`  ❌ ${label}: pages/${page.rel} -> e2e/${expectedE2E} MISSING`)
      ok = false

      if (FIX_MODE) {
        const content = generateTestContent(page.rel)
          .replace(`"./setup"`, `"${getSetupImportPrefix(expectedE2E)}setup"`)
        mkdirSync(dirname(e2ePath), {recursive: true})
        writeFileSync(e2ePath, content)
        console.log(`     ✅ Created e2e/${expectedE2E}`)
      }
    }
  }

  if (ok) {
    console.log(`  ✅ ${label}: ${pages.length} pages, all mirrored`)
  }
  return ok
}

// ── Main ──────────────────────────────────────────────────────────────

let allOk = true

if (customPath) {
  const label = customPath.replace(/\\/g, `/`).replace(/\/+$/, ``)
  const pagesDir = join(customPath, `src`, `pages`)
  const e2eDir = join(customPath, `e2e`)
  const ok = checkProject(label, pagesDir, e2eDir)
  if (!ok) allOk = false
} else {
  // Default: check this project's own pages and e2e
  const pagesDir = join(import.meta.dir, `../src/pages`)
  const e2eDir = join(import.meta.dir, `..`)
  const ok = checkProject(`this project`, pagesDir, e2eDir)
  if (!ok) allOk = false
}

if (!allOk && !FIX_MODE) {
  console.log(`\nSome e2e tests are missing. Run with --fix to auto-create them.`)
  process.exit(1)
} else if (allOk) {
  console.log(`\nAll OK!`)
  process.exit(0)
}
