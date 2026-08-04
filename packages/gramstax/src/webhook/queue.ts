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
  private waitEnqueue: Array<() => void> = []
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
      await new Promise<void>((resolve, reject) => {
        const waiter = () => resolve()
        this.waitEnqueue.push(waiter)
        signal?.addEventListener(
          `abort`,
          () => {
            const index = this.waitEnqueue.indexOf(waiter)
            if (index >= 0) {
              this.waitEnqueue.splice(index, 1)
            }
            reject(new Error(`WebhookQueue enqueue aborted`))
          },
          {once: true}
        )
      })
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
   * Dequeue a value, blocking when the queue is empty.
   *
   * @returns Promise resolved with the next value, or `undefined` when closed and empty.
   * @public
   */
  async dequeue(): Promise<T> {
    if (this.lengthCount > 0) {
      const value = this.items[this.head] as T
      this.items[this.head] = undefined
      this.head = (this.head + 1) % this.maxSize
      this.lengthCount--
      const resolve = this.waitEnqueue.shift()
      resolve?.()
      return value
    }

    if (this.closed) {
      return undefined as T
    }

    return await new Promise<T>((resolve) => this.waitDequeue.push(resolve))
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
    enqueuers.forEach((resolve) => {
      resolve()
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
