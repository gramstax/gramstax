import {afterEach, describe, expect, it} from "bun:test"
import {existsSync, mkdirSync, readdirSync, readFileSync, utimesSync, writeFileSync} from "node:fs"
import {join, basename} from "node:path"
import type {S3Client} from "@aws-sdk/client-s3"
import {LmdbBackup, type LmdbBackupHandle, type LmdbBackupS3Options, type LmdbBackupStartOptions} from "../src/backup"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {LmdbJobRun} from "../src/job-run"
import {LmdbSchema, t} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

class ValSchema extends LmdbSchema {
  static db = `vals`
  static key = t.number()
  static value = {n: t.number()}
}

const dirs: Array<string> = []
// Must be awaited: `rmWithRetry` sleeps between attempts, so an unawaited
// call keeps deleting this test's temp dir while the NEXT test already runs —
// its ENOENT then surfaces against whichever test is active at the time.
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rmWithRetry(dir)
})

function setupEnvAt(dir: string): {env: LmdbEnv; dir: string; base: string} {
  const base = join(dir, `backups`)
  dirs.push(dir)
  const env = new LmdbEnv({path: join(dir, `data`), maxDbs: 10})
  return {env, dir, base}
}

function setupEnv(): {env: LmdbEnv; dir: string; base: string} {
  return setupEnvAt(createTestDir(`backup-src`))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Poll until `check` holds, so a slow snapshot is not mistaken for a missing one.
 *
 * @remarks
 * A fixed sleep is a race on a loaded machine: `mdb_env_copy2` plus the prune
 * behind it can outlast the window, and the assertion then fails for a backup
 * that was merely late.
 */
async function until(check: () => boolean, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!check()) {
    if (Date.now() > deadline) return
    await sleep(25)
  }
}

/** Count created backups, tolerating a base dir the test never made. */
function backupCount(base: string): number {
  try {
    return readdirSync(base).filter((n) => n.startsWith(`backup-`)).length
  } catch {
    return 0
  }
}

/**
 * Start a schedule, run `body`, and always stop the timer afterwards.
 *
 * A leaked interval keeps snapshotting into a temp dir the runner is about to
 * delete. Under bun that escalates to a native segfault in the LMDB binding
 * rather than a readable test failure, so `stop()` belongs in a `finally` and
 * never after the assertions.
 */
async function duringSchedule(env: LmdbEnv, opts: LmdbBackupStartOptions, body: (handle: LmdbBackupHandle) => Promise<void>): Promise<void> {
  const handle = LmdbBackup.start(env, opts)
  try {
    await body(handle)
  } finally {
    await handle.stop()
  }
}

