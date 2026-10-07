# Changelog

## 3.1.0

Restart-safe backup scheduling on `croner`, with a persisted run-stamp so the schedule survives a restart.

**Breaking changes in this minor release.** Shipped as `3.1.0` by maintainer decision, but three items need action on upgrade:

1. **`intervalMs` is gone, replaced by `pattern`.** A cron expression is a wall-clock schedule, not a duration — `86_400_000` meant "24 h after the last run", `0 3 * * *` means "03:00 sharp". They diverge permanently after one manual run or one missed boundary.
2. **`start()` writes to the env it is backing up.** It constructs a `LmdbJobRun`, which registers the `__job_run` schema — one `maxDbs` slot — and reads it up front, so calling it on a closed env now throws instead of failing quietly on every tick. `persist: false` skips the stamp reads and writes and the catch-up decision, but the slot is still taken and a closed env still throws; to avoid the schema entirely, do not construct `LmdbJobRun` and drive `croner` directly.
3. **`croner` is a new runtime dependency.** It is MIT with zero dependencies and is used only by `LmdbBackup.start()`.

**Version note.** The release is driven by this package. `nx release` moves all four workspace packages as one fixed release group, so `gramstax`, `worker-thread` and `create-gramstax` also reach `3.1.0` without a change of their own — reading `3.1.0` on those as a delta would overstate it.

### Added

- **`env.transactionFast(fn)`** — commits through lmdb-js `db.transaction()`, so the commit runs on the writer thread instead of blocking the main thread and batches with other writes queued in the same event turn. Same commit-visibility atomicity as `transaction()`.

  **It cannot roll back, and that is not an oversight.** lmdb-js's `db.transaction()` records a callback error and rethrows it but never calls `mdb_txn_abort`, so the native transaction commits either way — returning `ABORT` is ignored, as is a throw. Both failure modes are therefore made loud instead of silent: `tx.abort()` throws `LmdbError` naming `transaction()` as the alternative, and a throwing callback surfaces an error stating that its writes were committed. Use `transaction()` whenever the outcome depends on the callback failing partway.

  Adopted internally for `deleteByPrefix`, `putMany` and CDC `pruneCdc`. It is deliberately **not** used by unique-index conflict handling (a committed row without its index entry would leave the index inconsistent), `migrate` (`up()` runs inside the transaction), `purgeExpired` (it counts `removeSync` return values) or `increment` (which throws before any write, so a commit-on-throw message would be false).
- **`croner`** as a runtime dependency, replacing the hand-rolled `setInterval` timer. Runs now land on a fixed wall-clock boundary instead of drifting by each snapshot's own duration, and croner's own scheduling handles arbitrarily long cadences.
- **`LmdbJobRun` + `JobRunSchema`** — cron scheduling that survives restarts. `LmdbJobRun` owns a whole job, the way `LmdbQueue` owns a queue: `new LmdbJobRun(env)` registers `JobRunSchema` idempotently (a real schema — `db: '__job_run'`, `key: t.string()`, `value: {at: t.number()}` — so rows are typed and readable through `env.sub(JobRunSchema)`, no raw sub-DB handle and no cast; the `__` prefix marks it engine bookkeeping, which also keeps it out of the CDC outbox), then `.start(key, {pattern, task, timezone?, runOnStart?, catchUp?, onError?, persist?})` returns `{stop, runNow, lastRun, nextRun, label}` and handles every scheduling decision — the croner job, the missed-boundary check, the one-shot boot catch-up, and the overlap guard. `.missed(key, {pattern, timezone?, now?})` exposes that check on its own; `.lastRun(key)` is synchronous (matching `sub.get()`), `.recordRun(key, at?)` is async, plus `.clear(key)` and `.sub`. Both are exported from the package root.

  Because the schedule lives here rather than in `LmdbBackup`, any job can opt in — not just backups. That is the point: the common pattern of hand-rolling an `isOverdue()` helper per job collapses into one call.
