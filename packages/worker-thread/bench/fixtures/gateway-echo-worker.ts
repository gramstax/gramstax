/**
 * Gateway fixture worker for benches — hosts a Unix-socket gateway server
 * inside the worker so benches measure the real inter-worker path.
 *
 * @remarks
 * Same conventions as `echo-worker.ts`: `WorkerThreadInit` subclass,
 * bare `new` at module load for `WorkerThreadLaunch` spawns (guarded so
 * `GatewayEchoJob.launchWorker()` spawns construct exactly once), plus a
 * `WorkerThreadExport.init` export. The server register is explicit, so
 * no `allowedMethods` list is needed.
 *
 * @internal
 */
import {isMainThread} from "node:worker_threads"
import {WorkerThreadExport} from "../../src/export"
import {WorkerThreadInit} from "../../src/init"

export class GatewayEchoWorker extends WorkerThreadInit {
  mtdEcho(payload: unknown) {
    return payload
  }

  async mtdStartGateway(path: string) {
    await this.createGatewayServer(path, {
      echo: (payload: unknown) => payload,
      ping: () => `pong`
    })
    return true
  }

  async mtdStopGateway() {
    await this.gatewayServer?.close()
    return true
  }
}

export const GatewayEchoJob = WorkerThreadExport.init({
  path: `${import.meta.dir}/gateway-echo-worker.ts`,
  WTInit: GatewayEchoWorker
})

// Exactly one construction per spawn style: `GatewayEchoJob.launchWorker()`
// passes a `for-` routing token (the `Export.init` worker branch constructs),
// while a direct `new WorkerThreadLaunch(path, [])` spawn carries no token
// (the bare construction below handles it). Two constructors would
// double-bind every parentPort listener — harmless for echo RPC, fatal for
// gateway paths (the twin would race the same socket bind with EADDRINUSE).
if (!isMainThread && !process.argv[2]?.startsWith(`for-`)) {
  new GatewayEchoWorker()
}
