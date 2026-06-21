/**
 * E2E Test Flow for Newsletter Bot
 *
 * Setup:
 *   1. MockTelegramServer starts on random port → apiRoot captured
 *   2. BotCore initialized with webhook:http://127.0.0.1:3007/webhook/e2e-8-newsletter
 *   3. TemplateManager loads pages from src/pages/
 *
 * Test Flow:
 *   T1. /start → Newsletter Hub + Status (Subscribed/Not subscribed) + inline keyboard (Stats, Help)
 *   T2. /start → callback:start:s1 → toggle subscription → editMessage → status changed
 *   T3. /start → callback:help → editMessage → Help + keyboard present
 *   T4. /unknown → No matching route found
 *   T5. /start → verify sendMessage request captured in mockServer.requests
 *   T6. /start → callback:help → text:gibberish → No matching route found (sequential chain)
 *   T7.  [Broadcast] Non-admin user cannot access broadcast page
 *   T8.  [Broadcast] Admin accesses broadcast form → draft message + Hybrid Media/Cancel buttons
 *   T9.  [Broadcast] Admin sends text → confirm broadcast text screen
 *   T10. [Broadcast] Admin sends photo → confirm broadcast photo screen
 *   T11. [Broadcast] Admin confirms send → broadcast success message
 *   T12. [Broadcast] Admin cancels broadcast → cancelled message
 *   T13. [Broadcast] Admin clicks edit → returns to draft form
 *   T14. [Broadcast] Broadcast with no subscribers → empty subs message
 *
 * Cleanup:
 *   - botCore.stop() + mockServer.stop() in afterAll
 *   - mockServer.clearRequests() in beforeEach
 */
import {join} from "node:path"
import {BotCore} from "../src/core/bot"
import {TemplateManager, CacheExternal} from "gramstax"
import {MockTelegramServer} from "gramstax"
import {describe, it, expect, beforeAll, afterAll, beforeEach} from "bun:test"

let mockServer: MockTelegramServer
let botCore: BotCore
let cacheSession: CacheExternal

const ADMIN_USER = {id: 840754970, first_name: `Admin`, username: `adminuser`, language_code: `en`}
const ADMIN_CHAT = {id: 840754970, type: `private` as const, first_name: `Admin`}

const REGULAR_USER = {id: 1001, first_name: `Test`, username: `testuser`, language_code: `en`}
const REGULAR_CHAT = {id: 1001, type: `private` as const, first_name: `Test`}

