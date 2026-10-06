import {Cron} from "croner"
import type {LmdbEnv} from "./env"
import {LmdbError} from "./errors"
import {LmdbSchema, t} from "./schema"
import type {LmdbEnvSub} from "./sub"
import type {IJobRunHandle, IJobRunMissedOptions, IJobRunScheduleOptions} from "./types/job-run"

export type {IJobRunHandle as LmdbJobRunHandle, IJobRunMissedOptions as LmdbJobRunMissedOptions, IJobRunScheduleOptions as LmdbJobRunScheduleOptions} from "./types/job-run"

/**
 * Storage for one last-successful-run stamp per job name.
 *
 * @remarks
 * Declared as a schema rather than reached through a raw `getDb` handle, so rows
 * are typed and readable via `env.sub(JobRunSchema)` — no cast, and it works
 * with the same inspection tooling as any other repository. `{at: number}`
 * leaves room to add fields later without a breaking change, since adding to a
 * msgpack map is backward compatible whereas changing the stored shape is not.
 *
 * The `__` prefix follows the internal-state convention (`__queue_meta`,
 * `__sync_state`, `__cdc_log`): a scheduler's bookkeeping is not domain data, and
 * the prefix keeps these rows out of the CDC outbox so a backup run does not
 * show up in every consumer's change stream. The schema class is still exported
 * for `env.isRegistered(JobRunSchema)` and for typing — public reachability of
 * the type does not make the rows user data.
 *
 * @public
 */
export class JobRunSchema extends LmdbSchema {
  static db = `__job_run`
  static key = t.string()
  static value = {at: t.number()}
}

/**
 * Persisted run-stamps and the cron schedule that honours them.
 *
 * @remarks
 * This module owns both halves of a restart-safe job, the way
 * {@link LmdbQueue} owns a queue's metadata and lifecycle together:
 *
 * - **croner** decides *when* to fire. It cannot answer whether a run was
 *   missed, because `cron.previousRun()` is in-memory and dies with the process.
 * - **this class** persists *that* answer, one `{at}` row per job name, so the
 *   next boot can tell whether the job is actually due.
 *
 * A bare timer gets both halves wrong. Restart a process every six hours with a
 * daily schedule and you either run on every boot, or — if the timer restarts
 * from zero — nothing covers the hours the process was down.
 *
 * @example
 * ```typescript
 * const jobs = new LmdbJobRun(env)
 * const handle = jobs.start(`db-backup`, {
 *   pattern: `0 3 * * *`,
 *   task: () => LmdbBackup.snapshot(env, {dir: `./backups`})
 * })
 * await handle.runNow()
 * handle.stop()
 * ```
 *
 * @public
 */
export class LmdbJobRun {
  /**
   * Typed handle for the `__job_run` sub-DB.
   *
   * @internal
   */
  private readonly _sub: LmdbEnvSub<typeof JobRunSchema>

  /**
   * Bind a run-stamp store and scheduler to an env.
   *
   * @remarks
   * Registers {@link JobRunSchema} on first use and reuses it afterwards, so a
   * second `LmdbJobRun` on the same env is safe and does not throw. Costs one
   * `maxDbs` slot.
   *
   * @param env - Owning env (must stay open for this instance's lifetime).
   *
   * @public
   */
  constructor(env: LmdbEnv) {
    if (!env.isRegistered(JobRunSchema)) env.register(JobRunSchema)
    this._sub = env.sub(JobRunSchema)
  }

  /**
   * The underlying sub-DB handle, for direct reads or range scans.
   *
   * @returns The pre-bound `__job_run` handle.
   *
   * @public
   */
  get sub(): LmdbEnvSub<typeof JobRunSchema> {
    return this._sub
  }

  /**
   * Read the last successful run for `key`.
   *
   * @param key - Job name.
   * @returns Epoch ms of the last success, or `undefined` when never run.
   * @throws {LmdbError} On a blank `key`, or when the env is closed.
   *
   * @public
   */
  lastRun(key: string): number | undefined {
    return this._sub.get(LmdbJobRun._key(key))?.at
  }

  /**
   * Record a successful run for `key`.
   *
   * @remarks
   * Call this only after the work succeeded. Stamping before the work means a
   * crash or a thrown error is recorded as a completed run, and the next boot
   * would treat the job as satisfied.
   *
   * @param key - Job name.
   * @param at - Epoch ms to stamp (default `Date.now()`).
   * @returns Nothing.
   * @throws {LmdbError} On a blank `key` or a non-finite `at`.
   *
   * @public
   */
  async recordRun(key: string, at = Date.now()): Promise<void> {
    if (!Number.isFinite(at)) throw new LmdbError(`Run stamp must be a finite epoch ms — received '${String(at)}'.`)
    await this._sub.put(LmdbJobRun._key(key), {at})
  }

  /**
   * Forget the stamp for `key`.
   *
   * @param key - Job name.
   * @returns `true` when a stamp existed.
   * @throws {LmdbError} On a blank `key`.
   *
   * @public
   */
  async clear(key: string): Promise<boolean> {
    // Read first rather than trusting the delete's return: lmdb's async
    // `remove` does not distinguish "deleted" from "was not there", so this
    // method promises the caller which of the two happened.
    const existed = this.lastRun(key) !== undefined
    await this._sub.delete(LmdbJobRun._key(key))
    return existed
  }

