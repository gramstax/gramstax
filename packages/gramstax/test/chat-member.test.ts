import {afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {chatMemberFilter, myChatMemberFilter} from "@grammyjs/chat-members"
import {Gramstax} from "~/core/bot"
import {Ctx} from "~/core/ctx"
import {TemplateManager} from "~/template/manager"

const TEST_PAGES_DIR = join(import.meta.dir, `chat-member-test-pages`)

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

// Test subclass to expose protected methods
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

// ── helper: build a dummy chat_member update ──────────────────────

function buildChatMemberUpdate(
  oldStatus: string,
  newStatus: string,
  oldIsMember?: boolean,
  newIsMember?: boolean,
  userId: number = 1001,
  botId: number = 123456789,
  chatId: number = -1001
): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    chat_member: {
      chat: {id: chatId, type: `supergroup`, title: `Test Group`},
      from: {id: userId, is_bot: false, first_name: `User`},
      date: Math.floor(Date.now() / 1000),
      old_chat_member: {
        user: {id: userId, is_bot: userId === botId, first_name: `User`},
        status: oldStatus,
        ...(oldStatus === `restricted` ? {is_member: oldIsMember ?? false} : {})
      },
      new_chat_member: {
        user: {id: userId, is_bot: userId === botId, first_name: `User`},
        status: newStatus,
        ...(newStatus === `restricted` ? {is_member: newIsMember ?? true} : {})
      }
    }
  }
}

function buildMyChatMemberUpdate(
  oldStatus: string,
  newStatus: string,
  chatId: number = -1001,
  botId: number = 123456789
): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    my_chat_member: {
      chat: {id: chatId, type: `supergroup`, title: `Test Group`},
      from: {id: botId, is_bot: true, first_name: `GramstaxBot`},
      date: Math.floor(Date.now() / 1000),
      old_chat_member: {
        user: {id: botId, is_bot: true, first_name: `GramstaxBot`},
        status: oldStatus
      },
      new_chat_member: {
        user: {id: botId, is_bot: true, first_name: `GramstaxBot`},
        status: newStatus
      }
    }
  }
}

// ── Page classes with chat member handlers ───────────────────────

let welcomeCalled = false
let botPromotedCalled = false
let botDemotedCalled = false
let handlerCallOrder: string[] = []

beforeEach(() => {
  welcomeCalled = false
  botPromotedCalled = false
  botDemotedCalled = false
  handlerCallOrder = []
})

class WelcomePage extends Ctx {
  static data = {name: `welcome`} as any

  async handleChatMemberOutIn() {
    welcomeCalled = true
    handlerCallOrder.push(`welcome`)
    // Signal that this handler answered
    ;(this as any).temp.isAnswer = true
  }
}

class AdminPage extends Ctx {
  static data = {name: `admin`} as any

  async handleMyChatMemberRegularAdmin() {
    botPromotedCalled = true
    handlerCallOrder.push(`admin-promoted`)
    ;(this as any).temp.isAnswer = true
  }

  async handleMyChatMemberAdminRegular() {
    botDemotedCalled = true
    handlerCallOrder.push(`admin-demoted`)
    ;(this as any).temp.isAnswer = true
  }
}

// ── help: create bot with custom pages ───────────────────────────

function createBot(
  pagesList: Array<{name: string; page: typeof Ctx}>
): TestBot {
  const tm = new TemplateManager({path: [TEST_PAGES_DIR]})

  const bot = new TestBot({
    token: `test`,
    deploy: `test`,
    templateManager: tm,
    log: false,
    botConfig: {botInfo: {id: 123456789, is_bot: true, first_name: `Bot`, username: `test_bot`}} as any
  })

  // Build mock pages structure
  const pages = bot.exposeBuildEmptyPages()
  for (const {name, page} of pagesList) {
    page.data = page.data || {name, intentText: name, intentCommandText: name, intentCallbackQueryData: name, _positionArgText: 1, callbackQueryData: () => name} as any
    pages.all[name] = page
    bot.exposePageSorts(page, pages, 0)
  }

  // Pre-compute chat member filters
  if (pages.routeChatMember.length > 0) {
    for (const route of pages.routeChatMember) {
      const factory = route.type === `chatMember` ? chatMemberFilter : myChatMemberFilter
      route.filter = factory(route.oldStatus as any, route.newStatus as any) as (ctx: any) => boolean
    }
  }

  bot.pages = pages as any
  bot.bot.on(`chat_member`, (ctx) => bot._onHandle(ctx, `chatmember`, false))
  bot.bot.on(`my_chat_member`, (ctx) => bot._onHandle(ctx, `mychatmember`, false))
  return bot
}

// ── tests ────────────────────────────────────────────────────────

