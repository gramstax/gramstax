# gateway-security.md

Verdict: always `token` + non-empty `allowedMethods`; `token: ""` is NOT auth.

## Why

The server checks `authToken !== undefined` — an empty string previously
disabled the guard while looking configured. So `token: ""` is a value
that must match, never a way to disable auth, and unset (`undefined`)
is the only off switch. Comparison is timing-safe via
`crypto.timingSafeEqual` with a length-mismatch reject
(`src/gateway-server.ts:231`). Omitting `register` exposes the whole
worker instance, so the constructor throws without a non-empty
allow-list; an explicit `register` object without a list is deliberately
permitted (narrow surface, owner's choice). Unknown connections'
messages are dropped, oversized ones get a controlled error.

## Threat / control table

| Threat | Control | What it does NOT do |
| --- | --- | --- |
| Rogue local process connects | `token` — server closes mismatched connections (`src/gateway-server.ts:127`) | Does not encrypt traffic, socket is local-only trust |
| Rogue client calls internals | `allowedMethods` — only listed methods dispatch (`src/gateway-server.ts:161`) | Does not cover short-circuit middleware, which intentionally skips the guard (see `rpc-middleware.md`) |
| Whole instance exposed | `createGatewayServer` throws without non-empty `allowedMethods` when `register` is omitted (`src/init.ts:277`) | Does not help when an explicit `register` is passed — owner chose the surface |
| Prototype / plumbing gadgets | `DENIED_RPC_METHODS` (dispatcher, exported, 10 entries) + `DENIED_RPC_PROPS` (proxy, module-private, 6 entries) — two independent gates, see `rpc-naming.md` | Neither replaces `allowedMethods`, layer all three |
| Peer floods memory | `maxMessageSize`, default `DEFAULT_MAX_MESSAGE_SIZE = 10 * 1024 * 1024` (`src/rpc.ts:22`) — oversized rejected with controlled error | Enforced post-buffering: stops handler-memory growth, not wire bytes (upstream `net-ipc` limitation) |

An empty `allowedMethods` list denies every method — it never opens
them. Only omitting the option leaves the register fully callable.

## Parameter order: `options` is third

`WorkerThreadGatewayServer.start(path, register?, options?)`
(`src/gateway-server.ts:288`) takes options THIRD. Passing
`{allowedMethods}` as the second argument is a real bug agents have
made — it lands in `register` and the server starts wide open.

## Incorrect

```typescript
// wrong: options passed as the SECOND argument land in register
// the server binds with no allow-list at all
await server.start(path, {allowedMethods: [`ping`]}) // wrong: this is register, not options
```

```typescript
// wrong: empty-string token looks locked but enforces a match on ""
// any client sending {auth: ""} walks in, and unset was probably meant
await this.createGatewayServer(path, undefined, {token: ``, allowedMethods: [`mtdHello`]}) // wrong: "" is a value, not off
```

```typescript
// wrong: no allow-list while exposing the whole instance
// pre-hardening this left constructor/toString reachable
await server.start(path, {ping: () => 1}) // wrong: register without options, throws today, reachable before
```

## Correct

```typescript
// correct: register + options in the right slots, token + allow-list together
await server.start(path, {ping: () => 1}, {token: `shared-secret`, allowedMethods: [`ping`]}) // correct: third arg is options
```

```typescript
// correct: whole-instance expose with the mandatory non-empty allow-list
await this.createGatewayServer(path, undefined, {token: `shared-secret`, allowedMethods: [`mtdHello`]}) // correct: omit register only with a list
```

```typescript
// correct: auth explicitly disabled by OMISSION, not by empty string
// narrow register, owner's choice, no allow-list required
await server.start(path, {ping: () => 1}, {allowedMethods: [`ping`]}) // correct: no token key at all means open socket
```

## Notes

- Method matching is case-sensitive; `request("Ping")` ≠ `"ping"`.
- `messagepack: true` without `msgpackr` throws — no silent JSON downgrade.
- Socket paths: >104 POSIX chars rejected early; relative paths resolve
  under `os.tmpdir()`; `-` is escaped so `/tmp/a-b` ≠ `/tmp/a/b` on pipes.
- Stale `.sock` files are unlinked best-effort on `close()`.
- Gateway path normalization is `WorkerThreadGatewayPath.normalize` — a
  static, never a free `normalizeGatewayPath` — see `platform-runtime.md`.
- The middleware short-circuit escape hatch (set `ctx.result` without
  calling `next()`) skips the `allowedMethods` guard by design, reachable
  only by code already holding the server instance — see
  `rpc-middleware.md`.
