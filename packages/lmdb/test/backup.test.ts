import {afterEach, describe, expect, it} from "bun:test"
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "node:fs"
import {join} from "node:path"
import type {S3Client} from "@aws-sdk/client-s3"
import {LmdbBackup, type LmdbBackupS3Options} from "../src/backup"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {LmdbSchema, t} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

class ValSchema extends LmdbSchema {
  static db = `vals`
  static key = t.number()
  static value = {n: t.number()}
}

const dirs: Array<string> = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmWithRetry(dir)
})

function setupEnv(): {env: LmdbEnv; dir: string; base: string} {
  const dir = createTestDir(`backup-src`)
  const base = join(dir, `backups`)
  dirs.push(dir)
  const env = new LmdbEnv({path: join(dir, `data`), maxDbs: 10})
  return {env, dir, base}
}

describe(`LmdbBackup`, () => {
  it(`backup creates timestamped dir and prunes to keep`, async () => {
    const {env, base} = setupEnv()
    try {
      const subs = env.register(ValSchema)
      await subs.put(1, {n: 7})
      const first = await LmdbBackup.backup(env, base, 2)
      expect(existsSync(first)).toBe(true)
      const second = await LmdbBackup.backup(env, base, 2)
      expect(existsSync(second)).toBe(true)
      const third = await LmdbBackup.backup(env, base, 1)
      expect(existsSync(first)).toBe(false)
      expect(existsSync(second)).toBe(false)
      expect(existsSync(third)).toBe(true)
    } finally {
      await env.close()
    }
  })

  it(`prune never touches foreign files`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      mkdirSync(base, {recursive: true})
      const foreign = join(base, `notes.txt`)
      writeFileSync(foreign, `do not delete`)
      await LmdbBackup.backup(env, base, 1)
      await LmdbBackup.backup(env, base, 1)
      expect(existsSync(foreign)).toBe(true)
    } finally {
      await env.close()
    }
  })

  it(`list returns backups oldest-first`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      const a = await LmdbBackup.backup(env, base, 5)
      const b = await LmdbBackup.backup(env, base, 5)
      const entries = LmdbBackup.list(base)
      expect(entries.map((e) => e.path)).toEqual([a, b])
      expect(entries[0]?.mtimeMs).toBeLessThanOrEqual(entries[1]?.mtimeMs ?? 0)
    } finally {
      await env.close()
    }
  })

  it(`restore round-trips data`, async () => {
    const {env, dir, base} = setupEnv()
    try {
      const subs = env.register(ValSchema)
      await subs.put(1, {n: 42})
      const src = await LmdbBackup.backup(env, base, 3)
      await env.close()
      const dest = join(dir, `restored`)
      await LmdbBackup.restore(src, dest)
      const revived = new LmdbEnv({path: dest, maxDbs: 10})
      try {
        const rows = revived.register(ValSchema)
        expect(rows.get(1)).toEqual({n: 42})
      } finally {
        await revived.close()
      }
    } finally {
      if (env.state === `open`) await env.close()
    }
  })

  it(`restore rejects non-backup source and existing dest`, async () => {
    const {env, dir, base} = setupEnv()
    try {
      env.register(ValSchema)
      const empty = join(dir, `empty`)
      mkdirSync(empty, {recursive: true})
      await expect(LmdbBackup.restore(empty, join(dir, `out`))).rejects.toBeInstanceOf(LmdbError)
      const src = await LmdbBackup.backup(env, base, 3)
      const dest = join(dir, `taken`)
      mkdirSync(dest, {recursive: true})
      await expect(LmdbBackup.restore(src, dest)).rejects.toBeInstanceOf(LmdbError)
      await LmdbBackup.restore(src, dest, {overwrite: true})
      expect(existsSync(join(dest, `data.mdb`))).toBe(true)
    } finally {
      await env.close()
    }
  })

  it(`start ticks on schedule and stop halts`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      const handle = LmdbBackup.start(env, {dir: base, keep: 5, intervalMs: 20, runOnStart: true})
      expect(handle.label()).toContain(`20`)
      await new Promise((resolve) => setTimeout(resolve, 120))
      handle.stop()
      const count = readdirSync(base).filter((n) => n.startsWith(`backup-`)).length
      expect(count).toBeGreaterThanOrEqual(1)
      // An in-flight tick may still land right after stop — wait it out, then
      // the count must stay flat (no further ticks).
      await new Promise((resolve) => setTimeout(resolve, 120))
      const settled = readdirSync(base).filter((n) => n.startsWith(`backup-`)).length
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(readdirSync(base).filter((n) => n.startsWith(`backup-`)).length).toBe(settled)
    } finally {
      await env.close()
    }
  })

  it(`start rejects bad interval`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      expect(() => LmdbBackup.start(env, {dir: base, intervalMs: 0})).toThrow(LmdbError)
    } finally {
      await env.close()
    }
  })

  it(`snapshot tar.gz archives, prunes, and restores`, async () => {
    const {env, dir, base} = setupEnv()
    try {
      const subs = env.register(ValSchema)
      await subs.put(1, {n: 9})
      const {path: first} = await LmdbBackup.snapshot(env, {dir: base, keep: 5, format: `tar.gz`})
      expect(first.endsWith(`.tar.gz`)).toBe(true)
      expect(existsSync(first)).toBe(true)
      expect(LmdbBackup.listArchives(base).map((e) => e.path)).toEqual([first])
      await LmdbBackup.snapshot(env, {dir: base, keep: 1, format: `tar.gz`})
      expect(existsSync(first)).toBe(false)
      expect(LmdbBackup.listArchives(base)).toHaveLength(1)
      const leftovers = readdirSync(base).filter((n) => n.endsWith(`.part`))
      expect(leftovers).toEqual([])
      await env.close()
      const dest = join(dir, `revived`)
      await LmdbBackup.restoreArchive(LmdbBackup.listArchives(base)[0]!.path, dir, `revived`)
      const revived = new LmdbEnv({path: dest, maxDbs: 10})
      try {
        expect(revived.register(ValSchema).get(1)).toEqual({n: 9})
      } finally {
        await revived.close()
      }
    } finally {
      if (env.state === `open`) await env.close()
    }
  })

  it(`snapshot rejects bad format and dir-format S3`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      const badFormat = LmdbBackup.snapshot(env, {dir: base, format: `zip` as never})
      await expect(badFormat).rejects.toBeInstanceOf(LmdbError)
      const s3 = {bucket: `b`, accessKeyId: `k`, secretAccessKey: `s`}
      const dirS3 = LmdbBackup.snapshot(env, {dir: base, format: `dir`, s3})
      await expect(dirS3).rejects.toBeInstanceOf(LmdbError)
    } finally {
      await env.close()
    }
  })

  it(`restoreArchive rejects missing archive`, async () => {
    const {env, dir} = setupEnv()
    try {
      env.register(ValSchema)
      await expect(LmdbBackup.restoreArchive(join(dir, `nope.tar.gz`), dir, `out`)).rejects.toBeInstanceOf(LmdbError)
    } finally {
      await env.close()
    }
  })

  it(`uploadToS3 validates config before network`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      const src = (await LmdbBackup.snapshot(env, {dir: base, keep: 3, format: `tar.gz`})).path
      const s3 = {bucket: ``, accessKeyId: ``, secretAccessKey: ``}
      await expect(LmdbBackup.uploadToS3(src, s3)).rejects.toBeInstanceOf(LmdbError)
    } finally {
      await env.close()
    }
  })

  it(`list returns [] for missing dir`, () => {
    expect(LmdbBackup.list(join(`no-such-dir`, `x`))).toEqual([])
    expect(LmdbBackup.listArchives(join(`no-such-dir`, `x`))).toEqual([])
  })

  it(`clearStaleStaging removes crash leftovers only`, async () => {
    const dir = createTestDir(`stale-`)
    dirs.push(dir)
    mkdirSync(join(dir, `backup-stale`), {recursive: true})
    writeFileSync(join(dir, `notes.txt`), `keep`)
    await LmdbBackup.clearStaleStaging(dir)
    expect(existsSync(join(dir, `backup-stale`))).toBe(false)
    expect(existsSync(join(dir, `notes.txt`))).toBe(true)
  })

  it(`snapshot tar.gz on closed env rejects and cleans staging`, async () => {
    const {env, base} = setupEnv()
    env.register(ValSchema)
    await env.close()
    await expect(LmdbBackup.snapshot(env, {dir: base, keep: 3, format: `tar.gz`})).rejects.toBeInstanceOf(LmdbError)
    expect(readdirSync(base).filter((n) => n.startsWith(`backup-`))).toEqual([])
  })

  it(`restore rejects missing source`, async () => {
    const {env, dir} = setupEnv()
    try {
      env.register(ValSchema)
      await expect(LmdbBackup.restore(join(dir, `nope`), join(dir, `out`))).rejects.toBeInstanceOf(LmdbError)
    } finally {
      await env.close()
    }
  })

  it(`start validates format`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      const s3 = {bucket: `b`, accessKeyId: `k`, secretAccessKey: `s`}
      expect(() => LmdbBackup.start(env, {dir: base, intervalMs: 10, format: `zip` as never})).toThrow(LmdbError)
      expect(() => LmdbBackup.start(env, {dir: base, intervalMs: 10, format: `dir`, s3})).toThrow(LmdbError)
    } finally {
      await env.close()
    }
  })

  it(`start routes tick failures to onError`, async () => {
    const {env, base} = setupEnv()
    env.register(ValSchema)
    await env.close()
    const seen: Array<unknown> = []
    const handle = LmdbBackup.start(env, {dir: base, intervalMs: 15, runOnStart: true, onError: (err: unknown) => seen.push(err)})
    await new Promise((resolve) => setTimeout(resolve, 100))
    handle.stop()
    expect(seen.length).toBeGreaterThanOrEqual(1)
    expect(seen[0]).toBeInstanceOf(Error)
  })

  it(`snapshot tar.gz uploads to fake S3 and prunes remote`, async () => {
    const {env, base} = setupEnv()
    try {
      env.register(ValSchema)
      const calls: Array<string> = []
      const remote = [
        {Key: `snapshots/old.tar.gz`, LastModified: new Date(`2020-01-01T00:00:00Z`)},
        {Key: `snapshots/older.tar.gz`, LastModified: new Date(`2019-01-01T00:00:00Z`)}
      ]
      const s3 = {...s3Creds(), client: fakeS3(calls, remote)}
      const {path, uploaded} = await LmdbBackup.snapshot(env, {dir: base, keep: 1, format: `tar.gz`, s3})
      expect(path.endsWith(`.tar.gz`)).toBe(true)
      expect(uploaded?.endsWith(`.tar.gz`)).toBe(true)
      expect(calls).toContain(`PutObjectCommand`)
      expect(calls).toContain(`DeleteObjectsCommand`)
    } finally {
      await env.close()
    }
  })

  it(`pruneS3Archives removes oldest beyond keep`, async () => {
    const calls: Array<string> = []
    const remote = [
      {Key: `snapshots/a.tar.gz`, LastModified: new Date(`2020-01-01T00:00:00Z`)},
      {Key: `snapshots/b.tar.gz`, LastModified: new Date(`2021-01-01T00:00:00Z`)},
      {Key: `snapshots/c.tar.gz`, LastModified: new Date(`2022-01-01T00:00:00Z`)}
    ]
    const s3 = {...s3Creds(), client: fakeS3(calls, remote)}
    const {removed} = await LmdbBackup.pruneS3Archives(s3, 1)
    expect(removed).toEqual([`snapshots/a.tar.gz`, `snapshots/b.tar.gz`])
  })

  it(`downloadFromS3 writes body to file`, async () => {
    const dir = createTestDir(`s3dl-`)
    dirs.push(dir)
    const calls: Array<string> = []
    const s3 = {...s3Creds(), client: fakeS3(calls, [])}
    const dest = join(dir, `out.tar.gz`)
    await LmdbBackup.downloadFromS3(s3, `snapshots/x.tar.gz`, dest)
    expect(readFileSync(dest, `utf8`)).toBe(`hello`)
  })

  it(`_peer maps missing modules to LmdbError`, async () => {
    const peer = (LmdbBackup as unknown as {_peer<T>(specifier: string, hint: string): Promise<T>})._peer
    await expect(peer(`no-such-peer-xyz`, `install hint`)).rejects.toThrow(`install hint`)
  })

  it(`_resolveS3 constructs a real client from fields`, async () => {
    const client = await (LmdbBackup as unknown as {_resolveS3(o: LmdbBackupS3Options): Promise<unknown>})._resolveS3({
      ...s3Creds(),
      endpoint: `https://s3.example.com`,
      region: `us-east-1`,
      forcePathStyle: true
    })
    expect((client as {constructor: {name: string}}).constructor.name).toBe(`S3Client`)
  })
})

function s3Creds(): LmdbBackupS3Options {
  return {bucket: `b`, accessKeyId: `k`, secretAccessKey: `s`}
}

function fakeS3(calls: Array<string>, objects: Array<{Key: string; LastModified: Date}>, body = `hello`): S3Client {
  return {
    send: async (cmd: unknown) => {
      const kind = (cmd as {constructor: {name: string}}).constructor.name
      calls.push(kind)
      if (kind === `PutObjectCommand`) return {$metadata: {httpStatusCode: 200}}
      if (kind === `ListObjectsV2Command`) {
        return {Contents: objects.map((o) => ({Key: o.Key, LastModified: o.LastModified})), IsTruncated: false}
      }
      if (kind === `DeleteObjectsCommand`) return {}
      if (kind === `GetObjectCommand`) {
        return {
          Body: new ReadableStream({
            start(c) {
              c.enqueue(new TextEncoder().encode(body))
              c.close()
            }
          })
        }
      }
      throw new Error(`unexpected ${kind}`)
    }
  } as unknown as S3Client
}
