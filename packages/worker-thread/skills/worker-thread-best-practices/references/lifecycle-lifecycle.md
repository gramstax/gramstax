# lifecycle-lifecycle.md

Verdict: follow launch → ready → request → shutdown; `kill()` is for dead
workers only, never the happy path.

## Why

`shutdown()` drains `onBeforeExit()` (flush, persist, close sockets) before
terminating; `kill()` skips it. Concurrent `shutdown()` calls share one
in-flight drain; a second sequential call returns `true` without re-running
the hook. `send()` returns `boolean` — `false` means no `parentPort`
(main-thread/test context), never a silent drop.

## Incorrect

```typescript
await worker.kill() // happy path: skips onBeforeExit, leaks gateway sockets
await worker.ready() // after kill: stale resolve pretends a dead worker is healthy
new WorkerThreadLaunch(file, [undefined]) // worker misdetects itself, spawns nested
```

## Correct

```typescript
const worker = await Job.launchWorker()
await worker.ready() // rejects if the worker crashed before signaling
await Job.mtdCompute(1)
await worker.shutdown(5_000) // drains onBeforeExit, closes gateway, terminates
```

## Notes

- `ready()` rejects after death (stores `exitCode`); poll `exited`, not `ready()`.
- `argv` slots: `export` reserves `process.argv[2]` for its routing token —
  user args start at `argv[3]`; explicit `[undefined]` normalizes to no-args.
- `shutdown()` on an exited worker resolves immediately (no 5s stall).
