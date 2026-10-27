# rpc-middleware.md

Verdict: register middleware for observation and guards; call `next()` exactly
once; short-circuit only as a deliberate escape hatch.

## Why

The chain runs in registration order and each link decides whether the rest of
the pipeline — including the gateway `allowedMethods` guard, which is itself a
`use()` middleware (`src/gateway-server.ts:161-169`) — ever sees the call. A
missing `next()` silently drops the call (the handler never runs, the caller
gets `null`), a double `next()` would execute the handler twice, and a
short-circuit skips every downstream check. The failure mode is invisible
either way: the caller gets a plausible-looking result while the guard that
should have fired never ran.

## Chain ordering

`worker.rpc.use(fn)` at `src/rpc.ts:230` appends to an ordered chain and
returns `this`, so calls chain. Middleware runs in REGISTRATION ORDER:

```
inbound request (`src/rpc.ts:297` builds `ctx = {method, params}`)
  -> middleware[0] (`use` order)
  -> middleware[1]
  -> ...
  -> gateway `allowedMethods` guard (registered via `use` at connect time)
  -> dispatch to `register[ctx.method]` (`src/rpc.ts:346-356`)
  -> reply `{id, result}` (or `{id, error}` on throw)
```

`ctx` carries the method and params (`IRpcContext` in `src/types/rpc.ts`:
`method`, mutable `params`, optional `result`); setting `ctx.result` is how
you short-circuit. The exit points:

- `await next()` exactly once → the rest of the chain runs, dispatch happens.
- set `ctx.result` WITHOUT calling `next()` → short-circuit, nothing
  downstream runs — see the table below.
- return without either → the handler never runs AND `ctx.result` stays
  `undefined`, so the caller receives `null` with no error. Silent drop.
- throw → the call rejects with that error (caught at `src/rpc.ts:304-307`
  and sent as `{id, error}`).
- call `next()` twice → the second call throws
  `next() called multiple times` (`src/rpc.ts:361`) into an error response.
  Now guarded — but the first dispatch may already have run, so treat any
  double-`next` as a bug.

## Short-circuit effect table

| Behavior | Runs | Skipped | Safe vs dangerous |
| --- | --- | --- | --- |
| `await next()` once | whole downstream chain, guard, dispatch | nothing | safe — the normal path |
| set `ctx.result`, skip `next()` | only middleware registered BEFORE you | every downstream check INCLUDING the `allowedMethods` gateway guard | safe ONLY as a deliberate escape hatch for trusted in-process customization — reachable solely by code that already holds the server instance |
| return with neither | upstream middleware unwind only | dispatch, guard, handler | dangerous — caller gets `null`, nothing logged |
| throw | error envelope to the caller | dispatch, everything after you | safe for guards — the caller sees the rejection reason |
| `next()` twice | first pass fully, then throws | second dispatch | dangerous — handler may already have executed once |

## Incorrect

```typescript
rpc.use(async (ctx, next) => {
  await next()
  await next() // wrong: throws `next() called multiple times` into an error response — the handler may already have run once
})
rpc.context = {traceId, user, tenant, debug, flags, extras} // wrong: merged and copied per call — keep it small on hot paths
```

```typescript
rpc.use(async (ctx, next) => {
  log(ctx.method) // wrong: missing `next()` silently drops the call — handler never runs, caller gets `null`
})
```

```typescript
class W extends WorkerThreadInit {
  async mtdHandle(job: Job) {
    this.rpc.use(async (ctx, next) => { // wrong: `use()` per-request inside a handler — the list is unbounded and slows every later call
      await next()
    })
    return this.run(job)
  }
}
```

## Correct

```typescript
rpc.use(async (ctx, next) => {
  const t0 = Date.now()
  await next() // correct: exactly once — observe around the call, never twice, never zero
  metrics.observe(Date.now() - t0)
})
rpc.context = {traceId} // correct: tiny, merged per call at negligible cost
```

```typescript
// correct: guard by throwing (caller sees the rejection) or rewriting `params` (mutable per `IRpcContext`), then `next()`
rpc.use(async (ctx, next) => {
  if (!isKnown(ctx.method)) { throw new Error(`unknown method ${ctx.method}`) } // correct: rejects the call with that error
  ctx.params = sanitize(ctx.params) // correct: downstream dispatch sees the cleaned args
  await next()
})
```

```typescript
// correct: short-circuit ONLY as a deliberate escape hatch — named, commented, and registered
// knowing it skips the `allowedMethods` guard downstream
rpc.use(async (ctx, next) => {
  if (ctx.method === `mtdHealth`) { ctx.result = `ok` } // correct: intentional, no `next()`, trusted in-process customization only
  else { await next() }
})
```

## Notes

- Short-circuit (`ctx.result = …` without `next()`) skips downstream checks
  INCLUDING the gateway allow-list — intentional escape hatch for trusted
  in-process code only (see `gateway-security`).
- Throwing inside middleware rejects the call with that error.
- Never `use()` per-request inside a handler — the list is unbounded and
  slows every later call.
- `use()` returns `this`, so register the whole chain in one statement — but
  order is still registration order, so put guards before observers when the
  observer must not see denied calls.
- Ordering rule of thumb: the gateway `allowedMethods` guard is itself a
  `use()` middleware, so anything registered before it that short-circuits
  skips it — see `gateway-security` for the allow-list side of this contract.
