/**
 * Custom codec example (non-JSON serialization).
 *
 * Run with: `bun run packages/lmdb/example/custom-codec.ts`
 *
 * Demonstrates:
 * - Static `serialize`/`deserialize` methods on a LmdbRepository subclass
 * - Using `createCodec` for inline custom serializers
 * - Storing non-JSON types (Date, Buffers, BigInt) via custom codec
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbRepository} from "../src/repository"
import {LmdbCodec} from "../src/codec"

type IVSession = {
  sid: string
  createdAt: Date
  expiresAt: Date
  data: Buffer
}
type IVDate = Date

// Static serialize/deserialize for Date <-> number (ms timestamp)
class DateRepo extends LmdbRepository<IVDate, string> {
  static dbName = `cached-date`
  static codec = LmdbCodec.create<Date, number>(
    (d: Date) => d.getTime(),
    (n: number) => new Date(n)
  )
}

// Inline static serialize/deserialize for SessionMeta <-> Buffer (msgpack-like)
class SessionRepo extends LmdbRepository<IVSession, string> {
  static dbName = `session`
  static serialize(value: IVSession): string {
    return JSON.stringify({
      sid: value.sid,
      createdAt: value.createdAt.getTime(),
      expiresAt: value.expiresAt.getTime(),
      dataB64: value.data.toString(`base64`)
    })
  }
  static deserialize(raw: any): IVSession {
    const obj = typeof raw === `string` ? JSON.parse(raw) : raw
    return {
      sid: obj.sid,
      createdAt: new Date(obj.createdAt),
      expiresAt: new Date(obj.expiresAt),
      data: Buffer.from(obj.dataB64, `base64`)
    }
  }
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-codec-`))

  try {
    const env = new LmdbEnv({path: dir, maxDbs: 3})
    await env.open()

    const dates = env.register(DateRepo)
    const sessions = env.register(SessionRepo)

    console.log(`--- Date repository (Date <-> ms timestamp) ---\n`)

    const now = new Date(`2026-06-21T10:00:00Z`)
    const later = new Date(`2026-12-31T23:59:59Z`)

    await dates.set(`now`, now)
    await dates.set(`later`, later)

    const gotNow = await dates.get(`now`)
    console.log(`get('now'):`, gotNow?.toISOString())
    console.log(`type preserved:`, gotNow instanceof Date)

    const rawDate = await (env as any).getDb(`cached-date`).get(`now`)
    console.log(`raw stored:`, rawDate, `(number ms)`)

    console.log(`\n--- Session repository (inline codec) ---\n`)

    const session: IVSession = {
      sid: `s-abc-123`,
      createdAt: now,
      expiresAt: later,
      data: Buffer.from(`hello world`)
    }
    await sessions.set(session.sid, session)

    const gotSession = await sessions.get(session.sid)
    console.log(`session.sid:`, gotSession?.sid)
    console.log(`session.createdAt:`, gotSession?.createdAt.toISOString())
    console.log(`session.data:`, gotSession?.data.toString())

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
