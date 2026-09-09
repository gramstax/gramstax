# gateway-reliability.md

Verdict: design every gateway handler idempotent — delivery is at-least-once,
order is not guaranteed, and the size cap is post-buffering.

## Why

The transport retries failed writes and replays in-flight requests across
reconnects with no idempotency key on the wire, so one logical call can
execute twice (measured: `charge`-style retry double-ran). The server dedupes
per connection by RPC id (monotonic, never reused): first delivery executes,
redeliveries replay the cached response — including ones arriving while the
first copy still runs (dropped, not queued). Cache: 1000 entries FIFO per
connection, responses >64KB never cached, dropped on disconnect.

## Incorrect

```typescript
mtdCharge(card) { await chargeCard(card) } // retry → charged twice
// relying on set(a)-then-set(b) order across a reconnect
```

## Correct

```typescript
mtdCharge(idempotencyKey, card) { // keyed: safe under redelivery
  if (seen.has(idempotencyKey)) return seen.get(idempotencyKey)
  // ...
}
```

## Notes

- Reconnects use exponential backoff with jitter (`reconnect: true` default);
  N clients × retries stampede without it — `retries`/`maxRetryTime` bound it.
- `maxMessageSize` (default 10MB) rejects AFTER full buffering+parse: it stops
  handler-memory growth, not wire bytes (upstream `net-ipc` limitation).
- Keep handlers fast or idempotent-keyed regardless — dedupe is a backstop.
