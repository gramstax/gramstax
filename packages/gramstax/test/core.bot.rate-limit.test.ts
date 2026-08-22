import {afterAll, beforeAll, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import type {Ctx} from "~/core/ctx"
import {TemplateManager} from "~/template/manager"

const TEST_PAGES_DIR = join(import.meta.dir, `rate-limit-test-pages`)

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

class RateLimitedBot extends Gramstax {
  hits = 0

  override async hookRateLimited() {
    this.hits++
  }
}

class KeyedRateLimitBot extends RateLimitedBot {
  keys: string[] = []

  override hookKeyGenerator(ctx: Ctx) {
    this.keys.push((ctx.from?.id ?? 0).toString())
    return `global`
  }
}

function createBot<B extends Gramstax>(BotClass: new (params: never) => B, overrides: Record<string, unknown> = {}): B {
  const tm = new TemplateManager({path: [TEST_PAGES_DIR]})
  return new BotClass({
    token: `test`,
    deploy: `test`,
    templateManager: tm,
    log: false,
    botConfig: {
      botInfo: {
        id: 123456789,
        is_bot: true,
        first_name: `Bot`,
        username: `test_bot`
      }
    } as any,
    ...overrides
  } as never)
}

function buildText(text: string, userId: number = 123456789): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: 1,
      chat: {id: userId, type: `private`},
      date: Math.floor(Date.now() / 1000),
      from: {id: userId, is_bot: false, first_name: `User`},
      text
    }
  }
}

describe(`rate limiting via @grammyjs/ratelimiter`, () => {
  it(`mounts ratelimiter and calls hookRateLimited when exceeded`, async () => {
    const bot = createBot(RateLimitedBot, {rateLimit: {windowMs: 60000, max: 1}})
    await bot.bot.handleUpdate(buildText(`a`) as never)
    await bot.bot.handleUpdate(buildText(`b`) as never)
    expect(bot.hits).toBe(1)
  })

  it(`does not mount without rateLimit params`, async () => {
    const bot = createBot(RateLimitedBot)
    await bot.bot.handleUpdate(buildText(`a`) as never)
    await bot.bot.handleUpdate(buildText(`b`) as never)
    expect(bot.hits).toBe(0)
  })

  it(`hookKeyGenerator groups updates from different users into one bucket`, async () => {
    const bot = createBot(KeyedRateLimitBot, {rateLimit: {windowMs: 60000, max: 1}})
    await bot.bot.handleUpdate(buildText(`a`, 111) as never)
    await bot.bot.handleUpdate(buildText(`b`, 222) as never)
    expect(bot.keys).toEqual([`111`, `222`])
    expect(bot.hits).toBe(1)
  })

  it(`default key is per user id (different users do not share a bucket)`, async () => {
    const bot = createBot(RateLimitedBot, {rateLimit: {windowMs: 60000, max: 1}})
    await bot.bot.handleUpdate(buildText(`a`, 111) as never)
    await bot.bot.handleUpdate(buildText(`b`, 222) as never)
    expect(bot.hits).toBe(0)
  })
})
