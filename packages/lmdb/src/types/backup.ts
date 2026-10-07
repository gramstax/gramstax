import type {S3Client} from "@aws-sdk/client-s3"

/**
 * One timestamped backup entry as returned by {@link LmdbBackup.list}.\
 *
 * @public
 */
export interface IBackupEntry {
  /**
   * Directory name (`backup-<stamp>`).
   */
  name: string
  /**
   * Absolute path.
   */
  path: string
  /**
   * Directory mtime in ms — prune/list order key.
   */
  mtimeMs: number
}

/**
 * Options for {@link LmdbBackup.start}.
 *
 * @public
 */
export interface IBackupStartOptions {
  /**
   * Directory holding timestamped backup subdirs.
   */
  dir: string
  /**
   * Backups to retain (default `3`; non-positive falls back to `3`).
   */
  keep?: number
  /**
   * Cron pattern for the schedule, resolved by `croner`.
   *
   * @remarks
   * Supports 5-field (minute precision), 6-field (second precision) and
   * 7-field (OCPS, with a trailing year) patterns.
   *
   * A pattern is a **wall-clock** schedule, not a duration — "03:00 every day"
   * is a different thing from "24 h after the last successful run". Pick the
   * one you actually mean.
   *
   * Patterns are interpreted in the **local** timezone unless `timezone` is
   * set, so a daily 03:00 pattern is 03:00 where the process runs, not 03:00
   * UTC. See `example/job-run.ts` for runnable patterns.
   */
  pattern: string
  /**
   * IANA timezone for `pattern` (default: the host's local timezone).
   *
   * @example
   * `Europe/Stockholm`
   */
  timezone?: string
  /**
   * Run one backup immediately on start, even when not due (default `false`).
   *
   * @remarks
   * Separate from overdue catch-up: an overdue job runs at boot regardless,
   * because a boundary passed while the process was down is a missed run. This
   * forces an extra early run on top of that.
   */
  runOnStart?: boolean
  /**
   * Snapshot format per tick (default `dir`).
   */
  format?: `dir` | `tar.gz`
  /**
   * Compact each snapshot while copying (default `false`).
   *
   * @remarks
   * `true` rewrites the copy densely, so it is slower but smaller on disk and
   * cheaper to restore from later. Worth it for archives you retain or ship
   * off-host; leave it off for local snapshots you will replace soon.
   */
  compact?: boolean
  /**
   * S3 upload per tick — tar.gz only.
   */
  s3?: IBackupS3Options
  /**
   * Tick failure handler (default `console.error`).
   */
  onError?: (err: unknown) => void
  /**
   * Persist the last successful run so a restart resumes the schedule
   * instead of restarting it (default `true`).
   *
   * @remarks
   * `false` restores the older timer-only behaviour: no catch-up decision is
   * made and nothing is written to the env. Costs one `maxDbs` slot for the
   * `__job_run` sub-DB when enabled.
   */
  persist?: boolean
  /**
   * Job name for the persisted stamp (default `'backup'`).
   *
   * @remarks
   * Use distinct names for schedules sharing one env, so they do not
   * overwrite each other's stamp.
   */
  persistKey?: string
}

/**
 * Handle returned by {@link LmdbBackup.start}.
 *
 * @public
 */
export interface IBackupHandle {
  /**
   * Stop the schedule — no further scheduled ticks.
   */
  stop(): void
  /**
   * Take a snapshot now and record the run, without disturbing the schedule.
   *
   * @remarks
   * Resolves when a snapshot has completed and the stamp is written, so it is
   * safe to assert on the result straight after awaiting. If a snapshot is
   * already in flight this **joins** that cycle rather than skipping, so the
   * resolved value always means real work finished — never a silent no-op.
   * Works after {@link IBackupHandle.stop}, since stopping only ends the
   * schedule.
   *
   * @returns Nothing.
   */
  runNow(): Promise<void>
  /**
   * Epoch ms of the last successful snapshot, or `undefined` before the first.
   */
  lastRun(): number | undefined
  /**
   * Next scheduled snapshot, or `undefined` once stopped.
   */
  nextRun(): Date | undefined
  /**
   * Cron pattern plus the last-run stamp (`0 3 * * *, last run <ISO>`).
   */
  label(): string
}

/**
 * One tar.gz archive entry as returned by {@link LmdbBackup.listArchives}.
 *
 * @public
 */
export interface IBackupArchiveEntry {
  /**
   * File name (`backup-<stamp>.tar.gz`).
   */
  name: string
  /**
   * Absolute path.
   */
  path: string
  /**
   * File mtime in ms — prune/list order key.
   */
  mtimeMs: number
  /**
   * Apparent size in bytes.
   */
  sizeBytes: number
}

/**
 * S3-compatible destination (AWS S3, Cloudflare R2, MinIO — same API).
 *
 * @public
 */
export interface IBackupS3Options {
  /**
   * Bucket name.
   */
  bucket: string
  /**
   * Key prefix (default `""`).
   */
  prefix?: string
  /**
   * API endpoint (R2/MinIO URL; absent means AWS default).
   */
  endpoint?: string
  /**
   * Region (default `auto`, works for R2).
   */
  region?: string
  /**
   * Access key id.
   */
  accessKeyId: string
  /**
   * Secret access key.
   */
  secretAccessKey: string
  /**
   * `true` for MinIO-style path URLs.
   */
  forcePathStyle?: boolean
  /**
   * Preconfigured client — wins over the fields above.
   */
  client?: S3Client
}

/**
 * Options for {@link LmdbBackup.snapshot}.
 *
 * @public
 */
export interface IBackupSnapshotOptions {
  /**
   * Directory holding backups.
   */
  dir: string
  /**
   * Local entries to retain (default `3`).
   */
  keep?: number
  /**
   * `dir` for raw LMDB dirs (default), `tar.gz` for single-file archives.
   */
  format?: `dir` | `tar.gz`
  /**
   * Compact each snapshot while copying (default `false`).
   *
   * @remarks
   * `true` rewrites the copy densely, so it is slower but smaller on disk and
   * cheaper to restore from later. Worth it for archives you retain or ship
   * off-host; leave it off for local snapshots you will replace soon.
   */
  compact?: boolean
  /**
   * S3 upload — tar.gz only (a directory cannot be PUT as one object).
   */
  s3?: IBackupS3Options
}

/**
 * Result of {@link LmdbBackup.snapshot}.
 *
 * @public
 */
export interface IBackupSnapshotResult {
  /**
   * Archive path (tar.gz) or backup dir (dir format).
   */
  path: string
  /**
   * S3 key when uploaded.
   */
  uploaded?: string
}
