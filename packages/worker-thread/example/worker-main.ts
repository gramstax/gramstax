import {WorkerThreadPool} from "../src/pool"
import {WorkerClient} from "./worker-client"
import {WorkerServer} from "./worker-server"

/**
 * Main thread orchestration.
 *
 * Demonstrates: lifecycle events, authenticated gateway startup, a worker
 * pool with round-robin dispatch, RPC timeouts, and graceful shutdown.
 */
async function main() {
  console.log(`--- STARTING WORKER THREAD CLUSTER ---`)

  // 1. Launch the gateway server worker and subscribe to its lifecycle.
  const server = await WorkerServer.launchWorker([`Main-Server`])
  server.on(`ready`, () => console.log(`[Main] server worker ready (thread ${server.threadId})`))
  server.on(`exit`, (code) => console.log(`[Main] server worker exited with code ${code}`))

  // 2. Start the authenticated gateway inside the server worker.
  await WorkerServer.mtdStart()

  // 3. Launch three client workers and register them in a pool.
  const clients = await Promise.all([`Client-A`, `Client-B`, `Client-C`].map((name) => WorkerClient.launchWorker([name])))
  const pool = new WorkerThreadPool(clients)
  console.log(`[Main] pool ready with ${pool.threadCount} workers`)

  // 4. Dispatch compute tasks round-robin across the pool.
  const results = await Promise.all([1, 2, 3, 4].map((n) => pool.execute(`mtdCompute`, [n])))
  console.log(`[Main] pool results:`, results)

  // 5. RPC timeout: the task needs 2s but we only wait 500ms.
  try {
    await server.request(`mtdSlowTask`, [2000], true, undefined, 500)
  } catch (err) {
    console.log(`[Main] slow task timed out as expected: ${(err as Error).message}`)
  }

  // 6. Graceful shutdown — the server worker drains its onBeforeExit hook first.
  await server.shutdown(5000)
  await Promise.all(clients.map((client) => client.shutdown(5000)))
  console.log(`(${process.pid}) Cluster shut down gracefully.`)
  process.exit(0) // Bun keeps worker handles alive — exit explicitly in CLI scripts
}

main().catch(console.error)