describe(`LmdbBackup`, () => {
  it(`backup creates timestamped dir and prunes to keep`, async () => {
    const {env, base} = setupEnv()
    try {
      const subs = env.register(ValSchema)
      await subs.put(1, {n: 7})
      const first = await LmdbBackup.backup(env, base, 2)
      expect(existsSync(first)).toBe(true)
      const second = await LmdbBackup.backup(env, base, 2)
      expect(existsSync(second)).toBe(true)
      const third = await LmdbBackup.backup(env, base, 1)
      expect(existsSync(first)).toBe(false)
      expect(existsSync(second)).toBe(false)
      expect(existsSync(third)).toBe(true)
    } finally {
      await env.close()
    }
  })

  it(`prune never touches foreign files`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      mkdirSync(base, {recursive: true})
      const foreign = join(base, `notes.txt`)
      writeFileSync(foreign, `do not delete`)
      await LmdbBackup.backup(env, base, 1)
      await LmdbBackup.backup(env, base, 1)
      expect(existsSync(foreign)).toBe(true)
    } finally {
      await env.close()
    }
  })

  it(`list returns backups oldest-first`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      const a = await LmdbBackup.backup(env, base, 5)
      // Two backups created inside the same millisecond share a stamp, and
      // _byOldest then falls back to the random name suffix — documented as
      // "arbitrary but stable", which is what `prune` needs to pick a
      // deterministic victim, but which is NOT creation order. Wait for the
      // clock to advance so this asserts the oldest-first ordering it is named
      // for. Without it the test passes or fails on how fast the machine is.
      const stampA = Number(basename(a).split(`-`)[1])
      expect(Number.isFinite(stampA)).toBe(true)
      while (Date.now() <= stampA) await new Promise(resolve => setTimeout(resolve, 1))
      const b = await LmdbBackup.backup(env, base, 5)
      const entries = LmdbBackup.list(base)
      expect(entries.map((e) => e.path)).toEqual([a, b])
      expect(entries[0]?.mtimeMs).toBeLessThanOrEqual(entries[1]?.mtimeMs ?? 0)
    } finally {
      await env.close()
    }
  })

  it(`prune keeps a fresh backup ahead of an entry with no stamp in its name`, async () => {
    const {env, base} = setupEnv()
    try {
      mkdirSync(base, {recursive: true})
      // A name no run of this package produces, so no stamp can be parsed from it.
      const legacy = join(base, `backup-old-a`)
      mkdirSync(legacy, {recursive: true})
      const old = new Date(1_700_000_000_000)
      utimesSync(legacy, old, old)
      const fresh = await LmdbBackup.backup(env, base, 1)
      // Digits sort before letters, so ordering these by name would put `fresh`
      // first and `prune` would delete the backup it just wrote.
      expect(existsSync(legacy)).toBe(false)
      expect(existsSync(fresh)).toBe(true)
    } finally {
      await env.close()
    }
  })

  it(`list stays oldest-first when mtime order disagrees with creation order`, async () => {
    const {env, base} = setupEnv()
    try {
      mkdirSync(base, {recursive: true})
      // Fixed names rather than real `backup()` stamps: two real ones can share a
      // millisecond, which would leave the expected order a coin flip. Here the
      // creation order is a fact of the test instead of a race.
      const older = join(base, `backup-0000000000001-aaaa`)
      const newer = join(base, `backup-0000000000002-bbbb`)
      mkdirSync(older, {recursive: true})
      mkdirSync(newer, {recursive: true})
      // `older` was created first but is given the LATER mtime, so an mtime
      // ordering would return the opposite answer.
      const late = new Date(1_700_000_060_000)
      const early = new Date(1_700_000_000_000)
      utimesSync(older, late, late)
      utimesSync(newer, early, early)
      expect(LmdbBackup.list(base).map((e) => e.path)).toEqual([older, newer])
    } finally {
      await env.close()
    }
  })

  it(`prune keeps the newest when mtime order disagrees with creation order`, async () => {
    const {env, base} = setupEnv()
    try {
      mkdirSync(base, {recursive: true})
      const older = join(base, `backup-0000000000001-aaaa`)
      const newer = join(base, `backup-0000000000002-bbbb`)
      mkdirSync(older, {recursive: true})
      mkdirSync(newer, {recursive: true})
      const late = new Date(1_700_000_060_000)
      const early = new Date(1_700_000_000_000)
      utimesSync(older, late, late)
      utimesSync(newer, early, early)
      LmdbBackup.prune(base, 1)
      expect(existsSync(older)).toBe(false)
      expect(existsSync(newer)).toBe(true)
    } finally {
      await env.close()
    }
  })

  it(`list breaks a same-millisecond tie by name, not by mtime`, async () => {
    const {env, base} = setupEnv()
    try {
      mkdirSync(base, {recursive: true})
      const first = join(base, `backup-0000000000001-aaaa`)
      const second = join(base, `backup-0000000000001-bbbb`)
      mkdirSync(first, {recursive: true})
      mkdirSync(second, {recursive: true})
      // Identical stamp: `prune` still has to choose a stable victim, so the
      // name decides. The mtimes are inverted against the names so that an
      // mtime-first tiebreak returns the opposite answer and gets caught.
      const late = new Date(1_700_000_060_000)
      const early = new Date(1_700_000_000_000)
      utimesSync(first, late, late)
      utimesSync(second, early, early)
      expect(LmdbBackup.list(base).map((e) => e.path)).toEqual([first, second])
    } finally {
      await env.close()
    }
  })

  it(`restore round-trips data`, async () => {
    const {env, dir, base} = setupEnv()
    try {
      const subs = env.register(ValSchema)
      await subs.put(1, {n: 42})
      const src = await LmdbBackup.backup(env, base, 3)
      await env.close()
      const dest = join(dir, `restored`)
      await LmdbBackup.restore(src, dest)
      const revived = new LmdbEnv({path: dest, maxDbs: 10})
      try {
        const rows = revived.register(ValSchema)
        expect(rows.get(1)).toEqual({n: 42})
      } finally {
        await revived.close()
      }
    } finally {
      if (env.state === `open`) await env.close()
    }
  })

  it(`restore rejects non-backup source and existing dest`, async () => {
    const {env, dir, base} = setupEnv()
    try {
      env.register(ValSchema)
      const empty = join(dir, `empty`)
      mkdirSync(empty, {recursive: true})
      await expect(LmdbBackup.restore(empty, join(dir, `out`))).rejects.toBeInstanceOf(LmdbError)
      const src = await LmdbBackup.backup(env, base, 3)
      const dest = join(dir, `taken`)
      mkdirSync(dest, {recursive: true})
      await expect(LmdbBackup.restore(src, dest)).rejects.toBeInstanceOf(LmdbError)
      await LmdbBackup.restore(src, dest, {overwrite: true})
      expect(existsSync(join(dest, `data.mdb`))).toBe(true)
    } finally {
      await env.close()
    }
  })

  it(`start fires on a cron boundary and stop halts it`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      // One second is the finest granularity croner offers, so this is the only
      // test that waits on a real boundary. Everything else forces a tick.
      const handle = LmdbBackup.start(env, {dir: base, keep: 5, pattern: `* * * * * *`, persist: false})
      expect(handle.label()).toContain(`* * * * * *`)
      await sleep(1300)
      await handle.stop()
      const count = backupCount(base)
      expect(count).toBeGreaterThanOrEqual(1)
      await sleep(1300)
      expect(backupCount(base)).toBe(count)
    } finally {
      await env.close()
    }
  })

  it(`start rejects a bad pattern`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      expect(() => LmdbBackup.start(env, {dir: base, pattern: ``})).toThrow(LmdbError)
      expect(() => LmdbBackup.start(env, {dir: base, pattern: `   `})).toThrow(LmdbError)
      expect(() => LmdbBackup.start(env, {dir: base, pattern: `not a cron`})).toThrow(LmdbError)
      expect(() => LmdbBackup.start(env, {dir: base, pattern: `99 99 99 99 99 99`})).toThrow(LmdbError)
    } finally {
      await env.close()
    }
  })

  it(`runNow stamps a successful run`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      await duringSchedule(env, {dir: base, pattern: `0 3 * * *`, persist: false}, async (handle) => {
        await handle.runNow()
        expect(backupCount(base)).toBe(1)
      })
    } finally {
      await env.close()
    }
  })

  it(`a scheduled success is stamped`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      // Fresh stamp so no boot catch-up fires, isolating the runNow path.
      await new LmdbJobRun(env).recordRun(`backup`, Date.now())
      await duringSchedule(env, {dir: base, pattern: `0 3 * * *`}, async (handle) => {
        await handle.runNow()
        const at = new LmdbJobRun(env).lastRun(`backup`)
        expect(typeof at).toBe(`number`)
        expect(at).toBeGreaterThan(0)
      })
    } finally {
      await env.close()
    }
  })

  it(`a recent stamp means no snapshot at boot`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      await new LmdbJobRun(env).recordRun(`backup`, Date.now())
      await duringSchedule(env, {dir: base, pattern: `0 3 * * *`}, async () => {
        await sleep(250)
        expect(backupCount(base)).toBe(0)
      })
    } finally {
      await env.close()
    }
  })

  it(`a job that missed a boundary catches up exactly once at boot`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      // Three days stale against a daily pattern: several boundaries passed
      // while the process was down, and boot must still take only one snapshot.
      await new LmdbJobRun(env).recordRun(`backup`, Date.now() - 3 * 86_400_000)
      await duringSchedule(env, {dir: base, pattern: `0 3 * * *`}, async () => {
        await sleep(350)
        expect(backupCount(base)).toBe(1)
      })
    } finally {
      await env.close()
    }
  })

  it(`a fresh env catches up once at boot`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      await duringSchedule(env, {dir: base, pattern: `0 3 * * *`}, async () => {
        await sleep(350)
        expect(backupCount(base)).toBe(1)
      })
    } finally {
      await env.close()
    }
  })

  it(`runOnStart forces a run even when the job is not due`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      await new LmdbJobRun(env).recordRun(`backup`, Date.now())
      await duringSchedule(env, {dir: base, pattern: `0 3 * * *`, runOnStart: true}, async () => {
        await sleep(300)
        expect(backupCount(base)).toBe(1)
      })
    } finally {
      await env.close()
    }
  })

  it(`persist false writes no stamp`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      // `persist: false` keeps the stamp in memory only. The `job-run` schema is
      // still registered, because `LmdbJobRun` registers it in its constructor —
      // the flag governs writes, not slot accounting.
      await duringSchedule(env, {dir: base, pattern: `0 3 * * *`, persist: false}, async (handle) => {
        await handle.runNow()
        expect(backupCount(base)).toBe(1)
        expect(handle.lastRun()).toBeGreaterThan(0)
        expect(new LmdbJobRun(env).lastRun(`backup`)).toBeUndefined()
      })
    } finally {
      await env.close()
    }
  })

  it(`persist false does not catch up at boot`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      await new LmdbJobRun(env).recordRun(`backup`, Date.now() - 3 * 86_400_000)
      await duringSchedule(env, {dir: base, pattern: `0 3 * * *`, persist: false}, async () => {
        await sleep(250)
        expect(backupCount(base)).toBe(0)
      })
    } finally {
      await env.close()
    }
  })

  it(`persistKey keeps two schedules on one env independent`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      const hourlyAt = Date.now() - 5_000
      const jobs = new LmdbJobRun(env)
      await jobs.recordRun(`nightly`, Date.now() - 3 * 86_400_000)
      await jobs.recordRun(`hourly`, hourlyAt)
      const nightly = LmdbBackup.start(env, {dir: base, pattern: `0 3 * * *`, persistKey: `nightly`})
      const hourly = LmdbBackup.start(env, {dir: base, pattern: `0 3 * * *`, persistKey: `hourly`})
      try {
        await until(() => backupCount(base) === 1)
        // `hourly` must NOT catch up. Keep the original window so that "did not
        // fire" is still being observed, rather than asserted before it had a
        // chance to run.
        await sleep(350)
        expect(backupCount(base)).toBe(1)
        expect(jobs.lastRun(`nightly`)).toBeGreaterThan(hourlyAt)
        expect(jobs.lastRun(`hourly`)).toBe(hourlyAt)
      } finally {
        await nightly.stop()
        await hourly.stop()
      }
    } finally {
      await env.close()
    }
  })

  it(`a failed tick does not advance the stamp`, async () => {
    const {env, dir} = setupEnv()
    try {
      env.register(ValSchema)
      // A file where a directory must be: the snapshot fails at mkdir while
      // the env stays open.
      const blocker = join(dir, `blocker`)
      writeFileSync(blocker, `x`)
      await duringSchedule(env, {dir: join(blocker, `backups`), pattern: `0 3 * * *`}, async (handle) => {
        await handle.runNow()
        expect(new LmdbJobRun(env).lastRun(`backup`)).toBeUndefined()
      })
    } finally {
      await env.close()
    }
  })

  it(`a long-interval pattern does not fire immediately`, async () => {
    const {env, dir} = setupEnv()
    try {
      env.register(ValSchema)
      // Midnight on 1 January — the next boundary is far away. A plain timer
      // clamps anything past 2^31-1 ms down to 1 ms and would spin here.
      const blocker = join(dir, `blocker`)
      writeFileSync(blocker, `x`)
      const seen: Array<unknown> = []
      await duringSchedule(env, {dir: join(blocker, `backups`), pattern: `0 0 1 1 *`, persist: false, onError: (err: unknown) => seen.push(err)}, async () => {
        await sleep(250)
        expect(seen).toEqual([])
      })
    } finally {
      await env.close()
    }
  })

  it(`start throws on a closed env when persisting`, async () => {
    const {env, base} = setupEnv()
    await env.close()
    // Captured so a regression cannot leak a live timer onto a closed env.
    let leaked: LmdbBackupHandle | undefined
    try {
      expect(() => {
        leaked = LmdbBackup.start(env, {dir: base, pattern: `0 3 * * *`})
      }).toThrow(LmdbError)
    } finally {
      await leaked?.stop()
    }
  })

  it(`label reports the pattern and the persisted stamp`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      const at = Date.now() - 60_000
      await new LmdbJobRun(env).recordRun(`backup`, at)
      await duringSchedule(env, {dir: base, pattern: `0 3 * * *`}, async (handle) => {
        expect(handle.label()).toContain(`0 3 * * *`)
        expect(handle.label()).toContain(new Date(at).toISOString())
      })
    } finally {
      await env.close()
    }
  })

  it(`runNow still works after stop`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      await duringSchedule(env, {dir: base, pattern: `0 3 * * *`, persist: false}, async (handle) => {
        await handle.stop()
        await handle.runNow()
        expect(backupCount(base)).toBe(1)
      })
    } finally {
      await env.close()
    }
  })

  it(`stop waits for a run already in flight`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      const handle = LmdbBackup.start(env, {dir: base, pattern: `0 0 1 1 *`, persist: false})
      const running = handle.runNow()
      await handle.stop()
      expect(backupCount(base)).toBe(1)
      await running
      expect(backupCount(base)).toBe(1)
    } finally {
      await env.close()
    }
  })

  it(`concurrent runNow calls collapse into one snapshot`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      await duringSchedule(env, {dir: base, pattern: `0 3 * * *`, persist: false}, async (handle) => {
        await Promise.all([handle.runNow(), handle.runNow(), handle.runNow()])
        expect(backupCount(base)).toBe(1)
      })
    } finally {
      await env.close()
    }
  })

  it(`backup removes the partial dir when the copy fails`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      // A closed env fails inside `env.backup()`, i.e. after the destination
      // directory already exists.
      await env.close()
      await expect(LmdbBackup.backup(env, base, 3)).rejects.toBeInstanceOf(LmdbError)
      expect(LmdbBackup.list(base)).toEqual([])
    } finally {
      await env.close()
    }
  })

  it(`snapshot tar.gz archives, prunes, and restores`, async () => {
    const {env, dir, base} = setupEnv()
    try {
      const subs = env.register(ValSchema)
      await subs.put(1, {n: 9})
      const {path: first} = await LmdbBackup.snapshot(env, {dir: base, keep: 5, format: `tar.gz`})
      expect(first.endsWith(`.tar.gz`)).toBe(true)
      expect(existsSync(first)).toBe(true)
      expect(LmdbBackup.listArchives(base).map((e) => e.path)).toEqual([first])
      await LmdbBackup.snapshot(env, {dir: base, keep: 1, format: `tar.gz`})
      expect(existsSync(first)).toBe(false)
      expect(LmdbBackup.listArchives(base)).toHaveLength(1)
      const leftovers = readdirSync(base).filter((n) => n.endsWith(`.part`))
      expect(leftovers).toEqual([])
      await env.close()
      const dest = join(dir, `revived`)
      await LmdbBackup.restoreArchive(LmdbBackup.listArchives(base)[0]!.path, dir, `revived`)
      const revived = new LmdbEnv({path: dest, maxDbs: 10})
      try {
        expect(revived.register(ValSchema).get(1)).toEqual({n: 9})
      } finally {
        await revived.close()
      }
    } finally {
      if (env.state === `open`) await env.close()
    }
  })

  it(`snapshot rejects bad format and dir-format S3`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      const badFormat = LmdbBackup.snapshot(env, {dir: base, format: `zip` as never})
      await expect(badFormat).rejects.toBeInstanceOf(LmdbError)
      const s3 = {bucket: `b`, accessKeyId: `k`, secretAccessKey: `s`}
      const dirS3 = LmdbBackup.snapshot(env, {dir: base, format: `dir`, s3})
      await expect(dirS3).rejects.toBeInstanceOf(LmdbError)
    } finally {
      await env.close()
    }
  })

  it(`restoreArchive rejects missing archive`, async () => {
    const {env, dir} = setupEnv()
    try {
      env.register(ValSchema)
      await expect(LmdbBackup.restoreArchive(join(dir, `nope.tar.gz`), dir, `out`)).rejects.toBeInstanceOf(LmdbError)
    } finally {
      await env.close()
    }
  })

  it(`uploadToS3 validates config before network`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      const src = (await LmdbBackup.snapshot(env, {dir: base, keep: 3, format: `tar.gz`})).path
      const s3 = {bucket: ``, accessKeyId: ``, secretAccessKey: ``}
      await expect(LmdbBackup.uploadToS3(src, s3)).rejects.toBeInstanceOf(LmdbError)
    } finally {
      await env.close()
    }
  })

  it(`list returns [] for missing dir`, () => {
    expect(LmdbBackup.list(join(`no-such-dir`, `x`))).toEqual([])
    expect(LmdbBackup.listArchives(join(`no-such-dir`, `x`))).toEqual([])
  })

  it(`clearStaleStaging removes crash leftovers only`, async () => {
    const dir = createTestDir(`stale-`)
    dirs.push(dir)
    mkdirSync(join(dir, `backup-stale`), {recursive: true})
    writeFileSync(join(dir, `notes.txt`), `keep`)
    await LmdbBackup.clearStaleStaging(dir)
    expect(existsSync(join(dir, `backup-stale`))).toBe(false)
    expect(existsSync(join(dir, `notes.txt`))).toBe(true)
  })

  it(`snapshot tar.gz on closed env rejects and cleans staging`, async () => {
    const {env, base} = setupEnv()
    env.register(ValSchema)
    await env.close()
    await expect(LmdbBackup.snapshot(env, {dir: base, keep: 3, format: `tar.gz`})).rejects.toBeInstanceOf(LmdbError)
    expect(readdirSync(base).filter((n) => n.startsWith(`backup-`))).toEqual([])
  })

  it(`restore rejects missing source`, async () => {
    const {env, dir} = setupEnv()
    try {
      env.register(ValSchema)
      await expect(LmdbBackup.restore(join(dir, `nope`), join(dir, `out`))).rejects.toBeInstanceOf(LmdbError)
    } finally {
      await env.close()
    }
  })

  it(`start validates format`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      const s3 = {bucket: `b`, accessKeyId: `k`, secretAccessKey: `s`}
      expect(() => LmdbBackup.start(env, {dir: base, pattern: `0 3 * * *`, format: `zip` as never})).toThrow(LmdbError)
      expect(() => LmdbBackup.start(env, {dir: base, pattern: `0 3 * * *`, format: `dir`, s3})).toThrow(LmdbError)
    } finally {
      await env.close()
    }
  })

  it(`start routes tick failures to onError`, async () => {
    const {env, dir, base} = setupEnv()
    try {
      env.register(ValSchema)
      await new LmdbJobRun(env).recordRun(`backup`, Date.now())
      // A file where the backup directory must be: the snapshot fails at mkdir,
      // the env stays open, and the failure has to surface through onError.
      const blocker = join(dir, `blocker`)
      writeFileSync(blocker, `x`)
      const seen: Array<unknown> = []
      await duringSchedule(env, {dir: join(blocker, `backups`), pattern: `0 3 * * *`, onError: (err: unknown) => seen.push(err)}, async (handle) => {
        await handle.runNow()
      })
      expect(seen.length).toBe(1)
      expect(seen[0]).toBeInstanceOf(Error)
      // A failed cycle must not count as a run.
      expect(new LmdbJobRun(env).lastRun(`backup`)).toBeLessThanOrEqual(Date.now())
      expect(backupCount(base)).toBe(0)
    } finally {
      await env.close()
    }
  })

  it(`snapshot tar.gz uploads to fake S3 and prunes remote`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      const calls: Array<string> = []
      const remote = [
        {Key: `snapshots/old.tar.gz`, LastModified: new Date(`2020-01-01T00:00:00Z`)},
        {Key: `snapshots/older.tar.gz`, LastModified: new Date(`2019-01-01T00:00:00Z`)}
      ]
      const s3 = {...s3Creds(), client: fakeS3(calls, remote)}
      const {path, uploaded} = await LmdbBackup.snapshot(env, {dir: base, keep: 1, format: `tar.gz`, s3})
      expect(path.endsWith(`.tar.gz`)).toBe(true)
      expect(uploaded?.endsWith(`.tar.gz`)).toBe(true)
      expect(calls).toContain(`PutObjectCommand`)
      expect(calls).toContain(`DeleteObjectsCommand`)
    } finally {
      await env.close()
    }
  })

  it(`s3Keep retains remote archives independently of local keep`, async () => {
    const remote = () => [
      {Key: `snapshots/old.tar.gz`, LastModified: new Date(`2020-01-01T00:00:00Z`)},
      {Key: `snapshots/older.tar.gz`, LastModified: new Date(`2019-01-01T00:00:00Z`)}
    ]
    const tight = setupEnv()
    const loose = setupEnv()
    try {
      tight.env.register(ValSchema)
      loose.env.register(ValSchema)
      const tightCalls: Array<string> = []
      const looseCalls: Array<string> = []

      await LmdbBackup.snapshot(tight.env, {
        dir: tight.base,
        keep: 1,
        format: `tar.gz`,
        s3: {...s3Creds(), client: fakeS3(tightCalls, remote())}
      })
      await LmdbBackup.snapshot(loose.env, {
        dir: loose.base,
        keep: 1,
        s3Keep: 5,
        format: `tar.gz`,
        s3: {...s3Creds(), client: fakeS3(looseCalls, remote())}
      })

      // Without it the remote copy follows local `keep`; with it the off-host
      // archives the local prune would have deleted are still there.
      expect(tightCalls).toContain(`DeleteObjectsCommand`)
      expect(looseCalls).toContain(`PutObjectCommand`)
      expect(looseCalls).not.toContain(`DeleteObjectsCommand`)
    } finally {
      await tight.env.close()
      await loose.env.close()
    }
  })

  it(`start forwards s3Keep to the scheduled tick`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      const calls: Array<string> = []
      const s3 = {
        ...s3Creds(),
        client: fakeS3(calls, [{Key: `snapshots/old.tar.gz`, LastModified: new Date(`2020-01-01T00:00:00Z`)}])
      }
      const handle = LmdbBackup.start(env, {dir: base, keep: 1, s3Keep: 5, pattern: `0 3 * * *`, format: `tar.gz`, s3})
      await handle.runNow()
      await handle.stop()
      expect(calls).toContain(`PutObjectCommand`)
      expect(calls).not.toContain(`DeleteObjectsCommand`)
    } finally {
      await env.close()
    }
  })

  it(`pruneS3Archives removes oldest beyond keep`, async () => {
    const calls: Array<string> = []
    const remote = [
      {Key: `snapshots/a.tar.gz`, LastModified: new Date(`2020-01-01T00:00:00Z`)},
      {Key: `snapshots/b.tar.gz`, LastModified: new Date(`2021-01-01T00:00:00Z`)},
      {Key: `snapshots/c.tar.gz`, LastModified: new Date(`2022-01-01T00:00:00Z`)}
    ]
    const s3 = {...s3Creds(), client: fakeS3(calls, remote)}
    const {removed} = await LmdbBackup.pruneS3Archives(s3, 1)
    expect(removed).toEqual([`snapshots/a.tar.gz`, `snapshots/b.tar.gz`])
  })

  it(`downloadFromS3 writes body to file`, async () => {
    const dir = createTestDir(`s3dl-`)
    try {
      const calls: Array<string> = []
      const s3 = {...s3Creds(), client: fakeS3(calls, [])}
      await LmdbBackup.downloadFromS3(s3, `snapshots/x.tar.gz`, dir, `out.tar.gz`)
      expect(readFileSync(join(dir, `out.tar.gz`), `utf8`)).toBe(`hello`)
    } finally {
      await rmWithRetry(dir)
    }
  })

  it(`downloadFromS3 creates a missing destination directory`, async () => {
    const dir = createTestDir(`s3nested-`)
    try {
      const calls: Array<string> = []
      const s3 = {...s3Creds(), client: fakeS3(calls, [])}
      const nested = join(dir, `nested`, `deeper`)
      const returned = await LmdbBackup.downloadFromS3(s3, `snapshots/x.tar.gz`, nested, `out.tar.gz`)
      expect(returned).toBe(join(nested, `out.tar.gz`))
      expect(readFileSync(join(nested, `out.tar.gz`), `utf8`)).toBe(`hello`)
    } finally {
      await rmWithRetry(dir)
    }
  })

  it(`downloadFromS3 leaves no .part file behind`, async () => {
    const dir = createTestDir(`s3part-`)
    try {
      const calls: Array<string> = []
      const s3 = {...s3Creds(), client: fakeS3(calls, [])}
      await LmdbBackup.downloadFromS3(s3, `snapshots/x.tar.gz`, dir, `out.tar.gz`)
      expect(readdirSync(dir)).toEqual([`out.tar.gz`])
    } finally {
      await rmWithRetry(dir)
    }
  })

  it(`downloadFromS3 runs in parallel without clobbering partials`, async () => {
    const dir = createTestDir(`s3par-`)
    try {
      const names = [`a`, `b`, `c`, `d`]
      // Distinct, chunk-y bodies so an interleaved write would be visible.
      const bodyFor = (key: string) => key.repeat(4_096)
      const s3 = {
        ...s3Creds(),
        client: {
          send: async (cmd: unknown) => {
            const key = (cmd as {input: {Key: string}}).input.Key
            const body = bodyFor(key)
            return {
              Body: new ReadableStream({
                start(c) {
                  // Two chunks with a yield between them, so two downloads into
                  // one directory genuinely interleave at the stream level.
                  c.enqueue(new TextEncoder().encode(body.slice(0, body.length / 2)))
                  queueMicrotask(() => {
                    c.enqueue(new TextEncoder().encode(body.slice(body.length / 2)))
                    c.close()
                  })
                }
              })
            }
          }
        } as unknown as S3Client
      }
      const targets = await Promise.all(names.map((n) => LmdbBackup.downloadFromS3(s3, `snapshots/${n}.tar.gz`, dir, `${n}.tar.gz`)))
      expect(targets).toEqual(names.map((n) => join(dir, `${n}.tar.gz`)))
      for (const n of names) {
        expect(readFileSync(join(dir, `${n}.tar.gz`), `utf8`)).toBe(bodyFor(`snapshots/${n}.tar.gz`))
      }
      expect(readdirSync(dir).sort()).toEqual([...names].map((n) => `${n}.tar.gz`).sort())
    } finally {
      await rmWithRetry(dir)
    }
  })

  it(`_peer maps missing modules to LmdbError`, async () => {
    const peer = (LmdbBackup as unknown as {_peer<T>(specifier: string, hint: string): Promise<T>})._peer
    await expect(peer(`no-such-peer-xyz`, `install hint`)).rejects.toThrow(`install hint`)
  })

  it(`_resolveS3 constructs a real client from fields`, async () => {
    const client = await (LmdbBackup as unknown as {_resolveS3(o: LmdbBackupS3Options): Promise<unknown>})._resolveS3({
      ...s3Creds(),
      endpoint: `https://s3.example.com`,
      region: `us-east-1`,
      forcePathStyle: true
    })
    expect((client as {constructor: {name: string}}).constructor.name).toBe(`S3Client`)
  })
})

