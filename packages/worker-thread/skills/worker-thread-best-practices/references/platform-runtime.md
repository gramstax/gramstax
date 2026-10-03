# platform-runtime.md

Verdict: normalize every gateway path through `WorkerThreadGatewayPath.normalize()`
and keep POSIX paths short, unique, and absolute — Windows and Linux fail
in different places when you do not.

## Why

`net-ipc` binds a Unix socket on POSIX and a named pipe on Windows, but the
caller passes one string. The static `WorkerThreadGatewayPath.normalize()`
is the single choke point that makes that string mean the same server on
both platforms (see `references/gateway-topology.md`). Skip it and the same
gateway works on a dev Mac while failing on Windows or on long Linux paths
with errors that point nowhere near the real cause.

## Bounds-inference table

What each input shape resolves to on each platform — read the row matching
your input before predicting where the socket lands:

| Input shape | POSIX result | win32 result |
|---|---|---|
| absolute, e.g. `/tmp/server.sock` | passes through after the 104-char check | `\\.\pipe\tmp-server.sock` |
| bare identifier, e.g. `gateway-main` | `join(os.tmpdir(), path)` — never the working directory | `\\.\pipe\gateway--main` (dash escaped) |
| relative, e.g. `./gateway.sock` | `join(os.tmpdir(), path)` — not next to the checkout | `\\.\pipe\.-gateway.sock` via the same replace chain |
| already a pipe, e.g. `\\.\pipe\already-pipe` | treated as a relative name under `os.tmpdir()` | passes through unchanged (double-normalize is safe) |
| over-long resolved path (> 104 chars) | throws at normalize time, naming limit + actual length | length check never runs (win32 branch returns first) |

## Failure-mode table

Each failure surfaces in exactly one place. Match the symptom to the row:

| Symptom | Platform | Real cause | Where it throws |
|---|---|---|---|
| cryptic `ENOENT` at bind/connect on a path that looks correct | POSIX | resolved path exceeds `sun_path` (108 bytes incl. NUL) | bind/connect time — never length-checked |
| `Error: gateway socket path exceeds 104 characters (N): <path>` | POSIX | deeply nested `os.tmpdir()` prefix + long test name | normalize time (`gateway-path.ts:58`) |
| client cannot find a server started with a relative path | POSIX | socket bound under `os.tmpdir()`, client looked next to the checkout | no throw — log the normalized value on both ends |
| two gateways answer on one pipe | win32 | hand-rolled mapping skipped the dash-escape step | no throw — silent collision |
| hang instead of a loud failure on restart | both | reused path collides with a stale socket file | runner hangs — use `uniqueSocketPath` |
| green CI, broken pipe names on Windows | win32 | the win32 branch never runs in CI (see section 5) | nowhere — zero coverage, not partial |

## Incorrect

```typescript
import {WorkerThreadGatewayServer} from "@gramstax/worker-thread"

// wrong: raw path handed to the server — POSIX-only, collides on win32, may
// wrong: exceed sun_path, and a bare name lands in the working directory.
// Note the signature: start(path, register?, options?) — options is 3rd.
const server = new WorkerThreadGatewayServer()
await server.start("/tmp/a-b", undefined, {allowedMethods: ["mtdHello"]})
await server.start("gateway-main", undefined, {allowedMethods: ["mtdHello"]})
```

```typescript
import {WorkerThreadGatewayServer} from "@gramstax/worker-thread"

// wrong: one fixed path shared across parallel servers is a hang, not a speedup
const serverA = new WorkerThreadGatewayServer()
const serverB = new WorkerThreadGatewayServer()
await serverA.start(`/tmp/server.sock`, {ping: () => `pong`}) // wrong: second bind collides with the stale file
await serverB.start(`/tmp/server.sock`, {ping: () => `pong`}) // wrong: hangs the runner instead of failing loudly
```

