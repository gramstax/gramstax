import {WorkerServer} from "./worker-server"
import {WorkerClient} from "./worker-client"

async function main() {
  console.log(`--- STARTING WORKER THREAD CLUSTER ---`)

  // 1. Launch Server
  await WorkerServer.launchWorker([`Main-Server`])

  // // 2. Start Gateway
  await WorkerServer.mtdStart()

  // // 3. Launch Multiple Clients (Sequentially)
  await WorkerClient.launchWorker([`Client-A`])

  console.log(`(${process.pid}) Cluster launched successfully.`)
}

main().catch(console.error)
setInterval(() => {}, 60000)
