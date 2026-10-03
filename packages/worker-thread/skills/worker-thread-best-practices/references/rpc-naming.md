# rpc-naming.md

Verdict: every remotely-called method is `mtd*`-prefixed — public or
effectively-private (RPC has no `private`); lifecycle/plumbing names stay
unprefixed and most are remotely denied.

## Why

The prefix is the ONLY boundary between callable API and local helpers: a
public-looking helper without it is invisible API that still shows up in
allow-list confusion, while a typo'd or plumbing-looking name fails at call
time with `not found`. Two independent deny lists enforce this at two layers,
so a name that slips past the proxy still dies at the dispatcher.

## The two deny lists

| | Dispatcher list | Proxy list |
| --- | --- | --- |
| Name | `DENIED_RPC_METHODS` | `DENIED_RPC_PROPS` |
| Location | `src/rpc.ts:42` | `src/export.ts:27` |
| Exported | yes, a `ReadonlySet<string>` | no, module-private by design |
| Guards | the dispatch in `_runMiddleware` | the proxy `get` trap, before any closure is built |
| Count | exactly 10 | exactly 6 |
| Contents | ``__proto__``, `constructor`, `prototype`, `send`, `request`, `kill`, `init`, `handleOnMessage`, `createGatewayServer`, `createGatewayClient` | `then`, `toString`, `constructor`, ``__proto__``, `prototype`, `inspect` |

The overlap is only THREE names (``__proto__``, `constructor`, `prototype`).
Each list exists for its own layer: `then` keeps the proxy NON-THENABLE so
`await` on it is safe, while `toString`/`inspect` defuse introspection gadgets
before a closure is ever built. A method can pass the proxy layer and still be
denied by the dispatcher — which is why a typo'd name fails with `not found`
instead of a proxy-level error.

## Dispatch decision flow

For an incoming `ctx.method` at `src/rpc.ts:352`:

```
resolve `func = register[ctx.method]`
  -> `typeof func !== `function`` → reject with `not found`
  -> `DENIED_RPC_METHODS.has(ctx.method)` → reject with `not found`
  -> `fromObjectProto` (own-missing AND on `Object.prototype`) → reject with `not found`
  -> otherwise → `func.apply(register, ctx.params)`
```

`fromObjectProto` rejects ANY `Object.prototype` member (`toString`,
`hasOwnProperty`, …), so a prototype-pollution attempt is denied structurally
rather than by name. A strict `hasOwn` check was tried and BROKE
class-prototype methods — `readyResolve` never resolved — so class-prototype
`mtd*` methods MUST dispatch. That regression constrains the implementation:
the guard cannot be tightened to own-properties-only.

## Name to remotely callable

| Name | Remotely callable | Reason |
| --- | --- | --- |
| `mtdCompute`, `mtdGetCount` | yes | prefixed API, own or class-prototype method |
| `shutdown`, `readyResolve` | yes | NOT in the deny list — they ARE the inbound lifecycle |
| `compute` (unprefixed helper) | dispatchable but unmarked | invisible API, allow-list confusion — prefix it or keep it off the instance |
| `send`, `request`, `kill`, `init`, `handleOnMessage`, `createGatewayServer`, `createGatewayClient` | no | dispatcher deny list, rejects with `not found` |
| `constructor`, `prototype`, ``__proto__`` | no | denied at BOTH layers |
| `toString`, `hasOwnProperty`, any `Object.prototype` member | no | `fromObjectProto` structural denial |
| `then`, `inspect` on a proxy | no closure built | proxy deny list resolves to `undefined` |
| `shutdown` as a business-method name | dispatches, do not do it | collides with the inbound lifecycle — pick another name |

## Incorrect

```typescript
class W extends WorkerThreadInit {
  async compute(n: number) { return n * 2 } // wrong: callable but unmarked, invisible API and allow-list confusion
  async mtdShutdown() { return `off` } // wrong: collides with the lifecycle name, denied names win at dispatch
}
```

```typescript
// wrong: `send` is outgoing-only plumbing — remotely denied, always rejects with `not found`
await worker.request(`send`, [{id: 1, method: `mtdPing`, params: []}])
// wrong: `constructor` would expose the class — denied at both layers
await worker.request(`constructor`, [])
```

```typescript
const Gateway = Job.launchGatewayClient(path)
// wrong: `instanceof` against a gateway proxy is ALWAYS FALSE by design
// (`src/export.ts:166-167` — the constructor returns a fresh proxy object)
if (proxy instanceof Gateway) { return proxy.mtdAlpha() } // wrong: dead branch, never taken
```

## Correct

```typescript
class W extends WorkerThreadInit {
  count = 0 // correct: state, never dispatched (not a function)
  mtdIncrement(by = 1) { return (this.count += by) } // correct: remote API, `mtd*` on the class prototype dispatches
  mtdGetCount() { return this.count } // correct: remote API, even if conceptually private — RPC has no `private`
  async onBeforeExit() { await this.flush() } // correct: lifecycle hook, local only, never remotely invoked
}
```

```typescript
// correct: main-thread callbacks follow the same rule — extend `WorkerThreadLaunch`
// with `mtd*` methods the worker can call back into
class Main extends WorkerThreadLaunch {
  mtdGetConfig() { return {feature: true} } // correct: prefixed, so the worker can `request` it
}
```

```typescript
// correct: compare against `WorkerThreadInit` or duck-type — never `instanceof` a gateway proxy
if (worker instanceof WorkerThreadInit) { await worker.mtdAlpha() } // correct: real base class check
// correct: feature-detect via the `has` trap (`src/export.ts:323-329` answers
// `prop in WTInit.prototype`), so probes report `false` for non-methods early
if (`mtdAlpha` in Job) { await Job.mtdAlpha() } // correct: `false` for typos instead of failing later at call time
```

## Notes

- `shutdown` and `readyResolve` stay remotely allowed — they ARE the inbound
  lifecycle. Never name a business method either.
- Main-thread callbacks follow the same rule: extend `WorkerThreadLaunch`
  with `mtd*` methods the worker can call back into.
- Non-function fields (`count = 0`) are never dispatched — the guard checks
  `typeof func !== `function`` first — but keep helpers off the instance or
  prefixed anyway so the surface reads honestly.
- Locked by `test/rpc.test.ts` — `dispatches a request to the registered method`
  and `dispatches id-less requests but answers nobody` — plus the gateway
  allow-list tests in `test/gateway.test.ts`. The broader
  `WorkerThreadExport regression (a–k fixes)` and
  `WorkerThreadLaunch regression (a–k fixes)` suites in
  `test/export.test.ts:191` and `test/launch.test.ts:212` cover the proxy and
  lifecycle halves.
- Proxy-layer companion: `DENIED_RPC_PROPS` is deliberately module-private —
  see `gateway-security` for the token/`allowedMethods` layer above this one.
