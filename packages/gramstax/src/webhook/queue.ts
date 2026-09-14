/**
 * Webhook update queue — in-memory bounded FIFO for sequential processing.
 *
 * @remarks
 * Provides a bounded FIFO queue for Telegram webhook updates, ensuring
 * they are processed sequentially. Useful for long-polling fallback or
 * rate-limited webhook processing.
 *
 * @public
 */

/**
 * In-memory bounded queue for webhook updates.
 *
 * @typeParam T - Queue item type.
 * @public
 */
export class WebhookQueue<T = unknown> {
  private items: Array<T | undefined>
  private head = 0
  private tail = 0
  private lengthCount = 0
  private waitEnqueue: Array<{resolve: () => void; reject: (error: Error) => void}> = []
  private waitDequeue: Array<(value: T) => void> = []
  private closed = false

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
    this.items = new Array<T | undefined>(maxSize)
  }

  /**
   * Get current queue statistics.
   *
   * @returns Queue stats including length and waiters.
   * @public
   */
  getStats() {
    return {
      length: this.lengthCount,
      maxSize: this.maxSize,
      waitingEnqueue: this.waitEnqueue.length,
      waitingDequeue: this.waitDequeue.length
    }
  }

  /**
   * Get current queue length.
   *
   * @public
   */
  get length() {
    return this.lengthCount
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
    if (this.closed) {
      throw new Error(`WebhookQueue is closed`)
    }

    if (this.lengthCount >= this.maxSize) {
      if (signal?.aborted) {
        throw new Error(`WebhookQueue enqueue aborted`)
      }
      let onAbort: (() => void) | undefined
      try {
        await new Promise<void>((resolve, reject) => {
          const waiter = {resolve, reject}
          onAbort = () => {
            const index = this.waitEnqueue.indexOf(waiter)
            if (index >= 0) {
              this.waitEnqueue.splice(index, 1)
            }
            reject(new Error(`WebhookQueue enqueue aborted`))
          }
          this.waitEnqueue.push(waiter)
          signal?.addEventListener(`abort`, onAbort, {once: true})
        })
      } finally {
        if (signal && onAbort) {
          signal.removeEventListener(`abort`, onAbort)
        }
      }
    }

    if (this.closed) {
      throw new Error(`WebhookQueue is closed`)
    }

    if (this.waitDequeue.length > 0) {
      const resolve = this.waitDequeue.shift()!
      resolve(value)
      return
    }

    this.items[this.tail] = value
    this.tail = (this.tail + 1) % this.maxSize
    this.lengthCount++
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
    if (this.closed) {
      return false
    }
    if (this.waitDequeue.length > 0) {
      const resolve = this.waitDequeue.shift()!
      resolve(value)
      return true
    }
    if (this.lengthCount >= this.maxSize) {
      return false
    }
    this.items[this.tail] = value
    this.tail = (this.tail + 1) % this.maxSize
    this.lengthCount++
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
    if (this.lengthCount > 0) {
      const value = this.items[this.head] as T
      this.items[this.head] = undefined
      this.head = (this.head + 1) % this.maxSize
      this.lengthCount--
      const waiter = this.waitEnqueue.shift()
      waiter?.resolve()
      return value
    }

    if (this.closed) {
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
        const index = this.waitDequeue.indexOf(waiter)
        if (index >= 0) {
          this.waitDequeue.splice(index, 1)
        }
        reject(new Error(`WebhookQueue dequeue aborted`))
      }
      this.waitDequeue.push(waiter)
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
    if (this.closed) return
    this.closed = true
    const dequeuers = this.waitDequeue.splice(0)
    const enqueuers = this.waitEnqueue.splice(0)
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
    return this.closed
  }
}
