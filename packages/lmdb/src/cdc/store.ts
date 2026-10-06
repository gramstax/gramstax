import type {LmdbEnv} from "../env"
import {LmdbError} from "../errors"
import type {ICdcEvent, ICdcRecord} from "../types/cdc"
import type {IRawDb} from "../types/cdc-store"
import type {ILmdbKey} from "../types/key"

/**
 * Sub-DB holding sequence-keyed outbox records.
 */
const OUTBOX_DB = `__cdc_log`
/**
 * Sub-DB holding the sequence counter and consumer acks.
 */
const META_DB = `__cdc_meta`
/**
 * Meta key for the last allocated sequence.
 */
const SEQ_KEY = `seq`
/**
 * Default retention for `prune` — newest N entries survive unacked.
 */
const DEFAULT_KEEP = 10_000

/**
 * Durable outbox + metadata store (one per env, opened lazily).
 *
 * @internal
 */
export class CdcStore {
  /**
   * Outbox sub-DB handle (opened lazily by `ensure`).
   *
   * @internal
   */
  private _logDb: IRawDb | undefined
  /**
   * Meta sub-DB handle (opened lazily by `ensure`).
   *
   * @internal
   */
  private _metaDb: IRawDb | undefined

  /**
   * Create an outbox store bound to one env.
   *
   * @param _env - The owning env (provides `getDb` for the internal sub-DBs).
   * @internal
   */
  constructor(private readonly _env: LmdbEnv) {}

  /**
   * Meta key for a named consumer's ack.
   *
   * @param name - Consumer name.
   * @returns The `c:<name>` meta key.
   */
  private static _consumerKey(name: string): string {
    return `c:${name}`
  }

  /**
   * Open the internal sub-DBs (idempotent).
   *
   * @remarks
   * Safe outside transactions — called at the top of every method, so
   * callers never open sub-DBs themselves.
   */
  ensure(): void {
    if (this._logDb === undefined) this._logDb = this._env.getDb(OUTBOX_DB)
    if (this._metaDb === undefined) this._metaDb = this._env.getDb(META_DB)
  }

  /**
   * Append an event in the ambient writer transaction.
   *
   * @remarks
   * The sequence counter bump and the record commit together — aborts roll
   * both back, so subscribers never see phantom events and sequences stay
   * gapless. Sync mode joins explicit transactions; async mode rides the
   * same-tick batch like the primary write — callers mirror the primary
   * op's syncness.
   *
   * @param db - Source sub-DB name recorded on the outbox record.
   * @param event - Subscriber event (`type`, `key`, `value`).
   * @param mode - `sync` joins explicit transactions; `async` rides the
   * same-tick batch.
   */
  append(db: string, event: ICdcEvent, mode: `sync` | `async`): void {
    this.ensure()
    const meta = this._metaDb!
    const log = this._logDb!
    const seq = ((meta.get(SEQ_KEY) as number | undefined) ?? 0) + 1
    const record = {db, type: event.type, key: event.key, value: event.value}
    if (mode === `sync`) {
      meta.putSync(SEQ_KEY as never, seq as never)
      log.putSync(seq as never, record as never)
    } else {
      void meta.put(SEQ_KEY as never, seq as never)
      void log.put(seq as never, record as never)
    }
  }

  /**
   * Current maximum sequence in the outbox.
   *
   * @returns The highest allocated sequence, or `0` when the outbox
   * is empty.
   */
  maxSeq(): number {
    this.ensure()
    for (const key of this._logDb!.getKeys({limit: 1, reverse: true})) {
      return key as number
    }
    return 0
  }

  /**
   * Records above `floor`, oldest first (synchronous walk).
   *
   * @remarks
   * `highWater` tracks the highest walked sequence even when the record is
   * gone (concurrent prune), so cursors never trap behind a hole.
   *
   * @param floor - Exclusive lower sequence bound (records above it).
   * @param limit - Maximum records returned (`undefined` means unbounded).
   * @returns Records above `floor` oldest first, plus the highest walked
   * sequence.
   */
  scan(floor: number, limit?: number): {records: Array<ICdcRecord>; highWater: number} {
    this.ensure()
    const records: Array<ICdcRecord> = []
    let highWater = floor
    for (const seqKey of this._logDb!.getKeys({start: floor + 1})) {
      if (limit !== undefined && records.length >= limit) break
      const seq = seqKey as number
      if (seq > highWater) highWater = seq
      const raw = this._logDb!.get(seqKey) as {db: string; type: ICdcEvent[`type`]; key: ILmdbKey | undefined; value: unknown} | undefined
      if (raw === undefined) continue // pruned concurrently — skip
      records.push({seq, db: raw.db, type: raw.type, key: raw.key, value: raw.value})
    }
    return {records, highWater}
  }

  /**
   * Stored ack for a consumer.
   *
   * @param consumer - Consumer name.
   * @returns The acked sequence, or `undefined` when never registered.
   */
  getAck(consumer: string): number | undefined {
    this.ensure()
    const ack = this._metaDb!.get(CdcStore._consumerKey(consumer)) as number | undefined
    return typeof ack === `number` ? ack : undefined
  }

  /**
   * Persist a consumer ack as a single-key atomic write.
   *
   * @param consumer - Consumer name.
   * @param seq - Sequence number consumed up to (inclusive).
   */
  setAck(consumer: string, seq: number): void {
    this.ensure()
    this._metaDb!.putSync(CdcStore._consumerKey(consumer) as never, seq as never)
  }

  /**
   * Delete outbox records at or below the retention cutoff.
   *
   * @remarks
   * Cutoff is `min(minAck, newest - keep)`: entries consumed by every
   * registered consumer go, the newest `keep` entries always stay, and an
   * unacked consumer (floor 0) blocks pruning below its start. With no
   * consumers the keep window alone bounds growth.
   *
   * @param keep - Newest entries to retain regardless of acks.
   * @returns The number of records removed.
   */
  async prune(keep = DEFAULT_KEEP): Promise<number> {
    if (typeof keep !== `number` || !Number.isFinite(keep) || keep < 0) {
      throw new LmdbError(`pruneCdc keep must be a non-negative number — received '${String(keep)}'`)
    }
    this.ensure()
    const newest = this.maxSeq()
    if (newest === 0) return 0
    const acks: Array<number> = []
    for (const key of this._metaDb!.getKeys()) {
      if (typeof key === `string` && key.startsWith(`c:`)) {
        const ack = this._metaDb!.get(key) as number | undefined
        if (typeof ack === `number`) acks.push(ack)
      }
    }
    const cutoff = Math.min(acks.length > 0 ? Math.min(...acks) : Infinity, newest - keep)
    if (cutoff < 1) return 0
    const log = this._logDb!
    return this._env.transactionFast(() => {
      let pruned = 0
      for (const seqKey of log.getKeys({end: cutoff + 1})) {
        if (log.removeSync(seqKey)) pruned++
      }
      return pruned
    })
  }
}
