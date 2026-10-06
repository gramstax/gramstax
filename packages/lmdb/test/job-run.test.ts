import {afterEach, describe, expect, it} from "bun:test"
import {join} from "node:path"
import {Cron} from "croner"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {JobRunSchema, LmdbJobRun} from "../src/job-run"
import {LmdbSchema, t} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

class ValSchema extends LmdbSchema {
  static db = `vals`
  static key = t.number()
  static value = {n: t.number()}
}

const dirs: Array<string> = []
// Must be awaited: `rmWithRetry` sleeps between attempts, so an unawaited
// call keeps deleting this test's temp dir while the NEXT test already runs.
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rmWithRetry(dir)
})

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Stop a schedule and let any in-flight run settle.
 *
 * `stop()` cannot cancel a tick already inside its task, and the caller closes
 * the env immediately after; without the window the close races it.
 */
async function settle(stop: () => void): Promise<void> {
  stop()
  await sleep(60)
}

function setup(prefix = `job-run`): {env: LmdbEnv; dir: string; path: string} {
  const dir = createTestDir(prefix)
  dirs.push(dir)
  const path = join(dir, `data`)
  return {env: new LmdbEnv({path, maxDbs: 10}), dir, path}
}

describe(`LmdbJobRun`, () => {
  it(`registers its schema and exposes a typed sub handle`, async () => {
    const {env} = setup()
    try {
      expect(env.isRegistered(JobRunSchema)).toBe(false)
      const jobs = new LmdbJobRun(env)
      expect(env.isRegistered(JobRunSchema)).toBe(true)
      expect(jobs.sub).toBe(env.sub(JobRunSchema))
      await jobs.recordRun(`db-backup`, 4_242)
      // Read through the raw handle: no cast, the row type comes from the schema.
      expect(jobs.sub.get(`db-backup`)).toEqual({at: 4_242})
    } finally {
      await env.close()
    }
  })

  it(`a second instance on the same env is safe`, async () => {
    const {env} = setup()
    try {
      const first = new LmdbJobRun(env)
      const second = new LmdbJobRun(env)
      await first.recordRun(`k`, 1_000)
      expect(second.lastRun(`k`)).toBe(1_000)
      expect(second.sub).toBe(first.sub)
    } finally {
      await env.close()
    }
  })

  it(`lastRun is undefined for a job that never ran`, async () => {
    const {env} = setup()
    try {
      expect(new LmdbJobRun(env).lastRun(`db-backup`)).toBeUndefined()
    } finally {
      await env.close()
    }
  })

  it(`recordRun then lastRun returns the stamped ms`, async () => {
    const {env} = setup()
    try {
      const jobs = new LmdbJobRun(env)
      const at = Date.now()
      await jobs.recordRun(`db-backup`, at)
      expect(jobs.lastRun(`db-backup`)).toBe(at)
    } finally {
      await env.close()
    }
  })

  it(`recordRun honours an explicit at instead of reading the clock`, async () => {
    const {env} = setup()
    try {
      const jobs = new LmdbJobRun(env)
      await jobs.recordRun(`weekly-report`, 1_234_567)
      expect(jobs.lastRun(`weekly-report`)).toBe(1_234_567)
    } finally {
      await env.close()
    }
  })

  it(`recordRun overwrites the previous stamp rather than appending`, async () => {
    const {env} = setup()
    try {
      const jobs = new LmdbJobRun(env)
      await jobs.recordRun(`sweep`, 1_000)
      await jobs.recordRun(`sweep`, 2_000)
      expect(jobs.lastRun(`sweep`)).toBe(2_000)
      expect(jobs.sub.count()).toBe(1)
    } finally {
      await env.close()
    }
  })

  it(`keeps separate job names isolated`, async () => {
    const {env} = setup()
    try {
      const jobs = new LmdbJobRun(env)
      await jobs.recordRun(`backup`, 1_000)
      await jobs.recordRun(`cleanup`, 9_000)
      expect(jobs.lastRun(`backup`)).toBe(1_000)
      expect(jobs.lastRun(`cleanup`)).toBe(9_000)
    } finally {
      await env.close()
    }
  })

  it(`clear removes the stamp and reports whether one existed`, async () => {
    const {env} = setup()
    try {
      const jobs = new LmdbJobRun(env)
      await jobs.recordRun(`temp`, 1_000)
      expect(await jobs.clear(`temp`)).toBe(true)
      expect(jobs.lastRun(`temp`)).toBeUndefined()
      expect(await jobs.clear(`temp`)).toBe(false)
    } finally {
      await env.close()
    }
  })

  it(`never shares state between envs on different paths`, async () => {
    const a = setup(`job-run-a`)
    const b = setup(`job-run-b`)
    try {
      const jobsA = new LmdbJobRun(a.env)
      await jobsA.recordRun(`db-backup`, 5_000)
      expect(jobsA.lastRun(`db-backup`)).toBe(5_000)
      expect(new LmdbJobRun(b.env).lastRun(`db-backup`)).toBeUndefined()
    } finally {
      await a.env.close()
      await b.env.close()
    }
  })

  it(`survives a close and reopen on the same path`, async () => {
    const {env, path} = setup()
    const at = 7_777
    try {
      await new LmdbJobRun(env).recordRun(`db-backup`, at)
      // The single-writer lock means env A must be closed before env B opens.
      await env.close()
      const reopened = new LmdbEnv({path, maxDbs: 10})
      try {
        expect(new LmdbJobRun(reopened).lastRun(`db-backup`)).toBe(at)
      } finally {
        await reopened.close()
      }
    } finally {
      await env.close()
    }
  })

  it(`rejects a blank job key on every entry point`, async () => {
    const {env} = setup()
    try {
      const jobs = new LmdbJobRun(env)
      expect(() => jobs.lastRun(``)).toThrow(LmdbError)
      await expect(jobs.recordRun(``)).rejects.toBeInstanceOf(LmdbError)
      await expect(jobs.clear(``)).rejects.toBeInstanceOf(LmdbError)
    } finally {
      await env.close()
    }
  })

  it(`rejects a non-finite stamp`, async () => {
    const {env} = setup()
    try {
      const jobs = new LmdbJobRun(env)
      await expect(jobs.recordRun(`k`, Number.NaN)).rejects.toBeInstanceOf(LmdbError)
      await expect(jobs.recordRun(`k`, Number.POSITIVE_INFINITY)).rejects.toBeInstanceOf(LmdbError)
    } finally {
      await env.close()
    }
  })

  it(`fails on a closed env instead of silently no-oping`, async () => {
    const {env} = setup()
    await env.close()
    expect(() => new LmdbJobRun(env)).toThrow(LmdbError)
  })

  it(`stays out of the CDC outbox, because __job_run is internal state`, async () => {
    const {env} = setup()
    try {
      // Arm capture FIRST: writes before the first CDC call are invisible, and
      // arming afterwards would make these assertions vacuous.
      await env.tailCdc()
      await env.register(ValSchema).put(1, {n: 1})
      const jobs = new LmdbJobRun(env)
      await jobs.recordRun(`db-backup`, 4_242)
      await jobs.clear(`db-backup`)
      const dbs = new Set((await env.tailCdc()).map((record) => record.db))
      // The `vals` assertion proves capture was genuinely armed, so the absent
      // `__job_run` below is a real exclusion rather than an empty outbox.
      expect(dbs.has(`vals`)).toBe(true)
      expect(dbs.has(`__job_run`)).toBe(false)
      // Same rule as `__sync_state` / `__queue_meta`: engine bookkeeping must
      // not show up in a consumer's change stream.
      expect(dbs.size).toBe(1)
    } finally {
      await env.close()
    }
  })
})

