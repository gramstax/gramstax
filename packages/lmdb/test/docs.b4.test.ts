/**
 * B4 — Phase 4 docs contract (TDD).
 *
 * Guards the public documentation against drifting from the shipped defaults
 * and guardrails introduced in phases 1-3:
 *   - env defaults: mapSize = 4 GB, maxDbs = 128 (was 256 MB / 10)
 *   - materialization guardrail: use iterate() for result sets > 100k
 *   - Queue v2: enqueue writes id + payload in ONE synchronous transaction
 *
 * The README.md, AGENTS.md, and src/env.ts JSDoc must stay in sync with the
 * source (env.ts constructor: `mapSize ?? 4 << 30`, `maxDbs ?? 128`,
 * LmdbRepository.MAX_MATERIALIZE = 100_000, LmdbQueue.transactionSync).
 */

import {describe, expect, it} from "bun:test"
import {readFileSync} from "node:fs"
import {join} from "node:path"

const pkgDir = join(import.meta.dir, `..`)
const readme = readFileSync(join(pkgDir, `README.md`), `utf8`)
const agents = readFileSync(join(pkgDir, `AGENTS.md`), `utf8`)
const envSrc = readFileSync(join(pkgDir, `src`, `env.ts`), `utf8`)

describe(`docs contract (B4)`, () => {
  it(`README constructor-options table documents mapSize 4 GB and maxDbs 128`, () => {
    const rows = readme.split(`\n`).filter((line) => line.trim().startsWith(`|`))
    const maxDbsRow = rows.find((line) => line.includes(`maxDbs`))
    expect(maxDbsRow).toBeDefined()
    expect(maxDbsRow).toContain(`128`)
    const mapSizeRow = rows.find((line) => line.includes(`mapSize`))
    expect(mapSizeRow).toBeDefined()
    expect(mapSizeRow).toContain(`4 GB`)
  })

  it(`README documents the materialization guardrail — use iterate() for > 100k`, () => {
    expect(readme).toContain(`iterate()`)
    expect(readme).toContain(`100_000`)
    expect(readme).toContain(`LmdbMaterializationError`)
  })

  it(`README documents Queue v2 — enqueue commits id + payload in one synchronous transaction`, () => {
    expect(readme).toContain(`LmdbQueue`)
    expect(readme).toContain(`transactionSync`)
  })

  it(`AGENTS.md documents the new defaults (4 GB / 128), guardrail, and Queue v2`, () => {
    expect(agents).toContain(`4 GB`)
    expect(agents).toContain(`128`)
    expect(agents).toContain(`iterate()`)
    expect(agents).toContain(`100_000`)
    expect(agents).toContain(`transactionSync`)
  })

  it(`env.ts JSDoc documents the new defaults — mapSize 4 GB and maxDbs 128`, () => {
    expect(envSrc).toContain(`4 GB`)
    expect(envSrc).toContain(`128`)
  })
})
