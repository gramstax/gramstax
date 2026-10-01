import type {LmdbEnv} from "../env"
import {LmdbError} from "../errors"
import type {ICdcCallback, ICdcFilter, ICdcRecord, ICdcTailOptions} from "../types/cdc"
import type {ISubscription} from "../types/cdc-hub"
import type {CdcStore} from "./store"

/**
 * In-process subscriber hub (one per env, aftercommit-driven).
 *
 * @internal
 */
export class CdcHub {
  /**
   * Whether CDC capture is armed for this env.
   *
   * @remarks
   * Sticky once set: the first subscribe/tail/ack/prune call arms it (and
   * opens the two internal sub-DBs — size `maxDbs` accordingly). Writes
   * before arming are invisible to CDC, so touch a CDC API at boot before
   * producing. Envs that never touch CDC pay nothing.
   */
  active = false

  /**
   * Live subscriptions in registration order.
   *
   * @internal
   */
  private _subs: Array<ISubscription> = []

  /**
   * Last outbox sequence delivered to subscribers.
   *
   * @remarks
   * Set to the outbox high-water mark on `subscribe` (from-now semantics)
   * and advanced by every `drain`.
   *
   * @internal
   */
  private _cursor = 0

  /**
   * Whether the `aftercommit` listener is currently attached.
   *
   * @remarks
   * Attached on the first `subscribe`, detached when the last subscriber
   * leaves — envs with no live subscribers pay no per-commit cost.
   *
   * @internal
   */
  private _hooked = false

  /**
   * Commit hook that drains new outbox records to subscribers.
   *
   * @internal
   */
  private readonly _onCommit = (): void => {
    this.drain()
  }

  /**
   * Create a subscriber hub bound to one env and its outbox store.
   *
   * @param _env - The owning env (provides `aftercommit` hooks).
   * @param _store - The durable outbox store backing subscribe/tail/ack.
   * @internal
   */
  constructor(
    private readonly _env: LmdbEnv,
    private readonly _store: CdcStore
  ) {}

  /**
   * Normalize a subscribe filter to a db name plus optional op.
   *
   * @param filter - A sub-DB name, or `{db, op?}` with `op` one of
   * `put`, `delete`, `clear`.
   * @returns The parsed `{db, op}` pair (`op` is `undefined` for all kinds).
   * @throws {@link LmdbError} When the db name is empty or the shape/op
   * is invalid.
   */
  private static _parseFilter(filter: ICdcFilter): {db: string; op: `put` | `delete` | `clear` | undefined} {
    if (typeof filter === `string`) {
      if (filter.length === 0) throw new LmdbError(`subscribe filter db must not be empty`)
      return {db: filter, op: undefined}
    }
    if (filter !== null && typeof filter === `object`) {
      const {db, op} = filter as {db?: unknown; op?: unknown}
      if (typeof db === `string` && db.length > 0) {
        if (op !== undefined && op !== `put` && op !== `delete` && op !== `clear`) {
          throw new LmdbError(`subscribe filter op must be put, delete, or clear — received '${String(op)}'`)
        }
        return {db, op: op as `put` | `delete` | `clear` | undefined}
      }
    }
    throw new LmdbError(`subscribe filter must be a db name or {db, op?} — received '${String(filter)}'`)
  }

  /**
   * Arm capture for this env (idempotent).
   *
   * @remarks
   * Called by every public entry point — the first call opens the two
   * internal sub-DBs, so size `maxDbs` accordingly.
   */
  activate(): void {
    this.active = true
  }