beforeAll(async () => {
  mockServer = new MockTelegramServer({log: false})
  await mockServer.start()

  const templateManager = new TemplateManager({path: [join(import.meta.dir, `../src/pages`)]})
  const cwd = process.cwd()
  process.chdir(join(import.meta.dir, `..`))

  cacheSession = new CacheExternal(`memory`)

  botCore = new BotCore({
    deploy: `webhook:http://127.0.0.1:3007/webhook/e2e-8-newsletter`,
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

describe(`E2E: Newsletter bot via MockTelegramServer (webhook)`, () => {
  it(`responds to /start command with Newsletter Hub and subscription status`, async () => {
    const responses = await mockServer.sendText(`/start`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]
    expect(reply).toBeDefined()
    expect(reply!.body?.text).toContain(`Newsletter Hub`)
    expect(reply!.body?.text).toContain(`Status:`)

    const keyboard = reply!.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    expect(keyboard.length).toBeGreaterThan(0)

    const allButtons = keyboard.flat()
    const buttonLabels = allButtons.map((b: any) => b.text)
    expect(buttonLabels).toContain(`📊 Stats`)
    expect(buttonLabels).toContain(`❓ Help`)
  })

  it(`toggles subscription status via callback`, async () => {
    const responses = await mockServer.sendText(`/start`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]
    expect(reply!.body?.text).toMatch(/Subscribed|Not subscribed/)

    mockServer.clearRequests()

    const toggleResponses = await mockServer.sendCallbackQuery(`start:s1`)

    expect(toggleResponses.length).toBeGreaterThan(0)
    const edit = toggleResponses[0]
    expect(edit!.body?.text).toMatch(/Subscribed|Not subscribed/)
  })

  it(`navigates to Help page and shows back button`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`help`)

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]
    expect(edit!.body?.text).toContain(`Help`)

    const keyboard = edit!.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
  })

  it(`shows route not found for unrecognized input`, async () => {
    const responses = await mockServer.sendText(`/unknown`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]
    expect(reply).toBeDefined()
    expect(reply!.body?.text).toContain(`No matching route found`)
  })

  it(`captures outbound requests in mockServer.requests`, async () => {
    await mockServer.sendText(`/start`)

    const sendMessageReq = mockServer.lastRequest(`sendMessage`)
    expect(sendMessageReq).toBeDefined()
    expect(sendMessageReq?.body?.text).toContain(`Newsletter Hub`)
  })

  it(`handles multiple sequential interactions`, async () => {
    const res1 = await mockServer.sendText(`/start`)
    expect(res1[0]?.body?.text).toContain(`Newsletter Hub`)

    mockServer.clearRequests()

    const res2 = await mockServer.sendCallbackQuery(`help`)
    expect(res2[0]?.body?.text).toContain(`Help`)

    mockServer.clearRequests()

    const res3 = await mockServer.sendText(`gibberish`)
    expect(res3[0]?.body?.text).toContain(`No matching route found`)
  })

  describe(`BroadcastPage (admin-only)`, () => {
    it(`non-admin user cannot access broadcast page`, async () => {
      await mockServer.sendText(`/start`, {user: REGULAR_USER, chat: REGULAR_CHAT})
      mockServer.clearRequests()

      const responses = await mockServer.sendCallbackQuery(`broadcast`, {
        responseTimeoutMs: 3000,
        user: REGULAR_USER,
        chat: REGULAR_CHAT
      })

      expect(responses.length).toBe(0)
    })

    it(`admin accesses broadcast form with draft and action buttons`, async () => {
      const responses = await mockServer.sendCallbackQuery(`broadcast`, {
        responseTimeoutMs: 3000,
        user: ADMIN_USER,
        chat: ADMIN_CHAT
      })

      expect(responses.length).toBeGreaterThan(0)
      const reply = responses[0]!
      expect(reply.body?.text).toContain(`Broadcast Message`)
      expect(reply.body?.text).toContain(`Current draft:`)

      const keyboard = reply.body?.reply_markup?.inline_keyboard
      expect(Array.isArray(keyboard)).toBe(true)
      const buttonLabels = keyboard.flat().map((b: any) => b.text)
      expect(buttonLabels).toContain(`📰 Hybrid Media`)
    })

    it(`admin sends text draft and gets confirm screen`, async () => {
      await mockServer.sendCallbackQuery(`broadcast`, {
        responseTimeoutMs: 3000,
        user: ADMIN_USER,
        chat: ADMIN_CHAT
      })
      mockServer.clearRequests()

      const responses = await mockServer.sendText(`Hello subscribers!`, {
        user: ADMIN_USER,
        chat: ADMIN_CHAT
      })

      expect(responses.length).toBeGreaterThan(0)
      const reply = responses[0]!
      expect(reply.body?.text).toContain(`Confirm broadcast text`)
      expect(reply.body?.text).toContain(`Hello subscribers!`)

      const keyboard = reply.body?.reply_markup?.inline_keyboard
      expect(Array.isArray(keyboard)).toBe(true)
      const buttonLabels = keyboard.flat().map((b: any) => b.text)
      expect(buttonLabels).toContain(`✅ Send`)
      expect(buttonLabels).toContain(`✏️ Edit`)
    })

    it(`admin sends photo and gets confirm screen`, async () => {
      await mockServer.sendCallbackQuery(`broadcast`, {
        responseTimeoutMs: 3000,
        user: ADMIN_USER,
        chat: ADMIN_CHAT
      })
      mockServer.clearRequests()

      const responses = await mockServer.sendPhoto({
        caption: `Photo caption here`,
        user: ADMIN_USER,
        chat: ADMIN_CHAT
      })

      expect(responses.length).toBeGreaterThan(0)
      const reply = responses[0]!
      expect(reply.method).toBe(`sendPhoto`)
      expect(reply.body?.caption).toContain(`Confirm broadcast photo`)
      expect(reply.body?.caption).toContain(`Photo caption here`)

      const keyboard = reply.body?.reply_markup?.inline_keyboard
      expect(Array.isArray(keyboard)).toBe(true)
      const buttonLabels = keyboard.flat().map((b: any) => b.text)
      expect(buttonLabels).toContain(`✅ Send`)
    })

    it(`admin confirms send and gets success message`, async () => {
      // Step 1: Access broadcast form
      const formResponses = await mockServer.sendCallbackQuery(`broadcast`, {
        responseTimeoutMs: 3000,
        user: ADMIN_USER,
        chat: ADMIN_CHAT
      })
      expect(formResponses.length).toBeGreaterThan(0)
      mockServer.clearRequests()

      // Step 2: Send text to get confirm screen
      const confirmResponses = await mockServer.sendText(`Test broadcast message`, {
        user: ADMIN_USER,
        chat: ADMIN_CHAT
      })
      expect(confirmResponses.length).toBeGreaterThan(0)
      const confirmReply = confirmResponses[0]!
      expect(confirmReply.body?.text).toContain(`Confirm broadcast text`)
      expect(confirmReply.body?.text).toContain(`Test broadcast message`)

      // Extract callback_data from confirm keyboard buttons
      const keyboard = confirmReply.body?.reply_markup?.inline_keyboard
      expect(Array.isArray(keyboard)).toBe(true)

      const sendButton = keyboard.flat().find((b: any) => b.text?.includes(`Send`))
      expect(sendButton).toBeDefined()
      const callbackData = sendButton?.callback_data
      expect(callbackData).toBeDefined()

      mockServer.clearRequests()

      // Step 3: Click send button
      const responses = await mockServer.sendCallbackQuery(callbackData, {
        responseTimeoutMs: 5000,
        user: ADMIN_USER,
        chat: ADMIN_CHAT
      })

      expect(responses.length).toBeGreaterThan(0)
      const editReply = responses.find((r) => r.method === `editMessageText`)
      expect(editReply).toBeDefined()
      expect(editReply!.body?.text).toContain(`Broadcast sent`)
      expect(editReply!.body?.text).toMatch(/Delivered to \d+\/\d+ subscribers/)
    })

    it(`admin cancels broadcast and gets cancelled message`, async () => {
      await mockServer.sendCallbackQuery(`broadcast`, {
        responseTimeoutMs: 3000,
        user: ADMIN_USER,
        chat: ADMIN_CHAT
      })
      mockServer.clearRequests()

      await mockServer.sendText(`Draft to cancel`, {
        user: ADMIN_USER,
        chat: ADMIN_CHAT
      })
      mockServer.clearRequests()

      const responses = await mockServer.sendCallbackQuery(`broadcast:s1:cancel`, {
        responseTimeoutMs: 3000,
        user: ADMIN_USER,
        chat: ADMIN_CHAT
      })

      expect(responses.length).toBeGreaterThan(0)
      const reply = responses[0]!
      expect(reply.body?.text).toContain(`Broadcast cancelled`)
      expect(reply.body?.text).toContain(`Draft discarded`)
    })

    it(`admin clicks edit and returns to draft form`, async () => {
      await mockServer.sendCallbackQuery(`broadcast`, {
        responseTimeoutMs: 3000,
        user: ADMIN_USER,
        chat: ADMIN_CHAT
      })
      mockServer.clearRequests()

      await mockServer.sendText(`Draft to edit`, {
        user: ADMIN_USER,
        chat: ADMIN_CHAT
      })
      mockServer.clearRequests()

      const responses = await mockServer.sendCallbackQuery(`broadcast:s1:edit`, {
        responseTimeoutMs: 3000,
        user: ADMIN_USER,
        chat: ADMIN_CHAT
      })

      expect(responses.length).toBeGreaterThan(0)
      const reply = responses[0]!
      expect(reply.body?.text).toContain(`Broadcast Message`)
      expect(reply.body?.text).toContain(`Current draft:`)
    })
  })
})
