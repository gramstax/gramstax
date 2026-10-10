import {cpSync, createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, type Stats, statSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {dirname, join} from "node:path"
import {Readable} from "node:stream"
import {pipeline} from "node:stream/promises"
import type {S3Client} from "@aws-sdk/client-s3"
import type {LmdbEnv} from "./env"
import {LmdbError} from "./errors"
import {LmdbJobRun} from "./job-run"
import type {IBackupArchiveEntry, IBackupEntry, IBackupHandle, IBackupS3Options, IBackupSnapshotOptions, IBackupSnapshotResult, IBackupStartOptions} from "./types/backup"

export type {
  IBackupArchiveEntry as LmdbBackupArchiveEntry,
  IBackupEntry as LmdbBackupEntry,
  IBackupHandle as LmdbBackupHandle,
  IBackupS3Options as LmdbBackupS3Options,
  IBackupSnapshotOptions as LmdbBackupSnapshotOptions,
  IBackupSnapshotResult as LmdbBackupSnapshotResult,
  IBackupStartOptions as LmdbBackupStartOptions
} from "./types/backup"

/**
 * Filename prefix for every entry this module creates.
 *
 * @remarks
 * Dir backups are `backup-<stamp>`, archives append `.tar.gz`. Listing and
 * pruning match on this prefix, so foreign files in the directory are never
 * touched.
 */
const BACKUP_PREFIX = `backup-`

/**
 * Default job name for the persisted backup run-stamp in the `__job_run` sub.
 */
const BACKUP_RUN_KEY = `backup`

/**
 * Timestamped backup lifecycle over LMDB envs — create, list, prune,
 * restore, archive, upload, and schedule.
 *
 * @remarks
 * Dir backups are plain directories (`backup-<stamp>` holding `data.mdb`),
 * so restore is a copy and inspection needs no tooling. Tar.gz archives
 * need the optional `tar` peer; S3 upload needs the optional
 * `@aws-sdk/client-s3` peer — both load lazily, so installs without them
 * pay nothing and only those two paths throw (`LmdbError`) when missing.
 * Only `backup-*` entries are ever listed or pruned — foreign files in the
 * directory are left alone.
 *
 * @public
 */
export class LmdbBackup {
  /**
   * Clamp a retention count to a positive integer.
   *
   * @param keep - Requested entries to retain.
   * @returns Floored `keep` when it is a finite number above `0`, else `3`.
   *
   * @internal
   */
  private static _normalizeKeep(keep: number | undefined): number {
    return typeof keep === `number` && Number.isFinite(keep) && keep > 0 ? Math.floor(keep) : 3
  }

  /**
   * Build a unique, time-ordered entry stamp.
   *
   * @returns Zero-padded `Date.now()` plus a random suffix, so same-ms
   * entries never collide.
   *
   * @internal
   */
  private static _stamp(): string {
    return `${Date.now().toString().padStart(13, `0`)}-${Math.random().toString(36).slice(2, 6)}`
  }

  /**
   * Creation time encoded in a backup name, in epoch ms.
   *
   * @remarks
   * Filesystem `mtimeMs` granularity can be coarser than a millisecond, so two
   * backups taken in quick succession can share an `mtimeMs` and leave the
   * order down to `readdirSync`. `prune()` deletes from this order, so a tie
   * means it can drop the newest instead of the oldest. The name carries
   * `Date.now()` at full precision, so that is the primary key.
   *
   * @param name - Directory or archive file name, with or without the prefix
   * and the `.tar.gz` suffix.
   * @returns Epoch ms, or `undefined` when the name carries no stamp.
   *
   * @internal
   */
  private static _stampMs(name: string): number | undefined {
    const rest = name.startsWith(BACKUP_PREFIX) ? name.slice(BACKUP_PREFIX.length) : name
    const digits = /^\d+/.exec(rest)?.[0]
    if (digits === undefined) return undefined
    const ms = Number(digits)
    return Number.isFinite(ms) ? ms : undefined
  }

  /**
   * Oldest-first comparator shared by {@link LmdbBackup.list} and
   * {@link LmdbBackup.listArchives}.
   *
   * @remarks
   * Falls back to `mtimeMs` and then to `name` so the result stays a total
   * order even for entries this package did not write.
   *
   * @internal
   */
  private static _byOldest(a: {name: string; mtimeMs: number}, b: {name: string; mtimeMs: number}): number {
    const stampA = LmdbBackup._stampMs(a.name)
    const stampB = LmdbBackup._stampMs(b.name)
    if (stampA !== undefined && stampB !== undefined) {
      if (stampA !== stampB) return stampA - stampB
      // Two backups can land in the same millisecond and share a stamp, so the
      // name suffix decides. Arbitrary but stable, which is what `prune` needs to
      // pick a deterministic victim.
      if (a.name !== b.name) return a.name < b.name ? -1 : 1
      return a.mtimeMs - b.mtimeMs
    }
    // At least one name carries no stamp, so there is nothing to compare. `mtimeMs`
    // is the only signal left, and sorting on it is what keeps a freshly written
    // backup behind pre-existing entries a package did not create — ordering
    // these by name instead would put digits first and make `prune` delete the
    // newest one.
    if (a.mtimeMs !== b.mtimeMs) return a.mtimeMs - b.mtimeMs
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  }

  /**
   * Lazily import an optional peer dependency.
   *
   * @param specifier - Package to `import()`.
   * @param hint - Install hint thrown as `LmdbError` when the peer is missing.
   * @returns The imported module namespace.
   * @throws {LmdbError} When the peer cannot be resolved.
   *
   * @internal
   */
  private static async _peer<T>(specifier: string, hint: string): Promise<T> {
    try {
      return (await import(specifier)) as T
    } catch {
      throw new LmdbError(hint)
    }
  }

  /**
   * Load the optional `tar` peer for archive create/extract.
   *
   * @returns The `tar` module namespace.
   * @throws {LmdbError} When `tar` is not installed.
   *
   * @internal
   */
  private static async _tar(): Promise<typeof import("tar")> {
    return LmdbBackup._peer(`tar`, `tar.gz snapshots need the "tar" package — install it (bun add tar).`)
  }

  /**
   * Load the optional `@aws-sdk/client-s3` peer for S3 paths.
   *
   * @returns The SDK module namespace.
   * @throws {LmdbError} When the SDK is not installed.
   *
   * @internal
   */
  private static async _s3(): Promise<typeof import("@aws-sdk/client-s3")> {
    return LmdbBackup._peer(`@aws-sdk/client-s3`, `S3 backup needs the "@aws-sdk/client-s3" package — install it (bun add @aws-sdk/client-s3).`)
  }

  /**
   * Resolve an S3 client from options.
   *
   * @param s3 - Destination options; a prebuilt `client` wins over fields.
   * @returns The prebuilt client, else a client built from
   * bucket/endpoint/region/credentials.
   * @throws {LmdbError} When bucket or credentials are missing and no
   * prebuilt client is given.
   *
   * @internal
   */
  private static async _resolveS3(s3: IBackupS3Options): Promise<S3Client> {
    if (s3.client) return s3.client
    if (!s3.bucket || !s3.accessKeyId || !s3.secretAccessKey) {
      throw new LmdbError(`S3 upload needs bucket + accessKeyId + secretAccessKey.`)
    }
    const {S3Client: Client} = await LmdbBackup._s3()
    return new Client({
      region: s3.region ?? `auto`,
      ...(s3.endpoint ? {endpoint: s3.endpoint} : {}),
      ...(s3.forcePathStyle !== undefined ? {forcePathStyle: s3.forcePathStyle} : {}),
      credentials: {accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey}
    })
  }

  /**
   * Forwarding shim to the public {@link LmdbBackup.clearStaleStaging}.
   *
   * @param dir - Directory holding backups.
   * @returns Nothing; missing directories are ignored.
   *
   * @internal
   */
  private static async _clearStaleStaging(dir: string): Promise<void> {
    return LmdbBackup.clearStaleStaging(dir)
  }

  /**
   * Create a timestamped backup inside `baseDir` and prune to `keep`.
   *
   * @param env - Writer env to back up (must be open).
   * @param baseDir - Directory that will contain timestamped backup subdirs.
   * @param keep - Backups to retain (default `3`).
   * @param compact - Compact while copying (default `false`): slower, but the
   * result is rewritten densely, so it is smaller on disk.
   * @returns The path of the newly created backup.
   *
   * @public
   */
  static async backup(env: LmdbEnv, baseDir: string, keep = 3, compact = false): Promise<string> {
    const want = LmdbBackup._normalizeKeep(keep)
    mkdirSync(baseDir, {recursive: true})
    const dest = join(baseDir, `${BACKUP_PREFIX}${LmdbBackup._stamp()}`)
    mkdirSync(dest, {recursive: true})
    try {
      await env.backup(dest, compact)
    } catch (err) {
      // A half-written backup-<stamp> dir would still be reported by list()
      // and would consume one of the `keep` slots, so a failed copy must not
      // leave debris behind. The tar.gz path already cleans up on failure.
      try {
        rmSync(dest, {recursive: true, force: true})
      } catch {}
      throw err
    }
    await LmdbBackup.prune(baseDir, want)
    return dest
  }

  /**
   * List backups oldest-first.
   *
   * @param baseDir - Directory holding timestamped backup subdirs.
   * @returns Backup entries oldest-first; `[]` when the directory is missing.
   * Foreign (non-`backup-*`) entries are skipped.
   *
   * @public
   */
  static list(baseDir: string): Array<IBackupEntry> {
    let names: Array<string>
    try {
      names = readdirSync(baseDir)
    } catch {
      return []
    }
    const entries: Array<IBackupEntry> = []
    for (const name of names) {
      if (!name.startsWith(BACKUP_PREFIX)) continue
      const full = join(baseDir, name)
      try {
        const st = statSync(full)
        if (!st.isDirectory()) continue
        entries.push({name, path: full, mtimeMs: st.mtimeMs})
      } catch {}
    }
    entries.sort((a, b) => LmdbBackup._byOldest(a, b))
    return entries
  }

  /**
   * Full snapshot cycle: backup, optionally archive + upload.
   *
   * @param env - Writer env to back up (must be open).
   * @param opts - `{dir, keep?, format?, s3?}` — `dir` keeps raw LMDB dirs
   * via {@link LmdbBackup.backup}; `tar.gz` archives a staging snapshot
   * (needs the `tar` peer), prunes archives, and uploads when `s3` is set.
   * @returns `{path}` plus `uploaded` S3 key when uploaded.
   *
   * @public
   */
  static async snapshot(env: LmdbEnv, opts: IBackupSnapshotOptions): Promise<IBackupSnapshotResult> {
    const format = opts.format ?? `dir`
    if (format !== `dir` && format !== `tar.gz`) {
      throw new LmdbError(`Snapshot format must be "dir" or "tar.gz" — received '${String(format)}'.`)
    }
    if (opts.s3 && format !== `tar.gz`) {
      throw new LmdbError(`S3 upload needs format "tar.gz" (a directory cannot be PUT as one object).`)
    }
    if (format === `dir`) {
      return {path: await LmdbBackup.backup(env, opts.dir, opts.keep, opts.compact)}
    }
    const keep = LmdbBackup._normalizeKeep(opts.keep)
    const dir = opts.dir
    mkdirSync(dir, {recursive: true})
    await LmdbBackup._clearStaleStaging(dir)
    const name = `backup-${LmdbBackup._stamp()}`
    const staging = join(dir, name)
    const dest = `${staging}.tar.gz`
    const partial = `${dest}.part`
    try {
      await mkdir(staging, {recursive: true})
      await env.backup(staging, opts.compact)
      const tar = await LmdbBackup._tar()
      await tar.create({gzip: true, file: partial, cwd: dir}, [name])
      renameSync(partial, dest)
    } catch (err) {
      await rm(staging, {recursive: true, force: true}).catch(() => {})
      await rm(partial, {force: true}).catch(() => {})
      await rm(dest, {force: true}).catch(() => {})
      throw new LmdbError(`Snapshot archive failed: ${String(err)}`)
    }
    await rm(staging, {recursive: true, force: true})
    await LmdbBackup.pruneArchives(dir, keep)
    if (!opts.s3) return {path: dest}
    const uploaded = await LmdbBackup.uploadToS3(dest, opts.s3, LmdbBackup._normalizeKeep(opts.s3Keep ?? opts.keep))
    return {path: dest, uploaded}
  }

  /**
   * Delete crash leftovers: raw staging dirs with no matching archive.
   *
   * @param dir - Directory holding backups.
   *
   * @public
   */
  static async clearStaleStaging(dir: string): Promise<void> {
    const {readdir} = await import("node:fs/promises")
    const entries = await readdir(dir).catch(() => [] as Array<string>)
    for (const name of entries) {
      if (name.startsWith(BACKUP_PREFIX) && !name.endsWith(`.tar.gz`)) {
        await rm(join(dir, name), {recursive: true, force: true}).catch(() => {})
      }
    }
  }

  /**
   * List tar.gz archives oldest-first.
   *
   * @param baseDir - Directory holding archives.
   * @returns Archive entries oldest-first; `[]` when the directory is missing.
   * directory is missing.
   *
   * @public
   */
  static listArchives(baseDir: string): Array<IBackupArchiveEntry> {
    let names: Array<string>
    try {
      names = readdirSync(baseDir)
    } catch {
      return []
    }
    const entries: Array<IBackupArchiveEntry> = []
    for (const name of names) {
      if (!name.startsWith(BACKUP_PREFIX) || !name.endsWith(`.tar.gz`)) continue
      const full = join(baseDir, name)
      try {
        const st = statSync(full)
        if (st.isFile()) entries.push({name, path: full, mtimeMs: st.mtimeMs, sizeBytes: st.size})
      } catch {}
    }
    entries.sort((a, b) => LmdbBackup._byOldest(a, b))
    return entries
  }

  /**
   * Delete oldest archives beyond `keep`.
   *
   * @param baseDir - Directory holding archives.
   * @param keep - Archives to retain (default `3`).
   * @returns Kept count and removed paths.
   *
   * @public
   */
  static async pruneArchives(baseDir: string, keep = 3): Promise<{kept: number; removed: Array<string>}> {
    const want = LmdbBackup._normalizeKeep(keep)
    const entries = LmdbBackup.listArchives(baseDir)
    const removed: Array<string> = []
    for (let i = 0; i < entries.length - want; i++) {
      const victim = entries[i]
      if (!victim) continue
      try {
        rmSync(victim.path, {force: true})
        removed.push(victim.path)
      } catch {}
    }
    return {kept: entries.length - removed.length, removed}
  }

  /**
   * Extract an archive and revive it via {@link LmdbBackup.restore}.
   *
   * @param archivePath - A `backup-*.tar.gz` file.
   * @param destParent - Staging parent + revival parent.
   * @param destName - Revived dir name under `destParent`.
   * @returns `destPath` — open a new env on it.
   *
   * @public
   */
  static async restoreArchive(archivePath: string, destParent: string, destName: string): Promise<string> {
    if (!existsSync(archivePath)) throw new LmdbError(`Archive '${archivePath}' does not exist.`)
    const staging = join(destParent, `restore-staging-${LmdbBackup._stamp()}`)
    await rm(staging, {recursive: true, force: true}).catch(() => {})
    const {mkdir: mkdirAsync, readdir: readdirAsync} = await import("node:fs/promises")
    await mkdirAsync(staging, {recursive: true})
    try {
      const tar = await LmdbBackup._tar()
      await tar.extract({file: archivePath, C: staging})
      const names = await readdirAsync(staging)
      const inner = names.find((n) => n.startsWith(BACKUP_PREFIX))
      if (!inner) throw new LmdbError(`Archive '${archivePath}' holds no backup-* entry.`)
      return await LmdbBackup.restore(join(staging, inner), join(destParent, destName))
    } finally {
      await rm(staging, {recursive: true, force: true}).catch(() => {})
    }
  }

  /**
   * PUT-verified upload of one archive, then remote retention prune.
   *
   * @param archivePath - A `backup-*.tar.gz` file.
   * @param s3 - Destination (bucket + credentials or prebuilt client).
   * @param keep - Remote archives to retain (default `3`).
   * @returns The S3 key. Never loses data: failures keep the local file
   * and throw (callers decide — {@link LmdbBackup.snapshot} logs and keeps).
   *
   * @public
   */
  static async uploadToS3(archivePath: string, s3: IBackupS3Options, keep = 3): Promise<string> {
    const {PutObjectCommand} = await LmdbBackup._s3()
    const client = await LmdbBackup._resolveS3(s3)
    const key = `${s3.prefix ?? ``}${archivePath.split(/[\\/]/).pop() as string}`
    const {size} = statSync(archivePath)
    const put = await client.send(new PutObjectCommand({Bucket: s3.bucket, Key: key, Body: createReadStream(archivePath), ContentLength: size, ContentType: `application/gzip`}))
    if (put.$metadata.httpStatusCode !== 200) throw new LmdbError(`S3 PUT returned ${String(put.$metadata.httpStatusCode)}.`)
    await LmdbBackup.pruneS3Archives(s3, keep)
    return key
  }

  /**
   * Delete oldest remote archives beyond `keep` (paginated, batched).
   *
   * @param s3 - Destination (bucket + credentials or prebuilt client).
   * @param keep - Remote archives to retain (default `3`).
   * @returns Removed keys.
   *
   * @public
   */
  static async pruneS3Archives(s3: IBackupS3Options, keep = 3): Promise<{removed: Array<string>}> {
    const {DeleteObjectsCommand, ListObjectsV2Command} = await LmdbBackup._s3()
    const client = await LmdbBackup._resolveS3(s3)
    const prefix = s3.prefix ?? ``
    const want = LmdbBackup._normalizeKeep(keep)
    const archives: Array<{key: string; time: number}> = []
    let token: string | undefined
    do {
      const listed = await client.send(new ListObjectsV2Command({Bucket: s3.bucket, Prefix: prefix, ContinuationToken: token}))
      for (const o of listed.Contents ?? []) {
        if (!o.Key?.endsWith(`.tar.gz`)) continue
        archives.push({key: o.Key, time: o.LastModified?.getTime() ?? 0})
      }
      token = listed.IsTruncated ? listed.NextContinuationToken : undefined
    } while (token)
    archives.sort((a, b) => a.time - b.time)
    const removed: Array<string> = []
    const excess = archives.slice(0, Math.max(0, archives.length - want))
    for (let i = 0; i < excess.length; i += 1000) {
      const chunk = excess.slice(i, i + 1000)
      await client.send(new DeleteObjectsCommand({Bucket: s3.bucket, Delete: {Objects: chunk.map((o) => ({Key: o.key}))}}))
      for (const o of chunk) removed.push(o.key)
    }
    return {removed}
  }

  /**
   * Download one S3 object to a local file.
   *
   * @remarks
   * Writes to a uniquely-named `.part` sibling and renames on success, so the
   * destination is either absent or complete — a failed or cancelled transfer
   * never leaves a truncated archive that a later `restoreArchive` would accept.
   * The random component also makes concurrent downloads into one directory
   * safe. `destDir` is created if missing, matching {@link LmdbBackup.backup}.
   *
   * Destination folder and file name are separate arguments so a caller can
   * restore several objects into one folder without re-joining paths, and so
   * the returned absolute target is unambiguous.
   *
   * @param s3 - Source (bucket + credentials or prebuilt client).
   * @param key - Full object key.
   * @param destDir - Local target folder, created when missing.
   * @param fileName - Local target file name inside `destDir`.
   * @returns `join(destDir, fileName)`.
   *
   * @public
   */
  static async downloadFromS3(s3: IBackupS3Options, key: string, destDir: string, fileName: string): Promise<string> {
    const {GetObjectCommand} = await LmdbBackup._s3()
    const client = await LmdbBackup._resolveS3(s3)
    const obj = await client.send(new GetObjectCommand({Bucket: s3.bucket, Key: key}))
    if (!obj.Body) throw new LmdbError(`S3 object '${key}' has no body.`)

    mkdirSync(destDir, {recursive: true})
    const destFile = join(destDir, fileName)
    // Unique per call so concurrent downloads into one directory cannot clobber
    // each other's partial file — they would otherwise share a single
    // `<name>.part` and interleave two bodies into it. The rename below is still
    // the only visible transition, so `destFile` is never seen half-written.
    const partial = join(destDir, `${fileName}.${Math.random().toString(36).slice(2, 10)}.part`)
    try {
      await pipeline(Readable.fromWeb(obj.Body as unknown as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(partial))
      renameSync(partial, destFile)
    } catch (err) {
      try {
        rmSync(partial, {force: true})
      } catch {}
      throw err
    }
    return destFile
  }

  /**
   * Delete oldest backups beyond `keep`.
   *
   * @param baseDir - Directory holding timestamped backup subdirs.
   * @param keep - Backups to retain (default `3`).
   * @returns Kept count and removed paths.
   *
   * @public
   */
  static async prune(baseDir: string, keep = 3): Promise<{kept: number; removed: Array<string>}> {
    const want = LmdbBackup._normalizeKeep(keep)
    const entries = LmdbBackup.list(baseDir)
    const removed: Array<string> = []
    for (let i = 0; i < entries.length - want; i++) {
      const victim = entries[i]
      if (!victim) continue
      try {
        rmSync(victim.path, {recursive: true, force: true})
        removed.push(victim.path)
      } catch {}
    }
    return {kept: entries.length - removed.length, removed}
  }

  /**
   * Copy a backup to `destPath` for revival.
   *
   * @param backupPath - A `backup-*` dir holding `data.mdb`.
   * @param destPath - Revival target; open a new env on it. Must not exist
   * unless `{overwrite: true}`.
   * @param opts - Optional `{overwrite: true}` to replace `destPath`.
   * @returns `destPath`.
   *
   * @public
   */
  static async restore(backupPath: string, destPath: string, opts?: {overwrite?: boolean}): Promise<string> {
    let st: Stats | undefined
    try {
      st = statSync(backupPath)
    } catch {
      throw new LmdbError(`Restore source '${backupPath}' does not exist.`)
    }
    if (!st.isDirectory() || !existsSync(join(backupPath, `data.mdb`))) {
      throw new LmdbError(`Restore source '${backupPath}' is not an LMDB backup (data.mdb missing).`)
    }
    if (existsSync(destPath)) {
      if (!opts?.overwrite) throw new LmdbError(`Restore destination '${destPath}' already exists — pass {overwrite: true} to replace it.`)
      rmSync(destPath, {recursive: true, force: true})
    }
    cpSync(backupPath, destPath, {recursive: true})
    return destPath
  }

  /**
   * Run snapshots on a cron schedule, resuming across restarts.
   *
   * @remarks
   * A thin wrapper over {@link LmdbJobRun.start}: this module owns *what* to
   * do (take a snapshot, prune, optionally upload) and the job-run module owns
   * *when* to do it. Everything schedule-related — croner, the missed-boundary
   * check, the overlap guard, the run-stamp — lives there, so any other job can
   * opt into the same restart safety without going through this helper.
   *
   * @param env - Writer env to back up (must stay open).
   * @param opts - `{dir, keep?, pattern, timezone?, runOnStart?, format?, s3?,
   * onError?, persist?, persistKey?}`.
   * @returns `{stop, runNow, lastRun, nextRun, label}` handle.
   * @throws {LmdbError} On a bad format, an s3/format pairing mismatch, or a
   * closed env — the job-run store is constructed up front.
   *
   * @public
   */
  static start(env: LmdbEnv, opts: IBackupStartOptions): IBackupHandle {
    const {dir, pattern, timezone} = opts
    const format = opts.format ?? `dir`
    if (format !== `dir` && format !== `tar.gz`) {
      throw new LmdbError(`Snapshot format must be "dir" or "tar.gz" — received '${String(format)}'.`)
    }
    if (opts.s3 && format !== `tar.gz`) {
      throw new LmdbError(`S3 upload needs format "tar.gz" (a directory cannot be PUT as one object).`)
    }
    const keep = LmdbBackup._normalizeKeep(opts.keep)

    const handle = new LmdbJobRun(env).start(opts.persistKey ?? BACKUP_RUN_KEY, {
      pattern,
      timezone,
      persist: opts.persist,
      runOnStart: opts.runOnStart,
      onError: opts.onError,
      task: () => LmdbBackup.snapshot(env, {dir, keep, s3Keep: opts.s3Keep, format, s3: opts.s3, compact: opts.compact})
    })

    return {
      stop: handle.stop,
      runNow: handle.runNow,
      lastRun: handle.lastRun,
      nextRun: handle.nextRun,
      label: handle.label
    }
  }
}