function s3Creds(): LmdbBackupS3Options {
  return {bucket: `b`, accessKeyId: `k`, secretAccessKey: `s`}
}

type DrainableBody = {once: (event: string, fn: () => void) => unknown; resume: () => unknown}

function isDrainable(value: unknown): value is DrainableBody {
  if (typeof value !== `object` || value === null) return false
  const candidate = value as DrainableBody
  return typeof candidate.resume === `function` && typeof candidate.once === `function`
}

/** Consume a request body the way the real S3 SDK does, and wait for it to close. */
async function drain(body: DrainableBody): Promise<void> {
  await new Promise<void>((resolve) => {
    const done = (): void => resolve()
    body.once(`close`, done)
    body.once(`end`, done)
    body.once(`error`, done)
    body.resume()
  })
}

function fakeS3(calls: Array<string>, objects: Array<{Key: string; LastModified: Date}>, body = `hello`): S3Client {
  return {
    send: async (cmd: unknown) => {
      const kind = (cmd as {constructor: {name: string}}).constructor.name
      calls.push(kind)
      if (kind === `PutObjectCommand`) {
        const carrier = cmd as {Body?: unknown; input?: {Body?: unknown}}
        const payload = carrier.input?.Body ?? carrier.Body
        if (isDrainable(payload)) await drain(payload)
        return {$metadata: {httpStatusCode: 200}}
      }
      if (kind === `ListObjectsV2Command`) {
        return {Contents: objects.map((o) => ({Key: o.Key, LastModified: o.LastModified})), IsTruncated: false}
      }
      if (kind === `DeleteObjectsCommand`) return {}
      if (kind === `GetObjectCommand`) {
        return {
          Body: new ReadableStream({
            start(c) {
              c.enqueue(new TextEncoder().encode(body))
              c.close()
            }
          })
        }
      }
      throw new Error(`unexpected ${kind}`)
    }
  } as unknown as S3Client
}

