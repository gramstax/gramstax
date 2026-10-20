---
title: "ILmdbEncoding"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [ILmdbEncoding](./lmdb.ilmdbencoding.md)

## ILmdbEncoding type

LMDB value encoding — passed to LMDB's native encoder when opening a sub-database.

**Signature:**

```typescript
type ILmdbEncoding = `msgpack` | `json` | `cbor` | `string` | `binary` | `ordered-binary`;
```

## Remarks

LMDB handles encoding natively per sub-database. The collection's optional `codec` (if defined) runs BEFORE LMDB encoding — use it only for custom transforms (e.g. `Date → number`).

- `msgpack` (default) — fastest, supports `Date`/`Map`/`Set`/BigInt via msgpackr structured-clone - `json` — human-readable, no extra Codec needed; LMDB does `JSON.stringify`/`JSON.parse` natively (no double encoding) - `string` — values must already be strings; LMDB stores as UTF-8 - `binary` — values must already be `Buffer`; LMDB stores raw bytes - `ordered-binary` — values encoded with the same encoding as keys (useful for `dupSort` indexes)

