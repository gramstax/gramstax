/**
 * Reconnect-storm benchmark — time-to-recover per kill/restart cycle.
 *
 * Each measured iteration kills the worker hosting the gateway server,
 * relaunches it on the SAME socket path (stale file unlinked
 * best-effort), and polls a reconnecting client hammering `ping` until
 * it answers — the elapsed wall-clock is the time-to-recover. Matches
 * the at-least-once retry/reconnect semantics in the README reliability
 * section (in-flight requests replay across reconnects; no cross-request
 * ordering is assumed here — one ping at a time).
 *
 * Run: bun run packages/worker-thread/bench/reconnect-storm.bench.ts
 *
 * @internal
 */
import {unlink} from "node:fs/promises"
import {bench, do_not_optimize, group} from "mitata"
import {WorkerThreadGatewayClient} from "../src/gateway-client"
import {normalizeGatewayPath} from "../src/gateway-path"
import type {WorkerThreadLaunch} from "../src/launch"
import {sleep, withTimeout} from "../test/helpers"
import {uniqueSocketPath} from "./_setup"
import {runBench} from "./_setup"
import {GatewayEchoJob} from "./fixtures/gateway-echo-worker"

async function unlinkStaleSocket(path: string): Promise<void> {
  const resolved = normalizeGatewayPath(path)
  if (process.platform === `win32` || resolved.startsWith(`\\\\.\\pipe\\`)) return
  await unlink(resolved).catch(() => {})
}

async function restartCycle(
  worker: WorkerThreadLaunch,
  oldClient: WorkerThreadGatewayClient
): Promise<{client: WorkerThreadGatewayClient; path: string; elapsed: number}> {
  await withTimeout(worker.request(`mtdStopGateway`, []), 10_000, `storm gateway stop`)
  await oldClient.close().catch(() => {})
  const path = uniqueSocketPath(`wt-storm`)
  await withTimeout(worker.request(`mtdStartGateway`, [path]), 10_000, `storm gateway restart`)
  const client = new WorkerThreadGatewayClient()
  await withTimeout(client.connect(path, {reconnect: true, retries: 200, maxRetryTime: 200}), 10_000, `storm client connect`)
  const start = Date.now()
  await withTimeout(
    (async () => {
      for (let i = 0; i < 150; i++) {
        try {
          if ((await client.request(`ping`, [])) === `pong`) return
        } catch {
          // not ready yet — keep hammering
        }
        await sleep(100)
      }
      throw new Error(`client did not recover after server restart`)
    })(),
    20_000,
    `storm reconnect recovery`
  )
  return {client, path, elapsed: Date.now() - start}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  let path = uniqueSocketPath(`wt-storm`)
  const worker = (await withTimeout(
    GatewayEchoJob.launchWorker(),
    10_000,
    `storm worker ready`
  )) as unknown as WorkerThreadLaunch
  await withTimeout(worker.request(`mtdStartGateway`, [path]), 10_000, `storm gateway start`)

  const client0 = new WorkerThreadGatewayClient()
  await withTimeout(client0.connect(path, {reconnect: true, retries: 200, maxRetryTime: 200}), 10_000, `storm client connect`)
  await withTimeout(client0.request(`ping`, []), 10_000, `storm prime`)
  let client = client0
  console.log(`Storm pair ready.\n`)

  group(`Gateway / reconnect-storm`, () => {
    bench(`kill + restart + recover (1 cycle)`, async () => {
      const next = await restartCycle(worker, client)
      client = next.client
      path = next.path
      do_not_optimize(next.elapsed)
    })
  })

  try {
    await runBench()
  } finally {
    await withTimeout(client.close(), 10_000, `storm client close`).catch(() => {})
    await withTimeout(worker.request(`mtdStopGateway`, []), 10_000, `storm gateway stop`).catch(() => {})
    await withTimeout(worker.kill(), 10_000, `storm worker kill`).catch(() => {})
    await unlinkStaleSocket(path)
    console.log(`\nDone.`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
