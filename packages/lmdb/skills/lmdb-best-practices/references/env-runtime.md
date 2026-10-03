# env-runtime

Pick encodings and flags per sub-DB; defaults favor speed over visibility.

## Why

`msgpack` handles Date/Map/Set/BigInt natively and decodes fastest; `json` is human-readable but slower on nested rows (`cbor` sits between, compact binary with the custom-encoder path). `noSync: true` trades crash-safety for write speed, the wrong default for user data. Reads served from the writer env give up isolation that LMDB offers for free: read-only replicas never take the writer lock, so fan-out belongs on `LmdbReader`, not on the primary.

## Constructor options

| Option | Default | Scope | Set when |
| --- | --- | --- | --- |
| `path` | required | env | always |
| `maxDbs` | `128` | env | counted from the slot table in `env-sizing.md` |
| `mapSize` | 4 GB | env | 10-50x expected data, see `env-sizing.md` |
| `encoding` | `msgpack` | forwarded | `json` only where operators inspect the bytes |
| `compression` | `false` | forwarded | large rows, LZ4 runs off-thread |
| `cache` | `false` | forwarded | hot, read-heavy subs |
| `useVersions` | `false` | forwarded | only for versioned writes (`put` with version / `ifVersion`) |
| `keyEncoding` | `ordered-binary` | forwarded | rarely, composite tables pin their own |
| `dupSort` | `false` | forwarded | one-key-to-many subs only |
| `strictAsyncOrder` | unset | forwarded | strict ordering of async transactions (`env.ts:258`) |
| `noSync` | `false` | env | benchmarks and disposable data, never user data |
| `commitDelay` | `0` | env | write bursts worth batching |
| `readOnly` | `false` | env | replicas via `LmdbReader`, never hand-set |

Forwarding is explicit, not inherited: the wrapper passes the forwarded options to every sub-DB at open time, so set them once at the env. Per-schema `static encoding` and `static useVersions` override for a single sub.

## Lifecycle and isolation

The env opens on construction, so there is no `open()` call and the first read or write is safe immediately after `new`. `close()` flushes pending writes, releases the mmap, detaches commit listeners, and purges the env from lmdb-js's `allDbs` registry (`env.ts:307`). After `close()` every data and transaction entry point throws `LmdbError`, except `resetReadTxn()`, an intentional no-op, and `isRegistered()`, which never throws. Each env is one writer. Read-only replicas attach with `LmdbReader.open(path, {maxDbs, pollMs})` (`reader.ts:21`): a read-only `LmdbEnv` with periodic `resetReadTxn` polling, so N readers never contend with the writer. The poll timer is unref'd and cleared on `close`.

## Incorrect

```typescript
// wrong: every sub pays JSON parse on every read, while operators inspect one sub at most
// wrong: env-level `encoding` is forwarded to all subs, so one audit need taxes the whole env
new LmdbEnv({path: `./data`, encoding: `json`})
```

```typescript
// wrong: one crash loses acknowledged writes, durability off for data users expect to survive
// wrong: `noSync: true` is a benchmark flag, not a production default
new LmdbEnv({path: `./data`, noSync: true})
```

```typescript
// wrong: after `close()` every data and transaction entry point throws `LmdbError`
// wrong: only `resetReadTxn()` (no-op) and `isRegistered()` (never throws) survive
await db.close()
await db.users.put(1, row)
```

## Correct

```typescript
// correct: binary default for speed, LZ4 off-thread for large rows
// correct: durability on, `noSync` stays `false` for user data
new LmdbEnv({path: `./data`, maxDbs: 128, compression: true})
```

```typescript
// correct: human-readable only where operators inspect it, via per-schema override
// correct: every other sub keeps the `msgpack` default
class AuditSchema extends LmdbSchema {
  static db = `audit`
  static key = t.string()
  static value = {at: t.date(), msg: t.string()}
  static encoding = `json`
}
```

```typescript
// correct: replicas never take the writer lock, read-only env with poll
// correct: unref'd poll timer is cleared on `close`, no leaked handle
const replica = await LmdbReader.open(`./data`, {maxDbs: 10, pollMs: 1000})
```

## Notes

- `cache` helps hot reads; `commitDelay` batches write bursts; `useVersions: true` only for versioned writes (root `put` with version / `ifVersion`).
- Sub-DBs inherit env-level `compression` / `cache` / `encoding` / `useVersions` / `keyEncoding` / `dupSort` / `strictAsyncOrder`, so set them once at the env.
- Locks: `test/env.test.ts` covers constructor defaults and lifecycle; `test/reader.test.ts` covers replica attach.
- Size first, then tune: `maxDbs` and `mapSize` budgeting lives in `env-sizing.md`.
