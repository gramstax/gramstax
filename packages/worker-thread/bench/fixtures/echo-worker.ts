/**
 * Echo fixture worker for benches — parentPort RPC round-trips.
 *
 * @remarks
 * Mirrors `test/fixtures/lifecycle-worker.ts`: a `WorkerThreadInit`
 * subclass instantiated at module load so the worker signals ready as
 * soon as it boots when spawned via `new WorkerThreadLaunch(path, [])`.
 * The `EchoJob` export wires the same class through
 * `WorkerThreadExport.init` for `launchWorker()`-style spawns — use one
 * spawn style per process (never both: each style constructs once).
 *
 * @internal
 */
import {isMainThread} from "node:worker_threads"
import {WorkerThreadExport} from "../../src/export"
import {WorkerThreadInit} from "../../src/init"

export class EchoWorker extends WorkerThreadInit {
  mtdEcho(payload: unknown) {
    return payload
  }

  mtdPing() {
    return `pong`
  }
}

export const EchoJob = WorkerThreadExport.init({
  path: `${import.meta.dir}/echo-worker.ts`,
  WTInit: EchoWorker
})

// Exactly one construction per spawn style: `EchoJob.launchWorker()` passes
// a `for-` routing token (the `Export.init` worker branch constructs), while
// a direct `new WorkerThreadLaunch(path, [])` spawn carries no token (the
// bare construction below handles it). Two constructors would double-bind
// every parentPort listener — harmless for echo RPC, fatal for gateway paths.
if (!isMainThread && !process.argv[2]?.startsWith(`for-`)) {
  new EchoWorker()
}
