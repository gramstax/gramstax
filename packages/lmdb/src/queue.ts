import type {LmdbEnv} from "./env"
import type {IColumnBuilder, KeyOf, ValueOf} from "./schema"
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
  /**
   * Counter sub-DB name shared by every queue in the env.
   *
   * @internal
   */
  static db = `__queue_meta`
  /**
   * Counter keys (`__queue_seq_<dbName>`) are strings.
   *
   * @internal
   */
  static key = t.string()
  /**
   * Counter values are plain numbers.
   *
   * @internal
   */
  static value = t.number()
}

/**
 * Schema class constraint for {@link LmdbQueue} — a structural check, not a base class.
 *
 * @remarks
 * The queue generates zero-padded string ids, so the key must be string-kind:
 * plain `t.string()` or a string enum (`t.string('a', 'b')`, `t.enum('a', 'b')`)
 * — both satisfy `ColumnBuilder<'string'>` since literals ride the `V` generic.
 * Pass your own schema class; do not extend this type. The one `as KeyOf<S>`
 * per method bridges the generated `string` id to the generic key.
 *
 * @public
 */
export type IQueueSchema = typeof LmdbSchema & {key: IColumnBuilder<`string`>}

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
export class LmdbQueue<S extends IQueueSchema> {
  /**
   * Queue (sub-DB) name, taken from the schema's `static db`.
   *
   * @internal
   */
  private readonly dbName: string
  /**
   * Handle to the shared `__queue_meta` counter sub-DB.
   *
   * @internal
   */
  private readonly meta: LmdbEnvSub<typeof QueueMetaSchema>
  /**
   * Handle to this queue's payload sub-DB.
   *
   * @internal
   */
  private readonly sub: LmdbEnvSub<S>

  /**
   * Create a queue bound to a schema's sub-DB.
   *
   * @remarks
   * Registration is idempotent: constructing a second queue with the same
   * schema reuses the already-created sub instead of throwing.
   *
   * @param env - Owning env (must stay open for the queue's lifetime).
   * @param schema - Payload schema class; its `static db` is the queue name
   * and its key must be string-kind.
   *
   * @public
   */
  constructor(
    private readonly env: LmdbEnv,
    schema: S
  ) {
    this.dbName = schema.db
    // register is idempotent-safe via isRegistered: a second LmdbQueue with
    // the same schema reuses the already-created sub instead of
    // throwing LmdbError.
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
   *
   * @public
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
   *
   * @remarks
   * Synchronous — reads through a cursor plus a point `get`, like
   * {@link LmdbQueue.dequeue} minus the delete. Never held a write lock.
   *
   * @returns The head `[id, job]`, or `undefined` when empty.
   *
   * @public
   */
  peek(): [string, ValueOf<S>] | undefined {
    for (const key of this.sub.getKeys({limit: 1})) {
      const id = key as string
      const job = this.sub.get(id as KeyOf<S>)
      if (job === undefined) return undefined
      return [id, job] as [string, ValueOf<S>]
    }
    return undefined
  }

  /**
   * Dequeue the head atomically (read + delete in one synchronous transaction).
   *
   * @remarks
   * The first key is read through a synchronous cursor (`getKeys({limit: 1})`)
   * so the write transaction is never held open across a microtask by an
   * async `first()` materialization.
   *
   * @returns The dequeued `[id, job]`, or `undefined` when empty.
   *
   * @public
   */
  async dequeue(): Promise<[string, ValueOf<S>] | undefined> {
    return this.env.rootTransactionSync(() => {
      for (const key of this.sub.getKeys({limit: 1})) {
        const id = key as KeyOf<S>
        const job = this.sub.get(id)
        if (job === undefined) return undefined
        this.sub.removeSync(id)
        return [id as string, job] as [string, ValueOf<S>]
      }
      return undefined
    })
  }

  /**
   * Number of jobs currently queued.
   *
   * @remarks
   * Synchronous — `count()` is an O(1) stat read.
   *
   * @returns Number of jobs currently queued.
   *
   * @public
   */
  size(): number {
    return this.sub.count()
  }

  /**
   * Drain the queue.
   *
   * @public
   */
  async clear(): Promise<void> {
    await this.sub.clear()
  }
}
