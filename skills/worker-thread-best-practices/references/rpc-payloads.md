# rpc-payloads.md

Verdict: send only what the transport preserves — JSON-safe over parentPort
and JSON gateways, rich types only with `messagepack: true` on both ends.

## Why

The gateway defaults to JSON, so `Date`, `BigInt`, `Map`, `Set`, `undefined`,
and typed arrays do NOT survive the wire — and the failure is silent
corruption (a `Date` arrives as a string, an `undefined` RESULT arrives as a
missing field) or a throw, not a clean error at the call site. The envelope
itself is defended by spread ordering, but nothing defends the params you put
inside it: the cost of a wrong type choice is paid per request, far from where
it was chosen.

## Serializability per transport

| Value | JSON gateway | `messagepack: true` gateways |
| --- | --- | --- |
| `string`, `number`, `boolean`, `null`, plain objects, arrays | preserved | preserved |
| `Date` | arrives as an ISO string, fidelity lost | preserved |
| `BigInt` | throws (`JSON.stringify` cannot serialize it) | preserved |
| `Map`, `Set` | arrive as `{}` — entries lost | contents preserved |
| `undefined` (in params) | key dropped | preserved |
| `undefined` (as RESULT) | key dropped — the peer sees a missing field, so `make` coerces it to `null` (`src/rpc.ts:299-302`) rather than hanging the caller | `result` key present — discrimination is key-presence based (`src/rpc.ts:334-335`), so it still resolves |
| Typed arrays, `ArrayBuffer` views | lost or mangled | preserved |

parentPort uses structured clone, so it preserves more than a JSON gateway —
but anything that also crosses a gateway must still be JSON-safe unless both
gateway ends set `messagepack: true`. A missing `msgpackr` now throws instead
of silently downgrading, and `messagepack: true` without it installed throws a
clear error (`src/gateway-client.ts:152-153`).

## Envelope field precedence

The envelope is JSON-RPC shaped with `id`, `method`, `params`, `result`,
`error`. Reserved fields are spread LAST at `src/rpc.ts:417-419`:

```typescript
const pld = {...this.context, ...others, id, method, params} // correct: `id`/`method`/`params` always win
```

| Layer | Supplies | Precedence |
| --- | --- | --- |
| `this.rpc.context` | shared object merged into EVERY outgoing request (e.g. `traceId`) | lowest — any collision loses |
| per-call `others` | the caller's own record passed to `makeRequest(method, params, wait, others?, timeoutMs?)` | middle — beats `context`, loses to the envelope |
| `id`, `method`, `params` | generated per call (`makeId` is monotonic per instance) | highest — a `context` or `others` key named `id`/`method`/`params` can never corrupt the wire format |

That ordering is a deliberate defense, not an accident of spread syntax. The
caller may pass its own `others` record to merge extra fields into the
outgoing envelope — but `context` is a shared object whose cost is paid per
request, so putting anything large in it is a per-request allocation.

## Size-estimation cost table

`WorkerThreadRpc.estimatePayloadSize(value)` is a class static at
`src/rpc.ts:73` — a recursive walker that estimates in-memory footprint. It
deliberately does NOT serialize; it approximates the size the value occupies
after decode:

| Value kind | Counted cost |
| --- | --- |
| `string` (incl. object keys) | `length * 2` per string, plus `key.length * 2` per object key |
| `number`, `bigint`, `Date` | 8 bytes each |
| `ArrayBuffer`, any `ArrayBufferView` | `byteLength` |
| `Map`, `Set` | walks contents entry by entry (locked by `counts Map keys and values instead of Object.keys undercount`, `counts Set items`, and `handles empty Map/Set as zero`) |
| `null`, `undefined`, `boolean` | 0 — skipped |
| `symbol`, `function` | skipped entirely |
| cycles | guarded by a `seen` `Set` — shared references counted once |

Size enforcement is POST-BUFFERING: `net-ipc` has already buffered the whole
frame by the time the estimate runs, so the cap stops handler memory and the
pending map from growing — not bytes from crossing the socket. That is an
upstream `net-ipc` limitation, not an oversight.

## Incorrect

```typescript
await gateway.mtdSave({at: new Date(), big: 1n}) // wrong: JSON gateway turns `Date` into a string and throws on `BigInt`
await worker.request(`mtdPing`, []) // wrong: fire-and-forget without `wait = false` still registers a pending entry that only a reply clears
```

```typescript
// wrong: an id-less notification gets NO reply (`src/rpc.ts:301` only answers when `id !== undefined`)
// — sending one raw and awaiting a result hangs the caller logic forever
worker.rpc.send({method: `mtdPing`, params: []}) // wrong: notification shape, dispatched but never answered
const res = await worker.request(`mtdPing`, []) // wrong when paired with the line above: the reply it waits for never comes
```

```typescript
worker.rpc.context = {traceId, user, tenant, debug, flags, extras} // wrong: the merge copies per call — a fat context is a per-request allocation on hot paths
```

## Correct

```typescript
await client.connect(path, {messagepack: true}) // correct: both ends agree, so `Date`/`BigInt`/`Map`/`Set`/`undefined`/typed arrays survive
await worker.request(`mtdSave`, [{at: `2026-09-10T00:00:00Z`, big: `1`}]) // correct: JSON-safe shape when either end stays on JSON
```

```typescript
// correct: fire-and-forget returns whatever `send` returned and never registers a pending entry
worker.rpc.makeRequest(`mtdLog`, [`hello`], false) // correct: `wait = false`, no reply expected, nothing to leak
```

```typescript
worker.rpc.context = {traceId} // correct: tiny correlation id, merged per call at negligible cost
await worker.request(`mtdSave`, [doc], true, {tenant}) // correct: per-call `others` beat `context` without bloating every request
```

## Notes

- `messagepack: true` without `msgpackr` installed throws a clear error.
- Oversized gateway messages reject with a controlled error (post-buffering
  cap — see `gateway-reliability`).
- Non-number response ids are reported and ignored, never silently hung on.
- Remote errors arrive verbatim — read `.message`, never `instanceof` (the
  wire carries `{message, stack, name}`, not the class).
- Outbound `undefined` results coerce to `null`; inbound `result`
  discrimination is key-presence based so msgpack `undefined` still resolves.
- Locked by `test/rpc.test.ts`:
  - size estimation — `counts Map keys and values instead of Object.keys undercount`, `counts Set items`, `handles empty Map/Set as zero`
  - transport-failure routing — `reports synchronous send throws from make()`, `reports async send rejections from make()`
  - malformed inbound id — `WorkerThreadErrorHandler.report reports and sends nothing on a string response id`
