# lifecycle-timeouts.md

Verdict: omitting `timeoutMs` applies the 30s instance default — pass
`timeoutMs: 0` for genuinely long tasks.

## Why

Unbounded pending requests (peer never answers) grew the pending map forever
— one entry per hung call across all four transports. The 30s default
(`DEFAULT_REQUEST_TIMEOUT_MS`, overridable via `rpc.defaultTimeoutMs`) bounds
it; `0` stays infinite for back-compat; negative/NaN/non-number throws
`TypeError`. Timers are `unref`d so a long timeout never pins the process.

## Incorrect

```typescript
await worker.request(`mtdBroadcast`, [tenThousandUsers]) // caller rejects at 30s, handler keeps running; a retry double-executes
```

## Correct

```typescript
await worker.request(`mtdBroadcast`, [users], true, undefined, 0) // opt out: waits indefinitely
await worker.request(`mtdFast`, [], true, undefined, 500) // bounded: rejects after 500ms, entry cleaned
```

## Notes

- Pool `execute`/`broadcastRequest` forward `timeoutMs` to the same default.
- Crash-before-ready rejects `ready()`; exit rejects all pending requests.
- Fire-and-forget (`wait: false`) has no waiter — a crash loses it silently.
