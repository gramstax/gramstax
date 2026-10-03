# sync

Copy tails with checkpoints, never full recopies; verify before trusting.

## Why

`source.syncTo(dest)` (via `LmdbSyncStream`) copies rows past the persisted cursor (`__sync_state`, per stream name) through a keyset cursor in 500-row chunks — each committed chunk advances the cursor, so kills resume mid-stream instead of restarting. Destination writes ride `{sorted: true}` appends (source order is natively ascending). Verify (counts + up-to-8 hash spot-checks, on by default) throws `LmdbError` on divergence.

The failure mode is trusting a copy you never proved: verify compares source and destination counts plus up to 8 evenly-strided row hashes (`hashRowValue`, `sync.ts`), and concurrent writes during the run move the target under the check — so an unverified or raced sync reports success while the two subs quietly disagree.

## The checkpoint lifecycle

| # | Event | Cursor in `__sync_state` (`sync:<name>`) |
| --- | --- | --- |
| 1 | first `syncTo(dest)` — no stored cursor | starts at the beginning, keyset-pages 500 rows at a time |
| 2 | chunk 1 commits to dest via `putMany` (`{sorted: true}`) | advances to chunk-1 last key — committed together with the rows |
| 3 | process dies mid-chunk-4 | stays at chunk-3 last key — chunk-4 rows rolled back with it |
| 4 | next `syncTo(dest)` with the same `name` | resumes PAST the stored key (exclusive — the boundary row is skipped via key comparison) |
| 5 | source exhausted | verify runs (iff the run reached exhaustion), result `{copied, checkpoint, verified}` |

Options on `ISyncOptions`: `name` (stream identity — defaults to the destination sub name), `checkpoint` (explicit start key: one-shot past that key, never touches stored state), `limit` (bounded run — caps rows, reports `verified: false` since exhaustion never happens), `verify` (default on — `false` skips the check). `sync.ts` re-exports `ISyncOptions`/`ISyncResult`, and the statics `hashRowValue`/`checkpoint`/`verify` ride on `LmdbSyncStream`.

## Upsert-only and the verify tradeoff

| Concern | Behavior | What to do |
| --- | --- | --- |
| Destination-only rows | never deleted — sync upserts, dest extras survive | `clear()` dest + fresh `name` to re-baseline |
| Indexes/search/CDC/TTL on dest | ride along via `putMany` like any write path | nothing — but size dest `maxDbs` for the same derived tables |
| `verify` vs live writes | counts + hash spot-checks race concurrent writers and throw `LmdbError` on divergence | quiesce writes on both subs first; treat a verify throw as retry-after-quiesce |
| `limit` runs | truncated, `verified: false` by construction | follow with an unbounded run to get a verified result |
| Self-sync (`source === dest`) | throws `LmdbError` | sync across subs/envs only |
| `__sync_state` slot | 1 `maxDbs` slot, opened lazily on first use | size for it or touch `syncTo` at boot |

## Incorrect

```typescript
// full re-copy every run — O(n) each time, no resume, no proof
await dest.putMany(await source.entries())
```

```typescript
// wrong: verifying a moving target — a concurrent writer lands between
// the copy and the spot-check, so `verify` throws `LmdbError` on a copy
// that was correct when written; quiesce first instead
await live.put(k, v) // racing writer during the run below
await source.syncTo(dest) // verify on — divergence throw, not a data bug
```

```typescript
// wrong: expecting deletes to propagate — dest-only rows survive every
// run, so a filtered source leaves stale rows behind silently
await source.syncTo(dest) // dest keeps rows the source no longer has
```

## Correct

```typescript
// named stream — kills resume mid-stream, result proves the copy
const r = await source.syncTo(dest) // {copied, checkpoint, verified}
const nightly = await source.syncTo(dest, {name: `nightly`, limit: 10000}) // bounded run
await source.syncTo(dest, {checkpoint: lastSeen}) // one-shot override — stored cursor untouched
```

```typescript
// quiesced + re-baselined — the only shape that earns trust
await quiesce(source, dest) // stop writers on both subs first
await dest.clear() // drop dest extras — sync never deletes
await source.syncTo(dest, {name: `rebaseline`}) // verified: true means counts + 8 hashes agree
```

## Notes

- Structural: cursor persists per committed chunk; explicit `checkpoint` never touches stored state.
- Stream `name` defaults to the destination sub name — two dests sharing one source need distinct names or they share a single cursor (`sync.ts`).
- Sync upserts only — destination extras are never deleted (clear dest + fresh name to re-baseline).
- Quiesce writes first; `verify: false` skips the check (reported `verified: false` when `limit` truncates).
- Spot-checks are up to 8 evenly-strided rows (`VERIFY_SAMPLES`, `sync.ts`) — stride spread catches tail divergence that head-only sampling would miss on delta syncs.
- A `limit <= 0` run short-circuits to `{copied: 0, checkpoint: undefined, verified: false}` without touching either sub (`sync.ts`).
- `LmdbSyncStream` instances are single-use — construct one per run; the six pieces of run state (source, dest, options, cursor, counters, exhaustion) thread across paged iterations (`sync.ts`).
- Helpers are exported from the package root: `LmdbSyncStream` + statics `hashRowValue`, `checkpoint`, `verify`; `RecordCodec`, `LmdbSearch`, `Cdc`/`CdcHub`/`CdcStore`, `LmdbBackup`, `LmdbReader`.
