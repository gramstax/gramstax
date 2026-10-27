# cdc

Subscribe to commits, tail history explicitly — never poll tables.

## Why

Every put/delete appends `{db, type, key, value}` to `__cdc_log` in the same writer transaction (aborts publish nothing, sequences stay gapless). `env.subscribe` delivers post-commit in sequence order; `tailCdc`/`ackCdc` give persistent followers resume across restarts; `pruneCdc` bounds retention by min-ack plus keep-count.

The failure mode is the arming window: capture arms on the FIRST CDC touch (`subscribe`, `tailCdc`, `ackCdc`, or `pruneCdc`), and every write before that moment is invisible to CDC forever. An env that seeds 100k rows and only then subscribes has a complete-looking log that starts at the seed's aftermath — the follower replays from a hole it cannot detect.

## The arming timeline

| Moment | What happens | CDC sees |
| --- | --- | --- |
| Boot, no CDC call yet | `__cdc_log` + `__cdc_meta` do not exist; writes commit normally | nothing — capture is disarmed |
| First CDC touch (any of the four entry points) | the two internal sub-DBs open lazily; high-water mark recorded | arming point — earlier writes stay invisible |
| Writes after arming | each put/delete appends `{db, type, key, value}` in the same writer txn | every commit, post-commit, in sequence order |
| Aborted transaction | counter bump and record roll back together | nothing — phantom events are impossible by construction |
| Unsubscribe (last subscriber leaves) | `aftercommit` listener detaches (`hub.ts`) | tail/ack history remains — only live delivery stops |

Practical rule: touch a CDC API at boot (a `subscribe` you keep, or a throwaway `tailCdc`) before the first production write, and size `maxDbs` for the 2 slots `__cdc_log` + `__cdc_meta` consume.

## Subscribe vs tail

| | `env.subscribe(filter, cb)` | `env.tailCdc({consumer?, from?, limit?})` + `ackCdc` |
| --- | --- | --- |
| Delivery | push, post-commit via `aftercommit` | pull — you call it |
| History | from-now only — backlog never delivered | full backlog from any `seq` |
| Survives restart | no — in-process only | yes — acks persist in `__cdc_meta` per consumer |
| Filter | `db` string or `{db, op?}` (`put`/`delete`/`clear`) | consumer-scoped cursor, `from`/`limit` paging |
| Unsubscribe / errors | returns idempotent unsubscribe; a throwing subscriber is logged and skipped, never breaks the commit | `ackCdc` on an unknown consumer throws `LmdbError` — `tail` first to register it |
| Use for | live mirrors, caches, websocket fans | durable followers, exactly-once pipelines, crash resume |

Retention: `env.pruneCdc(keep?)` drops entries at/below `min(minAck, newest - keep)` — entries every registered consumer has acked go, the newest `keep` always stay (default `10000`, `env.ts:554`), and an unacked consumer pins everything above its ack. Returns the number pruned. Call it periodically like a log compactor.

## Incorrect

```typescript
// polling a table for changes — misses deletes, races writers, burns reads
for (;;) { const rows = await users.values(); diff(rows, prev) }
```

```typescript
// wrong: seeding before the first CDC touch — all 100k seed writes are
// invisible, and the follower starts from a hole it cannot detect
await seed(users)
const unsub = env.subscribe(`users`, (e) => mirror.apply(e))
```

```typescript
// wrong: reaching past the classes — `Cdc`/`CdcHub`/`CdcStore` are per-env
// state owned by the env; the env methods arm capture and wire the hooks
const hub = new CdcHub(env, store)
hub.subscribe(`users`, cb)
```

## Correct

```typescript
// arm at boot, before the first production write
const unsub = env.subscribe(`users`, (e) => mirror.apply(e)) // {type, key, value}
const unsub2 = env.subscribe({db: `users`, op: `put`}, (e) => mirror.apply(e)) // kind-filtered
```

```typescript
// durable follower: tail pages, ack advances, prune compacts
const batch = await env.tailCdc({consumer: `mirror`}) // {seq, db, type, key, value}
const page = await env.tailCdc({consumer: `mirror`, from: 1000, limit: 500}) // reposition forward + cap
await env.ackCdc(`mirror`, batch[batch.length - 1]!.seq) // unknown consumer throws LmdbError — tail first
await env.pruneCdc() // cutoff min(minAck, newest - keep), default keep 10000; drops entries consumed by every consumer
```

## Notes

- Structural, by construction: same-txn appends make phantom events impossible.
- Capture arms on first subscribe/tail/ack/prune — touch a CDC API at boot; `__`-prefixed internal subs are excluded.
- `subscribe` positions the cursor at the outbox high-water mark (`hub.ts`) — backlog before the call is never delivered, even seconds-old writes.
- Filter validation throws `LmdbError` on an empty db name or an `op` outside `put`/`delete`/`clear` (`hub.ts`); arming itself (`activate`) and outbox opening (`ensure`) are both idempotent (`store.ts`).
- Deletes carry the key (`value` undefined, except dupSort exact removes); `clear()` emits one `clear` event.
- A throwing subscriber is logged and skipped — it never breaks the writer's commit.
- Runnable grounding: `packages/lmdb/example/search-cdc-demo.ts` shows subscribe-then-put ordering, delete events, and unsubscribe detaching on one handle.
