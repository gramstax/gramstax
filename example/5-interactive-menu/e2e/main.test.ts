/**
 * E2E Test Flow for Interactive Menu Bot
 *
 * Setup:
 *   1. MockTelegramServer starts on random port → apiRoot captured
 *   2. BotCore initialized with webhook:http://127.0.0.1:3004/webhook/e2e-5-interactive-menu
 *   3. TemplateManager loads pages from src/pages/
 *
 * Test Flow:
 *   T1. /start → Main Menu + inline keyboard (Browse, Inline Range, Help) + bottom keyboard (Quick actions enabled)
 *   T2. /start → callback:help → editMessage → Help + Back button
 *   T3. /start → callback:category → editMessage → category list + Back button
 *   T4. /unknown → Route not found
 *   T5. /start → verify sendMessage request captured (Quick actions enabled)
 *   T6. /start → callback:help → text:gibberish → Route not found (sequential chain)
 *
 * Cleanup:
 *   - botCore.stop() + mockServer.stop() in afterAll
 *   - mockServer.clearRequests() in beforeEach
 */
import {join} from "node:path"
import {BotCore} from "../src/core/bot"
import {TemplateManager} from "gramstax"
import {MockTelegramServer} from "gramstax"
import {CatalogData} from "../src/data/catalog"
import {ItemDetailPage} from "../src/pages/item-detail"
import {describe, it, expect, beforeAll, afterAll, beforeEach} from "bun:test"

let mockServer: MockTelegramServer
let botCore: BotCore

type InlineButton = {
  text?: string
  callback_data?: string
}

type ReplyButton = {
  text?: string
}

type TestResponse = {
  body?: {
    text?: string
    reply_markup?: {
      inline_keyboard?: InlineButton[][]
      keyboard?: ReplyButton[][]
    }
  }
}

const getInlineKeyboard = (response: TestResponse | undefined) => response?.body?.reply_markup?.inline_keyboard ?? []

const getReplyKeyboard = (response: TestResponse | undefined) => response?.body?.reply_markup?.keyboard ?? []

const getButtonByText = (buttons: InlineButton[], text: string) => buttons.find((button) => button.text === text)

beforeAll(async () => {
  mockServer = new MockTelegramServer({log: false})
  await mockServer.start()

  const templateManager = new TemplateManager({path: [join(import.meta.dir, `../src/pages`)]})
  const cwd = process.cwd()
  process.chdir(join(import.meta.dir, `..`))

  botCore = new BotCore({
    deploy: `webhook:http://127.0.0.1:3004/webhook/e2e-5-interactive-menu`,
    token: `test-token`,
    log: false,
    templateManager,
    botConfig: {client: {apiRoot: mockServer.apiRoot}}
  })

  process.chdir(cwd)

  const startedAt = Date.now()
  while (!mockServer.webhookUrl && Date.now() - startedAt < 5000) {
    await new Promise((r) => setTimeout(r, 50))
  }
})

afterAll(async () => {
  await botCore.stop()
  await mockServer.stop()
})

beforeEach(() => {
  mockServer.clearRequests()
})