/** Boundary helper so assertions are exact without hardcoding a timezone. */
function lastBoundary(pattern: string, now: number): number {
  const probe = new Cron(pattern, {paused: true})
  const at = probe.previousRuns(1, new Date(now))[0]?.getTime()
  probe.stop()
  if (at === undefined) throw new Error(`pattern ${pattern} matched nothing`)
  return at
}

describe(`LmdbJobRun runner`, () => {
  it(`missed is true when the job never ran`, async () => {
    const {env} = setup(`runner`)
    try {
      expect(new LmdbJobRun(env).missed(`k`, {pattern: `0 3 * * *`})).toBe(true)
    } finally {
      await env.close()
    }
  })

  it(`missed flips exactly at the boundary`, async () => {
    const {env} = setup(`runner`)
    try {
      const jobs = new LmdbJobRun(env)
      const now = Date.now()
      const boundary = lastBoundary(`0 3 * * *`, now)
      // Exactly at the boundary counts as done; one ms earlier does not.
      await jobs.recordRun(`k`, boundary)
      expect(jobs.missed(`k`, {pattern: `0 3 * * *`, now})).toBe(false)
      await jobs.recordRun(`k`, boundary - 1)
      expect(jobs.missed(`k`, {pattern: `0 3 * * *`, now})).toBe(true)
      // Comfortably after the boundary: not missed.
      await jobs.recordRun(`k`, boundary + 60_000)
      expect(jobs.missed(`k`, {pattern: `0 3 * * *`, now})).toBe(false)
    } finally {
      await env.close()
    }
  })

  it(`missed rejects an unparseable pattern`, async () => {
    const {env} = setup(`runner`)
    try {
      expect(() => new LmdbJobRun(env).missed(`k`, {pattern: `nope`})).toThrow(LmdbError)
    } finally {
      await env.close()
    }
  })

  it(`start runs the task and stamps it`, async () => {
    const {env} = setup(`runner`)
    try {
      const jobs = new LmdbJobRun(env)
      await jobs.recordRun(`nightly`, Date.now()) // not due, so no boot run
      let ran = 0
      const handle = jobs.start(`nightly`, {pattern: `0 3 * * *`, task: async () => void ran++})
      try {
        await handle.runNow()
        expect(ran).toBe(1)
        expect(handle.lastRun()).toBeGreaterThan(0)
        expect(jobs.lastRun(`nightly`)).toBe(handle.lastRun())
        expect(handle.label()).toContain(`0 3 * * *`)
        expect(handle.nextRun()).toBeInstanceOf(Date)
      } finally {
        await settle(handle.stop)
      }
    } finally {
      await env.close()
    }
  })

  it(`the same job key can be scheduled twice in one process`, async () => {
    const {env} = setup(`runner`)
    try {
      // Croner's named-job registry is process-global and throws on a
      // duplicate, so this guards that `start` never passes a `name`.
      const jobs = new LmdbJobRun(env)
      await jobs.recordRun(`dup`, Date.now())
      const a = jobs.start(`dup`, {pattern: `0 3 * * *`, task: async () => {}})
      const b = jobs.start(`dup`, {pattern: `0 4 * * *`, task: async () => {}})
      await settle(a.stop)
      await settle(b.stop)
      expect(true).toBe(true)
    } finally {
      await env.close()
    }
  })

  it(`nextRun is undefined once stopped`, async () => {
    const {env} = setup(`runner`)
    try {
      const jobs = new LmdbJobRun(env)
      await jobs.recordRun(`k`, Date.now())
      const handle = jobs.start(`k`, {pattern: `0 3 * * *`, task: async () => {}})
      expect(handle.nextRun()).toBeInstanceOf(Date)
      await settle(handle.stop)
      expect(handle.nextRun()).toBeUndefined()
    } finally {
      await env.close()
    }
  })

  it(`persist false keeps the stamp in memory only`, async () => {
    const {env} = setup(`runner`)
    try {
      const jobs = new LmdbJobRun(env)
      await jobs.recordRun(`k`, Date.now())
      let ran = 0
      const handle = jobs.start(`k`, {pattern: `0 3 * * *`, persist: false, task: async () => void ran++})
      try {
        await handle.runNow()
        expect(ran).toBe(1)
        expect(handle.lastRun()).toBeGreaterThan(0) // in-memory
        expect(jobs.lastRun(`k`)).not.toBe(handle.lastRun()) // nothing written
      } finally {
        await settle(handle.stop)
      }
    } finally {
      await env.close()
    }
  })

  it(`catchUp false skips the boot run for an overdue job`, async () => {
    const {env} = setup(`runner`)
    try {
      const jobs = new LmdbJobRun(env)
      await jobs.recordRun(`k`, Date.now() - 3 * 86_400_000) // definitely overdue
      let ran = 0
      const handle = jobs.start(`k`, {pattern: `0 3 * * *`, catchUp: false, task: async () => void ran++})
      try {
        await sleep(250)
        expect(ran).toBe(0)
      } finally {
        await settle(handle.stop)
      }
    } finally {
      await env.close()
    }
  })

  it(`an overdue job runs exactly once at boot`, async () => {
    const {env} = setup(`runner`)
    try {
      const jobs = new LmdbJobRun(env)
      await jobs.recordRun(`k`, Date.now() - 3 * 86_400_000)
      let ran = 0
      const handle = jobs.start(`k`, {pattern: `0 3 * * *`, task: async () => void ran++})
      try {
        await sleep(300)
        expect(ran).toBe(1)
      } finally {
        await settle(handle.stop)
      }
    } finally {
      await env.close()
    }
  })

  it(`runOnStart forces a run when not due`, async () => {
    const {env} = setup(`runner`)
    try {
      const jobs = new LmdbJobRun(env)
      await jobs.recordRun(`k`, Date.now())
      let ran = 0
      const handle = jobs.start(`k`, {pattern: `0 3 * * *`, runOnStart: true, task: async () => void ran++})
      try {
        await sleep(300)
        expect(ran).toBe(1)
      } finally {
        await settle(handle.stop)
      }
    } finally {
      await env.close()
    }
  })

  it(`a failing task routes to onError and leaves the job overdue`, async () => {
    const {env} = setup(`runner`)
    try {
      const jobs = new LmdbJobRun(env)
      await jobs.recordRun(`k`, Date.now())
      const seen: Array<unknown> = []
      const handle = jobs.start(`k`, {pattern: `0 3 * * *`, task: async () => Promise.reject(new Error(`boom`)), onError: (err: unknown) => seen.push(err)})
      try {
        await handle.runNow()
        expect(seen.length).toBe(1)
        expect(seen[0]).toBeInstanceOf(Error)
        // Stamp unchanged, so the boundary is still missed.
        expect(jobs.missed(`k`, {pattern: `0 3 * * *`})).toBe(false)
        expect(jobs.lastRun(`k`)).toBeLessThanOrEqual(Date.now())
      } finally {
        await settle(handle.stop)
      }
    } finally {
      await env.close()
    }
  })

  it(`concurrent runNow calls collapse into one task run`, async () => {
    const {env} = setup(`runner`)
    try {
      const jobs = new LmdbJobRun(env)
      await jobs.recordRun(`k`, Date.now())
      let ran = 0
      const handle = jobs.start(`k`, {pattern: `0 3 * * *`, task: async () => void ran++})
      try {
        await Promise.all([handle.runNow(), handle.runNow(), handle.runNow()])
        expect(ran).toBe(1)
      } finally {
        await settle(handle.stop)
      }
    } finally {
      await env.close()
    }
  })

  it(`runNow still works after stop`, async () => {
    const {env} = setup(`runner`)
    try {
      const jobs = new LmdbJobRun(env)
      await jobs.recordRun(`k`, Date.now())
      let ran = 0
      const handle = jobs.start(`k`, {pattern: `0 3 * * *`, task: async () => void ran++})
      await settle(handle.stop)
      await handle.runNow()
      expect(ran).toBe(1)
    } finally {
      await env.close()
    }
  })

  it(`start rejects a blank key and an unparseable pattern`, async () => {
    const {env} = setup(`runner`)
    try {
      const jobs = new LmdbJobRun(env)
      expect(() => jobs.start(``, {pattern: `0 3 * * *`, task: async () => {}})).toThrow(LmdbError)
      expect(() => jobs.start(`k`, {pattern: ``, task: async () => {}})).toThrow(LmdbError)
      expect(() => jobs.start(`k`, {pattern: `nope`, task: async () => {}})).toThrow(LmdbError)
    } finally {
      await env.close()
    }
  })
})
