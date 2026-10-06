/**
 * S3 + tar.gz snapshots via `LmdbBackup` — thin app-layer consumer.
 *
 * Flow: `LmdbBackup.snapshot` (backup → tar.gz via the `tar` peer →
 * optional S3 upload → local + remote prune), then `restoreArchive` to
 * revive. S3 is skipped unless S3_BUCKET + S3_ACCESS_KEY_ID +
 * S3_SECRET_ACCESS_KEY are set.
 *
 * Run with: `bun run packages/lmdb/example/backup-s3-tar.ts`
 * Knobs: BACKUP_DIR, S3_* (see Config below).
 */
import {rm} from "node:fs/promises"
import {join} from "node:path"
import {LmdbBackup, type LmdbBackupS3Options, LmdbEnv, LmdbSchema, t} from "../src/index"

const Config = {
  dir: `./backups`,
  keep: 3,
  bucket: process.env.S3_BUCKET ?? ``,
  prefix: process.env.S3_PREFIX ?? `snapshots/`,
  endpoint: process.env.S3_ENDPOINT ?? ``,
  region: process.env.S3_REGION ?? `auto`,
  accessKeyId: process.env.S3_ACCESS_KEY_ID ?? ``,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? ``,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === `true`
}

function s3Options(): LmdbBackupS3Options | undefined {
  if (!Config.bucket || !Config.accessKeyId || !Config.secretAccessKey) return undefined
  return {
    bucket: Config.bucket,
    prefix: Config.prefix,
    endpoint: Config.endpoint !== `` ? Config.endpoint : undefined,
    region: Config.region,
    accessKeyId: Config.accessKeyId,
    secretAccessKey: Config.secretAccessKey,
    forcePathStyle: Config.forcePathStyle
  }
}

class DemoSchema extends LmdbSchema {
  static db = `demo`
  static key = t.number()
  static value = {name: t.string()}
}

async function main(): Promise<void> {
  const root = join(process.cwd(), `.tmp-snapshot-demo`)
  const dir = join(root, `backups`)
  const db = new LmdbEnv({path: join(root, `data`), maxDbs: 10})
  const rows = db.register(DemoSchema)
  await rows.put(1, {name: `Alice`})

  const tick = await LmdbBackup.snapshot(db, {dir, keep: Config.keep, format: `tar.gz`, s3: s3Options()})
  console.log(`snapshot:`, tick.path, `uploaded:`, tick.uploaded ?? `(local only)`)

  // A wall-clock cron pattern, not a duration: 03:00 every day. Run it now
  // rather than waiting for the boundary.
  const handle = LmdbBackup.start(db, {dir, keep: Config.keep, pattern: `0 3 * * *`, format: `tar.gz`, s3: s3Options()})
  await handle.runNow()
  handle.stop()
  console.log(`schedule:`, handle.label(), `archives:`, LmdbBackup.listArchives(dir).length)

  await db.close()
  const latest = LmdbBackup.listArchives(dir).at(-1)
  if (!latest) throw new Error(`no archive produced`)
  const dest = await LmdbBackup.restoreArchive(latest.path, root, `revived`)
  const revived = new LmdbEnv({path: dest, maxDbs: 10})
  try {
    console.log(`revived row:`, revived.register(DemoSchema).get(1))
  } finally {
    await revived.close()
  }
  await rm(root, {recursive: true, force: true})
  console.log(`demo ok`)
}

if (import.meta.main) {
  await main().catch((err: unknown) => {
    console.error(err)
    process.exit(1)
  })
}