  /**
   * Whether a scheduled occurrence passed since the last successful run.
   *
   * @remarks
   * Compares the persisted stamp against the most recent time `pattern` matched
   * at or before `now`. `true` when the job never ran, or when that boundary is
   * newer than the last success.
   *
   * Use this to decide *whether* to run without committing to a schedule. To
   * run on a pattern, use {@link LmdbJobRun.start}.
   *
   * @param key - Job name.
   * @param opts - `{pattern, timezone?, now?}` — pass `now` to make the check
   * deterministic instead of reading the clock.
   * @returns `true` when a boundary was missed.
   * @throws {LmdbError} On a blank `key` or an unparseable `pattern`.
   *
   * @public
   */
  missed(key: string, opts: IJobRunMissedOptions): boolean {
    const last = this.lastRun(key)
    // Validate before the never-run short circuit: a typo'd pattern must not
    // quietly read as "always overdue", which would re-trigger forever.
    const probe = LmdbJobRun._probe(opts)
    try {
      if (last === undefined) return true
      const boundary = probe.previousRuns(1, opts.now === undefined ? undefined : new Date(opts.now))[0]
      return boundary !== undefined && boundary.getTime() > last
    } finally {
      probe.stop()
    }
  }

  /**
   * Run `task` on a cron schedule, resuming across restarts.
   *
   * @remarks
   * The job is constructed paused so the catch-up decision can be made from the
   * persisted stamp before anything is armed. When a boundary passed while the
   * process was down, exactly one run is triggered immediately; otherwise the
   * schedule waits for the next boundary.
   *
   * @param key - Job name, also the key its stamp is stored under.
   * @param opts - `{pattern, task, timezone?, runOnStart?, catchUp?, onError?, persist?}`.
   * @returns A handle with `stop`, `runNow`, `lastRun`, `nextRun` and `label`.
   * @throws {LmdbError} On a blank `key`, or an unparseable `pattern`.
   *
   * @public
   */
  start(key: string, opts: IJobRunScheduleOptions): IJobRunHandle {
    const name = LmdbJobRun._key(key)
    const {pattern, task, timezone} = opts
    if (typeof pattern !== `string` || pattern.trim() === ``) {
      throw new LmdbError(`Job '${name}' pattern must be a non-empty cron expression — received '${String(pattern)}'.`)
    }
    const persist = opts.persist ?? true
    const catchUp = opts.catchUp ?? true
    const onError = opts.onError ?? ((err: unknown) => console.error(`[LmdbJobRun] job '${name}' tick failed: ${String(err)}`))

    // `0` means "never ran" and suppresses the stamp in `label()`.
    let last = persist ? (this.lastRun(name) ?? 0) : 0
    let inFlight: Promise<void> | undefined

    /**
     * One run: the task, then the stamp. Joins an in-flight run.
     *
     * @remarks
     * The overlap guard is this module's own rather than croner's `protect`,
     * because {@link IJobRunHandle.runNow} enters through the same function
     * and `cron.trigger()` is fire-and-forget. Owning it is also what keeps
     * `runNow()` awaitable.
     *
     * Never rejects — failures go to `onError` so the schedule survives them.
     */
    const runOnce = async (): Promise<void> => {
      if (inFlight !== undefined) {
        await inFlight
        return
      }
      const work = (async () => {
        try {
          await task()
          const at = Date.now()
          last = at
          if (persist) await this.recordRun(name, at)
        } catch (err) {
          onError(err)
        }
      })()
      inFlight = work
      try {
        await work
      } finally {
        inFlight = undefined
      }
    }

    let cron: Cron
    try {
      // `name` is deliberately omitted: croner's named-job registry is
      // process-global and throws on a duplicate, so two envs in one process
      // using the same job key would collide.
      cron = new Cron(pattern, {paused: true, ...(timezone === undefined ? {} : {timezone})}, () => runOnce())
    } catch (err) {
      throw new LmdbError(`Job '${name}' pattern '${pattern}' is not a valid cron expression: ${String(err)}`)
    }

    // Evaluated while paused: a boundary newer than the last success means it
    // passed while the process was down.
    const boundary = cron.previousRuns(1)[0]
    const behind = persist && catchUp && (last <= 0 || (boundary !== undefined && boundary.getTime() > last))
    if (opts.runOnStart || behind) cron.trigger()
    cron.resume()

    return {
      stop: () => {
        cron.stop()
      },
      runNow: () => runOnce(),
      lastRun: () => (last > 0 ? last : undefined),
      nextRun: () => (cron.isStopped() ? undefined : (cron.nextRun() ?? undefined)),
      label: () => `${pattern}${last > 0 ? `, last run ${new Date(last).toISOString()}` : ``}`
    }
  }

  /**
   * Build a paused croner job for pure schedule arithmetic.
   *
   * @remarks
   * Paused so it holds no timer; the caller must `stop()` it. Used by
   * {@link LmdbJobRun.missed} to answer a question without arming anything.
   *
   * @internal
   */
  private static _probe(opts: {pattern: string; timezone?: string}): Cron {
    try {
      return new Cron(opts.pattern, {paused: true, ...(opts.timezone === undefined ? {} : {timezone: opts.timezone})})
    } catch (err) {
      throw new LmdbError(`Pattern '${opts.pattern}' is not a valid cron expression: ${String(err)}`)
    }
  }

  /**
   * Guard: a job name is required and must not be blank.
   *
   * @param key - Job name to validate.
   * @returns The key, unchanged — whitespace is not trimmed, so `' a '` and
   * `'a'` stay distinct stamps.
   * @throws {LmdbError} When the key is not a non-blank string.
   *
   * @internal
   */
  private static _key(key: string): string {
    if (typeof key !== `string` || key.trim() === ``) throw new LmdbError(`Run key must be a non-empty string — received '${String(key)}'.`)
    return key
  }
}
