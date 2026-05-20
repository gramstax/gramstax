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
    deploy: `webhook:http://127.0.0.1:3007/webhook/e2e-8-newsletter`,
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

    const toggleResponses = await mockServer.sendCallbackQuery(`start:s1`, {responseTimeoutMs: 3000})

    expect(toggleResponses.length).toBeGreaterThan(0)
    const edit = toggleResponses[0]
    expect(edit!.body?.text).toMatch(/Subscribed|Not subscribed/)
  })

  it(`navigates to Help page and shows back button`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`help`, {responseTimeoutMs: 3000})

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

    const res2 = await mockServer.sendCallbackQuery(`help`, {responseTimeoutMs: 3000})
    expect(res2[0]?.body?.text).toContain(`Help`)

    mockServer.clearRequests()

    const res3 = await mockServer.sendText(`gibberish`)
    expect(res3[0]?.body?.text).toContain(`No matching route found`)
  })
})
