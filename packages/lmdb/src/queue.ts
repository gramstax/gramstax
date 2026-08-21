/**
 * LmdbQueue — FIFO queue over LMDB with single-writer transaction dequeue.
 *
 * @remarks
 * Backed by a dedicated sub-DB per queue name. Enqueue generates a monotonic
 * sequence id (zero-padded) via a root-DB counter so FIFO order is preserved
 * even across processes. Dequeue reads the first key and deletes it in one
 * writer transaction. At-least-once semantics — a crash between read and
 * delete may redeliver.
 *
 * @packageDocumentation
 * @public
 */

import type {LmdbEnv} from "./env"
import {LmdbRepository} from "./repository"

class QueueMetaRepo extends LmdbRepository<number, string> {
  static dbName = `__queue_meta`
}

/**
 * FIFO queue.
 *
 * @typeParam T - Payload type.
 *
 * @public
 */
export class LmdbQueue<T> {
  private readonly repo: LmdbRepository<T, string>
  private readonly metaRepo: LmdbRepository<number, string>
  private readonly dbName: string

  constructor(
    private readonly env: LmdbEnv,
    dbName: string
  ) {
    this.dbName = dbName
    // Dynamic sub-DB per queue name — create a fresh class per instance so
    // multiple queues in the same env don't collide on static dbName.
    const Store = class extends LmdbRepository<T, string> {
      static dbName = dbName
    } as unknown as typeof LmdbRepository<T, string>
    this.repo = env.register(Store as never) as unknown as LmdbRepository<T, string>

    // Shared meta DB for sequence counters (one DB for all queues).
    try {
      this.metaRepo = env.get(QueueMetaRepo as never) as unknown as LmdbRepository<number, string>
    } catch {
      this.metaRepo = env.register(QueueMetaRepo as never) as unknown as LmdbRepository<number, string>
    }
  }

  private async nextSeq(): Promise<number> {
    const key = `__queue_seq_${this.dbName}`
    // Use the meta repo's transaction to bump atomically.
    return this.env.transaction(() => {
      const cur = this.metaRepo.get(key) ?? 0
      const next = cur + 1
      void this.metaRepo.set(key, next)
      return next
    })
  }

  /**
   * Enqueue a job.
   *
   * @param job - Payload to store.
   * @returns The generated id (zero-padded sequence).
   */
  async enqueue(job: T): Promise<string> {
    const seq = await this.nextSeq()
    const id = String(seq).padStart(12, `0`)
    await this.repo.set(id, job)
    return id
  }

  /**
   * Peek at the head without removing.
   */
  async peek(): Promise<[string, T] | undefined> {
    return this.repo.first() as Promise<[string, T] | undefined>
  }

  /**
   * Dequeue the head atomically (read + delete in one writer transaction).
   */
  async dequeue(): Promise<[string, T] | undefined> {
    return this.env.transaction(async () => {
      const entry = (await this.repo.first()) as [string, T] | undefined
      if (!entry) return undefined
      const [id] = entry
      await this.repo.delete(id)
      return entry
    })
  }

  /**
   * Number of jobs currently queued.
   */
  async size(): Promise<number> {
    return this.repo.count()
  }

  /**
   * Drain the queue.
   */
  async clear(): Promise<void> {
    await this.repo.clear()
  }
}