- **`IBackupStartOptions.pattern`** (required) and **`timezone`** to pin the pattern's zone. Patterns are otherwise read in the host's local timezone.
- **`IBackupStartOptions.persist`** (default `true`) and **`persistKey`** (default `'backup'`) for schedules sharing one env.
- **`IBackupHandle.runNow()`** — take a snapshot immediately without disturbing the schedule. Resolves when a snapshot has actually completed; a call arriving during an in-flight cycle joins that cycle rather than silently skipping. Works even after `stop()`.
- **`compact` on every backup path** — `env.backup(destPath, compact?)`, `LmdbBackup.backup(env, dir, keep?, compact?)`, `IBackupSnapshotOptions.compact?` and `IBackupStartOptions.compact?`, all defaulting to `false`.

  lmdb-js's `backup(path, compact)` requires the boolean and `mdb_env_copy2` treats it as a compaction pass, so it is surfaced rather than hardcoded: `false` is a fast plain copy that keeps the free-page layout it had at snapshot time, `true` rewrites the copy densely — slower, smaller on disk, and cheaper to restore from. Worth `true` for archives you retain or ship off-host; leave it off for local snapshots you will replace soon. It reaches every path, including both `snapshot` branches (`dir` and `tar.gz`) and the scheduled `start()` tick.

  `downloadFromS3` also creates a missing destination directory now (matching `LmdbBackup.backup`, which already did) and writes through a `.part` sibling it renames on success, so a failed transfer cannot leave a truncated archive that `restoreArchive` would later accept.

  One low-level caveat: `env.backup()` still requires the destination directory to exist — `mdb_env_copy2` does not `mkdir`. `LmdbBackup.backup` handles it; a direct call must create it.

### Changed

- `LmdbBackup.start()` takes a cron `pattern` instead of `intervalMs` and is now a thin wrapper: it supplies the snapshot task and delegates every scheduling decision to `LmdbJobRun.start`.
- `start()` detects a boundary missed while the process was down via croner's `previousRuns(1)`, compared against the persisted stamp, then triggers **exactly one** catch-up snapshot at boot — not one per missed boundary. Three days down against a daily pattern means one snapshot, not three near-identical archives consuming `keep`.
- A fresh env snapshots once at boot rather than waiting out the first boundary.
- `handle.label()` returns the pattern plus the last-run stamp (`0 3 * * *, last run <ISO>`), seeded from the persisted stamp so it is populated on a restart before anything has run.
- `handle.stop()` is now permanent — croner cannot resume a stopped job.

- **The package no longer writes to `console`.** Every internal warning and recoverable failure now routes through `env.emitWarn(message)`. An env with no listener attached reports nothing, so attach a sink to see diagnostics — `{onWarn}` at construction, or `env.onWarn(fn)` / `env.offWarn(fn)` later. Three sources feed it: the one-time `maxDbs` headroom warning (below 32 remaining slots, production-scale configs only), a CDC subscriber whose callback threw (reported, then delivery continues), and a failed scheduled tick with no explicit `onError`. A listener that throws is contained per-occurrence — the remaining listeners still run and the error never escapes into a writer transaction or a cron tick, so a broken logger cannot roll back a commit. `close()` clears the listener set.

  This is a behaviour change worth noticing: the `maxDbs` warning was previously always visible. It is now silent unless you attach `onWarn`, so add one if you rely on that signal.

### Fixed

- A failed `format: 'dir'` snapshot removes its partial `backup-<stamp>` directory. The debris was still returned by `list()` and consumed one of the `keep` slots, so `prune` could hold 2 real backups plus an empty directory. The `tar.gz` path already cleaned up on failure.
- Cadences beyond ~24.85 days no longer risk collapsing into a continuous loop. The previous timer clamped an out-of-range delay to 1 ms; the 24 h default sat just under the line, which is why it went unnoticed. Croner's scheduler has no such ceiling.

### Upgrade notes

Migrating `intervalMs` to a cron pattern — these are **not** equivalent, so choose deliberately:

| Before | After | Meaning |
| --- | --- | --- |
| `intervalMs: 86_400_000` | `pattern: \`0 3 * * *\`` | 03:00 daily, sharp |
| `intervalMs: 21_600_000` | `pattern: \`0 */6 * * *\`` | every six hours |
| `intervalMs: 604_800_000` | `pattern: \`0 3 * * 1\`` | 03:00 Mondays |

If you genuinely wanted "N ms after the previous run", that is no longer the model — pick the wall-clock boundary you actually meant, or keep a `setTimeout` chain of your own. See `example/job-run.ts`.

