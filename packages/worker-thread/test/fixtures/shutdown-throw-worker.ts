/**
 * Fixture worker whose onBeforeExit hook throws.
 */
import {WorkerThreadInit} from "../../src/init"

export class ThrowShutdownWorker extends WorkerThreadInit {
  async onBeforeExit() {
    throw new Error(`drain failed`)
  }
}

new ThrowShutdownWorker()
