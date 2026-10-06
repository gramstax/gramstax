/**
 * Restart-safe scheduling with `LmdbJobRun`.
 *
 * The problem this solves: a plain timer forgets everything when the process
 * exits. Restart a bot every six hours with a "daily" backup and you either get
 * a snapshot on every boot, or — if the timer restarts from zero — no coverage
 * at all for the hours the process was down.
 *
 * `LmdbJobRun` owns both halves of the fix, the way `LmdbQueue` owns a queue's
 * metadata and lifecycle together:
 *
 *   croner        WHEN to fire. A wall-clock cron pattern, so runs land on the
 *                 same boundary regardless of when the process started.
 *   LmdbJobRun    DID WE MISS ONE. One persisted `{at}` row per job name —
 *                 the only thing that can survive a restart, since
 *                 `cron.previousRun()` is in-memory.
 *
 * Run with: `bun run packages/lmdb/example/job-run.ts`
 */
import {rm} from "node:fs/promises"
import {join} from "node:path"
import {Cron} from "croner"
import {JobRunSchema, LmdbBackup, LmdbEnv, LmdbJobRun} from "../src/index"

const DAY_MS = 86_400_000
const PATTERN = `0 3 * * *`

async function main(): Promise<void> {
  const root = join(process.cwd(), `.tmp-job-run-demo`)

  // ── 1. The normal case: hand it a pattern and a task ──────────────────────
  const db = new LmdbEnv({path: join(root, `data`), maxDbs: 10})
  try {
    const jobs = new LmdbJobRun(db)

    // `JobRunSchema` is a plain schema, so the stamps are ordinary rows you can
    // read yourself — no raw sub-DB handle, no cast.
    console.log(`schema registered:  `, db.isRegistered(JobRunSchema))
    console.log(`lastRun before run: `, jobs.lastRun(`daily-report`))

    const handle = jobs.start(`daily-report`, {
      // A wall-clock cron pattern, not a duration. Local time unless you pass
      // `timezone`. "Every 24h since the last run" is a different schedule and
      // cannot be expressed here.
      pattern: PATTERN,
      timezone: `Asia/Jakarta`,
      // Whatever the job actually is. A rejection is routed to `onError` and
      // never stops the schedule; the stamp lands only after this resolves.
      task: async () => {
        console.log(`  -> daily-report ran`)
      }
    })

    console.log(`label:              `, handle.label())
    console.log(`next boundary:      `, handle.nextRun()?.toISOString())

    await handle.runNow() // manual "run it now" — resolves when it has completed
    console.log(`after runNow:       `, handle.label())
    console.log(`stamp persisted:    `, new Date(jobs.lastRun(`daily-report`)!).toISOString())

    handle.stop()
    console.log(`nextRun after stop: `, handle.nextRun())
  } finally {
    await db.close()
  }

  // ── 2. Why catch-up needs a stamp at all ──────────────────────────────────
  // `missed()` is the decision `start()` makes internally: was a boundary newer
  // than our last success? Useful on its own when you want to check without
  // committing to a schedule.
  const db2 = new LmdbEnv({path: join(root, `data2`), maxDbs: 10})
  const jobs2 = new LmdbJobRun(db2)
  // Pretend the last successful run was three days ago.
  await jobs2.recordRun(`daily-report`, Date.now() - 3 * DAY_MS)
  console.log(`\nlastRun 3 days ago: `, new Date(jobs2.lastRun(`daily-report`)!).toISOString())
  console.log(`missed a boundary:  `, jobs2.missed(`daily-report`, {pattern: PATTERN}))

  // The stamp survives the process — which is the entire point.
  const at = jobs2.lastRun(`daily-report`)
  await db2.close()
  const reopened = new LmdbEnv({path: join(root, `data2`), maxDbs: 10})
  try {
    const survived = new LmdbJobRun(reopened).lastRun(`daily-report`)
    console.log(`after reopen:       `, survived === at ? `same stamp ✓` : `LOST ✗`)
  } finally {
    await reopened.close()
  }

  // ── 3. Backup is just one task that wants this ────────────────────────────
  // `LmdbBackup.start` is a thin wrapper: it supplies the snapshot task and
  // delegates every scheduling decision to `LmdbJobRun`.
  const db3 = new LmdbEnv({path: join(root, `data3`), maxDbs: 10})
  const backups = join(root, `backups`)
  try {
    const jobs3 = new LmdbJobRun(db3)
    // Seed a fresh stamp BEFORE starting so the boot catch-up does not fire,
    // making the runNow() below the one and only snapshot in this section.
    await jobs3.recordRun(`daily-backup`, Date.now())
    const handle = LmdbBackup.start(db3, {dir: backups, pattern: PATTERN, keep: 3, persistKey: `daily-backup`})
    await handle.runNow()
    console.log(`\nLmdbBackup.start:   `, handle.label())
    console.log(`archives on disk:   `, LmdbBackup.list(backups).length)
    console.log(`stamp in job-run:   `, jobs3.lastRun(`daily-backup`) !== undefined ? `written ✓` : `MISSING ✗`)
    handle.stop()
  } finally {
    await db3.close()
  }

  // ── 4. Doing it by hand, if you are not using LmdbJobRun ─────────────────
  // The wiring `LmdbJobRun.start` performs, in a few lines.
  const probe = new Cron(PATTERN, {paused: true, timezone: `Asia/Jakarta`})
  const boundary = probe.previousRuns(1)[0]
  probe.stop()
  console.log(`\nmanual: most recent boundary was`, boundary?.toISOString())

  await rm(root, {recursive: true, force: true})
  console.log(`\ndemo ok`)
}

if (import.meta.main) {
  await main().catch((err: unknown) => {
    console.error(err)
    process.exit(1)
  })
}
