/**
 * Options for {@link LmdbJobRun.start}.
 *
 * @public
 */
export interface IJobRunScheduleOptions {
  /**
   * Cron expression for the schedule, resolved by `croner`.
   *
   * @remarks
   * 5-field (minute precision), 6-field (second precision) and 7-field (OCPS,
   * with a trailing year) patterns are supported. A pattern is a **wall-clock**
   * schedule, not a duration — "03:00 every day" is a different thing from
   * "24 h after the last successful run". See `example/job-run.ts`.
   */
  pattern: string
  /**
   * The work to run on each tick.
   *
   * @remarks
   * A rejection is routed to `onError` and never stops the schedule. The run
   * stamp is written only after this resolves, so a thrown error leaves the job
   * overdue and the next boot retries it.
   */
  task: () => Promise<unknown>
  /**
   * IANA timezone for `pattern` (default: the host's local timezone).
   */
  timezone?: string
  /**
   * Run once at start even when the job is not due (default `false`).
   *
   * @remarks
   * Separate from {@link IJobRunScheduleOptions.catchUp}: catch-up reacts to a
   * boundary that genuinely passed, this forces an extra run on top.
   */
  runOnStart?: boolean
  /**
   * Run once at start if a boundary passed while the process was down
   * (default `true`).
   *
   * @remarks
   * Exactly one run, never one per missed boundary — otherwise three days of
   * downtime against a daily schedule would burn through a retention count
   * with copies of near-identical data.
   */
  catchUp?: boolean
  /**
   * Tick failure handler.
   *
   * @remarks
   * Defaults to reporting through the env's diagnostics sink — see
   * {@link ILmdbEnvOptions.onWarn}. Nothing is written to `console`.
   */
  onError?: (err: unknown) => void
  /**
   * Read and write the run-stamp (default `true`).
   *
   * @remarks
   * `false` keeps `lastRun` in memory only: no catch-up decision is made and
   * nothing is written, so the schedule cannot survive a restart. The
   * `__job_run` schema is still registered by the constructor.
   */
  persist?: boolean
}

/**
 * Options for {@link LmdbJobRun.missed}.
 *
 * @public
 */
export interface IJobRunMissedOptions {
  /**
   * Cron expression the job is scheduled on.
   */
  pattern: string
  /**
   * IANA timezone for `pattern` (default: the host's local timezone).
   */
  timezone?: string
  /**
   * Clock override in epoch ms (default `Date.now()`).
   *
   * @remarks
   * Pass this to make the check deterministic in tests instead of reading the
   * clock.
   */
  now?: number
}

/**
 * Handle returned by {@link LmdbJobRun.start}.
 *
 * @public
 */
export interface IJobRunHandle {
  /**
   * Stop the schedule — no further scheduled ticks.
   *
   * @remarks
   * Idempotent, and permanent: croner cannot resume a stopped job. A tick
   * already in flight still settles through `onError`.
   */
  stop(): void
  /**
   * Run the task now and record the run, without disturbing the schedule.
   *
   * @remarks
   * Resolves when the task has completed, so it is safe to assert on the
   * result straight after awaiting. A call arriving while a run is in flight
   * **joins** that run rather than skipping, so the resolved value always means
   * real work finished. Still works after {@link IJobRunHandle.stop}.
   */
  runNow(): Promise<void>
  /**
   * Epoch ms of the last successful run, or `undefined` before the first one.
   */
  lastRun(): number | undefined
  /**
   * Next scheduled run, or `undefined` once stopped.
   */
  nextRun(): Date | undefined
  /**
   * Cron pattern plus the last-run stamp (`0 3 * * *, last run <ISO>`).
   */
  label(): string
}
