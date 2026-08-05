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
let businessMessageCalled = false
let successfulPaymentCalled = false
let chatBoostCalled = false
let reactionCountCalled = false
let giveawayCalled = false
let webAppDataCalled = false
let userSharedCalled = false
let pinMessageCalled = false
let forumTopicCreatedCalled = false
let proximityAlertCalled = false
let newChatTitleCalled = false
let customRouteCalled = false
let sessionNicheCalled = false

beforeEach(() => {
  channelPostCalled = false
  businessMessageCalled = false
  successfulPaymentCalled = false
  chatBoostCalled = false
  reactionCountCalled = false
  giveawayCalled = false
  webAppDataCalled = false
  userSharedCalled = false
  pinMessageCalled = false
  forumTopicCreatedCalled = false
  proximityAlertCalled = false
  newChatTitleCalled = false
  customRouteCalled = false
  sessionNicheCalled = false
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

class BusinessPage extends Ctx {
  static data = {name: `businessHandler`} as any

  async handleFreeBusinessMessage() {
    businessMessageCalled = true
    ;(this as any).temp.isAnswer = true
  }
}

class PaymentPage extends Ctx {
  static data = {name: `paymentHandler`} as any

  async handleFreeSuccessfulPayment() {
    successfulPaymentCalled = true
    ;(this as any).temp.isAnswer = true
  }
}

class BoostPage extends Ctx {
  static data = {name: `boostHandler`} as any

  async handleFreeChatBoost() {
    chatBoostCalled = true
    ;(this as any).temp.isAnswer = true
  }
}

class ReactionCountPage extends Ctx {
  static data = {name: `reactionCountHandler`} as any

  async handleFreeMessageReactionCount() {
    reactionCountCalled = true
    ;(this as any).temp.isAnswer = true
  }
}

class GiveawayPage extends Ctx {
  static data = {name: `giveawayHandler`} as any

  async handleFreeGiveaway() {
    giveawayCalled = true
    ;(this as any).temp.isAnswer = true
  }
}

class WebAppPage extends Ctx {
  static data = {name: `webAppHandler`} as any

  async handleFreeWebAppData() {
    webAppDataCalled = true
    ;(this as any).temp.isAnswer = true
  }
}

class UserSharedPage extends Ctx {
  static data = {name: `userSharedHandler`} as any

  async handleFreeUserShared() {
    userSharedCalled = true
    ;(this as any).temp.isAnswer = true
  }
}

class PinMessagePage extends Ctx {
  static data = {name: `pinMessageHandler`} as any

  async handleFreePinMessage() {
    pinMessageCalled = true
    ;(this as any).temp.isAnswer = true
  }
}

class NichePage extends Ctx {
  static data = {name: `nicheHandler`} as any

  async handleFreeForumTopicCreated() {
    forumTopicCreatedCalled = true
    ;(this as any).temp.isAnswer = true
  }

  async handleFreeForumTopicEdited() {
    ;(this as any).temp.isAnswer = true
  }

  async handleFreeForumTopicClosed() {
    ;(this as any).temp.isAnswer = true
  }

  async handleFreeForumTopicReopened() {
    ;(this as any).temp.isAnswer = true
  }

  async handleFreeGeneralForumTopicHidden() {
    ;(this as any).temp.isAnswer = true
  }

  async handleFreeGeneralForumTopicUnhidden() {
    ;(this as any).temp.isAnswer = true
  }

  async handleFreeProximityAlertTriggered() {
    proximityAlertCalled = true
    ;(this as any).temp.isAnswer = true
  }

  async handleFreeConnectedWebsite() {
    ;(this as any).temp.isAnswer = true
  }

  async handleFreePassportData() {
    ;(this as any).temp.isAnswer = true
  }

  async handleFreeMessageAutoDeleteTimerChanged() {
    ;(this as any).temp.isAnswer = true
  }

  async handleFreeChatBackgroundSet() {
    ;(this as any).temp.isAnswer = true
  }

  async handleFreeNewChatTitle() {
    newChatTitleCalled = true
    ;(this as any).temp.isAnswer = true
  }

  async handleFreeNewChatPhoto() {
    ;(this as any).temp.isAnswer = true
  }

  async handleFreeDeleteChatPhoto() {
    ;(this as any).temp.isAnswer = true
  }

  async handleFreeWriteAccessAllowed() {
    ;(this as any).temp.isAnswer = true
  }
}

class CustomRoutePage extends Ctx {
  static data = {name: `customRouteHandler`} as any

  async handleCustomInlineQuery() {
    customRouteCalled = true
    ;(this as any).temp.isAnswer = true
  }
}

class SessionNichePage extends Ctx {
  static data = {name: `sessionNicheHandler`} as any

  async handleSessionFreeNewChatTitle() {
    sessionNicheCalled = true
    ;(this as any).temp.isAnswer = true
  }
}

class SessionProbePage extends Ctx {
  static data = {name: `sessionProbeHandler`} as any
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

function expectRegistered(bot: TestBot, key: string) {
  const dyn = (bot.pages.routeDynamicSpesific as any)[key]
  expect(dyn).toBeDefined()
  expect(dyn.length).toBe(1)
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

function buildBusinessMessage(text: string): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    business_message: {
      message_id: 1,
      chat: {id: -1001234567890, type: `channel`, title: `Business Channel`},
      date: Math.floor(Date.now() / 1000),
      text
    }
  }
}

function buildSuccessfulPayment(): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: 1,
      chat: {id: 123456789, type: `private`},
      date: Math.floor(Date.now() / 1000),
      from: {id: 123456789, is_bot: false, first_name: `Payer`},
      successful_payment: {
        currency: `USD`,
        total_amount: 100,
        invoice_payload: `payload-1`,
        telegram_payment_charge_id: `charge-1`,
        provider_payment_charge_id: `provider-1`
      }
    }
  }
}

