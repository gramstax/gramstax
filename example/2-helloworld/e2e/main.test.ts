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
    deploy: `webhook:http://127.0.0.1:3000/webhook/e2e`,
    token: `test-token`,
    log: false,
    templateManager,
    botConfig: {
      client: {
        apiRoot: mockServer.apiRoot
      }
    }
  })

  process.chdir(cwd)
})

afterAll(async () => {
  await botCore.stop()
  await mockServer.stop()
})

beforeEach(() => {
  mockServer.clearRequests()
})

describe(`E2E: HelloWorld bot via MockTelegramServer (webhook)`, () => {
  it(`responds to /start command with Hello World message`, async () => {
    const responses = await mockServer.sendText(`/start`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]
    expect(reply).toBeDefined()
    expect(reply!.body?.text).toContain(`Hello World!`)
    expect(reply!.body?.text).toContain(`Time now:`)

    const keyboard = reply!.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    expect(keyboard.length).toBeGreaterThan(0)

    const firstRow = keyboard[0]
    expect(Array.isArray(firstRow)).toBe(true)
    expect(firstRow.length).toBe(1)

    const button = firstRow[0]
    expect(button?.text).toBe(`Refresh`)
    expect(button?.callback_data).toBe(`start`)
  })

  it(`responds to callback query with edited message`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`start`, {responseTimeoutMs: 3000})

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toContain(`Hello World!`)
    expect(edit.body?.text).toContain(`Time now:`)
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
    expect(sendMessageReq?.body?.text).toContain(`Hello World!`)
  })

  it(`handles multiple sequential interactions`, async () => {
    const res1 = await mockServer.sendText(`/start`)
    expect(res1[0]?.body?.text).toContain(`Hello World!`)

    mockServer.clearRequests()

    const res2 = await mockServer.sendCallbackQuery(`start`, {responseTimeoutMs: 3000})
    expect(res2.length).toBeGreaterThan(0)
    expect(res2[0]?.body?.text).toContain(`Hello World!`)

    mockServer.clearRequests()

    const res3 = await mockServer.sendText(`gibberish`)
    expect(res3[0]?.body?.text).toContain(`Route not found`)
  })

  it(`sendPhoto triggers a response`, async () => {
    const responses = await mockServer.sendPhoto({caption: `test photo`})

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]?.body?.text).toContain(`Route not found`)
  })

  it(`supports custom user and chat options`, async () => {
    const responses = await mockServer.sendText(`/start`, {
      user: {id: 99999, first_name: `CustomUser`, username: `customuser`},
      chat: {id: 88888, type: `private`, first_name: `CustomChat`}
    })

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]?.body?.text).toContain(`Hello World!`)

    const lastUpdate = mockServer.updates[mockServer.updates.length - 1]
    expect(lastUpdate).toBeDefined()
    const msg = (lastUpdate as any)?.message
    expect(msg?.from?.id).toBe(99999)
    expect(msg?.chat?.id).toBe(88888)
  })
})
