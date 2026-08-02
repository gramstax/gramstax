import {afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {Ctx} from "~/core/ctx"
import {TemplateManager} from "~/template/manager"

const TEST_PAGES_DIR = join(import.meta.dir, `non-message-routing-test-pages`)

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

// ── Page classes with non-message free handlers ──────────────────

let channelPostCalled = false

beforeEach(() => {
  channelPostCalled = false
})

class ChannelPage extends Ctx {
  static data = {name: `channelHandler`} as any

  async handleFreeChannelPost() {
    channelPostCalled = true
    ;(this as any).temp.isAnswer = true
  }
}

class InlinePage extends Ctx {
  static data = {name: `inlineHandler`} as any

  async handleFreeInlineQuery() {
    ;(this as any).temp.isAnswer = true
  }
}

class PollPage extends Ctx {
  static data = {name: `pollHandler`} as any

  async handleFreePoll() {
    ;(this as any).temp.isAnswer = true
  }
}

class JoinRequestPage extends Ctx {
  static data = {name: `joinHandler`} as any

  async handleFreeChatJoinRequest() {
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
    const pages = this._buildEmptyPages()
    return pages
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

  // Build mock pages structure
  const pages = bot.exposeBuildEmptyPages()

  // Override pageLoads output to include our test pages
  for (const {name, page} of pagesList) {
    page.data =
      page.data ||
      ({
        name,
        intentText: name,
        intentCommandText: name,
        intentCallbackQueryData: name,
        _positionArgText: 1,
        callbackQueryData: () => name
      } as any)
    pages.all[name] = page
    bot.exposePageSorts(page, pages, 0)
  }

  bot.pages = pages as any
  return bot
}

// ── help: build dummy updates ────────────────────────────────────

function buildChannelPost(text: string): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    channel_post: {
      message_id: 1,
      chat: {id: -1001234567890, type: `channel`, title: `Test Channel`},
      date: Math.floor(Date.now() / 1000),
      text
    }
  }
}

// ── tests ──────────────────────────────────────────────────────────

describe(`non-message free routing`, () => {
  it(`should register handleFreeChannelPost in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `channelHandler`, page: ChannelPage}])
    const dyn = (bot.pages.routeDynamicSpesific as any).channelpost
    expect(dyn).toBeDefined()
    expect(dyn.length).toBe(1)
    expect(dyn[0]!.name).toBe(`channelHandler`)
    expect(dyn[0]!.routeName).toBe(`handleFreeChannelPost`)
  })

  it(`should register handleFreeInlineQuery in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `inlineHandler`, page: InlinePage}])
    const dyn = (bot.pages.routeDynamicSpesific as any).inlinequery
    expect(dyn).toBeDefined()
    expect(dyn.length).toBe(1)
    expect(dyn[0]!.name).toBe(`inlineHandler`)
  })

  it(`should register handleFreePoll in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `pollHandler`, page: PollPage}])
    const dyn = (bot.pages.routeDynamicSpesific as any).poll
    expect(dyn).toBeDefined()
    expect(dyn.length).toBe(1)
  })

  it(`should register handleFreeChatJoinRequest in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `joinHandler`, page: JoinRequestPage}])
    const dyn = (bot.pages.routeDynamicSpesific as any).chatjoinrequest
    expect(dyn).toBeDefined()
    expect(dyn.length).toBe(1)
  })

  it(`should dispatch handleFreeChannelPost on channel_post`, async () => {
    const bot = createBot([{name: `channelHandler`, page: ChannelPage}])
    const update = buildChannelPost(`test message`)
    await bot.bot.handleUpdate(update as any)
    expect(channelPostCalled).toBe(true)
  })

  it(`should have handleFreeInlineQuery registered in listRouteDynamicSpesific`, () => {
    const bot = createBot([{name: `inlineHandler`, page: InlinePage}])
    const hasRoute = (bot.pages.listRouteDynamicSpesific as readonly string[]).includes(`handleFreeInlineQuery`)
    expect(hasRoute).toBe(true)
  })

  it(`should have handleFreePoll registered in listRouteDynamicSpesific`, () => {
    const bot = createBot([{name: `pollHandler`, page: PollPage}])
    const hasRoute = (bot.pages.listRouteDynamicSpesific as readonly string[]).includes(`handleFreePoll`)
    expect(hasRoute).toBe(true)
  })

  it(`should have handleFreeChatJoinRequest registered in listRouteDynamicSpesific`, () => {
    const bot = createBot([{name: `joinHandler`, page: JoinRequestPage}])
    const hasRoute = (bot.pages.listRouteDynamicSpesific as readonly string[]).includes(`handleFreeChatJoinRequest`)
    expect(hasRoute).toBe(true)
  })
})
