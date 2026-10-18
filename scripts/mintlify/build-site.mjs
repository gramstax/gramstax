// Prepare docs-site/ for Mintlify.
//
// Runs the two transforms that turn raw api-documenter output into something the
// MDX parser accepts, then regenerates navigation. Wired into `build:docs` so a
// regeneration can never leave the site pointing at unparseable pages.
//
//   bun scripts/mintlify/build-site.mjs [siteDir]

import {existsSync} from "node:fs"
import {dirname, join, resolve} from "node:path"
import {fileURLToPath} from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "..", "..")
const site = resolve(process.argv[2] ?? join(repoRoot, "docs-site"))

if (!existsSync(join(site, "reference"))) {
  console.error(`  reference/ tidak ditemukan di ${site} — jalankan api-documenter dulu`)
  process.exit(1)
}

console.log(`  docs-site: ${site}`)
// Only the generated corpus is sanitised. Hand-written pages under docs-site/
// are authored as MDX and legitimately use {expressions} in component props,
// which the sanitizer would rewrite into entities.
await import("./mdx-sanitize.mjs").then(m => m.run(join(site, "reference")))

await import("./generate-navigation.mjs").then(m => m.run(site))

console.log("  docs-site siap divalidasi: npx mintlify validate")