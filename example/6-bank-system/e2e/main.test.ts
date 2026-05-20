/**
 * E2E Test Flow for Bank System Bot
 *
 * Setup:
 *   1. MockTelegramServer starts on random port → apiRoot captured
 *   2. BotCore initialized with webhook:http://127.0.0.1:3005/webhook/e2e-6-bank-system
 *   3. TemplateManager loads pages from src/pages/
 *
 * Test Flow:
 *   T1. /start → Banking Menu + inline keyboard (Balance, Deposit, Withdraw, Transfer, History)
 *   T2. /start → callback:balance → editMessage → Account balance + Available balance + Back button
 *   T3. /start → callback:deposit → editMessage → Deposit funds + amount prompt
 *   T4. /start → callback:deposit → text:/unknown → Invalid amount (session-based validation)
 *   T5. callback:start → verify editMessageText/sendMessage captured in mockServer.requests
 *   T6. callback:start → callback:balance → callback:deposit → sequential chain (all callbacks)
 *
 * Cleanup:
 *   - botCore.stop() + mockServer.stop() in afterAll
 *   - mockServer.clearRequests() in beforeEach
 */
import {join} from "node:path"
import {BotCore} from "../src/core/bot"
import {TemplateManager} from "gramstax"
import {MockTelegramServer} from "gramstax"
import {describe, it, expect, beforeAll, afterAll, beforeEach} from "bun:test"

let mockServer: MockTelegramServer
let botCore: BotCore

beforeAll(async () => {
  mockServer = new MockTelegramServer({log: false})
  await mockServer.start()

  const templateManager = new TemplateManager({path: [join(import.meta.dir, `../src/pages`)]})
  const cwd = process.cwd()
  process.chdir(join(import.meta.dir, `..`))

  botCore = new BotCore({
    deploy: `webhook:http://127.0.0.1:3005/webhook/e2e-6-bank-system`,
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

describe(`E2E: Bank System bot via MockTelegramServer (webhook)`, () => {
  it(`responds to /start command with Banking Menu and action buttons`, async () => {
    const responses = await mockServer.sendText(`/start`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]
    expect(reply).toBeDefined()
    expect(reply!.body?.text).toContain(`Banking Menu`)

    const keyboard = reply!.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    expect(keyboard.length).toBeGreaterThan(0)

    const allButtons = keyboard.flat()
    const buttonLabels = allButtons.map((b: any) => b.text)
    expect(buttonLabels).toContain(`💳 Balance`)
    expect(buttonLabels).toContain(`➕ Deposit`)
    expect(buttonLabels).toContain(`➖ Withdraw`)
    expect(buttonLabels).toContain(`🔁 Transfer`)
    expect(buttonLabels).toContain(`📜 History`)
  })

  it(`navigates to Balance page and shows balance`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`balance`, {responseTimeoutMs: 3000})

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toContain(`Account balance`)
    expect(edit.body?.text).toContain(`Available balance:`)

    const keyboard = edit.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    const firstButton = keyboard[0]?.[0]
    expect(firstButton?.text).toContain(`Back`)
  })

  it(`navigates to Deposit page and prompts for amount`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`deposit`, {responseTimeoutMs: 3000})

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toContain(`Deposit funds`)
    expect(edit.body?.text).toContain(`amount`)
  })

  it(`shows invalid amount for unrecognized input after deposit session`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    await mockServer.sendCallbackQuery(`deposit`, {responseTimeoutMs: 3000})
    mockServer.clearRequests()

    const responses = await mockServer.sendText(`/unknown`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply).toBeDefined()
    expect(reply.body?.text).toContain(`Invalid amount`)
  })

  it(`captures outbound requests in mockServer.requests`, async () => {
    const responses = await mockServer.sendCallbackQuery(`start`, {responseTimeoutMs: 3000})

    expect(responses.length).toBeGreaterThan(0)
    const sendMessageReq = mockServer.lastRequest(`editMessageText`) ?? mockServer.lastRequest(`sendMessage`)
    expect(sendMessageReq).toBeDefined()
    expect(sendMessageReq?.body?.text).toContain(`Banking Menu`)
  })

  it(`handles multiple sequential interactions`, async () => {
    const res1 = await mockServer.sendCallbackQuery(`start`, {responseTimeoutMs: 3000})
    expect(res1[0]?.body?.text).toContain(`Banking Menu`)

    mockServer.clearRequests()

    const res2 = await mockServer.sendCallbackQuery(`balance`, {responseTimeoutMs: 3000})
    expect(res2[0]?.body?.text).toContain(`Account balance`)

    mockServer.clearRequests()

    const res3 = await mockServer.sendCallbackQuery(`deposit`, {responseTimeoutMs: 3000})
    expect(res3[0]?.body?.text).toContain(`Deposit funds`)
  })
})
