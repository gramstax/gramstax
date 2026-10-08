/**
 * Update queue — in-memory bounded FIFO for sequential processing.
 *
 * @remarks
 * Provides a bounded FIFO queue for Telegram updates, ensuring they are
 * processed sequentially. Shared by both deploy modes: webhook/serverless
 * enqueue from HTTP requests, polling enqueues from the `getUpdates` loop.
 * Useful for long-polling fallback or rate-limited processing.
 *
 * @typeParam T - Queue item type.
 *
 * @public
 */
export class UpdateQueue<T = unknown> {
  /**
   * Fixed-size ring-buffer storage for buffered items, sized by `maxSize`.
   *
   * Empty slots hold `undefined`; the constructor allocates all slots up front.
   *
   * @internal
   */
  _items: Array<T | undefined>
  /**
   * Read cursor into `_items`: index of the next slot `dequeue()` consumes.
   *
   * Advances modulo `maxSize` so the buffer wraps as a ring.
   *
   * @internal
   */
  _head = 0
  /**
   * Write cursor into `_items`: index of the next slot `enqueue()` fills.
   *
   * Advances modulo `maxSize` so the buffer wraps as a ring.
   *
   * @internal
   */
  _tail = 0
  /**
   * Cached number of buffered items backing `length` and `getStats()`.
   *
   * The queue is full when this reaches `maxSize` and empty at `0`.
   *
   * @internal
   */
  _lengthCount = 0
  /**
   * FIFO of producers blocked in `enqueue()` while the queue is full.
   *
   * @remarks
   * Each entry carries `resolve`/`reject` so one waiter is woken per
   * `dequeue()` via `shift()` plus `resolve()`, all waiters are failed by
   * `close()`, and an aborted `enqueue()` splices its own entry out.
   *
   * @internal
   */
  _waitEnqueue: Array<{resolve: () => void; reject: (error: Error) => void}> = []
  /**
   * FIFO of consumers blocked in `dequeue()` while the queue is empty.
   *
   * @remarks
   * Woken by direct handoff: `enqueue()` and `tryEnqueue()` resolve the
   * shifted waiter with the value without touching `_items`, while `close()`
   * resolves every waiter with the `undefined` sentinel instead.
   *
   * @internal
   */
  _waitDequeue: Array<(value: T) => void> = []
  /**
   * Whether `close()` has been called.
   *
   * @remarks
   * Latched once and never reset: `enqueue()` throws after close while
   * `dequeue()` drains remaining items and then resolves `undefined`.
   *
   * @internal
   */
  _closed = false

  /**
   * Create a new queue with a maximum size.
   *
   * @param maxSize - Maximum number of items allowed in the queue.
   * @throws Error if maxSize is not a positive number.
   * @public
   */
  constructor(private maxSize: number) {
    if (!Number.isFinite(maxSize) || maxSize <= 0) {
      throw new Error(`WebhookQueue maxSize must be a positive number`)
    }
    this._items = new Array<T | undefined>(maxSize)
  }

  /**
   * Get current queue statistics.
   *
   * @returns Queue stats including length and waiters.
   * @public
   */
  getStats() {
    return {
      length: this._lengthCount,
      maxSize: this.maxSize,
      waitingEnqueue: this._waitEnqueue.length,
      waitingDequeue: this._waitDequeue.length
    }
  }

  /**
   * Number of free slots available right now.
   *
   * @remarks
   * Used as the `getUpdates` `limit` hint so fetch slows under load instead of
   * over-fetching into a full buffer. Saturates at 0; callers clamp to 1..100.
   * A closed queue reports 0 because it accepts nothing, however much room is
   * physically left in the buffer.
   *
   * @public
   */
  capacity(): number {
    if (this._closed) return 0
    return Math.max(0, this.maxSize - this._lengthCount)
  }

  /**
   * Get current queue length.
   *
   * @public
   */
  get length() {
    return this._lengthCount
  }

