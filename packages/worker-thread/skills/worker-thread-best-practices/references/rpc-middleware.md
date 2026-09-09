# rpc-middleware.md

Verdict: register middleware for observation and guards; call `next()` exactly
once; short-circuit only as a deliberate escape hatch.

## Why

The chain runs in registration order; a missing `next()` silently drops the
call, a double `next()` executes the handler twice (second result wins) —
now guarded: the second call throws into an error response. `rpc.context`
merges into every outbound envelope (correlation ids), but the merge copies
per call — keep it small on hot paths.

## Incorrect

```typescript
rpc.use(async (ctx, next) => {
  await next()
  await next() // throws: handler would have run twice
})
rpc.context = {traceId, user, tenant, debug, flags, extras} // copied per RPC
```

## Correct

```typescript
rpc.use(async (ctx, next) => {
  const t0 = Date.now()
  await next() // exactly once
  metrics.observe(Date.now() - t0)
})
rpc.context = {traceId} // tiny: merged per call
```

## Notes

- Short-circuit (`ctx.result = …` without `next()`) skips downstream checks
  INCLUDING the gateway allow-list — intentional escape hatch for trusted
  in-process code only (see `gateway-security`).
- Throwing inside middleware rejects the call with that error.
- Never `use()` per-request inside a handler — the list is unbounded and
  slows every later call.
