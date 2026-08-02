/**
 * Fixture worker that crashes at runtime (after ready).
 */
import {WorkerThreadInit} from "../../src/init"

export class RuntimeCrashWorker extends WorkerThreadInit {
  mtdHang() {
    return new Promise(() => {})
  }
}

new RuntimeCrashWorker()
setTimeout(() => {
  throw new Error(`runtime boom`)
}, 200)
