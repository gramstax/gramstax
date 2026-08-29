import type {LmdbEnv} from "./env"
import type {ColumnBuilder, KeyOf, ValueOf} from "./schema"
import {LmdbSchema, t} from "./schema"
import type {LmdbEnvSub} from "./sub"

/**
 * Shared meta sub — monotonic sequence counters for every queue.
 *
 * @remarks
 * One sub-DB holds `__queue_seq_<dbName> → number` counters for all
 * queues in the env. Registered lazily on first queue construction.
 *
 * @internal
 */
class QueueMetaSchema extends LmdbSchema {
  static db = `__queue_meta`
  static key = t.string()
  static value = t.number()
}

/**
 * Schema class constraint for {@link LmdbQueue} — the queue key must be a
 * `t.string()` builder (queue ids are zero-padded sequence strings), so
 * `KeyOf<S>` resolves to `string` for the schema-typed sub calls.
 *
 * @public
 */
export type QueueSchema = typeof LmdbSchema & {key: ColumnBuilder<`string`>}

/**
 * FIFO queue over LMDB with single-writer transaction dequeue.
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
 * @typeParam S - Schema class describing the queue payload (its `static db`
 * is the queue name; its value shape is the payload row; its key must be
 * `t.string()`).
 *
 * @public
 */
export class LmdbQueue<S extends QueueSchema> {
  private readonly dbName: string
  private readonly meta: LmdbEnvSub<typeof QueueMetaSchema>
  private readonly sub: LmdbEnvSub<S>

  constructor(
    private readonly env: LmdbEnv,
    schema: S
  ) {
    this.dbName = schema.db
    // register is idempotent-safe via isRegistered: a second LmdbQueue with
    // the same schema reuses the already-created sub instead of
    // throwing LmdbDuplicateDbNameError.
    if (!env.isRegistered(schema)) env.register(schema)
    if (!env.isRegistered(QueueMetaSchema)) env.register(QueueMetaSchema)
    this.meta = env.sub(QueueMetaSchema)
    this.sub = env.sub(schema)
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
  async enqueue(job: ValueOf<S>): Promise<string> {
    return this.env.rootTransactionSync(() => {
      const key = `__queue_seq_${this.dbName}`
      const cur = this.meta.get(key) ?? 0
      const next = cur + 1
      this.meta.putSync(key, next)
      const id = String(next).padStart(12, `0`)
      this.sub.putSync(id as KeyOf<S>, job)
      return id
    })
  }

  /**
   * Peek at the head without removing.
   */
  async peek(): Promise<[string, ValueOf<S>] | undefined> {
    return (await this.sub.first()) as [string, ValueOf<S>] | undefined
  }

  /**
   * Dequeue the head atomically (read + delete in one synchronous transaction).
   *
   * @remarks
   * The first key is read through a synchronous cursor (`getKeys({limit: 1})`)
   * so the write transaction is never held open across a microtask by an
   * async `first()` materialization.
   */
  async dequeue(): Promise<[string, ValueOf<S>] | undefined> {
    return this.env.rootTransactionSync(() => {
      for (const key of this.sub.getKeys({limit: 1})) {
        const id = key as string
        const job = this.sub.get(id as KeyOf<S>)
        if (job === undefined) return undefined
        this.sub.removeSync(id as KeyOf<S>)
        return [id, job] as [string, ValueOf<S>]
      }
      return undefined
    })
  }

  /**
   * Number of jobs currently queued.
   */
  async size(): Promise<number> {
    return this.sub.count()
  }

  /**
   * Drain the queue.
   */
  async clear(): Promise<void> {
    await this.sub.clear()
  }
}
