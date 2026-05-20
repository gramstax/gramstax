/**
 * E2E Test Flow for Echo Bot
 *
 * Setup:
 *   1. MockTelegramServer starts on random port → apiRoot captured
 *   2. BotCore initialized with webhook:http://127.0.0.1:3003/webhook/e2e-4-echo
 *   3. TemplateManager loads pages from src/pages/
 *
 * Test Flow:
 *   T1. /start → Echo Bot welcome + inline keyboard (Help, Echo Tips)
 *   T2. /start → callback:help → editMessage → Help + /start + /help + Back button
 *   T3. /start → callback:echo → editMessage → Echo Tips + Home button
 *   T4. /unknown → Route not found
 *   T5. /start → verify sendMessage request captured in mockServer.requests
 *   T6. /start → callback:help → text:gibberish → echo "gibberish" (sequential chain)
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
    deploy: `webhook:http://127.0.0.1:3003/webhook/e2e-4-echo`,
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

describe(`E2E: Echo bot via MockTelegramServer (webhook)`, () => {
  it(`responds to /start command with Echo Bot welcome message`, async () => {
    const responses = await mockServer.sendText(`/start`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]
    expect(reply).toBeDefined()
    expect(reply!.body?.text).toContain(`Echo Bot`)

    const keyboard = reply!.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    expect(keyboard.length).toBeGreaterThan(0)

    const allButtons = keyboard.flat()
    const buttonLabels = allButtons.map((b: any) => b.text)
    expect(buttonLabels).toContain(`❓ Help`)
    expect(buttonLabels).toContain(`🔁 Echo Tips`)
  })

  it(`navigates to Help page and shows back button`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`help`, {responseTimeoutMs: 3000})

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toContain(`Help`)
    expect(edit.body?.text).toContain(`/start`)
    expect(edit.body?.text).toContain(`/help`)

    const keyboard = edit.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    const firstButton = keyboard[0]?.[0]
    expect(firstButton?.text).toContain(`Back`)
  })

  it(`navigates to Echo Tips page and shows instructions`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`echo`, {responseTimeoutMs: 3000})

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toContain(`Echo Tips`)

    const keyboard = edit.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    const firstButton = keyboard[0]?.[0]
    expect(firstButton?.text).toContain(`Home`)
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
    expect(sendMessageReq?.body?.text).toContain(`Echo Bot`)
  })

  it(`handles multiple sequential interactions`, async () => {
    const res1 = await mockServer.sendText(`/start`)
    expect(res1[0]?.body?.text).toContain(`Echo Bot`)

    mockServer.clearRequests()

    const res2 = await mockServer.sendCallbackQuery(`help`, {responseTimeoutMs: 3000})
    expect(res2[0]?.body?.text).toContain(`Help`)

    mockServer.clearRequests()

    const res3 = await mockServer.sendText(`gibberish`)
    expect(res3[0]?.body?.text).toContain(`gibberish`)
  })
})
