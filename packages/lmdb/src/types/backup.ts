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
   * Tick interval in ms (must be finite and above `0`).
   */
  intervalMs: number
  /**
   * Run one backup immediately on start (default `false`).
   */
  runOnStart?: boolean
  /**
   * Snapshot format per tick (default `dir`).
   */
  format?: `dir` | `tar.gz`
  /**
   * S3 upload per tick — tar.gz only.
   */
  s3?: IBackupS3Options
  /**
   * Tick failure handler (default `console.error`).
   */
  onError?: (err: unknown) => void
}

/**
 * Handle returned by {@link LmdbBackup.start}.
 *
 * @public
 */
export interface IBackupHandle {
  /**
   * Stop the schedule — no further ticks.
   */
  stop(): void
  /**
   * Human-readable cadence (`every 24h`, `every 20ms`).
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
