import {ServerMainExp} from "./test-final-server-main"
import {WorkerAExp} from "./test-final-worker-a"
import {WorkerBExp} from "./test-final-worker-b"
import {WorkerCExp} from "./test-final-worker-c"

async function run() {
  console.log(`--- STARTING FINAL 1-SERVER / 3-CLIENTS TEST ---`)

  // Launch Server
  await ServerMainExp.launchWorker([`Server`])
  await ServerMainExp.mtdStart()
  await ServerMainExp.mtdHello(`From Main Thread`)

  // Launch Clients
  await WorkerAExp.launchWorker([`A`])
  await WorkerBExp.launchWorker([`B`])
  await WorkerCExp.launchWorker([`C`])

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
