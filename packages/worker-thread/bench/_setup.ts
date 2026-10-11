/**
 * Shared bench setup — echo workers, gateway pairs, pools, mitata run.
 *
 * Knobs (all optional):
 * - `BENCH_N` — batch size / payload-size multiplier per file
 * - `BENCH_FILTER` — regex passed to mitata `run({filter})` for single-bench runs
 *
 * Socket paths are unique per call (`pid` + `Date.now` + counter) so
 * parallel or repeated runs never collide on a stale socket file.
 *
 * @internal
 */
import {run} from "mitata"
import type {IGatewayClientOptions} from "../src/types/gateway-client"
import {WorkerThreadGatewayClient} from "../src/gateway-client"
import {WorkerThreadGatewayServer} from "../src/gateway-server"
import type {WorkerThreadLaunch} from "../src/launch"
import {WorkerThreadPool} from "../src/pool"
import {withTimeout} from "../test/helpers"
import {EchoJob, type EchoWorker} from "./fixtures/echo-worker"

let socketCounter = 0

export function benchSize(fallback: number): number {
  return Number(process.env.BENCH_N ?? fallback)
}

export function uniqueSocketPath(prefix = `wt-bench`): string {
  socketCounter += 1
  return `${prefix}-${process.pid}-${Date.now()}-${socketCounter}`
}

/** Small JSON object shared by the rpc vs gateway round-trip files (like-for-like). */
export const SMALL_PAYLOAD = {id: 1, name: `bench`, score: 42, tags: [`a`, `b`]}

export async function spawnEchoWorker(): Promise<WorkerThreadLaunch> {
  const worker = await withTimeout(EchoJob.launchWorker(), 10_000, `echo worker ready`)
  await withTimeout(worker.request(`mtdPing`, []), 10_000, `echo worker prime`)
  return worker as unknown as WorkerThreadLaunch
}

export async function spawnGatewayPair(options: IGatewayClientOptions = {}): Promise<{server: WorkerThreadGatewayServer; client: WorkerThreadGatewayClient; path: string}> {
  const path = uniqueSocketPath()
  const server = new WorkerThreadGatewayServer()
  const client = new WorkerThreadGatewayClient()
  await withTimeout(server.start(path, {echo: (payload: unknown) => payload, ping: () => `pong`}), 10_000, `gateway server start`)
  await withTimeout(client.connect(path, options), 10_000, `gateway client connect`)
  await withTimeout(client.request(`ping`, []), 10_000, `gateway prime`)
  return {server, client, path}
}

export async function makePool(n: number): Promise<{pool: WorkerThreadPool<EchoWorker>; workers: WorkerThreadLaunch[]}> {
  const workers = (await Promise.all(Array.from({length: n}, () => withTimeout(EchoJob.launchWorker(), 10_000, `pool worker ready`)))) as unknown as WorkerThreadLaunch[]
  return {pool: new WorkerThreadPool<EchoWorker>(workers), workers}
}

export function runBench(): Promise<unknown> {
  const filter = process.env.BENCH_FILTER
  return filter ? run({filter: new RegExp(filter)}) : run()
}
