import {afterAll, beforeAll, beforeEach, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {Ctx} from "~/core/ctx"
import {TemplateManager} from "~/template/manager"

const TEST_PAGES_DIR = join(import.meta.dir, `auto-clear-session-test-pages`)

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

// ── Page classes ──────────────────────────────────────────────────

let callbackCalled = false
let freeTextCalled = false
let sessionFreePhotoCalled = false

beforeEach(() => {
  callbackCalled = false
  freeTextCalled = false
  sessionFreePhotoCalled = false
})

class CallbackPage extends Ctx {
  static data = {name: `callbackPage`} as any

  async handleCallbackQueryData() {
    callbackCalled = true
    ;(this as any).temp.isAnswer = true
  }
}

class FreeTextPage extends Ctx {
  static data = {name: `freeTextPage`} as any

  async handleSessionFreePhoto() {
    sessionFreePhotoCalled = true
    ;(this as any).temp.isAnswer = true
  }

  async handleFreeText() {
    freeTextCalled = true
    ;(this as any).temp.isAnswer = true
  }
}

class SessionTextPage extends Ctx {
  static data = {name: `sessionTextPage`} as any

  async handleSessionFreeText() {
    ;(this as any).temp.isAnswer = true
  }
}

// ── Test subclass ──────────────────────────────────────────────────

class TestBot extends Gramstax {
  exposeBuildEmptyPages() {
    return this._buildEmptyPages()
  }

  exposePageSorts(page: typeof Ctx, pages: any, index: number) {
    this._pageSorts(page, pages, index)
  }

  override _pageLoads() {
    return this._buildEmptyPages()
  }
}

// ── help: create bot with custom pages ────────────────────────────

function createBot(pagesList: Array<{name: string; page: typeof Ctx}>): TestBot {
  const tm = new TemplateManager({path: [TEST_PAGES_DIR]})

  const bot = new TestBot({
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
    } as any
  })

  const pages = bot.exposeBuildEmptyPages()

  for (const {name, page} of pagesList) {
    page.data = {
      name,
      intentText: name,
      intentCommandText: name,
      intentCallbackQueryData: name,
      _positionArgText: 1,
      callbackQueryData: () => name
    } as any
    pages.all[name] = page
    bot.exposePageSorts(page, pages, 0)
  }

  bot.pages = pages as any
  return bot
}

// ── help: build dummy updates ────────────────────────────────────

function buildCallbackQuery(data: string): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    callback_query: {
      id: `cb-1`,
      from: {id: 123456789, is_bot: false, first_name: `User`},
      chat_instance: `ci-1`,
      message: {message_id: 1, chat: {id: 123456789, type: `private`}, date: 1},
      data
    }
  }
}

function buildText(text: string): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: 1,
      chat: {id: 123456789, type: `private`},
      date: Math.floor(Date.now() / 1000),
      from: {id: 123456789, is_bot: false, first_name: `User`},
      text
    }
  }
}

function buildPhoto(): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: 1,
      chat: {id: 123456789, type: `private`},
      date: Math.floor(Date.now() / 1000),
      from: {id: 123456789, is_bot: false, first_name: `User`},
      photo: [{file_id: `f1`, file_unique_id: `u1`, width: 100, height: 100}]
    }
  }
}

const SESSION_KEY = `123456789:123456789`

// ── tests ──────────────────────────────────────────────────────────

describe(`Gramstax auto session-clear on non-session handlers`, () => {
  it(`clears a pending session when a non-session callback handler runs (id=2)`, async () => {
    const bot = createBot([{name: `callbackPage`, page: CallbackPage}, {name: `sessionTextPage`, page: SessionTextPage}])
    expect((bot.pages as any).hasSessionRoutes).toBe(true)
    const method = (Ctx.prototype as any).methodSessionFreeText(`callbackPage`) as string
    await bot.cacheSession.set(SESSION_KEY, {method, params: {step: `left`}})

    await bot.bot.handleUpdate(buildCallbackQuery(`callbackPage`) as any)

    expect(callbackCalled).toBe(true)
    expect(await bot.cacheSession.get(SESSION_KEY)).toBeUndefined()
  })

  it(`clears a pending session of another listener type via handleFree* (id=4)`, async () => {
    const bot = createBot([{name: `freeTextPage`, page: FreeTextPage}])
    const method = (Ctx.prototype as any).methodSessionFreePhoto(`freeTextPage`) as string
    await bot.cacheSession.set(SESSION_KEY, {method, params: {}})

    await bot.bot.handleUpdate(buildText(`unknown-random-xyz`) as any)

    expect(freeTextCalled).toBe(true)
    expect(await bot.cacheSession.get(SESSION_KEY)).toBeUndefined()
  })

  it(`does not auto-clear when the session route itself is dispatched (id=1)`, async () => {
    const bot = createBot([{name: `freeTextPage`, page: FreeTextPage}])
    const method = (Ctx.prototype as any).methodSessionFreePhoto(`freeTextPage`) as string
    await bot.cacheSession.set(SESSION_KEY, {method, params: {}})

    await bot.bot.handleUpdate(buildPhoto() as any)

    expect(sessionFreePhotoCalled).toBe(true)
    expect(await bot.cacheSession.get(SESSION_KEY)).not.toBeNull()
  })

  it(`never reads or writes the external cache when the app has no session routes`, async () => {
    const bot = createBot([{name: `callbackPage`, page: CallbackPage}])
    expect((bot.pages as any).hasSessionRoutes).toBe(false)

    let getCalls = 0
    let deleteCalls = 0
    const origGet = bot.cacheSession.get.bind(bot.cacheSession)
    const origDelete = bot.cacheSession.delete.bind(bot.cacheSession)
    ;(bot.cacheSession as any).get = async (...args: unknown[]) => {
      getCalls++
      return origGet(...(args as [string]))
    }
    ;(bot.cacheSession as any).delete = async (...args: unknown[]) => {
      deleteCalls++
      return origDelete(...(args as [string]))
    }

    await bot.bot.handleUpdate(buildCallbackQuery(`callbackPage`) as any)

    expect(callbackCalled).toBe(true)
    expect(getCalls).toBe(0)
    expect(deleteCalls).toBe(0)
  })
})