function buildChatBoost(): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    chat_boost: {
      chat: {id: -1001234567890, type: `channel`, title: `Boosted Channel`},
      boost_added_date: Math.floor(Date.now() / 1000),
      boost: {
        boost_id: `boost-1`,
        add_unix_time: Math.floor(Date.now() / 1000),
        expiration_unix_time: Math.floor(Date.now() / 1000) + 86400,
        source: {source: `premium`, user: {id: 123456789, is_bot: false, first_name: `Booster`}}
      }
    }
  }
}

function buildMessageReactionCount(): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message_reaction_count: {
      chat: {id: -1001234567890, type: `channel`, title: `Reaction Channel`},
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      reactions: []
    }
  }
}

function buildGiveaway(): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: 1,
      chat: {id: -1001234567890, type: `channel`, title: `Giveaway Channel`},
      date: Math.floor(Date.now() / 1000),
      giveaway: {
        chats: [{id: -1001234567890, type: `channel`, title: `Giveaway Channel`}],
        winners_selection_date: Math.floor(Date.now() / 1000) + 86400,
        winner_count: 1
      }
    }
  }
}

function buildWebAppData(): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: 1,
      chat: {id: 123456789, type: `private`},
      date: Math.floor(Date.now() / 1000),
      from: {id: 123456789, is_bot: false, first_name: `WebApp User`},
      web_app_data: {button_text: `Open App`, data: `app-data`}
    }
  }
}

function buildUsersShared(): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: 1,
      chat: {id: 123456789, type: `private`},
      date: Math.floor(Date.now() / 1000),
      from: {id: 123456789, is_bot: false, first_name: `Sharer`},
      users_shared: {request_id: 1, user_ids: [987654321]}
    }
  }
}

function buildPinMessage(): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: 1,
      chat: {id: -1001234567890, type: `channel`, title: `Pinned Channel`},
      date: Math.floor(Date.now() / 1000),
      pinned_message: {
        message_id: 2,
        chat: {id: -1001234567890, type: `channel`, title: `Pinned Channel`},
        date: Math.floor(Date.now() / 1000),
        text: `pinned content`
      }
    }
  }
}

function buildForumTopicCreated(): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: 1,
      chat: {id: -1001234567890, type: `supergroup`, title: `Forum Group`},
      date: Math.floor(Date.now() / 1000),
      forum_topic_created: {name: `New Topic`, icon_color: 0x6fb9f0}
    }
  }
}

function buildProximityAlert(): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: 1,
      chat: {id: -1001234567890, type: `supergroup`, title: `Proximity Group`},
      date: Math.floor(Date.now() / 1000),
      proximity_alert_triggered: {
        traveler: {id: 111, is_bot: false, first_name: `Traveler`},
        watcher: {id: 222, is_bot: false, first_name: `Watcher`},
        distance: 50
      }
    }
  }
}

function buildNewChatTitle(): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: 1,
      chat: {id: -1001234567890, type: `group`, title: `Old Title`},
      date: Math.floor(Date.now() / 1000),
      new_chat_title: `New Title`
    }
  }
}

function buildInlineQuery(): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    inline_query: {
      id: `iq-1`,
      from: {id: 123456789, is_bot: false, first_name: `Query User`},
      query: `test`,
      offset: ``
    }
  }
}

// ── tests ──────────────────────────────────────────────────────────

