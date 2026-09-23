# env-runtime

Pick encodings and flags per sub-DB; defaults favor speed over visibility.

## Why

`msgpack` handles Date/Map/Set/BigInt natively and decodes fastest; `json` is human-readable but slower on nested rows (`cbor` sits between — compact binary, needs the custom-encoder path). `noSync: true` trades crash-safety for write speed — wrong default for user data.

## Incorrect

```typescript
new LmdbEnv({path, encoding: `json`}) // every sub pays JSON parse on every read
new LmdbEnv({path, noSync: true}) // one crash loses acknowledged writes
```

## Correct

```typescript
new LmdbEnv({path, maxDbs: 128, compression: true}) // LZ4 off-thread for large rows
// human-readable only where operators inspect it:
class AuditSchema extends LmdbSchema { static encoding = `json`; /* ... */ }
// replicas never take the writer lock:
const replica = await LmdbReader.open(path, {maxDbs: 10, pollMs: 1000}) // read-only LmdbEnv, unref'd poll timer cleared on close
```

## Notes

- `cache` helps hot reads; `commitDelay` batches write bursts; `useVersions: true` only for versioned writes (root `put` with version/`ifVersion`).
- Sub-DBs inherit env-level `compression`/`cache`/`encoding`/`useVersions`/`keyEncoding`/`dupSort`/`strictAsyncOrder` — set once at the env.
