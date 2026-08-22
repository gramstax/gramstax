/**
 * LmdbQueue — FIFO queue over LMDB with single-writer transaction dequeue.
 *
 * @remarks
 * Backed by a dedicated sub-DB per queue name. Enqueue bumps a monotonic
 * sequence counter (root-DB meta sub-DB) and stores the payload in ONE
 * synchronous transaction (v2 — previously the counter bump and the
 * payload put were separate commits), so the zero-padded id and the
 * payload are always visible atomically, FIFO order preserved even across
 * processes. Dequeue reads the first key via a synchronous cursor and
 * deletes it in ONE synchronous transaction — no async `first()` holding
 * the write lock open across a microtask. At-least-once semantics — a
 * crash between read and delete may redeliver.
 *
 * @packageDocumentation
 * @public
 */

import type {LmdbEnv} from "./env"
import {LmdbRepository} from "./repository"

class QueueMetaRepo extends LmdbRepository<number, string> {
  static dbName = `__queue_meta`
}

// One shared Store class per dbName so a second LmdbQueue with the same
// dbName reuses the already-registered repo instead of throwing
// LmdbDuplicateDbNameError (idempotent construction).
const queueStores = new Map<string, typeof LmdbRepository>()

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
    // Dynamic sub-DB per queue name — reuse one shared class per dbName so
    // multiple queues in the same env (or same dbName twice) don't collide
    // on static dbName / don't throw LmdbDuplicateDbNameError.
    let Store = queueStores.get(dbName)
    if (!Store) {
      Store = class extends LmdbRepository<T, string> {
        static dbName = dbName
      } as unknown as typeof LmdbRepository
      queueStores.set(dbName, Store)
    }
    try {
      this.repo = env.get(Store as never) as unknown as LmdbRepository<T, string>
    } catch {
      this.repo = env.register(Store as never) as unknown as LmdbRepository<T, string>
    }

    // Shared meta DB for sequence counters (one DB for all queues).
    try {
      this.metaRepo = env.get(QueueMetaRepo as never) as unknown as LmdbRepository<number, string>
    } catch {
      this.metaRepo = env.register(QueueMetaRepo as never) as unknown as LmdbRepository<number, string>
    }
  }

  /**
   * Enqueue a job.
   *
   * @remarks
   * Counter bump + payload write happen in ONE synchronous transaction
   * (v2) — the generated id and the stored payload commit together.
   *
   * @param job - Payload to store.
   * @returns The generated id (zero-padded sequence).
   */
  async enqueue(job: T): Promise<string> {
    return this.env.transactionSync(() => {
      const key = `__queue_seq_${this.dbName}`
      const cur = this.metaRepo.get(key) ?? 0
      const next = cur + 1
      this.metaRepo.env.putSync(key, next)
      const id = String(next).padStart(12, `0`)
      this.repo.env.putSync(id, job)
      return id
    })
  }

  /**
   * Peek at the head without removing.
   */
  async peek(): Promise<[string, T] | undefined> {
    return this.repo.first() as Promise<[string, T] | undefined>
  }

  /**
   * Dequeue the head atomically (read + delete in one synchronous transaction).
   *
   * @remarks
   * The first key is read through a synchronous cursor (`getKeys({limit: 1})`)
   * so the write transaction is never held open across a microtask by an
   * async `first()` materialization.
   */
  async dequeue(): Promise<[string, T] | undefined> {
    return this.env.transactionSync(() => {
      for (const key of this.repo.env.getKeys({limit: 1})) {
        const id = key as string
        const job = this.repo.get(id)
        if (job === undefined) return undefined
        this.repo.env.removeSync(id)
        return [id, job] as [string, T]
      }
      return undefined
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