describe(`Gramstax non-message free routing`, () => {
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

  it(`should register handleFreeBusinessMessage in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `businessHandler`, page: BusinessPage}])
    const dyn = (bot.pages.routeDynamicSpesific as any).businessmessage
    expect(dyn).toBeDefined()
    expect(dyn.length).toBe(1)
    expect(dyn[0]!.name).toBe(`businessHandler`)
    expect(dyn[0]!.routeName).toBe(`handleFreeBusinessMessage`)
  })

  it(`should dispatch handleFreeBusinessMessage on business_message`, async () => {
    const bot = createBot([{name: `businessHandler`, page: BusinessPage}])
    const update = buildBusinessMessage(`hello business`)
    await bot.bot.handleUpdate(update as any)
    expect(businessMessageCalled).toBe(true)
  })

  it(`should register handleFreeSuccessfulPayment in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `paymentHandler`, page: PaymentPage}])
    const dyn = (bot.pages.routeDynamicSpesific as any).successfulpayment
    expect(dyn).toBeDefined()
    expect(dyn.length).toBe(1)
  })

  it(`should dispatch handleFreeSuccessfulPayment on successful_payment`, async () => {
    const bot = createBot([{name: `paymentHandler`, page: PaymentPage}])
    const update = buildSuccessfulPayment()
    await bot.bot.handleUpdate(update as any)
    expect(successfulPaymentCalled).toBe(true)
  })

  it(`should register handleFreeChatBoost in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `boostHandler`, page: BoostPage}])
    const dyn = (bot.pages.routeDynamicSpesific as any).chatboost
    expect(dyn).toBeDefined()
    expect(dyn.length).toBe(1)
  })

  it(`should dispatch handleFreeChatBoost on chat_boost`, async () => {
    const bot = createBot([{name: `boostHandler`, page: BoostPage}])
    const update = buildChatBoost()
    await bot.bot.handleUpdate(update as any)
    expect(chatBoostCalled).toBe(true)
  })

  it(`should register handleFreeMessageReactionCount in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `reactionCountHandler`, page: ReactionCountPage}])
    const dyn = (bot.pages.routeDynamicSpesific as any).messagereactioncount
    expect(dyn).toBeDefined()
    expect(dyn.length).toBe(1)
  })

  it(`should dispatch handleFreeMessageReactionCount on message_reaction_count`, async () => {
    const bot = createBot([{name: `reactionCountHandler`, page: ReactionCountPage}])
    const update = buildMessageReactionCount()
    await bot.bot.handleUpdate(update as any)
    expect(reactionCountCalled).toBe(true)
  })

  it(`should register handleFreeGiveaway in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `giveawayHandler`, page: GiveawayPage}])
    const dyn = (bot.pages.routeDynamicSpesific as any).giveaway
    expect(dyn).toBeDefined()
    expect(dyn.length).toBe(1)
  })

  it(`should dispatch handleFreeGiveaway on giveaway message`, async () => {
    const bot = createBot([{name: `giveawayHandler`, page: GiveawayPage}])
    const update = buildGiveaway()
    await bot.bot.handleUpdate(update as any)
    expect(giveawayCalled).toBe(true)
  })

  it(`should register handleFreeWebAppData in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `webAppHandler`, page: WebAppPage}])
    const dyn = (bot.pages.routeDynamicSpesific as any).webappdata
    expect(dyn).toBeDefined()
    expect(dyn.length).toBe(1)
  })

  it(`should dispatch handleFreeWebAppData on web_app_data`, async () => {
    const bot = createBot([{name: `webAppHandler`, page: WebAppPage}])
    const update = buildWebAppData()
    await bot.bot.handleUpdate(update as any)
    expect(webAppDataCalled).toBe(true)
  })

  it(`should register handleFreeUserShared in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `userSharedHandler`, page: UserSharedPage}])
    const dyn = (bot.pages.routeDynamicSpesific as any).usershared
    expect(dyn).toBeDefined()
    expect(dyn.length).toBe(1)
  })

  it(`should dispatch handleFreeUserShared on users_shared`, async () => {
    const bot = createBot([{name: `userSharedHandler`, page: UserSharedPage}])
    const update = buildUsersShared()
    await bot.bot.handleUpdate(update as any)
    expect(userSharedCalled).toBe(true)
  })

  it(`should register handleFreePinMessage in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `pinMessageHandler`, page: PinMessagePage}])
    const dyn = (bot.pages.routeDynamicSpesific as any).pinmessage
    expect(dyn).toBeDefined()
    expect(dyn.length).toBe(1)
  })

  it(`should dispatch handleFreePinMessage on pinned message`, async () => {
    const bot = createBot([{name: `pinMessageHandler`, page: PinMessagePage}])
    const update = buildPinMessage()
    await bot.bot.handleUpdate(update as any)
    expect(pinMessageCalled).toBe(true)
  })
})

