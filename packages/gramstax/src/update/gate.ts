import type {IUpdateGateOptions} from "~/types/bot"

/**
 * Per-key concurrency gate.
 *
 * @remarks
 * Extracted verbatim from the closure that used to live inside
 * `Gramstax._runWebhook`, then generalized from "chat id" to "gate key" so
 * polling and webhook share one implementation. Same-key updates serialize;
 * different keys run concurrently. Entries are removed as soon as their last
 * holder releases, so the maps do not grow with key cardinality.
 *
 * @public
 */
export class UpdateGate {
  private readonly _active = new Map<string, number>()
  private readonly _waiting = new Map<string, Array<(bypass?: boolean) => void>>()

  constructor(private readonly _options: IUpdateGateOptions) {}

  /**
   * Acquire the gate for `key`, returning a release function.
   *
   * @remarks
   * Resolves immediately (with a no-op release) when gating is disabled or
   * `key` is `undefined`. Otherwise parks FIFO until the key has a free slot.
   *
   * @public
   */
  async acquire(key: string | undefined): Promise<() => void> {
    const {perChatConcurrency, waiterTimeoutMs, onTimeout} = this._options
    if (perChatConcurrency <= 0 || key === undefined) {
      return () => {}
    }

    while (true) {
      const current = this._active.get(key) ?? 0
      if (current < perChatConcurrency) {
        this._active.set(key, current + 1)
        let released = false
        return () => {
          if (released) return
          released = true
          this._release(key)
        }
      }

      const bypassed = await new Promise<boolean>((resolve) => {
        const waiters = this._waiting.get(key) ?? []
        let settled = false
        let timer: ReturnType<typeof setTimeout> | undefined
        const done = (bypass = false): void => {
          if (settled) return
          settled = true
          if (timer !== undefined) clearTimeout(timer)
          const idx = waiters.indexOf(done)
          if (idx >= 0) waiters.splice(idx, 1)
          if (waiters.length === 0) this._waiting.delete(key)
          resolve(bypass)
        }
        waiters.push(done)
        this._waiting.set(key, waiters)
        timer = setTimeout(() => done(true), waiterTimeoutMs)
        timer.unref?.()
      })

      // Proceeding ungated is better than blocking that key forever.
      if (bypassed) {
        onTimeout?.(key)
        return () => {}
      }
    }
  }

  /** Current holder count for `key`. @public */
  activeCount(key: string): number {
    return this._active.get(key) ?? 0
  }

  /** Live gate stats for metrics. @public */
  stats(): {activeKeys: number; waiting: number} {
    let waiting = 0
    for (const list of this._waiting.values()) waiting += list.length
    return {activeKeys: this._active.size, waiting}
  }

  /** Wake every waiter so shutdown cannot hang on a parked gate. @public */
  releaseAll(): void {
    for (const [key, waiters] of this._waiting) {
      for (const waiter of [...waiters]) waiter(true)
      this._waiting.delete(key)
    }
    this._active.clear()
  }

  private _release(key: string): void {
    const next = Math.max(0, (this._active.get(key) ?? 0) - 1)
    if (next === 0) {
      this._active.delete(key)
    } else {
      this._active.set(key, next)
    }
    const waiters = this._waiting.get(key)
    if (waiters !== undefined && waiters.length > 0) {
      waiters.shift()?.(false)
    }
  }
}