import {afterAll, beforeAll, describe, expect, it, mock} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import KeyvRedis from "@keyv/redis"
import {CacheExternal} from "~/cache/external"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"
import type {IRedisLockClient} from "~/types/session-lock"

const TEST_PAGES_DIR = join(import.meta.dir, `session-lock-integration-pages`)

beforeAll(async () => {
  if (!existsSync(TEST_PAGES_DIR)) {
    await mkdir(TEST_PAGES_DIR, {recursive: true})
  }
})

afterAll(async () => {
  if (existsSync(TEST_PAGES_DIR)) {
    await rm(TEST_PAGES_DIR, {recursive: true, force: true})
  }
})

const createFakeRedisCache = () => {
  const held = new Set<string>()
  const client = {
    isOpen: true,
    connect: mock(async () => {}),
    on: () => {},
    set: mock(async (key: string) => {
      if (key.startsWith(`lock:`)) {
        return held.has(key) ? null : (held.add(key), `OK`)
      }
      return `OK`
    }),
    eval: mock(async (_script: string, opts: {keys: string[]}) => (held.delete(opts.keys[0] as string), 1))
  } as unknown as IRedisLockClient
  const store = new KeyvRedis(client as never)
  const cache = new CacheExternal(`memory`, undefined, undefined, {forceStore: store})
  return {cache, client}
}

class LockProbeBot extends Gramstax {
  active = 0
  maxActive = 0
  calls = 0

  override async hookAfterRoute() {
    this.calls++
    this.active++
    this.maxActive = Math.max(this.maxActive, this.active)
    await new Promise((resolve) => setTimeout(resolve, 10))
    this.active--
  }
}

const createBot = (overrides: Record<string, unknown> = {}): LockProbeBot => {
  const tm = new TemplateManager({path: [TEST_PAGES_DIR]})
  return new LockProbeBot({
    token: `test`,
    deploy: `test`,
    templateManager: tm,
    log: false,
    botConfig: {botInfo: {id: 123456789, is_bot: true, first_name: `Bot`, username: `test_bot`}} as any,
    ...overrides
  } as never)
}

const buildText = (userId: number, text: string): Record<string, unknown> => ({
  update_id: Math.floor(Math.random() * 1000000),
  message: {
    message_id: 1,
    chat: {id: 1, type: `private`},
    date: Math.floor(Date.now() / 1000),
    from: {id: userId, is_bot: false, first_name: `T`},
    text
  }
})

describe(`session lock — handler-level integration (Redis backend)`, () => {
  it(`enables the lock when the cache is Redis-backed`, async () => {
    const {cache} = createFakeRedisCache()
    const bot = createBot({cacheSession: cache, sessionLock: {onContended: `serialize`}})
    expect((bot as unknown as {_sessionLock: unknown})._sessionLock).toBeDefined()
  })

  it(`auto-disables with memory store and warns`, async () => {
    const warns: unknown[] = []
    const bot = createBot({
      sessionLock: {},
      log: {warn: (msg: unknown) => warns.push(msg)} as never
    })
    expect((bot as unknown as {_sessionLock: unknown})._sessionLock).toBeUndefined()
    expect(warns.some((msg) => String(msg).includes(`sessionLock requires a Redis cache backend`))).toBe(true)
  })

  it(`serializes concurrent updates for the same user (serialize mode)`, async () => {
    const {cache} = createFakeRedisCache()
    const bot = createBot({cacheSession: cache, sessionLock: {onContended: `serialize`}})

    await Promise.all([bot.bot.handleUpdate(buildText(7, `a`) as never), bot.bot.handleUpdate(buildText(7, `b`) as never)])

    expect(bot.calls).toBe(2)
    expect(bot.maxActive).toBe(1)
  })

  it(`default (no lock) allows concurrent updates for the same user`, async () => {
    const bot = createBot()

    await Promise.all([bot.bot.handleUpdate(buildText(7, `a`) as never), bot.bot.handleUpdate(buildText(7, `b`) as never)])

    expect(bot.calls).toBe(2)
    expect(bot.maxActive).toBe(2)
  })

  it(`drops the update when the lease is held (skip mode)`, async () => {
    const {cache} = createFakeRedisCache()
    const bot = createBot({cacheSession: cache, sessionLock: {onContended: `skip`}})
    const lock = (bot as unknown as {_sessionLock: {acquire: (k: string) => Promise<string | null>}})._sessionLock as unknown as {acquire: (k: string) => Promise<string | null>}

    const token = await lock.acquire(`7:1`)
    expect(token).toBeTruthy()

    await bot.bot.handleUpdate(buildText(7, `a`) as never)

    expect(bot.calls).toBe(0)
    expect(bot.metrics.counts.blocked).toBe(1)
    await (bot as unknown as {_sessionLock: {release: (k: string, t: string) => Promise<void>}})._sessionLock.release(`7:1`, token as string)
  })

  it(`bypasses locking for updates without a user/chat owner`, async () => {
    const {cache} = createFakeRedisCache()
    const bot = createBot({cacheSession: cache, sessionLock: {onContended: `skip`}})

    await bot.bot.handleUpdate({update_id: Math.floor(Math.random() * 1000000), poll: {id: `p1`, question: `q`, options: []}} as never)

    expect(bot.calls).toBe(1)
    expect(bot.metrics.counts.blocked).toBe(0)
  })
})