  /**
   * Subscribe to writes from now on (no backlog).
   *
   * @remarks
   * Arms capture, ensures the outbox, and positions the cursor at the
   * current high-water mark — records written before this call are never
   * delivered. Attaches the `aftercommit` listener on the first live
   * subscription and detaches it when the last one leaves.
   *
   * @param filter - A sub-DB name, or `{db, op?}` to narrow to one write kind.
   * @param cb - Subscriber callback invoked per matching record on drain.
   * A throwing callback is reported via `console.error` and never breaks
   * the writer's commit.
   * @returns An idempotent unsubscribe closure.
   * @throws {@link LmdbError} When the filter shape is invalid.
   */
  subscribe(filter: ICdcFilter, cb: ICdcCallback): () => void {
    const parsed = CdcHub._parseFilter(filter)
    this.activate()
    this._store.ensure()
    this._cursor = this._store.maxSeq()
    const sub: ISubscription = {db: parsed.db, op: parsed.op, cb}
    this._subs.push(sub)
    if (!this._hooked) {
      this._env.on(`aftercommit`, this._onCommit)
      this._hooked = true
    }
    let done = false
    return () => {
      if (done) return
      done = true
      this._subs = this._subs.filter((s) => s !== sub)
      if (this._subs.length === 0 && this._hooked) {
        this._env.off(`aftercommit`, this._onCommit)
        this._hooked = false
      }
    }
  }

  /**
   * Publish everything past the cursor to matching subscribers.
   *
   * @remarks
   * Fully synchronous, so the `aftercommit` hook can never interleave with
   * a concurrent writer — delivery is race-free. A throwing subscriber is
   * reported via `console.error` without breaking the commit or the
   * remaining subscribers.
   */
  drain(): void {
    if (this._subs.length === 0) return
    const {records, highWater} = this._store.scan(this._cursor)
    this._cursor = highWater
    for (const record of records) {
      for (const sub of this._subs) {
        if (sub.db !== record.db) continue
        if (sub.op !== undefined && sub.op !== record.type) continue
        try {
          sub.cb({type: record.type, key: record.key, value: record.value})
        } catch (err) {
          // A throwing subscriber must not break the writer's commit —
          // report loudly and continue with the remaining subscribers.
          console.error(`[@gramstax/lmdb] CDC subscriber for '${record.db}' threw: ${String(err)}`)
        }
      }
    }
  }

  /**
   * Tail the outbox above a floor (explicit `from`, consumer ack, or both).
   *
   * @remarks
   * A named consumer auto-registers on first tail (floor 0); later tails
   * resume past its ack. An explicit `from` repositions forward past the ack
   * but never backward — consumed history stays consumed.
   *
   * @param options - Tail options: `consumer` for persistent resume,
   * `from` for an inclusive lower sequence bound, `limit` for the batch cap
   * (a non-positive limit returns an empty array).
   * @returns Outbox records above the resolved floor, oldest first.
   */
  async tail(options?: ICdcTailOptions): Promise<Array<ICdcRecord>> {
    this.activate()
    // `from` is inclusive ("records starting at `from`"); the scan floor stays
    // exclusive, so the stored ack is `from - 1` and resumes re-include it.
    const from = typeof options?.from === `number` && Number.isFinite(options.from) ? Math.max(0, Math.floor(options.from)) : 0
    const limit = typeof options?.limit === `number` && Number.isFinite(options.limit) ? options.limit : undefined
    if (limit !== undefined && limit <= 0) return []
    let floor = from - 1
    if (options?.consumer !== undefined) {
      const ack = this._store.getAck(options.consumer)
      if (ack === undefined) {
        this._store.setAck(options.consumer, floor)
      } else {
        floor = Math.max(ack, floor)
      }
    }
    return this._store.scan(floor, limit).records
  }

  /**
   * Persist a consumer ack, advancing its resume floor.
   *
   * @param consumer - Named consumer previously registered via `tail`.
   * @param seq - Sequence number consumed up to (inclusive).
   * @throws {@link LmdbError} When the consumer is unknown — tail first
   * to register.
   */
  async ack(consumer: string, seq: number): Promise<void> {
    this.activate()
    if (this._store.getAck(consumer) === undefined) {
      throw new LmdbError(`unknown CDC consumer '${consumer}' — tail first to register`)
    }
    this._store.setAck(consumer, seq)
  }
}
