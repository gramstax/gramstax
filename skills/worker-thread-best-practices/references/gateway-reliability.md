# gateway-reliability.md

Verdict: design every gateway handler idempotent — delivery is at-least-once,
order is not guaranteed, and the size cap is post-buffering.

## Why

The transport retries failed writes and replays in-flight requests across
reconnects, and callers may retry timed-out requests — so one logical call
can execute twice and a handler can observe the same RPC `id` twice.
Request ids are monotonically increasing per client and never reused
within a connection lifetime, so the server suppresses duplicates per
connection: first delivery executes, redeliveries replay the cached
response. But the backstop has holes by design — responses over 64 KB are
never cached, the cache holds 1000 entries FIFO per connection, and it is
dropped on disconnect — so idempotency is the handler's job either way.

## Dedupe state table

| Arrival | Server action | Caller sees |
| --- | --- | --- |
| First delivery of `id` | executes handler, caches response if ≤64 KB | result (or error) |
| Redelivery, response cached | replays cached response, handler NOT re-run (`src/gateway-server.ts:189`) | same result, no side effect |
| Redelivery, response >64 KB (`MAX_CACHED_RESPONSE_SIZE = 64 * 1024`, `src/gateway-server.ts:14`) | never cached, handler RE-EXECUTES | result, side effect ran twice |
| Redelivery while first copy still running | dropped, not queued (`src/gateway-server.ts:204`) — first response serves both | single result, handler ran once |
| Redelivery after disconnect | cache dropped with the connection — full re-execution | result, side effect ran twice |
| Redelivery after 1000 newer entries (`MAX_CACHED_RESPONSES = 1000`, `src/gateway-server.ts:11`) | FIFO-evicted, handler RE-EXECUTES | result, side effect ran twice |

## The at-least-once window

```
client:  send id=7 ──drop──▶ retry id=7 ──reconnect──▶ retry id=7
server:  run #1 ──▶ cache ──▶ replay cached ──▶ (disconnect: cache gone) ──▶ run #2
caller:  ...waiting... ──▶ result ──▶ result ──▶ result   (same id, three deliveries)
```

There is no ordering across a reconnect: requests sent before a drop may
resolve after requests sent after the reconnect. Never rely on
cross-request order — `set(a)`-then-`set(b)` can land `b`-then-`a`.

## Incorrect

```typescript
// wrong: naked side effect, retry double-charges
mtdCharge(card) { await chargeCard(card) } // wrong: redelivery runs it again
```

```typescript
// wrong: relying on set(a)-then-set(b) order across a reconnect
await gateway.mtdSet(this, `a`, 1) // wrong: may resolve AFTER the next line
await gateway.mtdSet(this, `b`, 2) // reader can see b=2 before a=1 lands
```

```typescript
// wrong: default timeout hides the double-execute
// caller rejects at 30s but the handler keeps running, retry runs it twice
await gateway.mtdSlowJob(this, payload) // wrong: pass timeoutMs: 0 for long tasks
```

## Correct

```typescript
// correct: caller-supplied idempotency key, safe under every redelivery row
mtdCharge(idempotencyKey, card) { // correct: keyed, replay returns stored result
  if (seen.has(idempotencyKey)) return seen.get(idempotencyKey) // correct: dedupe at the app layer
  const receipt = chargeCard(card) // correct: runs once per key
  seen.set(idempotencyKey, receipt)
  return receipt
}
```

```typescript
// correct: reconnect budget explicit, backoff capped
await client.connect(`/tmp/srv.sock`, { // correct: automatic reconnect with bounds
  reconnect: true, // correct: default, survives server restarts
  retries: 50, // correct: gives up instead of retrying forever
  maxRetryTime: 500 // correct: backoff cap in ms
})
```

## Idempotency checklist

- Key every mutating handler by a caller-supplied idempotency key.
- Keep handlers fast or keyed regardless — server dedupe is a backstop.
- Never depend on cross-request order; make each call self-contained.
- Size responses under 64 KB when redelivery safety matters — above that
  the cache never helps.
- For long tasks pass `timeoutMs: 0` so the caller does not reject at the
  30s default (`DEFAULT_REQUEST_TIMEOUT_MS`) and retry a still-running job.

## Notes

- Reconnects use exponential backoff with jitter (`reconnect: true` default);
  N clients × retries stampede without it — `retries`/`maxRetryTime` bound it.
- `maxMessageSize` (default 10MB) rejects AFTER full buffering+parse: it stops
  handler-memory growth, not wire bytes (upstream `net-ipc` limitation).
- Keep handlers fast or idempotent-keyed regardless — dedupe is a backstop.
- The middleware short-circuit escape hatch skips the `allowedMethods` guard
  — see `rpc-middleware.md`. Denied-name gates are separate — see
  `rpc-naming.md`.
