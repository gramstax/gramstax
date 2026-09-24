import {afterAll, beforeAll, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {Ctx} from "~/core/ctx"
import {TemplateManager} from "~/template/manager"

const TEST_PAGES_DIR = join(import.meta.dir, `max-text-length-pages`)

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

class LengthPage extends Ctx {
  static data = {name: `lengthprobe`} as any
  static textHits = 0
  static photoHits = 0

  async handleFreeText(): Promise<void> {
    LengthPage.textHits += 1
  }

  async handleFreePhoto(): Promise<void> {
    LengthPage.photoHits += 1
  }
}

class LengthBot extends Gramstax {
  override _pageLoads() {
    return this._buildEmptyPages()
  }
}

class HookedLengthBot extends LengthBot {
  override hookUpdateError: ((event: unknown) => void) | undefined
  override hookUpdate: ((event: unknown) => void) | undefined
}

function createLengthBot(maxTextLength: number): {bot: HookedLengthBot; errors: unknown[]; updates: unknown[]} {
  const errors: unknown[] = []
  const updates: unknown[] = []
  const bot = new HookedLengthBot({
    token: `test:token`,
    deploy: `test`,
    log: false,
    updateTimeoutMs: 0,
    maxTextLength,
    templateManager: new TemplateManager({path: [TEST_PAGES_DIR]}),
    botConfig: {
      botInfo: {
        id: 123456789,
        is_bot: true,
        first_name: `Bot`,
        username: `test_bot`
      }
    } as any
  })
  bot.hookUpdateError = (event) => {
    errors.push(event)
  }
  bot.hookUpdate = (event) => {
    updates.push(event)
  }
  bot._pageSorts(LengthPage, bot.pages as any, 0)
  return {bot, errors, updates}
}

function buildTextUpdate(text: string, updateId: number): Record<string, unknown> {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat: {id: 9001, type: `private`, first_name: `Bench`},
      from: {id: 9001, is_bot: false, first_name: `Bench`},
      text
    }
  }
}

function buildPhotoUpdate(caption: string, updateId: number): Record<string, unknown> {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat: {id: 9001, type: `private`, first_name: `Bench`},
      from: {id: 9001, is_bot: false, first_name: `Bench`},
      photo: [{file_id: `pic`, width: 1, height: 1}],
      caption
    }
  }
}

describe(`maxTextLength dispatch guard`, () => {
  it(`rejects oversized text without routing to the handler`, async () => {
    const {bot, errors, updates} = createLengthBot(5)
    LengthPage.textHits = 0
    await bot.bot.handleUpdate(buildTextUpdate(`toolongtext`, 501) as any)
    expect(LengthPage.textHits).toBe(0)
    expect(bot.metrics.counts.skippedValidation).toBe(1)
    expect(errors.length).toBe(1)
    expect((errors[0] as {state: string}).state).toBe(`validation`)
    expect(updates.length).toBe(0)
    await bot.stop().catch(() => undefined)
  })

  it(`rejects oversized captions without routing to the handler`, async () => {
    const {bot, errors} = createLengthBot(5)
    LengthPage.photoHits = 0
    await bot.bot.handleUpdate(buildPhotoUpdate(`toolongcaption`, 502) as any)
    expect(LengthPage.photoHits).toBe(0)
    expect(bot.metrics.counts.skippedValidation).toBe(1)
    expect(errors.length).toBe(1)
    expect((errors[0] as {state: string}).state).toBe(`validation`)
    await bot.stop().catch(() => undefined)
  })

  it(`routes within-limit text normally`, async () => {
    const {bot, errors} = createLengthBot(5)
    LengthPage.textHits = 0
    await bot.bot.handleUpdate(buildTextUpdate(`hey`, 503) as any)
    expect(LengthPage.textHits).toBe(1)
    expect(bot.metrics.counts.skippedValidation).toBe(0)
    expect(errors.length).toBe(0)
    await bot.stop().catch(() => undefined)
  })

  it(`treats zero as unlimited`, async () => {
    const {bot} = createLengthBot(0)
    LengthPage.textHits = 0
    await bot.bot.handleUpdate(buildTextUpdate(`a`.repeat(5000), 504) as any)
    expect(LengthPage.textHits).toBe(1)
    expect(bot.metrics.counts.skippedValidation).toBe(0)
    await bot.stop().catch(() => undefined)
  })
})
