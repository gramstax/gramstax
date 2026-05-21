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
})
