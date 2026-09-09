# rpc-payloads.md

Verdict: send only what the transport preserves — JSON-safe over parentPort
and JSON gateways, rich types only with `messagepack: true` on both ends.

## Why

parentPort uses structured clone; the gateway defaults to JSON (drops
`undefined`, `BigInt`, `Date` fidelity, typed arrays) unless both sides set
`messagepack: true` — and a missing `msgpackr` now throws instead of silently
downgrading. Outbound `undefined` results coerce to `null`; inbound `result`
discrimination is key-presence based so msgpack `undefined` still resolves.
Id-less inbound messages dispatch but get NO reply (that junk reply was pure
waste). Remote errors arrive verbatim — read `.message`, never `instanceof`.

## Incorrect

```typescript
await gateway.mtdSave({at: new Date(), big: 1n}) // JSON gateway: Date → string, BigInt throws
await worker.request(`mtdPing`, []) // fire-and-forget expecting a reply that never comes
```

## Correct

```typescript
await client.connect(path, {messagepack: true}) // both ends, or stay JSON-safe
await worker.request(`mtdSave`, [{at: `2026-09-10T00:00:00Z`, big: `1`}]) // JSON-safe shape
```

## Notes

- `messagepack: true` without `msgpackr` installed throws a clear error.
- Oversized gateway messages reject with a controlled error (post-buffering
  cap — see `gateway-reliability`).
- Non-number response ids are reported and ignored, never silently hung on.
