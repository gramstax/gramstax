import {WorkerThreadPool} from "../src/pool"
import {WorkerClient, type Worker} from "./worker-client"
import {WorkerServer} from "./worker-server"

async function main() {
  console.log(`--- DEBUG CLUSTER ---`)
  const server = await WorkerServer.launchWorker([`Main-Server`])
  server.on(`ready`, () => console.log(`[Main] server ready`))
  server.on(`exit`, (code) => console.log(`[Main] server exited code ${code}`))
  await WorkerServer.mtdStart()
  const clients = await Promise.all([`Client-A`, `Client-B`, `Client-C`].map((name) => WorkerClient.launchWorker([name])))
  const pool = new WorkerThreadPool(clients)
  console.log(`[Main] pool ready:`, pool.threadCount)
  await Promise.all([1, 2, 3].map((n) => pool.mtdCompute(n)))
  console.log(`[Main] compute done`)

  console.log(`[Main] >>> server.shutdown()`)
  await server.shutdown(5000)
  console.log(`[Main] <<< server.shutdown done`)

  for (let i = 0; i < clients.length; i++) {
    const c = clients[i]!
    c.on(`exit`, (code) => console.log(`[Main] client ${i} exited code ${code}`))
    console.log(`[Main] >>> client ${i} shutdown`)
    const t = Date.now()
    await c.shutdown(5000)
    console.log(`[Main] <<< client ${i} shutdown done in ${Date.now() - t}ms`)
  }
  console.log(`[Main] ALL DONE`)
}

main().catch((e) => { console.error(`[Main] error:`, e); process.exit(1) })
