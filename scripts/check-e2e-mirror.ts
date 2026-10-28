/**
 * check-e2e-mirror.ts
 *
 * Memastikan struktur e2e identik dengan struktur pages di suatu project.
 * Bisa digunakan untuk project mana pun, tidak terbatas pada example/.
 *
 * Konvensi:
 *   src/pages/foo.ts       → e2e/foo.test.ts        (path relatif sama)
 *   src/pages/foo/bar.ts   → e2e/foo/bar.test.ts    (path relatif sama)
 *   src/pages/foo/index.ts → e2e/foo/index.test.ts  (path relatif sama)
 *
 * Dicek dua arah:
 *   - pages/ → e2e/ : setiap page punya test (--fix bisa membuatkannya)
 *   - e2e/ → pages/ : setiap test punya page (orphan, test sisa page dihapus)
 *     dikecualikan lewat EXTRA_TESTS untuk test harness yang memang bukan page test.
 *
 * Penggunaan:
 *   bun run scripts/check-e2e-mirror.ts
 *       → Cek semua project di example/
 *
 *   bun run scripts/check-e2e-mirror.ts --path ./my-app
 *       → Cek project my-app (pages: ./my-app/src/pages, e2e: ./my-app/e2e)
 *
 *   bun run scripts/check-e2e-mirror.ts --path ./my-app --fix
 *       → Cek + auto-create e2e test yang missing
 *
 *   bun run scripts/check-e2e-mirror.ts 7-crud 10-http-request
 *       → Cek subset project di example/
 *
 * Exit code: 0 jika semua OK, 1 jika ada mismatch.
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

/** Test e2e yang bukan page test (harness/boot), jadi tidak butuh padanan pages/. */
const EXTRA_TESTS: Record<string, ReadonlyArray<string>> = {
  "11-cloudflare-worker": [`aot-boot.test.ts`, `manifest-boot.test.ts`]
}

// ── Parse CLI ─────────────────────────────────────────────────────────

const args = process.argv.slice(2)

const FIX_MODE = args.includes(`--fix`)

// Extract --path value
const pathIndex = args.indexOf(`--path`)
const customPath = pathIndex !== -1 && pathIndex + 1 < args.length ? args[pathIndex + 1]! : null

// Project names (for default mode, without --path)
const projectNames = customPath
  ? [] // --path mode doesn't use project names
  : args.filter((a) => !a.startsWith(`--`) && a !== args[pathIndex + 1])

// ── Helpers ───────────────────────────────────────────────────────────

function walkPages(dir: string, prefix = ``): Array<{rel: string}> {
  const results: Array<{rel: string}> = []
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkPages(full, prefix ? `${prefix}/${entry.name}` : entry.name))
    } else if (entry.isFile() && /\.(ts|js)$/.test(entry.name) && !/\.test\.(ts|js)$/.test(entry.name)) {
      results.push({rel: prefix ? `${prefix}/${entry.name}` : entry.name})
    }
  }
  return results
}

function walkTests(dir: string, prefix = ``): Array<{rel: string}> {
  const results: Array<{rel: string}> = []
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkTests(full, prefix ? `${prefix}/${entry.name}` : entry.name))
    } else if (entry.isFile() && /\.test\.(ts|js)$/.test(entry.name)) {
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

/** Build page key access: dotted for identifier-like keys, computed otherwise (useLiteralKeys-safe) */
function pageKeyAccess(baseName: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(baseName) ? `.${baseName}` : `[\`${baseName}\`]`
}

function generateTestContent(pageRel: string): string {
  const baseName = pageRel.replace(/\.(ts|js)$/, ``)
  const parts = baseName.split(`/`)
  const pageName = parts[parts.length - 1] || parts[parts.length - 2] || `Page`
  const className = `${pageName
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(``)}Page`

  return [
    `import {describe, it, expect} from "bun:test"`,
    `import {bot} from "./setup"`,
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

function checkProject(label: string, pagesDir: string, e2eDir: string): boolean {
  if (!existsSync(pagesDir)) {
    console.log(`  ⏭️  ${label}: pages directory not found at ${pagesDir}`)
    return true // skip, not an error
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

  const projectKey = label.split(`/`).pop() ?? label
  const extras = EXTRA_TESTS[projectKey] ?? []
  const orphans: Array<string> = []
  for (const test of walkTests(e2eDir)) {
    if (extras.includes(test.rel)) continue
    const base = test.rel.replace(/\.test\.(ts|js)$/, ``)
    const hasPage = [`${base}.ts`, `${base}.js`, `${base}/index.ts`, `${base}/index.js`].some((c) => existsSync(join(pagesDir, c)))
    if (!hasPage) orphans.push(test.rel)
  }
  for (const orphan of orphans) {
    console.log(`  ⚠️  ${label}: e2e/${orphan} ORPHAN — no pages/ counterpart (delete it, or list it in EXTRA_TESTS)`)
    ok = false
  }

  if (ok) {
    console.log(`  ✅ ${label}: ${pages.length} pages, all mirrored`)
  }
  return ok
}

// ── Main ──────────────────────────────────────────────────────────────

let allOk = true

if (customPath) {
  // Single-project mode (--path)
  const label = customPath.replace(/\\/g, `/`).replace(/\/+$/, ``)
  const pagesDir = join(customPath, `src`, `pages`)
  const e2eDir = join(customPath, `e2e`)
  const ok = checkProject(label, pagesDir, e2eDir)
  if (!ok) allOk = false
} else {
  // Default mode — check all example projects (or subset)
  const selected = projectNames.length > 0 ? projectNames : DEFAULT_PROJECTS
  for (const proj of selected) {
    const ok = checkProject(proj, `example/${proj}/src/pages`, `example/${proj}/e2e`)
    if (!ok) allOk = false
  }
}

// ── Exit ──────────────────────────────────────────────────────────────

if (!allOk && !FIX_MODE) {
  console.log(`\nSome e2e tests are missing or orphaned. --fix creates the missing ones; orphans must be deleted by hand.`)
  process.exit(1)
} else if (allOk) {
  console.log(`\nAll OK!`)
  process.exit(0)
}