// ── niche service-message routing ────────────────────────────────

describe(`Gramstax niche service-message routing`, () => {
  it(`should register handleFreeForumTopicCreated in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    expectRegistered(bot, `forumtopiccreated`)
  })

  it(`should register handleFreeForumTopicEdited in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    expectRegistered(bot, `forumtopicedited`)
  })

  it(`should register handleFreeForumTopicClosed in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    expectRegistered(bot, `forumtopicclosed`)
  })

  it(`should register handleFreeForumTopicReopened in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    expectRegistered(bot, `forumtopicreopened`)
  })

  it(`should register handleFreeGeneralForumTopicHidden in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    expectRegistered(bot, `generalforumtopichidden`)
  })

  it(`should register handleFreeGeneralForumTopicUnhidden in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    expectRegistered(bot, `generalforumtopicunhidden`)
  })

  it(`should register handleFreeProximityAlertTriggered in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    expectRegistered(bot, `proximityalerttriggered`)
  })

  it(`should register handleFreeConnectedWebsite in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    expectRegistered(bot, `connectedwebsite`)
  })

  it(`should register handleFreePassportData in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    expectRegistered(bot, `passportdata`)
  })

  it(`should register handleFreeMessageAutoDeleteTimerChanged in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    expectRegistered(bot, `messageautodeletetimerchanged`)
  })

  it(`should register handleFreeChatBackgroundSet in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    expectRegistered(bot, `chatbackgroundset`)
  })

  it(`should register handleFreeNewChatTitle in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    expectRegistered(bot, `newchattitle`)
  })

  it(`should register handleFreeNewChatPhoto in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    expectRegistered(bot, `newchatphoto`)
  })

  it(`should register handleFreeDeleteChatPhoto in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    expectRegistered(bot, `deletechatphoto`)
  })

  it(`should register handleFreeWriteAccessAllowed in routeDynamicSpesific`, () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    expectRegistered(bot, `writeaccessallowed`)
  })

  it(`should dispatch handleFreeForumTopicCreated on forum_topic_created`, async () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    await bot.bot.handleUpdate(buildForumTopicCreated() as any)
    expect(forumTopicCreatedCalled).toBe(true)
  })

  it(`should dispatch handleFreeProximityAlertTriggered on proximity_alert_triggered`, async () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    await bot.bot.handleUpdate(buildProximityAlert() as any)
    expect(proximityAlertCalled).toBe(true)
  })

  it(`should dispatch handleFreeNewChatTitle on new_chat_title`, async () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    await bot.bot.handleUpdate(buildNewChatTitle() as any)
    expect(newChatTitleCalled).toBe(true)
  })

  it(`should register handleSessionFreeForumTopicCreated in routeStaticSession`, () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    const ss = (bot.pages.routeStaticSession as any).handleSessionFreeForumTopicCreated
    expect(ss).toBeDefined()
  })

  it(`should register handleSessionFreeProximityAlertTriggered in routeStaticSession`, () => {
    const bot = createBot([{name: `nicheHandler`, page: NichePage}])
    const ss = (bot.pages.routeStaticSession as any).handleSessionFreeProximityAlertTriggered
    expect(ss).toBeDefined()
  })
})

// ── registerCustomRoute contract ─────────────────────────────────

describe(`Gramstax registerCustomRoute`, () => {
  it(`should dispatch a custom route on its registered event`, async () => {
    const bot = createBot([{name: `customRouteHandler`, page: CustomRoutePage}])
    bot.registerCustomRoute({
      name: `customRouteHandler`,
      routeName: `handleCustomInlineQuery`,
      listenerName: `inlinequery`,
      event: `inline_query`,
      filter: () => true
    } as any)
    await bot.bot.handleUpdate(buildInlineQuery() as any)
    expect(customRouteCalled).toBe(true)
  })

  it(`should be idempotent when the same routeName is registered twice`, () => {
    const bot = createBot([{name: `customRouteHandler`, page: CustomRoutePage}])
    const entry = {
      name: `customRouteHandler`,
      routeName: `handleCustomInlineQuery`,
      listenerName: `inlinequery`,
      event: `inline_query`,
      filter: () => true
    } as any
    bot.registerCustomRoute(entry)
    bot.registerCustomRoute(entry)
    expect(bot.pages.routeCustom.length).toBe(1)
  })

  it(`should throw when routeName does not start with 'handle'`, () => {
    const bot = createBot([{name: `customRouteHandler`, page: CustomRoutePage}])
    expect(() =>
      bot.registerCustomRoute({
        name: `customRouteHandler`,
        routeName: `customInlineQuery`,
        listenerName: `inlinequery`,
        event: `inline_query`,
        filter: () => true
      } as any)
    ).toThrow()
  })

  it(`should throw when listenerName does not match the built-in listener for the event`, () => {
    const bot = createBot([{name: `customRouteHandler`, page: CustomRoutePage}])
    expect(() =>
      bot.registerCustomRoute({
        name: `customRouteHandler`,
        routeName: `handleCustomInlineQuery`,
        listenerName: `custominlinequery`,
        event: `inline_query`,
        filter: () => true
      } as any)
    ).toThrow()
  })
})

