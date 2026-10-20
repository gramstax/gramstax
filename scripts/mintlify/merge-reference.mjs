// Merge the per-package api-documenter output into the single reference corpus.
//
// api-documenter empties its output folder on every run, so three packages
// cannot write into docs-site/reference directly — the last one would win and
// the other two would be wiped. Each package therefore stages into its own
// packages/<pkg>/docs/markdown folder, and this script empties
// docs-site/reference and copies every staged page in a fixed order.
//
//   bun scripts/mintlify/merge-reference.mjs

import {copyFileSync, existsSync, mkdirSync, readdirSync, rmSync} from "node:fs"
import {dirname, join, resolve} from "node:path"
import {fileURLToPath} from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "..", "..")

// The order fixes the outcome for the one file name every package emits:
// api-documenter writes each package's model page as "index.md", so only the
// first package keeps it and the rest are dropped. Every other page name is
// prefixed with the package name (gramstax.*, lmdb.*, worker-thread.*) and
// therefore never collides.
const STAGING_DIRS = ["packages/gramstax/docs/markdown", "packages/lmdb/docs/markdown", "packages/worker-thread/docs/markdown"]
const OUT_DIR = join(repoRoot, "docs-site", "reference")

export function run() {
  for (const dir of STAGING_DIRS) {
    if (!existsSync(join(repoRoot, dir))) {
      console.error(`  staging directory missing: ${dir} — run that package's build:docs first`)
      process.exit(1)
    }
  }

  // Same semantics as api-documenter's ensureEmptyFolder: every entry goes,
  // recursively, so a page that no longer exists cannot survive as a stale
  // link in the committed corpus.
  rmSync(OUT_DIR, {recursive: true, force: true})
  mkdirSync(OUT_DIR, {recursive: true})

  let total = 0
  let indexWritten = false
  for (const dir of STAGING_DIRS) {
    const source = join(repoRoot, dir)
    const files = readdirSync(source).filter((file) => file.endsWith(".md"))
    let copied = 0
    for (const file of files) {
      if (file === "index.md") {
        if (indexWritten) continue
        indexWritten = true
      }
      copyFileSync(join(source, file), join(OUT_DIR, file))
      copied++
    }
    console.log(`  ${dir}: ${copied} halaman`)
    total += copied
  }
  console.log(`  total halaman reference: ${total}`)
  return total
}

run()
