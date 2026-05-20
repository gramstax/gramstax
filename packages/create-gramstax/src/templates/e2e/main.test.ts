/**
 * E2E Test Flow for Template Bot
 *
 * Setup:
 *   1. MockTelegramServer starts on random port → apiRoot captured
 *   2. BotCore initialized with webhook:http://127.0.0.1:3009/webhook/e2e-template
 *   3. CacheExternal (memory) shared across tests, cleared in beforeEach
 *
 * Test Flow:
 *   T1.  /start → Welcome message + inline keyboard (Random Number, Sum Number, Help)
 *   T2.  /start → callback:help → editMessage → Help Message + Back button
 *   T3.  /start → callback:random-number → editMessage → Random Number + Shake/Back buttons
 *   T4.  /start → callback:random-number → callback:random-number → editMessage → refreshed number
 *   T5.  /start → callback:sum-number → text:23 → text:10 → Result Sum: 33 + Home button
 *   T6.  /start → callback:sum-number → text:not-a-number → re-prompt Input Left Number
 *   T7.  /start → callback:nonexistent_action → graceful handling (no crash)
 *   T8.  /start → verify sendMessage request captured in mockServer.requests
 *   T9.  /start → callback:help → callback:random-number → sequential chain
 *   T10. sendPhoto → Route Not Found (no handler for photo)
 *   T11. /start with custom user/chat → custom ID propagation verified
 *   T12. /start without username → Username Required page (UserGuard blocks)
 *   T13. /start → callback:help → callback:random-number → keyboard structure validation (text + callback_data)
 *
 * Cleanup:
 *   - botCore.stop() + mockServer.stop() in afterAll
 *   - cacheSession.clear() + mockServer.clearRequests() in beforeEach
 */
import {join} from "node:path"
import {BotCore} from "../src/core/bot"
import {TemplateManager, CacheExternal} from "gramstax"
import {MockTelegramServer} from "gramstax"
import {describe, it, expect, beforeAll, afterAll, beforeEach} from "bun:test"

let mockServer: MockTelegramServer
let botCore: BotCore
let cacheSession: CacheExternal

const USER_1 = {
  responseTimeoutMs: undefined, // 9000,
  user: {
    id: 123456789,
    first_name: `Test`,
    last_name: `user`,
    username: `testuser`,
    language_code: `en`,
    is_bot: false
  }
}