  /**
   * Enqueue a value, blocking when the queue is full.
   *
   * @param value - Value to enqueue.
   * @param signal - Optional AbortSignal to cancel a blocked enqueue.
   * @returns Promise resolved when enqueued.
   * @throws Error if the queue is closed or enqueue is aborted.
   * @public
   */
  async enqueue(value: T, signal?: AbortSignal) {
    if (this._closed) {
      throw new Error(`WebhookQueue is closed`)
    }

    if (this._lengthCount >= this.maxSize) {
      if (signal?.aborted) {
        throw new Error(`WebhookQueue enqueue aborted`)
      }
      let onAbort: (() => void) | undefined
      let settled = false
      try {
        await new Promise<void>((resolve, reject) => {
          const waiter = {resolve, reject}
          onAbort = () => {
            if (settled) return
            settled = true
            const idx = this._waitEnqueue.indexOf(waiter)
            if (idx >= 0) this._waitEnqueue.splice(idx, 1)
            reject(new Error(`WebhookQueue enqueue aborted`))
          }
          this._waitEnqueue.push(waiter)
          signal?.addEventListener(`abort`, onAbort, {once: true})
        })
        settled = true
      } finally {
        if (signal && onAbort) {
          signal.removeEventListener(`abort`, onAbort)
        }
      }
    }

    if (this._closed) {
      throw new Error(`WebhookQueue is closed`)
    }

    if (this._waitDequeue.length > 0) {
      const resolve = this._waitDequeue.shift()!
      resolve(value)
      return
    }

    this._items[this._tail] = value
    this._tail = (this._tail + 1) % this.maxSize
    this._lengthCount++
  }

  /**
   * Offer a value without blocking.
   *
   * @param value - Value to enqueue.
   * @returns `true` when the value was accepted (buffered or handed to a
   * waiting dequeuer), `false` when the queue is closed or full.
   * @public
   */
  tryEnqueue(value: T): boolean {
    if (this._closed) {
      return false
    }
    if (this._waitDequeue.length > 0) {
      const resolve = this._waitDequeue.shift()!
      resolve(value)
      return true
    }
    if (this._lengthCount >= this.maxSize) {
      return false
    }
    this._items[this._tail] = value
    this._tail = (this._tail + 1) % this.maxSize
    this._lengthCount++
    return true
  }

  /**
   * Dequeue a value, blocking when the queue is empty.
   *
   * @param signal - Optional AbortSignal to cancel a blocked dequeue.
   * @returns Promise resolved with the next value, or `undefined` when closed and empty.
   * @public
   */
  async dequeue(signal?: AbortSignal): Promise<T | undefined> {
    if (this._lengthCount > 0) {
      const value = this._items[this._head] as T
      this._items[this._head] = undefined
      this._head = (this._head + 1) % this.maxSize
      this._lengthCount--
      const waiter = this._waitEnqueue.shift()
      waiter?.resolve()
      return value
    }

    if (this._closed) {
      return undefined
    }

    if (signal?.aborted) {
      throw new Error(`WebhookQueue dequeue aborted`)
    }

    return await new Promise<T>((resolve, reject) => {
      let settled = false
      const waiter = (value: T) => {
        if (settled) {
          return
        }
        settled = true
        if (signal) {
          signal.removeEventListener(`abort`, onAbort)
        }
        resolve(value)
      }
      const onAbort = () => {
        if (settled) {
          return
        }
        settled = true
        const index = this._waitDequeue.indexOf(waiter)
        if (index >= 0) {
          this._waitDequeue.splice(index, 1)
        }
        reject(new Error(`WebhookQueue dequeue aborted`))
      }
      this._waitDequeue.push(waiter)
      signal?.addEventListener(`abort`, onAbort, {once: true})
    })
  }

  /**
   * Close the queue and release all waiting consumers and producers.
   *
   * @remarks
   * Workers waiting on `dequeue()` resolve with `undefined` (sentinel).
   * Enqueueing after close throws.
   *
   * @public
   */
  close(): void {
    if (this._closed) return
    this._closed = true
    const dequeuers = this._waitDequeue.splice(0)
    const enqueuers = this._waitEnqueue.splice(0)
    dequeuers.forEach((resolve) => {
      resolve(undefined as T)
    })
    enqueuers.forEach((waiter) => {
      waiter.reject(new Error(`WebhookQueue is closed`))
    })
  }

  /**
   * Whether the queue has been closed.
   *
   * @public
   */
  get isClosed(): boolean {
    return this._closed
  }
}

/**
 * Legacy alias for {@link UpdateQueue}.
 *
 * @remarks
 * The queue stopped being webhook-specific when polling adopted it, so the
 * class was renamed. The alias is the same object — not a subclass — so
 * `WebhookQueue === UpdateQueue` holds and `instanceof` works both ways.
 *
 * @deprecated Renamed to {@link UpdateQueue}. Kept as an alias for the public
 * barrel; will be removed in the next major version.
 * @public
 */
export const WebhookQueue = UpdateQueue
/**
 * Legacy type alias for {@link UpdateQueue}.
 *
 * @deprecated Renamed to {@link UpdateQueue}. Will be removed in the next
 * major version.
 * @public
 */
export type WebhookQueue<T = unknown> = UpdateQueue<T>