Also worth knowing: a backup contains the stamp from the *previous* run (it is written after the copy resolves), so restoring one rolls the schedule back and the app snapshots once soon after a restore. And `__job_run` carries the internal-state prefix, so like `__sync_state` it stays out of the CDC outbox — a backup run does not show up in your change stream.

## 3.0.0

Documentation and test-stability release for `@gramstax/lmdb`. No API change, no schema change, no behavioural change.

**Version note.** `nx release --dry-run` resolves `2.2.0 → 3.0.0` for all four packages as one fixed release group, driven by the breaking reshape in `@gramstax/worker-thread` (`cb59cfdc`). `@gramstax/lmdb` has no breaking change of its own in this release and moves in lockstep with the group — reading the `3.0.0` on this package as "lmdb 3.0.0" would overstate the delta.

### Fixed

- Flaky test for the S3 backup download-to-file path (`59f78988`). The assertion raced the async write, so it failed intermittently rather than deterministically; it now waits for the file to settle before asserting.

### Corrected

- Skill rule text for two things that had drifted from the source (`588f4417`): the documented source layout still listed the pre-`search.ts` / `queue.ts` / `sync.ts` / `cdc/` shape, and several rules described cross-sub access as going through a "repo" receiver after the handle refactor renamed it to `sub`. Both are the kind of error that makes an agent write an import that resolves against nothing.

### Also in this release

- JSDoc on every `lmdb` function (`f429c6fe`), matching the same sweep across `gramstax` and `worker-thread`.
- Skill realigned with the v2.2.0 source (`b7acbd8d`).

## 2.2.0

Realigns the skill with **@gramstax/lmdb v2.2.0** — the "query-scale epic"
release. All four `lmdb` entries in the `## 2.2.0 (2026-10-02)` release notes
land **inside** the published `v2.2.0` tag, and `packages/lmdb/src` at `HEAD` is
identical to that tag, so nothing in this entry describes unreleased work. That
is the opposite of the `worker-thread` skill's realignment, where the breaking
reshape sits after the tag.

The heading now follows the **package** version. It was `1.2.0`, which described
this same shipped release under the skill's own numbering.

### Why / Incorrect / Correct deepened to gramstax depth

All 25 rule files rewritten to match the depth the `gramstax` skill adopted in
`f2bce1f8` (compare `route-hooks.md`: 31 → 109 lines there). Rule content grew
from **844 to 2279 lines**; the whole skill is now 2562 lines, level with the
`gramstax` skill's 2768.

What changed structurally in every file:

- **The verdict now carries the load-bearing correction**, not a feature
  description — matching how `gramstax` leads with "there are **two**
  `hookBeforeRoute` hooks, not one".
- **`Why` states the failure mode and cost model**, not the feature.
- **One or two new analytical sections** — decision tables, comparison tables,
  coverage matrices, sequence tables. This is the largest addition.
- **`Incorrect` carries 2-3 separate blocks**, each isolating ONE mistake, each
  with an inline `// wrong: <specific consequence>` comment. Previously one
  block with a single vague comment.
- **`Correct` carries one block per valid variant**, each commented.
- **Line citations** (`sub.ts:35`, `env.ts:231`, `queue.ts:130`,
  `transaction.ts:222`, `biome.json:115`, `bench/_setup.ts:18`) appear only
  where the number was read from source. All 37 in the skill were re-verified.

Representative outcome — `query-pagination.md` (31 → 83) now carries a per-page
cost-by-depth table and documents the composite-key last-key trap, including
that `start` is inclusive and `exclusiveStart` exists. `index-write-cost.md`
(28 → 75) now carries a write-amplification matrix across all four index kinds.

Facts newly verified while rewriting (all confirmed against source):
`exclusiveStart` (`src/types/range.ts:52`), `limit <= 0` short-circuiting to an
empty result (`src/sub.ts:1868`, `:2221`), 12 column builders,
`BENCH_CONC` defaulting to `[10, 50, 100]` (`bench/concurrent.bench.ts:22-25`),
and the `bench/_setup.ts` helper line numbers.

### Terminology normalized: `repo` → `sub` as a receiver name

The package's own source never uses the word "repo" — `packages/lmdb/src/`
contains zero occurrences of `repo`/`repository`/`repositories`, because the
code is built around `LmdbEnvSub`, `static db`, and "sub-DB". The docs,
however, used `repo` as the **variable name on the handle**, which implies an
object type the package does not have.

