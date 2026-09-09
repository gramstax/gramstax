/**
 * Custom transforms (schema write/read hooks) — use when LMDB cannot represent your types natively
 * (Date, Buffer, BigInt) or you want a compact stored form.
 *
 * Run with: `bun run packages/lmdb/example/custom-codec.ts`
 *
 * Demonstrates:
 * - `static hookBeforeWrite` / `static hookBeforeRead` on an LmdbSchema —
 *   `hookBeforeWrite` runs before LMDB serializes the value,
 *   `hookBeforeRead` after it deserializes it (replaces the removed
 *   `LmdbCodec` + static `serialize`/`deserialize` class-style API).
 *   They must be declared together.
 * - Storing a `Date` field as an ms `number`, and a `Buffer` payload as a base64 string.
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbSchema, t, type ValueOf} from "../src/schema"

// Date -> ms number: the write/read hooks transform the row at the repository boundary.
type IVCachedDate = ValueOf<typeof CachedDateSchema>
class CachedDateSchema extends LmdbSchema {
  static db = `cached-date`
  static key = t.string()
  static value = {at: t.date()}
  static hookBeforeWrite = (row: unknown): unknown => ({at: (row as IVCachedDate).at.getTime()})
  static hookBeforeRead = (raw: unknown): unknown => ({at: new Date((raw as IVCachedDate).at)})
}

// Buffer -> base64 string: the write/read hooks transform the whole session row.
type IVSession = ValueOf<typeof SessionSchema>
class SessionSchema extends LmdbSchema {
  static db = `session`
  static key = t.string()
  static value = {
    sid: t.string(),
    createdAt: t.date(),
    expiresAt: t.date(),
    data: t.buffer()
  }
  static hookBeforeWrite = (row: unknown): unknown => {
    const s = row as IVSession
    return {sid: s.sid, createdAt: s.createdAt.getTime(), expiresAt: s.expiresAt.getTime(), dataB64: Buffer.from(s.data).toString(`base64`)}
  }
  static hookBeforeRead = (raw: unknown): unknown => {
    const obj = raw as IVSession
    return {sid: obj.sid, createdAt: new Date(obj.createdAt), expiresAt: new Date(obj.expiresAt), data: Buffer.from(obj.dataB64, `base64`)}
  }
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-codec-`))

  try {
    const env = new LmdbEnv({path: dir, maxDbs: 3})

    const dates = env.register(CachedDateSchema)
    const sessions = env.register(SessionSchema)

    console.log(`--- Date repository (Date <-> ms timestamp via write/read hooks) ---\n`)

    const now = new Date(`2026-06-21T10:00:00Z`)
    const later = new Date(`2026-12-31T23:59:59Z`)

    await dates.put(`now`, {at: now})
    await dates.put(`later`, {at: later})

    const gotNow: IVCachedDate | undefined = dates.get(`now`)
    console.log(`get('now').at:`, gotNow?.at?.toISOString())
    console.log(`type preserved:`, gotNow?.at instanceof Date)

    const rawDate = await env.getDb(`cached-date`).get(`now`)
    console.log(`raw stored:`, rawDate, `(ms number — encode ran before serialization)`)

    console.log(`\n--- Session repository (Buffer -> base64 + Date -> ms) ---\n`)

    const sid = `s-abc-123`
    const session: IVSession = {
      sid,
      createdAt: now,
      expiresAt: later,
      data: Buffer.from(`hello world`)
    }
    await sessions.put(sid, session)

    const gotSession = sessions.get(sid)
    console.log(`session.sid:`, gotSession?.sid)
    console.log(`session.createdAt:`, gotSession?.createdAt?.toISOString())
    console.log(`session.data:`, gotSession?.data?.toString())

    const rawSession = await env.getDb(`session`).get(sid)
    console.log(`raw stored:`, rawSession)

    await env.close()
    console.log(`\nenv closed cleanly`)
  } finally {
    rmSync(dir, {recursive: true, force: true})
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
