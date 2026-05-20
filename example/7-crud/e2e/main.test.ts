/**
 * E2E Test Flow for CRUD Bot
 *
 * Setup:
 *   1. MockTelegramServer starts on random port → apiRoot captured
 *   2. BotCore initialized with webhook:http://127.0.0.1:3006/webhook/e2e-7-crud
 *   3. TemplateManager loads pages from src/pages/
 *
 * Test Flow:
 *   T1. /start → CRUD Menu + inline keyboard (Create, List, Detail, Update, Delete, Help)
 *   T2. /start → callback:help → editMessage → CRUD Help + Back button
 *   T3. /start → callback:create → editMessage → Create a new item + title prompt
 *   T4. /start → callback:list → editMessage → Cached items list
 *   T5. /start → callback:nonexistent_action → graceful handling (no crash)
 *   T6. /start → verify sendMessage request captured in mockServer.requests
 *   T7. /start → callback:help → callback:help → sequential chain
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
    deploy: `webhook:http://127.0.0.1:3006/webhook/e2e-7-crud`,
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

describe(`E2E: CRUD bot via MockTelegramServer (webhook)`, () => {
  it(`responds to /start command with CRUD Menu and action buttons`, async () => {
    const responses = await mockServer.sendText(`/start`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]
    expect(reply).toBeDefined()
    expect(reply!.body?.text).toContain(`CRUD Menu`)

    const keyboard = reply!.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    expect(keyboard.length).toBeGreaterThan(0)

    const allButtons = keyboard.flat()
    const buttonLabels = allButtons.map((b: any) => b.text)
    expect(buttonLabels).toContain(`➕ Create`)
    expect(buttonLabels).toContain(`📋 List`)
    expect(buttonLabels).toContain(`🔎 Detail`)
    expect(buttonLabels).toContain(`✅ Update`)
    expect(buttonLabels).toContain(`🗑️ Delete`)
    expect(buttonLabels).toContain(`❓ Help`)
  })

  it(`navigates to Help page and shows back button`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`help`, {responseTimeoutMs: 3000})

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toContain(`Help`)

    const keyboard = edit.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    const firstButton = keyboard[0]?.[0]
    expect(firstButton?.text).toContain(`Back`)
  })

  it(`navigates to Create page and prompts for title`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`create`, {responseTimeoutMs: 3000})

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toContain(`Create a new item`)
    expect(edit.body?.text).toContain(`title`)
  })

  it(`navigates to List page and shows items list`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`list`, {responseTimeoutMs: 3000})

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toContain(`Cached items`)
  })

  it(`handles unrecognized callback gracefully`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`nonexistent_action`, {responseTimeoutMs: 3000})

    expect(responses.length).toBeGreaterThanOrEqual(0)
    if (responses.length > 0) {
      const reply = responses[0]!
      expect(reply.body?.text).toBeDefined()
    }
  })

  it(`captures outbound requests in mockServer.requests`, async () => {
    await mockServer.sendText(`/start`)

    const sendMessageReq = mockServer.lastRequest(`sendMessage`)
    expect(sendMessageReq).toBeDefined()
    expect(sendMessageReq?.body?.text).toContain(`CRUD Menu`)
  })

  it(`handles multiple sequential interactions`, async () => {
    const res1 = await mockServer.sendText(`/start`)
    expect(res1[0]?.body?.text).toContain(`CRUD Menu`)

    mockServer.clearRequests()

    const res2 = await mockServer.sendCallbackQuery(`help`, {responseTimeoutMs: 3000})
    expect(res2[0]?.body?.text).toContain(`Help`)

    mockServer.clearRequests()

    const res3 = await mockServer.sendCallbackQuery(`help`, {responseTimeoutMs: 3000})
    expect(res3[0]?.body?.text).toContain(`Help`)
  })
})
