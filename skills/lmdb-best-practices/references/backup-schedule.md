# backup-schedule

Anchor a scheduled job on a persisted run-stamp; a bare timer cannot survive a restart.

> Applies from the release that introduces `LmdbJobRun` and croner-backed scheduling. On earlier versions `LmdbBackup.start()` takes `intervalMs` (a duration) and `persist`/`persistKey`/`runNow` do not exist.

## Why

A timer plus a `lastRun` variable in memory is the obvious shape for "run this every N ms", and it is wrong the moment the process can restart. The variable dies with the process, so every boot begins a fresh interval and downtime is never counted.

Two halves, with a deliberate split — and `LmdbJobRun` owns both, the way `LmdbQueue` owns a queue's metadata and lifecycle together:

| | Answers | Provided by |
| --- | --- | --- |
| *when* to fire | the next wall-clock boundary | `croner`, inside `LmdbJobRun.start` |
| *did we miss one* | was a boundary newer than our last success | `LmdbJobRun` (persisted stamp) |

`croner` cannot answer the second question: `cron.previousRun()` is in-memory and dies with the process. That gap is the entire reason this module exists — and the reason the scheduling belongs next to the stamp rather than inside `LmdbBackup`. Any job can use it, not just backups.

The failure mode is a schedule that silently drifts out of coverage. With a daily pattern:

| Deployment reality | Timer-only behaviour | Stamp-anchored behaviour |
| --- | --- | --- |
| process restarts every 6 h | a snapshot on **every boot** — 4/day, so `keep: 3` covers the last 12 hours, not 3 days | 1/day |
| process down 3 days, then boots | **zero** snapshots — the window where a backup mattered most is the one with no coverage | 1 snapshot at boot |
| a snapshot takes 40 s | the next fire is still counted from the previous tick, so 40 s of drift compounds every cycle | runs land on the wall-clock boundary regardless |

## Pattern is wall-clock, not a duration

The single most important thing to internalise. `pattern` replaced `intervalMs`, and a cron expression is **not** "every N milliseconds".

| Intent | Old `intervalMs` | `pattern` |
| --- | --- | --- |
| every day at 03:00 | `86_400_000` — 24 h after the *last run* | `0 3 * * *` — 03:00 sharp, whatever the last run was |
| every six hours | `21_600_000` | `0 */6 * * *` |
| weekdays at 09:00 | not expressible | `0 9 * * 1-5` |

Pick deliberately: "24 h after the last backup" and "03:00 every day" drift apart permanently after the first missed run or a manual `runNow()`.

Patterns are read in the **local** timezone unless `timezone` is set. Pin it explicitly for anything that must not move with the host's locale or DST rules.

## The run-stamp lifecycle

| # | Event | `__job_run` row | Next run |
| --- | --- | --- | --- |
| 1 | fresh env, `start(env, {pattern})` | absent (never run counts as overdue) | one catch-up at boot |
| 2 | `snapshot()` resolves | `{at: Date.now()}` | next wall-clock boundary |
| 3 | `snapshot()` throws | **unchanged** — a failed cycle is not a run | next boundary, retried |
| 4 | restart, last success newer than the last boundary | read back at `start()` | the next boundary; no catch-up |
| 5 | restart, last boundary newer than the last success | read back at `start()` | **one** `trigger()` at boot, not one per missed boundary |
| 6 | `handle.label()` after a restart that found a stamp | read back at `start()` | reports the pattern and `last run <ISO>` before anything has run this boot |

The stamp is written **after** `snapshot()` resolves, never before. Stamping first would record a crash as a completed run and the next boot would treat the job as satisfied.

## Option semantics

| Option / condition | Behaviour | Why |
| --- | --- | --- |
| `pattern` (required) | cron expression, 5/6/7-field | wall-clock schedule |
| `timezone` | pins the pattern's zone | the host's locale and DST are not a contract |
| `persist` (default `true`) | reads and writes `__job_run` | the whole point — resume across restarts |
| `persist: false` | nothing written and no catch-up; the schema is still registered by the constructor | in-memory only — the schedule cannot survive a restart |
| `runOnStart` | forces a run even when not due | "back up now" on top of the normal rules |
| `persistKey` (default `'backup'`) | job name for the stamp | two schedules on one env need distinct names |
| `compact` (default `false`) | rewrites each copy densely — slower, smaller on disk | lmdb-js's `backup(path, compact)` requires the flag, so it is surfaced rather than hardcoded; use `true` for archives you retain or ship off-host, `false` for local snapshots you will replace soon |
| overlapping run | the second **joins** the in-flight cycle | `await runNow()` always means real work finished |
| `handle.runNow()` | snapshot + stamp now, schedule untouched | manual "back up now"; works even after `stop()` |
| `handle.stop()` | permanent — croner cannot resume a stopped job | stopping ends the schedule, not the stamp store |
| `__job_run` slot | 1 `maxDbs` slot, taken **eagerly** on `new LmdbJobRun(env)` | it is a registered schema, not a lazy `getDb` handle like CDC/sync |

## Do not pass a `name` to croner

Croner's named-job registry is **process-global** and throws on a duplicate:

```
Cron: Tried to initialize new named job 'dup', but name already taken.
```

Two envs in one process — which the test suite does routinely — sharing a `persistKey` would collide. `LmdbBackup.start` deliberately omits `name`. If you need observability, use the `persistKey` stamp, not a croner job name.

## Why file mtime is not a run-stamp