describe(`chat member routing`, () => {
  it(`should parse handleChatMemberOutIn route`, () => {
    const bot = createBot([{name: `welcome`, page: WelcomePage}])
    const route = bot.pages.routeChatMember[0]
    expect(route).toBeDefined()
    expect(route!.name).toBe(`welcome`)
    expect(route!.routeName).toBe(`handleChatMemberOutIn`)
    expect(route!.type).toBe(`chatMember`)
    expect(route!.oldStatus).toBe(`out`)
    expect(route!.newStatus).toBe(`in`)
  })

  it(`should parse handleMyChatMemberRegularAdmin route`, () => {
    const bot = createBot([{name: `admin`, page: AdminPage}])
    const cmRoutes = bot.pages.routeChatMember
    const promotedRoute = cmRoutes.find((r: any) => r.routeName === `handleMyChatMemberRegularAdmin`)
    expect(promotedRoute).toBeDefined()
    expect(promotedRoute!.type).toBe(`myChatMember`)
    expect(promotedRoute!.oldStatus).toBe(`regular`)
    expect(promotedRoute!.newStatus).toBe(`admin`)
  })

  it(`should dispatch handleChatMemberOutIn when user joins (kicked → member)`, async () => {
    const bot = createBot([{name: `welcome`, page: WelcomePage}])
    const update = buildChatMemberUpdate(`kicked`, `member`)
    await bot.bot.handleUpdate(update as any)
    expect(welcomeCalled).toBe(true)
  })

  it(`should dispatch handleChatMemberOutIn when user joins (left → administrator)`, async () => {
    const bot = createBot([{name: `welcome`, page: WelcomePage}])
    const update = buildChatMemberUpdate(`left`, `administrator`)
    await bot.bot.handleUpdate(update as any)
    expect(welcomeCalled).toBe(true)
  })

  it(`should dispatch handleChatMemberOutIn when restricted user becomes member`, async () => {
    const bot = createBot([{name: `welcome`, page: WelcomePage}])
    const update = buildChatMemberUpdate(`restricted`, `member`, false, true)
    await bot.bot.handleUpdate(update as any)
    expect(welcomeCalled).toBe(true)
  })

  it(`should NOT dispatch when user leaves (member → kicked)`, async () => {
    const bot = createBot([{name: `welcome`, page: WelcomePage}])
    const update = buildChatMemberUpdate(`member`, `kicked`)
    await bot.bot.handleUpdate(update as any)
    expect(welcomeCalled).toBe(false)
  })

  it(`should NOT dispatch when user status unchanged (member → administrator)`, async () => {
    const bot = createBot([{name: `welcome`, page: WelcomePage}])
    const update = buildChatMemberUpdate(`member`, `administrator`)
    await bot.bot.handleUpdate(update as any)
    expect(welcomeCalled).toBe(false)
  })

  it(`should dispatch handleMyChatMemberRegularAdmin when bot promoted`, async () => {
    const bot = createBot([{name: `admin`, page: AdminPage}])
    const update = buildMyChatMemberUpdate(`member`, `administrator`)
    await bot.bot.handleUpdate(update as any)
    expect(botPromotedCalled).toBe(true)
  })

  it(`should dispatch handleMyChatMemberAdminRegular when bot demoted`, async () => {
    const bot = createBot([{name: `admin`, page: AdminPage}])
    const update = buildMyChatMemberUpdate(`administrator`, `member`)
    await bot.bot.handleUpdate(update as any)
    expect(botDemotedCalled).toBe(true)
  })

  it(`should NOT dispatch myChatMember when status transition does not match`, async () => {
    const bot = createBot([{name: `admin`, page: AdminPage}])
    const update = buildMyChatMemberUpdate(`member`, `kicked`)
    await bot.bot.handleUpdate(update as any)
    expect(botPromotedCalled).toBe(false)
    expect(botDemotedCalled).toBe(false)
  })

  it(`should dispatch the correct handler when multiple pages exist`, async () => {
    const bot = createBot([
      {name: `welcome`, page: WelcomePage},
      {name: `admin`, page: AdminPage}
    ])

    // User joins — should trigger welcome only
    const userJoin = buildChatMemberUpdate(`kicked`, `member`, undefined, undefined, 2001)
    await bot.bot.handleUpdate(userJoin as any)
    expect(welcomeCalled).toBe(true)
    expect(botPromotedCalled).toBe(false)
    expect(botDemotedCalled).toBe(false)
  })

  it(`should dispatch the handler only for matching update type (chat_member vs my_chat_member)`, async () => {
    const bot = createBot([
      {name: `welcome`, page: WelcomePage},
      {name: `admin`, page: AdminPage}
    ])

    // Bot promoted → should trigger myChatMember handler only
    const botPromotion = buildMyChatMemberUpdate(`member`, `administrator`)
    await bot.bot.handleUpdate(botPromotion as any)
    expect(botPromotedCalled).toBe(true)
    expect(welcomeCalled).toBe(false)
  })

  it(`should register zero chat member routes when no page has handlers`, () => {
    class EmptyPage extends Ctx {
      static data = {name: `empty`} as any
    }
    const bot = createBot([{name: `empty`, page: EmptyPage}])
    expect(bot.pages.routeChatMember.length).toBe(0)
  })

  it(`should register chat_member listeners via constructor`, async () => {
    const bot = createBot([{name: `welcome`, page: WelcomePage}])
    const update = buildChatMemberUpdate(`kicked`, `member`)
    welcomeCalled = false
    await bot.bot.handleUpdate(update as any)
    expect(welcomeCalled).toBe(true)
  })

  it(`should support handleChatMember with array-like status transitions`, async () => {
    // Test that "restricted" → "member" (with is_member change) triggers properly
    const bot = createBot([{name: `welcome`, page: WelcomePage}])
    const update = buildChatMemberUpdate(`restricted`, `administrator`, false, true)
    await bot.bot.handleUpdate(update as any)
    expect(welcomeCalled).toBe(true)
  })

  it(`should NOT respond to regular text messages`, async () => {
    const bot = createBot([{name: `welcome`, page: WelcomePage}])
    const textUpdate = {
      update_id: 1,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: {id: 1001, type: `private`},
        from: {id: 2001, is_bot: false, first_name: `Test`},
        text: `hello`
      }
    }
    await bot.bot.handleUpdate(textUpdate as any)
    expect(welcomeCalled).toBe(false)
  })
})