// ── session triune (handleSession* ↔ setSession* ↔ methodSession*) ──

describe(`Gramstax session triune`, () => {
  it(`every handleSessionFree* has a matching methodSessionFree* on Ctx`, () => {
    const bot = createBot([])
    const proto = Ctx.prototype as any
    for (const routeName of bot.pages.listRouteStaticSession) {
      const normalized = routeName.replace(`handle`, ``).replace(/^Session/, ``)
      expect(typeof proto[`methodSession${normalized}`]).toBe(`function`)
    }
  })

  it(`methodSessionFree* produces unique session keys`, () => {
    const bot = createBot([])
    const proto = Ctx.prototype as any
    const seen = new Set<string>()
    for (const routeName of bot.pages.listRouteStaticSession) {
      const normalized = routeName.replace(`handle`, ``).replace(/^Session/, ``)
      const key = proto[`methodSession${normalized}`](`P`) as string
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it(`dispatches handleSessionFreeNewChatTitle when session method is active`, async () => {
    const bot = createBot([{name: `sessionNicheHandler`, page: SessionNichePage}])
    const method = (Ctx.prototype as any).methodSessionFreeNewChatTitle(`sessionNicheHandler`) as string
    await bot.cacheSession.set(`-1001234567890`, {method, params: {}})
    await bot.bot.handleUpdate(buildNewChatTitle() as any)
    expect(sessionNicheCalled).toBe(true)
  })

  it(`executes every handleSessionFree* through its setSessionFree* + methodSessionFree*`, async () => {
    const executed = new Set<string>()
    const probe = createBot([])
    const proto = SessionProbePage.prototype as any
    for (const sessionRoute of probe.pages.listRouteStaticSession) {
      proto[sessionRoute] = async function (this: Ctx) {
        executed.add(sessionRoute)
        ;(this as any).temp.isAnswer = true
      }
    }

    const bot = createBot([{name: `sessionProbeHandler`, page: SessionProbePage}])
    const cn = {id: 123456789, is_bot: false, first_name: `Probe`}
    const ct = {
      update: {
        update_id: 1,
        message: {message_id: 1, date: 1, chat: {id: 123456789, type: `private`}, from: cn, text: `x`},
        from: cn,
        chat: {id: 123456789, type: `private`}
      },
      from: cn,
      chat: {id: 123456789, type: `private`}
    } as any
    const allPairs = [...bot.pages.listRouteStatic, ...bot.pages.listRouteStaticIntent, ...bot.pages.listRouteDynamicSpesific] as readonly string[]

    for (const sessionRoute of probe.pages.listRouteStaticSession) {
      const rest = sessionRoute.slice(`handleSession`.length)
      const pairRoute = `handle${rest}`
      if (!allPairs.includes(pairRoute)) {
        throw new Error(`no pair for ${sessionRoute} (expected ${pairRoute})`)
      }
      const listenerName = pairRoute.replace(`handle`, ``).replace(`Args`, ``).replace(`Command`, ``).replace(`Caption`, ``).replace(`Free`, ``).toLowerCase()

      const ctx = new SessionProbePage({
        ct: ct as any,
        cacheSession: (bot as any).cacheSession,
        cacheKeyboard: (bot as any).cacheKeyboard,
        templateManager: (bot as any).templateManager,
        temp: {isAnswer: false, session: {}, data: {}}
      }) as unknown as Ctx
      await (ctx as any)[`setSession${rest}`]({probe: sessionRoute})
      const res = await bot._pageRoutes(ctx, listenerName)
      if (res.state !== `matched`) {
        throw new Error(`sessionRoute=${sessionRoute} listener=${listenerName} setter=setSession${rest} got ${res.state}`)
      }
      expect(executed.has(sessionRoute)).toBe(true)
    }
  })
})
