/**
 * Fixture worker whose onBeforeExit hook never resolves.
 */
import {WorkerThreadInit} from "../../src/init"

export class HangShutdownWorker extends WorkerThreadInit {
  async onBeforeExit() {
    return new Promise<void>(() => {})
  }
}

new HangShutdownWorker()
