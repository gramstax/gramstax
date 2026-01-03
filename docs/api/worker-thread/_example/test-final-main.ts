import {ServerMain} from "./test-final-server-main"
import {WorkerA} from "./test-final-worker-a"
import {WorkerB} from "./test-final-worker-b"
import {WorkerC} from "./test-final-worker-c"

async function run() {
  console.log(`--- STARTING FINAL 1-SERVER / 3-CLIENTS TEST ---`)

  // Launch Server
  await ServerMain.launchWorker([`Server`])
  await ServerMain.mtdStart()
  await ServerMain.mtdHello(`From Main Thread`)

  // Launch Clients
  await WorkerA.launchWorker([`A`])
  await WorkerB.launchWorker([`B`])
  await WorkerC.launchWorker([`C`])

  console.log(`All workers launched. Interaction is autonomous.`)

  // Keep alive to see all logs
  await new Promise((r) => setTimeout(r, 8000))
  console.log(`Final test complete. Exiting.`)
  process.exit(0)
}

run().catch((err) => {
  console.error(`Final Test Error:`, err)
  process.exit(1)
})