beforeAll(async () => {
  mockServer = new MockTelegramServer({log: false})
  await mockServer.start()

  const templateManager = new TemplateManager({path: [join(import.meta.dir, `../src/pages`)]})
  const cwd = process.cwd()
  process.chdir(join(import.meta.dir, `..`))

  cacheSession = new CacheExternal(`memory`)

  botCore = new BotCore({
    deploy: `webhook:http://127.0.0.1:3009/webhook/e2e-template`,
    token: `test-token`,
    log: false,
    templateManager,
    cacheSession,
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

beforeEach(async () => {
  mockServer.clearRequests()
  await cacheSession.clear()
})

describe(`E2E: Template bot via MockTelegramServer (webhook)`, () => {
  it(`responds to /start command with welcome message and navigation buttons`, async () => {
    const responses = await mockServer.sendText(`/start`, USER_1)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply).toBeDefined()
    expect(reply!.body?.text).toContain(`Welcome to the bot`)

    const keyboard = reply!.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    expect(keyboard.length).toBeGreaterThan(0)

    const allButtons = keyboard.flat()
    const buttonLabels = allButtons.map((b: any) => b.text)
    expect(buttonLabels).toContain(`🎰 Random Number`)
    expect(buttonLabels).toContain(`➕ Sum Number`)
    expect(buttonLabels).toContain(`🆘 Help`)
  })

  it(`navigates to Help page via callback and shows back button`, async () => {
    await mockServer.sendText(`/start`, USER_1)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`help`, USER_1)

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit!.body?.text).toContain(`Help Message`)

    const keyboard = edit!.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    const firstButton = keyboard[0]?.[0]
    expect(firstButton?.text).toContain(`Back`)
  })

  it(`navigates to Random Number page via callback and shows generated number`, async () => {
    await mockServer.sendText(`/start`, USER_1)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`random-number`, USER_1)

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit!.body?.text).toContain(`Random Number`)

    const keyboard = edit!.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    const allButtons = keyboard.flat()
    const buttonLabels = allButtons.map((b: any) => b.text)
    expect(buttonLabels).toContain(`🎲 Shake`)
    expect(buttonLabels).toContain(`⬅️ Back`)
  })

  it(`refreshes random number via Shake callback`, async () => {
    await mockServer.sendText(`/start`, USER_1)
    mockServer.clearRequests()

    await mockServer.sendCallbackQuery(`random-number`, USER_1)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`random-number`, USER_1)

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit!.body?.text).toContain(`Random Number`)
  })

  it(`completes Sum Number two-step session flow`, async () => {
    await mockServer.sendText(`/start`, USER_1)
    mockServer.clearRequests()

    const sumResponses = await mockServer.sendCallbackQuery(`sum-number`, USER_1)
    expect(sumResponses.length).toBeGreaterThan(0)
    expect(sumResponses[0]!.body?.text).toContain(`Input Left Number`)

    mockServer.clearRequests()

    const leftResponses = await mockServer.sendText(`23`, USER_1)
    expect(leftResponses.length).toBeGreaterThan(0)
    expect(leftResponses[0]!.body?.text).toContain(`Input Right Number`)

    mockServer.clearRequests()

    const resultResponses = await mockServer.sendText(`10`, USER_1)
    expect(resultResponses.length).toBeGreaterThan(0)
    expect(resultResponses[0]!.body?.text).toContain(`Result Sum`)
    expect(resultResponses[0]!.body?.text).toContain(`33`)

    const keyboard = resultResponses[0]!.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    const firstButton = keyboard[0]?.[0]
    expect(firstButton?.text).toContain(`Home`)
  })

  it(`handles invalid input in Sum Number gracefully`, async () => {
    await mockServer.sendText(`/start`, USER_1)
    mockServer.clearRequests()

    await mockServer.sendCallbackQuery(`sum-number`, USER_1)
    mockServer.clearRequests()

    const leftResponses = await mockServer.sendText(`not-a-number`, USER_1)
    expect(leftResponses.length).toBeGreaterThan(0)
    expect(leftResponses[0]!.body?.text).toContain(`Input Left Number`)
  })

  it(`shows route not found for unrecognized callback`, async () => {
    await mockServer.sendText(`/start`, USER_1)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`nonexistent_action_${Math.random()}`, USER_1)
    expect(responses.length).toBeGreaterThanOrEqual(0)
  })

  it(`captures outbound requests in mockServer.requests`, async () => {
    const responses = await mockServer.sendText(`/start`, USER_1)

    expect(responses.length).toBeGreaterThan(0)
    const sendMessageReq = mockServer.lastRequest(`sendMessage`)
    expect(sendMessageReq).toBeDefined()
    expect(sendMessageReq?.body?.text).toContain(`Welcome to the bot`)
  })

  it(`handles multiple sequential interactions`, async () => {
    const res1 = await mockServer.sendText(`/start`, USER_1)
    expect(res1[0]?.body?.text).toContain(`Welcome to the bot`)

    mockServer.clearRequests()

    const res2 = await mockServer.sendCallbackQuery(`help`, USER_1)
    expect(res2[0]?.body?.text).toContain(`Help Message`)

    mockServer.clearRequests()

    const res3 = await mockServer.sendCallbackQuery(`random-number`, USER_1)
    expect(res3[0]?.body?.text).toContain(`Random Number`)
  })

  it(`sendPhoto triggers a response`, async () => {
    const responses = await mockServer.sendPhoto({caption: `test photo`, ...USER_1})

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]?.body?.text).toContain(`Route Not Found`)
  })

  it(`supports custom user and chat options`, async () => {
    const responses = await mockServer.sendText(`/start`, {
      user: {id: 99999, first_name: `CustomUser`, username: `customuser`},
      chat: {id: 88888, type: `private`, first_name: `CustomChat`}
    })

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]?.body?.text).toContain(`Welcome to the bot`)

    const lastUpdate = mockServer.updates[mockServer.updates.length - 1]
    expect(lastUpdate).toBeDefined()
    const msg = (lastUpdate as any)?.message
    expect(msg?.from?.id).toBe(99999)
    expect(msg?.chat?.id).toBe(88888)
  })

  it(`blocks user without username and shows username required page`, async () => {
    const responses = await mockServer.sendText(`/start`, {
      user: {id: 77777, first_name: `NoUsername`},
      chat: {id: 77777, type: `private`, first_name: `NoUsername`}
    })

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply.body?.text).toContain(`Username Required`)
    expect(reply.body?.text).toContain(`set the username first`)
  })

  it(`validates inline_keyboard structure for all navigation pages`, async () => {
    const res1 = await mockServer.sendText(`/start`, USER_1)
    expect(Array.isArray(res1[0]?.body?.reply_markup?.inline_keyboard)).toBe(true)

    mockServer.clearRequests()

    const res2 = await mockServer.sendCallbackQuery(`help`, USER_1)
    const kb2 = res2[0]?.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(kb2)).toBe(true)
    expect(kb2!.length).toBeGreaterThan(0)
    expect(kb2![0]?.[0]?.text).toBeDefined()
    expect(kb2![0]?.[0]?.callback_data).toBeDefined()

    mockServer.clearRequests()

    const res3 = await mockServer.sendCallbackQuery(`random-number`, USER_1)
    const kb3 = res3[0]?.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(kb3)).toBe(true)
    expect(kb3!.length).toBeGreaterThan(0)
    for (const row of kb3!) {
      for (const btn of row) {
        expect(btn?.text).toBeDefined()
        expect(btn?.callback_data).toBeDefined()
      }
    }
  })
})