Code receivers were normalized; the domain noun was kept.

| Was | Now | Where |
| --- | --- | --- |
| `repo.get(key, tx?)` … 51 call sites across 42 distinct methods | `sub.get(key, tx?)` | `README.md` dispatch table + prose examples |
| `userRepo.put(…)`, `sessionRepo.put(…)` | `users.put(…)`, `sessions.put(…)` | `README.md` transaction examples |
| `repo.count()` | `sub.count()` | `AGENTS.md` |
| "Cross-repo access" / "Cross-repo atomicity" | "Cross-sub access" / "Cross-sub atomicity" | `AGENTS.md`, `txn-transactions.md` |
| "natural key per repo" | "natural key per sub" | `AGENTS.md` |
| "sub-DBs per repo" | "one sub-DB per entity type" | `AGENTS.md` |
| "the manual index-repo + `NonUniqueIndex` wiring" | "the manual index-sub-DB + `NonUniqueIndex` wiring" | `AGENTS.md` |
| "holding the typed repo" | "holding the typed sub handle" | `AGENTS.md` |
| `repo.entries(…)` ×6, `repo.values()` | `sub.entries(…)`, `sub.values()` | `query-pagination.md`, `maintain-style-tests.md` |
| "an oversized repo … the same repo" | "an oversized sub … the same sub" | `query-range-scans.md` |

Deliberately **kept**: "repository"/"repositories" where the word names the
concept rather than the object — "Each repository here owns a dedicated
sub-DB", "at the repository boundary", "TTL repository", "Version 1.x declared
repositories as `LmdbRepository` subclasses" — and "repo root"/"this repo" for
the repository directory. `_createRepo` and `LmdbRepository` are retained as
deleted-API names.

### Query-scale epic

- 4 new rules (`search.md`, `cdc.md`, `migrate.md`, `sync.md`) plus a
  `cross-cutting` section in `_sections.md`.
- `index-declaration.md` / `query-index-reads.md`: composite `.index([a, b])`
  tuples, prefix/range seeks, one-composite-per-query.
- `index-maintenance.md`: composite + search-table maintenance parity.
- `query-bulk-writes.md`: `{sorted: true}` MDB_APPEND path (~7x at 100k),
  `importJSONL` progress, inversion errors.
- `schema-design.md`: record-codec note plus pointers to search/composite/
  version rules; `schema-hooks-ttl.md`: codec bypass note.
- `txn-transactions.md`: CDC publish-on-commit pointer.

### Cross-checked against the v2.2.0 release changelog

| Release entry | Outcome |
| --- | --- |
| `lmdb: query-scale epic, class-only src, per-module types, docs accuracy pass (40226b01)` | Confirmed — every source module it names is in the published tag |
| `update agents and add deps for lmdb (cf42d88a)` | Confirmed in tag |
| `lmdb: update implementation (066d7b08)` | Confirmed in tag |
| `lmdb: filter the deleteByPrefix CDC test by op instead of clearing seen (330f3b88)` | Confirmed in tag |

### Corrected

- `SKILL.md` — the rule-file anatomy claimed rules end with
  **"Gramstax-specific notes"**, a copy-paste left over from the `gramstax`
  skill. These are lmdb rules; now reads "Package-specific notes (deviations
  from raw lmdb-js)".
- `SKILL.md` — the priority table listed **7 categories and omitted
  `cross-cutting` entirely**, even though `_sections.md` rates it HIGH and it
  holds 4 of the 25 rules (`search`, `cdc`, `migrate`, `sync`). An agent reading
  only the router would never discover full-text search, CDC, migrations, or
  sync. Added as priority 5; the table is now 8 rows.
- `SKILL.md` — added version targeting (in `description`, `compatibility`, and
  a body callout) and a **Start Here** table routing by symptom, matching the
  `gramstax` and `worker-thread` skills.
- `references/index-maintenance.md:30` — "follow the same same-txn rule" read as
  a duplicated word; now "follow the same rule — written in the same transaction
  as the primary row".
