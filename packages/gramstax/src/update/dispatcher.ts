import type {Update} from "grammy/types"
import type {IUpdateDispatcherOptions, IUpdateDispatchStopResult} from "~/types/bot"
import {UpdateGate} from "./gate"
import {resolveGateKey} from "./gate-key"

/**
 * Worker pool that drains a bounded queue through a per-key gate.
 *
 * @remarks
 * Replaces the fire-and-forget loop in `Gramstax._startWebhookWorker`. Unlike
 * that loop it stores its worker promises so `stop()` can join them, wraps the
 * whole iteration in `try/catch` so one throw cannot silently shrink the pool,
 * and reports the residual count instead of abandoning updates without a trace.
 *
 * @public
 */
export class UpdateDispatcher {
  private readonly _gate: UpdateGate
  private readonly _workers: Array<Promise<void>> = []
  private _started = false
  private _stopping: Promise<IUpdateDispatchStopResult> | undefined

  constructor(private readonly _options: IUpdateDispatcherOptions) {
    this._gate = new UpdateGate({
      perChatConcurrency: _options.perChatConcurrency,
      waiterTimeoutMs: _options.waiterTimeoutMs,
      onTimeout: _options.onWaiterTimeout
    })
  }

  /** Free slots in the queue — feed this back as the fetch `limit`. @public */
  capacity(): number {
    return this._options.queue.capacity()
  }

  /** Live gate stats for metrics. @public */
  stats(): {activeKeys: number; waiting: number} {
    return this._gate.stats()
  }

  /** Start the worker loops. @public */
  start(): void {
    if (this._started) return
    this._started = true
    for (let index = 0; index < this._options.workerCount; index++) {
      this._workers.push(this._run())
    }
  }

  /**
   * Stop fetching, wake parked waiters, and join in-flight handlers.
   *
   * @remarks
   * Idempotent. Never rejects — a drain timeout is reported, not thrown.
   *
   * @public
   */
  async stop(): Promise<IUpdateDispatchStopResult> {
    if (this._stopping !== undefined) return this._stopping
    this._stopping = this._doStop()
    return this._stopping
  }

  private async _doStop(): Promise<IUpdateDispatchStopResult> {
    this._gate.releaseAll()
    this._options.queue.close()

    const settled = await Promise.race([
      Promise.allSettled(this._workers).then(() => true),
      new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), this._options.drainTimeoutMs)
        timer.unref?.()
      })
    ])

    const residual = this._options.queue.length
    return {timedOut: settled !== true, residual: settled === true ? 0 : residual}
  }

  private async _run(): Promise<void> {
    const {queue, handle, onError} = this._options
    while (true) {
      let update: Update | undefined
      try {
        update = await queue.dequeue()
        if (update === undefined) return

        const release = await this._gate.acquire(resolveGateKey(update))
        try {
          await handle(update)
        } finally {
          release()
        }
      } catch (error) {
        // Never let a throw escape: it would end this worker for good and the
        // pool would shrink silently. The old loop had `dequeue` outside the
        // try, which is exactly how that happened.
        if (update === undefined) return
        onError(error, update)
      }
    }
  }
}