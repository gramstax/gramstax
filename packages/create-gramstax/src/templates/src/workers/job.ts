import {WorkerThreadExport, WorkerThreadInit} from "@gramstax/worker-thread"
import {LogHe} from "~/helpers/log"

/**
 * Background executor.
 *
 * Scheduling deliberately does NOT live in this class. A worker thread dies with
 * the process, so a `setInterval` in here silently loses its cadence on every
 * restart. The main thread owns the cron schedule — restart-safe, because the
 * run-stamp lives in the database — and calls an `mtd*` method when a job comes
 * due. That also keeps this file free of any storage dependency.
 *
 * `mtd*` methods are the RPC surface reachable from the main thread. Release
 * per-thread resources in `onBeforeExit()`.
 */
export class Worker extends WorkerThreadInit {
  /** Health check — proves the thread is alive and reports which one it is. */
  async mtdPing() {
    return {ok: true, threadId: this.id}
  }

  /**
   * CPU-bound aggregation, run off the main thread.
   *
   * This is the shape of work worth moving: sorting and summing a large input
   * would stall every Telegram update if it ran inline. Throwing propagates to
   * the caller's `await`, so a failed job is visible instead of silent.
   */
  async mtdSummarize(input: {label: string; amount: number}[]) {
    const ranked = [...input].sort((a, b) => b.amount - a.amount)
    const total = ranked.reduce((sum, row) => sum + row.amount, 0)
    return {
      count: ranked.length,
      total,
      top: ranked[0] ?? null,
      average: ranked.length === 0 ? 0 : total / ranked.length
    }
  }

  /** Last-resort handler for failures outside an awaited call. */
  onError(err: unknown) {
    LogHe.errorMake(err, `Worker`, `thread-${this.id}`)
  }
}

/**
 * The worker thread.
 *
 * This export is both the typed RPC surface and the lifecycle handle — the main
 * thread calls `JobWorker.launchWorker()` to start, `JobWorker.shutdown(ms)` to
 * stop, and `JobWorker.mtdPing()` to reach an `mtd*` method. Nothing needs to
 * keep the handle itself; `shutdown()` drains every live worker it launched.
 *
 * `shutdown()` throws when no worker was ever launched, so guard it.
 *
 * @internal
 */
export const JobWorker = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker
})
