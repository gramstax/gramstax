# rpc-naming.md

Verdict: every remotely-called method is `mtd*`-prefixed — public or
effectively-private (RPC has no `private`); lifecycle/plumbing names stay
unprefixed and most are remotely denied.

## Why

The prefix marks the remote surface: anything without it that lives on the
worker instance is still dispatchable, so the prefix is the only boundary
between callable API and local helpers. `DENIED_RPC_METHODS`
(`__proto__`, `constructor`, `prototype`, `send`, `request`, `kill`, `init`,
`handleOnMessage`, `createGatewayServer`, `createGatewayClient`) plus any
`Object.prototype` member (`toString`, `hasOwnProperty`, …) always rejects
with `not found` — but class-prototype `mtd*` methods dispatch normally
(strict `hasOwn` broke this: `readyResolve` never resolved).

## Incorrect

```typescript
class W extends WorkerThreadInit {
  async compute(n: number) { return n * 2 } // callable but unmarked: invisible API, allow-list confusion
  async mtdShutdown() { /* ... */ } // collides with the lifecycle name; denied names win
}
```

## Correct

```typescript
class W extends WorkerThreadInit {
  count = 0 // state: never dispatched (not a function)
  mtdIncrement(by = 1) { return (this.count += by) } // remote API
  mtdGetCount() { return this.count } // remote API, even if conceptually private
  async onBeforeExit() { await this.flush() } // lifecycle hook: local only
}
```

## Notes

- `shutdown` and `readyResolve` stay remotely allowed — they ARE the inbound
  lifecycle. Never name a business method either.
- Main-thread callbacks follow the same rule: extend `WorkerThreadLaunch`
  with `mtd*` methods the worker can call back into.
- Locked by `rpc.test.ts` regression (b)/(o) and the gateway `mtdAlpha` test.
