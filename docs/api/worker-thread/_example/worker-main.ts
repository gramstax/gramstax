import {WorkerServerExp} from "./worker-server"
import {WorkerClientExp} from "./worker-client"

async function main() {
  console.log(`--- STARTING WORKER THREAD CLUSTER ---`)

  // 1. Launch Server
  await WorkerServerExp.launchWorker([`Main-Server`])

  // // 2. Start Gateway
  await WorkerServerExp.mtdStart()

  // // 3. Launch Multiple Clients (Sequentially)
  await WorkerClientExp.launchWorker([`Client-A`])

  console.log(`(${process.pid}) Cluster launched successfully.`)
}

main().catch(console.error)
setInterval(() => {}, 60000)
