# gateway-security.md

Verdict: always `token` + non-empty `allowedMethods`; `token: ""` is NOT auth.

## Why

The server checks `authToken !== undefined` — an empty string previously
disabled the guard while looking configured. Comparison is timing-safe.
Omitting `register` exposes the whole worker instance, so the constructor
THROWS without a non-empty allow-list; an explicit `register` object without
a list is deliberately permitted (narrow surface, owner’s choice). Unknown
connections’ messages are dropped; oversized ones get a controlled error.

## Incorrect

```typescript
await this.createGatewayServer(path, undefined, {token: ``}) // looks locked, is open
await server.start(path, {ping: () => 1}) // no allow-list: constructor/toString were reachable pre-hardening
```

## Correct

```typescript
await this.createGatewayServer(path, undefined, {token: `shared-secret`, allowedMethods: [`mtdHello`]})
await server.start(path, {ping: () => 1}, {token: `shared-secret`, allowedMethods: [`ping`]})
```

## Notes

- Method matching is case-sensitive; `request("Ping")` ≠ `"ping"`.
- `messagepack: true` without `msgpackr` throws — no silent JSON downgrade.
- Socket paths: >104 POSIX chars rejected early; relative paths resolve
  under `os.tmpdir()`; `-` is escaped so `/tmp/a-b` ≠ `/tmp/a/b` on pipes.
- Stale `.sock` files are unlinked best-effort on `close()`.