describe(`E2E: Interactive Menu bot via MockTelegramServer (webhook)`, () => {
  it(`responds to /start command with Main Menu and navigation buttons`, async () => {
    const responses = await mockServer.sendText(`/start`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]
    expect(reply).toBeDefined()
    expect(reply!.body?.text).toContain(`Main Menu`)

    const keyboard = reply!.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    expect(keyboard.length).toBeGreaterThan(0)

    const allButtons = keyboard.flat()
    const buttonLabels = allButtons.map((b: any) => b.text)
    expect(buttonLabels).toContain(`🔎 Browse`)
    expect(buttonLabels).toContain(`📊 Inline Range`)
    expect(buttonLabels).toContain(`❓ Help`)
  })

  it(`navigates to Help page and shows back button`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`help`)

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toContain(`Help`)

    const keyboard = edit.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    const firstButton = keyboard[0]?.[0]
    expect(firstButton?.text).toContain(`Back`)
  })

  it(`navigates to Category page and shows category buttons`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`category`)

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toContain(`category`)

    const keyboard = edit.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    const lastRow = keyboard[keyboard.length - 1]
    const backButton = lastRow?.[0]
    expect(backButton?.text).toContain(`Back`)
  })

  it(`shows route not found for unrecognized input`, async () => {
    const responses = await mockServer.sendText(`/unknown`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply).toBeDefined()
    expect(reply.body?.text).toContain(`Route not found`)
  })

  it(`captures outbound requests in mockServer.requests`, async () => {
    await mockServer.sendText(`/start`)

    const sendMessageReq = mockServer.lastRequest(`sendMessage`)
    expect(sendMessageReq).toBeDefined()
    expect(sendMessageReq?.body?.text).toContain(`Quick actions enabled`)
  })

  it(`handles multiple sequential interactions`, async () => {
    const res1 = await mockServer.sendText(`/start`)
    expect(res1[0]?.body?.text).toContain(`Main Menu`)

    mockServer.clearRequests()

    const res2 = await mockServer.sendCallbackQuery(`help`)
    expect(res2[0]?.body?.text).toContain(`Help`)

    mockServer.clearRequests()

    const res3 = await mockServer.sendText(`gibberish`)
    expect(res3[0]?.body?.text).toContain(`Route not found`)
  })

  it(`InlineWithRangePage shows paginated inline menu`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`inline-with-range`)

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Inline Menu (With Count + Range)`)
    expect(responses[0]!.body?.text).toContain(`Page 1/4`)

    const keyboard = getInlineKeyboard(responses[0])
    const buttonLabels = keyboard.flat().map((button) => button.text)
    expect(buttonLabels).toContain(CatalogData.menuItems[0]!.name)
    expect(buttonLabels).toContain(CatalogData.menuItems[1]!.name)
    expect(buttonLabels).toContain(CatalogData.menuItems[2]!.name)
    expect(buttonLabels).toContain(CatalogData.menuItems[3]!.name)
    expect(buttonLabels).toContain(`➡️ Next`)
  })

  it(`InlineWithRangePage pagination works`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const firstPageResponses = await mockServer.sendCallbackQuery(`inline-with-range`)
    expect(firstPageResponses[0]!.body?.text).toContain(`Page 1/4`)

    const nextButton = getButtonByText(getInlineKeyboard(firstPageResponses[0]).flat(), `➡️ Next`)
    expect(nextButton?.callback_data).toBeDefined()

    mockServer.clearRequests()

    const secondPageResponses = await mockServer.sendCallbackQuery(nextButton!.callback_data!)
    expect(secondPageResponses.length).toBeGreaterThan(0)
    expect(secondPageResponses[0]!.body?.text).toContain(`Page 2/4`)

    const secondPageLabels = getInlineKeyboard(secondPageResponses[0]).flat().map((button) => button.text)
    expect(secondPageLabels).toContain(`⬅️ Prev`)
    expect(secondPageLabels).toContain(CatalogData.menuItems[4]!.name)
  })

  it(`InlineWithoutRangePage shows simple inline menu`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`inline-without-range`)

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Inline Menu (Without Range`)
    expect(responses[0]!.body?.text).toContain(`Page 1`)
    expect(responses[0]!.body?.text).not.toContain(`Page 1/`)

    const buttonLabels = getInlineKeyboard(responses[0]).flat().map((button) => button.text)
    expect(buttonLabels).toContain(CatalogData.menuItems[0]!.name)
    expect(buttonLabels).toContain(`➡️ Next`)
  })

  it(`InlineWithoutRangePage pagination without total works`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const firstPageResponses = await mockServer.sendCallbackQuery(`inline-without-range`)
    expect(firstPageResponses[0]!.body?.text).toContain(`Page 1`)
    expect(firstPageResponses[0]!.body?.text).not.toContain(`Page 1/`)

    const nextButton = getButtonByText(getInlineKeyboard(firstPageResponses[0]).flat(), `➡️ Next`)
    expect(nextButton?.callback_data).toBeDefined()

    mockServer.clearRequests()

    const secondPageResponses = await mockServer.sendCallbackQuery(nextButton!.callback_data!)
    expect(secondPageResponses.length).toBeGreaterThan(0)
    expect(secondPageResponses[0]!.body?.text).toContain(`Page 2`)
    expect(secondPageResponses[0]!.body?.text).not.toContain(`Page 2/`)

    const secondPageLabels = getInlineKeyboard(secondPageResponses[0]).flat().map((button) => button.text)
    expect(secondPageLabels).toContain(`⬅️ Prev`)
    expect(secondPageLabels).toContain(CatalogData.menuItems[4]!.name)
  })

  it(`CategoryPage to ItemListPage browses categories then items`, async () => {
    const category = CatalogData.list[0]!

    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const categoryResponses = await mockServer.sendCallbackQuery(`category`)

    expect(categoryResponses.length).toBeGreaterThan(0)
    expect(categoryResponses[0]!.body?.text).toContain(`Choose a category`)

    const categoryButtons = getInlineKeyboard(categoryResponses[0]).flat()
    const categoryButton = getButtonByText(categoryButtons, category.name)
    expect(categoryButton?.callback_data).toBeDefined()

    mockServer.clearRequests()

    const itemListResponses = await mockServer.sendCallbackQuery(categoryButton!.callback_data!)
    expect(itemListResponses.length).toBeGreaterThan(0)
    expect(itemListResponses[0]!.body?.text).toContain(`Items in ${category.name}`)

    const itemButtons = getInlineKeyboard(itemListResponses[0]).flat().map((button) => button.text)
    expect(itemButtons).toContain(category.items[0]!.name)
    expect(itemButtons).toContain(category.items[1]!.name)
    expect(itemButtons).toContain(category.items[2]!.name)
  })

  it(`ItemDetailPage shows item detail`, async () => {
    const category = CatalogData.list[0]!
    const item = category.items[0]!

    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const categoryResponses = await mockServer.sendCallbackQuery(`category`)
    const categoryButton = getButtonByText(getInlineKeyboard(categoryResponses[0]).flat(), category.name)
    expect(categoryButton?.callback_data).toBeDefined()

    mockServer.clearRequests()

    const itemListResponses = await mockServer.sendCallbackQuery(categoryButton!.callback_data!)
    const expectedDetailCallback = ItemDetailPage.data.callbackData(`detail`, category.id, item.id)
    const detailButton = getButtonByText(getInlineKeyboard(itemListResponses[0]).flat(), item.name)
    expect(detailButton?.callback_data).toBe(expectedDetailCallback)

    mockServer.clearRequests()

    const detailResponses = await mockServer.sendCallbackQuery(expectedDetailCallback)
    expect(detailResponses.length).toBeGreaterThan(0)
    expect(detailResponses[0]!.body?.text).toContain(item.name)
    expect(detailResponses[0]!.body?.text).toContain(item.description)
  })

  it(`ResetPage reset clears state`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`reset`)

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Reset complete`)

    const firstButton = getInlineKeyboard(responses[0])[0]?.[0]
    expect(firstButton?.text).toContain(`Back`)
  })

  it(`BottomKeyboard shows on /start second response`, async () => {
    const responses = await mockServer.sendText(`/start`)

    expect(responses.length).toBeGreaterThan(1)
    expect(responses[0]!.body?.text).toContain(`Main Menu`)

    const startButtons = getInlineKeyboard(responses[0]).flat().map((button) => button.text)
    expect(startButtons).toContain(`🔎 Browse`)
    expect(startButtons).toContain(`📊 Inline Range`)
    expect(startButtons).toContain(`🧾 Inline WRange`)
    expect(startButtons).toContain(`❓ Help`)
    expect(startButtons).toContain(`♻️ Reset`)

    expect(responses[1]!.body?.text).toContain(`Quick actions enabled`)

    const bottomButtons = getReplyKeyboard(responses[1]).flat().map((button) => button.text)
    expect(bottomButtons).toContain(`🏠 Home`)
    expect(bottomButtons).toContain(`🔎 Browse`)
    expect(bottomButtons).toContain(`❓ Help`)
    expect(bottomButtons).toContain(`♻️ Reset`)
  })

  it(`Full Browse Flow goes category to item list to item detail and back to menu`, async () => {
    const category = CatalogData.list[0]!
    const item = category.items[0]!

    const startResponses = await mockServer.sendText(`/start`)
    expect(startResponses[0]!.body?.text).toContain(`Main Menu`)

    mockServer.clearRequests()

    const categoryResponses = await mockServer.sendCallbackQuery(`category`)
    expect(categoryResponses[0]!.body?.text).toContain(`Choose a category`)

    const categoryButton = getButtonByText(getInlineKeyboard(categoryResponses[0]).flat(), category.name)
    expect(categoryButton?.callback_data).toBeDefined()

    mockServer.clearRequests()

    const itemListResponses = await mockServer.sendCallbackQuery(categoryButton!.callback_data!)
    expect(itemListResponses[0]!.body?.text).toContain(`Items in ${category.name}`)

    const detailCallback = ItemDetailPage.data.callbackData(`detail`, category.id, item.id)

    mockServer.clearRequests()

    const detailResponses = await mockServer.sendCallbackQuery(detailCallback)
    expect(detailResponses[0]!.body?.text).toContain(item.name)

    const backToListButton = getButtonByText(getInlineKeyboard(detailResponses[0]).flat(), `⬅️ Back to List`)
    expect(backToListButton?.callback_data).toBeDefined()

    mockServer.clearRequests()

    const backToListResponses = await mockServer.sendCallbackQuery(backToListButton!.callback_data!)
    expect(backToListResponses[0]!.body?.text).toContain(`Items in ${category.name}`)

    const backToCategoryButton = getButtonByText(getInlineKeyboard(backToListResponses[0]).flat(), `⬅️ Back`)
    expect(backToCategoryButton?.callback_data).toBeDefined()

    mockServer.clearRequests()

    const backToCategoryResponses = await mockServer.sendCallbackQuery(backToCategoryButton!.callback_data!)
    expect(backToCategoryResponses[0]!.body?.text).toContain(`Choose a category`)

    const backToMenuButton = getButtonByText(getInlineKeyboard(backToCategoryResponses[0]).flat(), `⬅️ Back`)
    expect(backToMenuButton?.callback_data).toBeDefined()

    mockServer.clearRequests()

    const backToMenuResponses = await mockServer.sendCallbackQuery(backToMenuButton!.callback_data!)
    expect(backToMenuResponses[0]!.body?.text).toContain(`Main Menu`)
  })
})
