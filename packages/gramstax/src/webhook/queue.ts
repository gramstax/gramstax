/**
 * In-memory bounded queue for webhook updates.
 *
 * @typeParam T - Queue item type.
 * @public
 */
export class WebhookQueue<T = unknown> {
  private queue: T[] = []
  private waitEnqueue: Array<() => void> = []
  private waitDequeue: Array<(value: T) => void> = []

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
  }

  /**
   * Get current queue statistics.
   *
   * @returns Queue stats including length and waiters.
   * @public
   */
  getStats() {
    return {
      length: this.queue.length,
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
    return this.queue.length
  }

  /**
   * Enqueue a value, blocking when the queue is full.
   *
   * @param value - Value to enqueue.
   * @returns Promise resolved when enqueued.
   * @public
   */
  async enqueue(value: T) {
    if (this.queue.length >= this.maxSize) {
      await new Promise<void>((resolve) => this.waitEnqueue.push(resolve))
    }

    if (this.waitDequeue.length > 0) {
      const resolve = this.waitDequeue.shift()!
      resolve(value)
      return
    }

    this.queue.push(value)
  }

  /**
   * Dequeue a value, blocking when the queue is empty.
   *
   * @returns Promise resolved with the next value.
   * @public
   */
  async dequeue(): Promise<T> {
    if (this.queue.length > 0) {
      const value = this.queue.shift()!
      const resolve = this.waitEnqueue.shift()
      resolve?.()
      return value
    }

    return await new Promise<T>((resolve) => this.waitDequeue.push(resolve))
  }
}
