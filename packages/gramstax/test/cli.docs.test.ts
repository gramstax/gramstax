import {describe, expect, it} from "bun:test"
import {readdirSync, readFileSync, statSync} from "node:fs"
import {join} from "node:path"

const root = join(import.meta.dir, `..`, `..`, `..`)
const needle = [`bun`, `--bun`, `gramstax`].join(` `)
const scanRoots = [
  join(root, `README.md`),
  join(root, `AGENTS.md`),
  join(root, `docs-site`),
  join(root, `skills`),
  join(root, `example`),
  join(root, `packages`, `gramstax`, `README.md`),
  join(root, `packages`, `gramstax`, `AGENTS.md`),
  join(root, `packages`, `gramstax`, `src`),
  join(root, `packages`, `create-gramstax`, `README.md`),
  join(root, `packages`, `create-gramstax`, `AGENTS.md`),
  join(root, `packages`, `create-gramstax`, `src`)
]
const skipped = new Set([`node_modules`, `dist`, `.git`, `plans`, `real-projects`])
const textExtensions = [`.md`, `.mdx`, `.json`, `.ts`, `.tsx`, `.js`]
const appRuntimeDocs = [
  join(root, `README.md`),
  join(root, `packages`, `gramstax`, `README.md`),
  join(root, `packages`, `gramstax`, `AGENTS.md`),
  join(root, `packages`, `create-gramstax`, `README.md`),
  join(root, `packages`, `create-gramstax`, `AGENTS.md`),
  join(root, `packages`, `create-gramstax`, `src`, `templates`, `README.md`),
  join(root, `docs-site`, `quickstart.md`),
  join(root, `docs-site`, `guides`, `getting-started.md`),
  join(root, `docs-site`, `guides`, `gramstax-start.md`),
  join(root, `docs-site`, `guides`, `gramstax-build.md`),
  join(root, `docs-site`, `guides`, `serverless-deploy.md`),
  join(root, `docs-site`, `guides`, `rate-limiting.md`),
  join(root, `docs-site`, `guides`, `examples.md`),
  join(root, `example`, `AGENTS.md`)
]

function filesUnder(path: string): string[] {
  if (statSync(path).isFile()) return [path]
  const files: string[] = []
  for (const entry of readdirSync(path, {withFileTypes: true})) {
    if (skipped.has(entry.name)) continue
    const full = join(path, entry.name)
    if (entry.isDirectory()) files.push(...filesUnder(full))
    else if (textExtensions.some((extension) => entry.name.endsWith(extension))) files.push(full)
  }
  return files
}

describe(`clean CLI documentation`, () => {
  it(`does not instruct users to type bun --bun gramstax`, () => {
    const hits = scanRoots.flatMap(filesUnder).filter((file) => readFileSync(file, `utf-8`).includes(needle))
    expect(hits).toEqual([])
  }, 120_000)

  it(`does not document the removed --runtime option`, () => {
    const hits = scanRoots.flatMap(filesUnder).filter((file) => /--runtime\b/.test(readFileSync(file, `utf-8`)))
    expect(hits).toEqual([])
  }, 120_000)

  it(`presents Bun as the only runtime for Gramstax apps`, () => {
    const nodeRuntime = /\bNode(?:\.js)?\b/
    const hits = appRuntimeDocs.filter((file) => nodeRuntime.test(readFileSync(file, `utf-8`)))
    expect(hits).toEqual([])
  })
})
