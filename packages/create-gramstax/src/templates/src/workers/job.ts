import {WorkerThreadExport, WorkerThreadInit} from "@gramstax/worker-thread"

export class Worker extends WorkerThreadInit {
  _timer: ReturnType<typeof setInterval> | null = null

  async mtdStart(intervalMs = 60_000) {
    if (this._timer) return `already running`
    this._timer = setInterval(() => {
      if (this._timer !== null) {
        this._tick()
      }
    }, intervalMs)
    return `started every ${intervalMs}ms`
  }

  async mtdStop() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
    return `stopped`
  }

  async mtdPing() {
    return {ok: true, threadId: this.id}
  }

  async _tick() {
    try {
      // background work goes here (sweep expired rows, refresh caches, ...)
    } catch {
      // intentionally swallowed: a failing tick must never kill the interval
    }
  }

  async onBeforeExit() {
    await this.mtdStop()
  }
}

export const JobWorker = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker
})

// Main-thread usage (e.g. in src/index.ts after boot):
//   const worker = await JobWorker.launchWorker()
//   await worker.ready()
//   await JobWorker.mtdStart(60_000)
//   // ...on SIGINT/SIGTERM:
//   await worker.shutdown(1_000)