describe(`compact reaches the native copy`, () => {
  it(`env.backup defaults to no compaction`, async () => {
    const {env, base} = setupEnvAt(createTestDir(`lmdb-compact-default-`))
    try {
      const vals = env.register(ValSchema)
      await vals.put(1, {n: 1})
      const dest = join(base, `snap`)
      mkdirSync(dest, {recursive: true})
      await env.backup(dest)
      expect(existsSync(join(dest, `data.mdb`))).toBe(true)
    } finally {
      await env.close()
    }
  })

  it(`env.backup accepts an explicit compact flag`, async () => {
    const {env, base} = setupEnvAt(createTestDir(`lmdb-compact-true-`))
    try {
      const vals = env.register(ValSchema)
      await vals.put(1, {n: 1})
      const dest = join(base, `snap`)
      mkdirSync(dest, {recursive: true})
      await env.backup(dest, true)
      expect(existsSync(join(dest, `data.mdb`))).toBe(true)
    } finally {
      await env.close()
    }
  })

  it(`snapshot forwards compact to the dir path`, async () => {
    const {env, base} = setupEnvAt(createTestDir(`lmdb-compact-snap-`))
    try {
      const vals = env.register(ValSchema)
      await vals.put(1, {n: 1})
      const {path} = await LmdbBackup.snapshot(env, {dir: base, compact: true})
      expect(existsSync(join(path, `data.mdb`))).toBe(true)
    } finally {
      await env.close()
    }
  })

  it(`snapshot forwards compact to the tar.gz path`, async () => {
    const {env, base} = setupEnvAt(createTestDir(`lmdb-compact-snap2-`))
    try {
      const vals = env.register(ValSchema)
      await vals.put(1, {n: 1})
      const {path} = await LmdbBackup.snapshot(env, {dir: base, format: `tar.gz`, compact: true})
      expect(existsSync(path)).toBe(true)
    } finally {
      await env.close()
    }
  })

  it(`start forwards compact through its scheduled snapshot`, async () => {
    const {env, base} = setupEnvAt(createTestDir(`lmdb-compact-snap3-`))
    try {
      const vals = env.register(ValSchema)
      await vals.put(1, {n: 1})
      await duringSchedule(env, {dir: base, pattern: `0 3 * * *`, persist: false, compact: true}, async (handle) => {
        await handle.runNow()
        const entries = LmdbBackup.list(base)
        expect(entries.length).toBe(1)
        expect(existsSync(join(entries[0]!.path, `data.mdb`))).toBe(true)
      })
    } finally {
      await env.close()
    }
  })
})
