/**
 * Fixture worker for lifecycle tests — instantiated at module load so the
 * worker signals ready as soon as it boots.
 */
import {WorkerThreadInit} from "../../src/init"

export class LifecycleWorker extends WorkerThreadInit {
  beforeExitRan = false

  mtdAdd(a: number, b: number) {
    return a + b
  }

  mtdHang() {
    return new Promise(() => {})
  }

  async onBeforeExit() {
    await new Promise((resolve) => setTimeout(resolve, 150))
    this.beforeExitRan = true
  }
}

new LifecycleWorker()
