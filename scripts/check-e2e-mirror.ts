/**
 * check-e2e-mirror.ts
 *
 * VERIFIKASI: Memastikan setiap example project memiliki struktur e2e yang
 * identik dengan struktur pages-nya.
 *
 * Konvensi:
 *   pages/foo.ts       → e2e/foo.ts        (sama persis path & filename)
 *   pages/foo/bar.ts   → e2e/foo/bar.ts    (sama persis)
 *   pages/foo/index.ts → e2e/foo/index.ts  (sama persis)
 *
 * Penggunaan:
 *   bun run scripts/check-e2e-mirror.ts
 *   bun run scripts/check-e2e-mirror.ts --fix   (auto-create missing e2e files)
 *
 * Exit code: 0 jika semua OK, 1 jika ada yang mismatch.
 */

import {existsSync, readdirSync, mkdirSync, writeFileSync, readFileSync} from "node:fs"
import {join, dirname} from "node:path"

const PROJECTS = [
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

const args = process.argv.slice(2)
const FIX_MODE = args.includes(`--fix`)

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

function getSetupImportPrefix(rel: string): string {
  const depth = rel.split(`/`).length - 1
  if (depth === 0) return `./`
  let prefix = ``
  for (let i = 0; i < depth; i++) prefix += `../`
  return prefix
}

let allOk = true

for (const proj of PROJECTS) {
  const pagesDir = `example/${proj}/src/pages`
  const e2eDir = `example/${proj}/e2e`

  if (!existsSync(pagesDir)) {
    console.log(`  ⏭️  ${proj}: pages directory not found`)
    continue
  }
  if (!existsSync(e2eDir)) {
    console.log(`  ⏭️  ${proj}: e2e directory not found`)
    continue
  }

  const pages = walkPages(pagesDir)
  let projOk = true

  for (const page of pages) {
    const ext = getTestExt(page.rel)
    const expectedE2E = page.rel.replace(/\.(ts|js)$/, ``) + ext
    const e2ePath = join(e2eDir, expectedE2E)

    if (!existsSync(e2ePath)) {
      console.log(`  ❌ ${proj}: pages/${page.rel} -> e2e/${expectedE2E} MISSING`)
      projOk = false
      allOk = false

      if (FIX_MODE) {
        const content = generateTestContent(page.rel)
          .replace(`"./setup"`, `"${getSetupImportPrefix(expectedE2E)}setup"`)
        mkdirSync(dirname(e2ePath), {recursive: true})
        writeFileSync(e2ePath, content)
        console.log(`     ✅ Created e2e/${expectedE2E}`)
      }
    }
  }

  if (projOk) {
    console.log(`  ✅ ${proj}: ${pages.length} pages, all mirrored`)
  }
}

if (!allOk && !FIX_MODE) {
  console.log(`\nSome e2e tests are missing. Run with --fix to auto-create them.`)
  process.exit(1)
} else if (allOk) {
  console.log(`\nAll 10 projects OK!`)
  process.exit(0)
}
