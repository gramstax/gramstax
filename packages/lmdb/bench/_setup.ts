/**
 * Shared bench setup — temp env, chunked populate, env-driven sizes, mitata run.
 *
 * Knobs (all optional):
 * - `BENCH_N` — override dataset/populate size per file
 * - `BENCH_CONC` — override concurrency list in concurrent.bench.ts (csv, e.g. `10,50`)
 * - `BENCH_FILTER` — regex passed to mitata `run({filter})` for single-bench runs
 *
 * @internal
 */

import {mkdtempSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {run} from "mitata"
import {LmdbEnv} from "../src"

export function benchSize(fallback: number): number {
  return Number(process.env.BENCH_N ?? fallback)
}

export function setupEnv(prefix: string, maxDbs = 5): {env: LmdbEnv; tmp: string} {
  const tmp = mkdtempSync(join(tmpdir(), prefix))
  return {env: new LmdbEnv({path: tmp, maxDbs}), tmp}
}

export function populateSync(env: LmdbEnv, n: number, put: (i: number) => void, chunk = 500): void {
  for (let start = 0; start < n; start += chunk) {
    const end = Math.min(start + chunk, n)
    env.rootTransactionSync(() => {
      for (let i = start; i < end; i++) put(i)
    })
  }
}

export function runBench(): Promise<unknown> {
  const filter = process.env.BENCH_FILTER
  return filter ? run({filter: new RegExp(filter)}) : run()
}