```typescript
// wrong: hand-rolled pipe mapping that skips the dash-escape step
const toPipe = (path: string): string => {
  return `\\\\.\\pipe\\${path.replace(/^\//, ``).replace(/\//g, `-`)}` // wrong: no dash escape
}

toPipe(`/tmp/a-b`) // wrong: lands on the SAME pipe as /tmp/a/b — collision bug
toPipe(`/tmp/a/b`) // wrong: indistinguishable from /tmp/a-b without the escape
```

## Correct

```typescript
import {WorkerThreadGatewayPath} from "@gramstax/worker-thread"

// right: one static call, same input on every platform
const pathA = WorkerThreadGatewayPath.normalize("/tmp/server.sock")
const pathB = WorkerThreadGatewayPath.normalize("gateway-main")
const unique = WorkerThreadGatewayPath.normalize(`gw-${process.pid}-${Date.now()}`)
```

```typescript
import {WorkerThreadGatewayServer} from "@gramstax/worker-thread"
import {uniqueSocketPath} from "../bench/_setup"

// right: pid + Date.now() + counter per server, so no stale file collides
const path = uniqueSocketPath(`gw-test`) // right: mirrors bench/_setup.ts:28
const server = new WorkerThreadGatewayServer()
await server.start(path, {ping: () => `pong`}) // right: explicit register, no allow-list needed
```

```typescript
// right: win32-equivalent of normalize() for a POSIX dev machine
const win32Normalize = (path: string): string => {
  if (path.startsWith(`\\\\.\\pipe\\`)) return path // right: existing pipes pass through unchanged
  return `\\\\.\\pipe\\${path.replace(/^\//, ``).replace(/-/g, `--`).replace(/\//g, `-`)}` // right: dash escape before slash mapping
}

console.log(win32Normalize(`/tmp/a-b`)) // right: \\.\pipe\tmp-a--b
console.log(win32Normalize(`/tmp/a/b`)) // right: \\.\pipe\tmp-a-b — distinct pipe
```

## Notes

- Static, never an instance: call `WorkerThreadGatewayPath.normalize()`
  directly. Server and client share it so both ends resolve identically.

### 1. Windows named-pipe transform

- On `win32`, `/tmp/server.sock` and bare identifiers such as
  `gateway-main` both become `\\.\pipe\...` pipes.
- Escape order is load-bearing: one leading `/` is stripped, then `-`
  maps to `--`, then remaining `/` maps to `-`.
- That ordering keeps `/tmp/a-b` and `/tmp/a/b` on DISTINCT pipes
  instead of colliding. Treat any hand-rolled pipe mapping that skips
  the dash-escape step as a collision bug.
- A path already starting with `\\.\pipe\` passes through unchanged,
  so double-normalizing a pipe name is safe.

### 2. Win32 transform order — worked trace

The replace chain in `gateway-path.ts:54` runs left to right on every
non-pipe input. Trace `/tmp/a-b` through it:

1. `path.replace(/^\//, ``)` strips one leading slash → `tmp/a-b`.
2. `.replace(/-/g, `--`)` escapes every dash → `tmp/a--b`.
3. `.replace(/\//g, `-`)` maps remaining slashes → `tmp-a--b`.
4. Prefix applied → `\\.\pipe\tmp-a--b`.

Now trace `/tmp/a/b` through the same chain: strip → `tmp/a/b`, no dashes
to escape, slashes map → `tmp-a-b`, prefix → `\\.\pipe\tmp-a-b`. The two
inputs land on DISTINCT pipes (`tmp-a--b` vs `tmp-a-b`) only because step 2
runs before step 3 — swap them and `/tmp/a-b` would collapse onto
`tmp-a-b`, colliding with `/tmp/a/b`. Bare identifiers skip step 1 (no
leading slash) but still pass steps 2–3, so `gateway-main` becomes
`\\.\pipe\gateway--main`.

### 3. POSIX 104-char limit

- `MAX_POSIX_SOCKET_PATH = 104`. Anything longer throws at normalize
  time, naming the limit and the actual length in the message.
- The reason is `sun_path`: 108 bytes including the NUL on Linux. An
  over-long path that slips past validation does not fail cleanly, it
  surfaces later as a cryptic `ENOENT` at bind or connect time.
- Telling them apart: a normalize throw names characters and prints
  the path, an `ENOENT` on a path that looks correct means the path
  was never length-checked. Deeply nested `os.tmpdir()` prefixes plus
  long test names are the usual way over.

### 4. Relative path resolution

- On POSIX, absolute paths pass through after the length check.
- Relative paths and bare identifiers resolve against `os.tmpdir()`,
  so socket files never pollute the process working directory.
- Do not assume `./gateway.sock` binds next to the checkout, it binds
  under the temp directory. Log the normalized value when debugging
  a client that cannot find a server.

### 5. Engines contract

- `engines` is `node >= 18` and `bun >= 1.0.0`.
- Exactly one runtime dependency exists: `net-ipc`. `typescript` is a
  peer dependency, not a bundled runtime.
- Keep gateway code to that surface: `node:os`, `node:path`, and
  `net-ipc` behavior. Anything needing a second socket library breaks
  the contract this package promises.

### 6. The CI blind spot

- CI (`.github/workflows/release.yml`) runs `ubuntu-latest` only, and
  7 assertions in the suite early-return behind `process.platform`
  guards. The entire `win32` branch of `normalize()` is NEVER executed
  in CI: zero coverage, not partial coverage.
- Node is used only for npm OIDC publish, never to run the suite. All
  9 `.test.ts` files plus `test/helpers.ts` import `bun:test`, so `npm test`
  under plain Node does not exercise this package at all.
- A green CI run therefore says nothing about named-pipe output. Treat
  any gateway change that only passed CI as unverified on Windows until
  the win32 branch is executed locally.

### 7. Socket path uniqueness for parallel runs

- Every gateway server needs a unique socket path. A reused path can
  collide with a stale socket file left by a previous run and hang the
  runner instead of failing loudly.
- Bench helpers build that uniqueness as `pid` plus `Date.now()` plus
  a counter via `uniqueSocketPath` (see `references/bench-runner.md`).
  Mirror that pattern in tests and scripts: one fixed `/tmp/server.sock`
  shared across parallel servers is a hang, not a speedup.

### Verify locally

- POSIX cannot take the `win32` branch by calling `normalize()`
  directly (`process.platform` is read-only). Exercise the same replace
  chain in isolation instead:

```typescript
// win32-equivalent of normalize() for a POSIX dev machine
const win32Normalize = (path: string): string => {
  if (path.startsWith(`\\\\.\\pipe\\`)) return path
  return `\\\\.\\pipe\\${path.replace(/^\//, ``).replace(/-/g, `--`).replace(/\//g, `-`)}`
}

console.log(win32Normalize(`/tmp/a-b`))
console.log(win32Normalize(`/tmp/a/b`))
console.log(win32Normalize(`\\\\.\\pipe\\already-pipe`))
```

- Run it with `bun ./scratch-win32-check.ts` and confirm the first two
  lines differ (dash-escape working) and the third passes through
  unchanged. Then run the real suite with
  `bun test packages/worker-thread/test/` for the POSIX side.
