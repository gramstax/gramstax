# sync

Copy tails with checkpoints, never full recopies; verify before trusting.

## Why

`source.syncTo(dest)` (via `LmdbSyncStream`) copies rows past the persisted cursor (`__sync_state`, per stream name) through a keyset cursor in 500-row chunks — each committed chunk advances the cursor, so kills resume mid-stream instead of restarting. Destination writes ride `{sorted: true}` appends (source order is natively ascending). Verify (counts + up-to-8 hash spot-checks, on by default) throws `LmdbError` on divergence.

## Incorrect

```typescript
// full re-copy every run — O(n) each time, no resume, no proof
await dest.putMany(await source.entries())
```

## Correct

```typescript
await source.syncTo(dest) // {copied, checkpoint, verified}
await source.syncTo(dest, {name: `nightly`, limit: 10000}) // bounded run
await source.syncTo(dest, {checkpoint: lastSeen}) // one-shot override
```

## Notes

- Structural: cursor persists per committed chunk; explicit `checkpoint` never touches stored state.
- Sync upserts only — destination extras are never deleted (clear dest + fresh name to re-baseline).
- Quiesce writes first; `verify: false` skips the check (reported `verified: false` when `limit` truncates).