The cheapest possible fix is to read `LmdbBackup.list(dir).at(-1).mtimeMs` and treat the newest entry as "last run". Do not. A failed `format: 'dir'` snapshot used to leave a partial `backup-<stamp>/` directory behind — the destination is created *before* the copy runs, with no cleanup on the failure path. That debris is still returned by `list()` and still consumes one of the `keep` slots, so prune can end up holding 2 real backups plus an empty directory. Its mtime is *now*, so the schedule would record a run that never completed.

`backup()` now removes the partial directory when the copy throws (the `tar.gz` path already did). The stamp stays explicit anyway: a stamp is written only on success, which mtime can never express.

## Incorrect

```typescript
// wrong: the closure is the schedule. Every restart waits a fresh full
// interval, downtime is never made up, and a slow tick shifts the next one.
let lastRun = 0
const tick = () => { lastRun = Date.now(); void snapshot() }
if (runOnStart) tick()
setInterval(tick, intervalMs)
```

```typescript
// wrong: reading "last run" off the clock. "Every 24 h since the last backup"
// and "03:00 every day" are different schedules, and they diverge permanently
// after one manual run.
LmdbBackup.start(env, {dir, intervalMs: 86_400_000})
```

```typescript
// wrong: deriving "last run" from file mtime. A failed `dir` snapshot left a
// partial `backup-<stamp>/` behind, so this reports a run that never finished
// and burns a `keep` slot on an empty directory.
const newest = LmdbBackup.list(dir).at(-1)
const overdue = newest === undefined || Date.now() - newest.mtimeMs >= intervalMs
```

```typescript
// wrong: stamping before the work. A crash or a throw now counts as a
// completed run, and the next boot treats the job as satisfied.
await jobs.recordRun(`db-backup`)
await LmdbBackup.snapshot(env, {dir})
```

```typescript
// wrong: giving croner a name. The registry is process-global and throws, so
// two envs sharing a persistKey take the whole process down.
new Cron(pattern, {name: runKey}, tick)
```

## Correct

```typescript
// right: persist-first and wall-clock. Overdue catches up once at boot, and
// runs land on the same boundary no matter how slow a snapshot was.
const handle = LmdbBackup.start(db, {dir: `./backups`, pattern: `0 3 * * *`, keep: 7})
console.log(handle.label()) // '0 3 * * *, last run <ISO from the stamp>'
await handle.runNow() // manual run; resolves when it has completed
handle.stop()
```

```typescript
// right: the general form. Any job gets restart safety — this is what the four
// hand-rolled `isOverdue` copies in a real app should collapse into.
const jobs = new LmdbJobRun(db)
const handle = jobs.start(`weekly-report`, {
  pattern: `0 4 * * 1`, // 04:00 Mondays
  timezone: `Asia/Jakarta`,
  task: async () => { await runReport() }
})
await handle.runNow()
handle.stop()
```

```typescript
// right: `missed()` on its own, when you want the decision without a schedule.
if (jobs.missed(`weekly-report`, {pattern: `0 4 * * 1`})) await runReport()
```

```typescript
// right: two cadences on one env — distinct keys so neither stamp is lost.
LmdbBackup.start(db, {dir: `./nightly`, pattern: `0 3 * * *`, persistKey: `nightly`})
LmdbBackup.start(db, {dir: `./hourly`, pattern: `0 * * * *`, persistKey: `hourly`})
```

## Notes

- Structural: the stamp is written only after `snapshot()` resolves; a failed cycle leaves the job overdue and the next boot retries it.
- `LmdbJobRun.start` owns the whole schedule: croner, the missed-boundary check, the one-shot catch-up, and the overlap guard. `LmdbBackup.start` is a thin wrapper over it.
- `JobRunSchema` is a real schema (`db: '__job_run'`), so rows are typed and readable through `env.sub(JobRunSchema)` / `jobs.sub`. The `__` prefix puts it in the internal-state family, so CDC skips it — do not expect run-stamps in `tailCdc()` output.
- `new LmdbJobRun(env)` registers the schema idempotently; a second instance on the same env is safe and reuses the sub.
- The overlap guard is `LmdbBackup`'s own, not croner's `protect`, because `runNow()` enters through the same function and `cron.trigger()` is fire-and-forget. That is also what keeps `runNow()` awaitable.
- A backup contains the stamp from the **previous** run (it lands after the copy resolves), so restoring a backup rolls the schedule back and the app snapshots once soon after — the correct response to a rollback.
- `compact` reaches every path: `env.backup(destPath, compact?)`, `LmdbBackup.backup(env, dir, keep?, compact?)`, both `snapshot` branches (`dir` and `tar.gz`), and the `start()` tick.
- `env.backup()` requires the destination directory to already exist — `mdb_env_copy2` does not `mkdir` and fails `ENOENT`. `LmdbBackup.backup` does `mkdirSync` first, which is why the library path works and a direct `env.backup()` call needs the caller to create it.
- `downloadFromS3(s3, key, destDir, fileName)` takes folder and file name separately, creates a missing destination directory, and writes through a uniquely-named `.part` sibling (`Math.random()` token) so concurrent downloads into one directory cannot interleave into a shared partial file it renames on success, so a failed transfer cannot leave a truncated archive that `restoreArchive` would accept.
- Helpers are exported from the package root: `LmdbJobRun`, `JobRunSchema`, `LmdbBackup` (`backup`/`list`/`prune`/`restore`/`snapshot`/`start` + S3 companions), `LmdbSyncStream`, `Cdc`/`CdcHub`/`CdcStore`, `LmdbReader`.
- Run it: `example/job-run.ts` walks the missed-boundary check by hand, then shows the `LmdbBackup.start` one-liner.