- `references/maintain-style-tests.md` — dropped a "wrap thread/socket awaits in
  `withTimeout`" bullet inherited from the `worker-thread` skill. **lmdb has no
  `withTimeout` helper and no thread or socket surface at all**
  (`grep -rln "worker_threads\|node:net" src/` returns nothing), so the advice
  was inapplicable. Replaced with the actual hazard: every test must close its
  env and remove its tmp dir, because a leaked mmap handle locks the file and
  fails the *next* test rather than the current one.

### Fixed — `packages/lmdb/AGENTS.md`

The skill names `AGENTS.md` as its API source of truth, so drift there silently
corrupts the skill. All four defects are fixed.

| Location | Defect | Fix |
| --- | --- | --- |
| Source Layout | Listed `types.ts` as a single file holding `LmdbSubState`/`IndexDescriptor`/`MAX_MATERIALIZE` | It is a `types/` **directory** of 16 modules; tree rewritten, with a note that the barrel re-exports only `codec`, part of `env`, `indexes`, `key`, `range`, `search`, `sub-state` |
| Source Layout | Omitted `queue.ts` entirely | Added — `LmdbQueue` + `IQueueSchema`, FIFO over a dedicated sub-DB |
| Source Layout | Described `search.ts` as "Search statics" and `sync.ts` as "SyncStream" | Corrected to the exported class names `LmdbSearch` and `LmdbSyncStream` |
| Core Pattern | Said "`QueueSchema` is a constraint, not a base class" | The exported type is `IQueueSchema` |

Also corrected: `MAX_MATERIALIZE` is exported from `sub.ts`, not from `types/`.

Two sections added for parity with `packages/gramstax/AGENTS.md`:

- **Where to Look** — a 12-row task→file table. Absent before, which left an
  agent with 15 runtime modules plus a 16-module `types/` tree and no map.
- **Agent skills** — points at this skill, matching the gramstax and
  worker-thread packages.

### Verified sound

Checked rather than changed: `register`/`sub`/`isRegistered` handle caching,
every CDC method (`subscribe`/`tailCdc`/`ackCdc`/`pruneCdc`), `migrate` +
`getMigrationVersion`, `syncTo`, `importJSONL`, `reindex`, the full
materialization guardrail set, `rootTransactionSync`, `getMapSizeUsed`,
`addValue`/`getValues`/`getValuesCount`/`removeValue`, `putSync`/`removeSync`,
`getEntry`/`getKeys`, and `purgeExpired` — all present in `src`.

Constants were checked against their definitions rather than trusted:

| Claim | Definition site |
| --- | --- |
| `MAX_MATERIALIZE = 100_000` | `src/sub.ts:35` |
| `mapSize` default `4 * 1024 * 1024 * 1024` | `src/env.ts:231` |
| `maxDbs` default `128` | `src/env.ts:232` |
| `pruneCdc` default keep `10000` | `src/env.ts:554` |

Also confirmed: index sub-DBs are named `{db}:idx:{name}`, search tables
`{db}:search:{col}`, dupSort index sub-DBs opt out of versions, sync and
migration transforms batch in 500-row chunks, the `maxDbs` warning fires below 32
free slots, registration refuses below 10% free `mapSize`, and `like()` rejects
past 10 wildcards.

The skill also references `LmdbCodec` and `LmdbRepository`, which do **not** exist
in source. Both are correct: they appear only as deleted-API callouts or inside
`## Incorrect` examples. `LmdbSearch` and `LmdbSyncStream` are the real exported
class names, and the skill does not reference the non-existent bare `QueueSchema`.

## 1.1.0

- Breaking rename `.nullable()` → `.optional()` across all rules; columns are
  required by default and optional fields are truly omit-able.
- New rules: `schema-enum.md` (`t.enum` homogen sets + `LmdbError`
  write-time validation) and `schema-defaults.md` (`.default()` /
  `.$defaultFn()` write-time fill, last-wins, declaration-time checks).

## 1.0.0

- Initial release: router `SKILL.md` + 17 rule files across 7 categories
  (`query-`, `index-`, `env-`, `schema-`, `txn-`, `bench-`, `maintain-`),
  plus `_sections.md` index and `_template.md` for new rules.
- Rules distilled from measured optimization work: O(1) stat count,
  bounded guardrail counting, `findByIndex` batch + `{limit}`, keyset
  pagination evidence, putMany TTL semantics, purge chunking.
