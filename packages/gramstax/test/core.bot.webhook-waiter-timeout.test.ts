import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test"
import {Bot} from "grammy"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"

const TEST_DIR = join(import.meta.dir, `bot_views_waiter`)

const getFreePort = async (): Promise<number> => {
  const server = Bun.serve({port: 0, hostname: `127.0.0.1`, fetch: () => new Response()})
  const port = server.port ?? 0
  server.stop(true)
  return port
}

class TestGramstax extends Gramstax {
  override _pageLoads() {
    return {routeStatic: {handleCommandText: {}}, routeDynamic: []} as any
  }

  override async _onStart(): Promise<void> {
    return
  }
}

describe(`Gramstax webhook waiter timeout (K6)`, () => {
  let bot: TestGramstax
  let baseUrl: string
  let handleUpdateMock: ReturnType<typeof mock>

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
    await mkdir(TEST_DIR, {recursive: true})
    const templateManager = new TemplateManager({path: [TEST_DIR]})
    bot = new TestGramstax({
      token: `test`,
      deploy: `test`,
      log: false,
      templateManager,
      webhookQueue: {enabled: true, maxQueueSize: 100, workerCount: 2, perChatConcurrency: 1, waiterTimeoutMs: 300}
    })

    const realBot = new Bot(`test`) as any
    Object.defineProperty(realBot, `api`, {
      value: {
        getWebhookInfo: mock(() => ({url: ``})),
        setWebhook: mock(() => true),
        getMe: mock(() => ({id: 1, is_bot: true, first_name: `Test`, username: `test`}))
      },
      writable: true
    })
    realBot.init = mock(() => Promise.resolve())
    handleUpdateMock = mock(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 10_000))
      return new Response(`OK`, {status: 200})
    })
    realBot.handleUpdate = handleUpdateMock
    bot.bot = realBot

    const port = await getFreePort()
    baseUrl = `http://127.0.0.1:${port}`
    await bot._runWebhook(`${baseUrl}/webhook`)
  })

  afterEach(async () => {
    ;(bot as any).webhookServer?.stop()
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
  })

  it(`bypasses the per-chat concurrency gate after waiterTimeoutMs`, async () => {
    const updateA = {update_id: 1, message: {message_id: 1, date: 1, chat: {id: 99, type: `private` as const}, from: {id: 7}, text: `a`}}
    const updateB = {update_id: 2, message: {message_id: 2, date: 2, chat: {id: 99, type: `private` as const}, from: {id: 7}, text: `b`}}

    const resA = await fetch(`${baseUrl}/webhook`, {method: `POST`, headers: {"Content-Type": `application/json`}, body: JSON.stringify(updateA)})
    const resB = await fetch(`${baseUrl}/webhook`, {method: `POST`, headers: {"Content-Type": `application/json`}, body: JSON.stringify(updateB)})
    expect(resA.status).toBe(200)
    expect(resB.status).toBe(200)

    // Worker 1 takes updateA and hangs. Worker 2 waits on the chat gate for
    // updateB. After waiterTimeoutMs it must bypass the gate and call handleUpdate
    // a second time instead of waiting forever.
    await new Promise<void>((resolve) => setTimeout(resolve, 2_000))

    expect(handleUpdateMock).toHaveBeenCalledTimes(2)
  })
})