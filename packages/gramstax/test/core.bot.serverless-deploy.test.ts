import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test"
import {Bot} from "grammy"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"

const TEST_DIR = join(import.meta.dir, `bot_views_serverless`)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const waitFor = async (ready: () => boolean, timeoutMs = 5000) => {
  const deadline = Date.now() + timeoutMs
  while (!ready() && Date.now() < deadline) {
    await sleep(10)
  }
  expect(ready()).toBe(true)
}

class TestGramstax extends Gramstax {
  override _pageLoads() {
    return {routeStatic: {handleCommandText: {}}, routeDynamic: []} as never
  }
}

const mockGrammyBot = () => {
  const realBot = new Bot(`test`) as unknown as Record<string, unknown>
  const handleUpdate = mock(async () => new Response(`OK`, {status: 200}))
  Object.defineProperty(realBot, `api`, {
    value: {
      getMe: mock(async () => ({id: 1, is_bot: true, first_name: `Test`, username: `test`})),
      getWebhookInfo: mock(async () => ({url: ``}))
    },
    writable: true
  })
  realBot.init = mock(() => Promise.resolve())
  realBot.handleUpdate = handleUpdate
  return {realBot, handleUpdate}
}

describe(`Gramstax deploy:"serverless"`, () => {
  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
    await mkdir(TEST_DIR, {recursive: true})
  })

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
  })

  it(`sets deployType and exposes handlerBotUpdate after startup`, async () => {
    const order: string[] = []
    let releaseGate!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve
    })
    class HookBot extends TestGramstax {
      override async hookBeforeStart() {
        order.push(`before`)
        await gate
      }
      override async hookAfterStart() {
        order.push(`after`)
      }
    }
    const bot = new HookBot({
      token: `test`,
      deploy: `serverless:std/http`,
      templateManager: new TemplateManager({path: [TEST_DIR]}),
      log: false
    })
    expect(bot.deployType).toBe(`serverless`)
    const {realBot} = mockGrammyBot()
    bot.bot = realBot as never
    releaseGate()
    await waitFor(() => (bot as unknown as {handlerBotUpdate?: unknown}).handlerBotUpdate !== undefined)
    expect(typeof (bot as unknown as {handlerBotUpdate: unknown}).handlerBotUpdate).toBe(`function`)
    await waitFor(() => order.includes(`after`))
    expect(order).toEqual([`before`, `after`])
    await bot.stop()
  })

  it(`routes hookBeforeStart rejection to _onStartupError`, async () => {
    let startupError: unknown
    class BoomBot extends TestGramstax {
      override async hookBeforeStart() {
        throw new Error(`boom-before-serverless`)
      }
      override _onStartupError(error: unknown) {
        startupError = error
      }
    }
    const bot = new BoomBot({
      token: `test`,
      deploy: `serverless:std/http`,
      templateManager: new TemplateManager({path: [TEST_DIR]}),
      log: false
    })
    await waitFor(() => startupError !== undefined)
    expect(String(startupError)).toContain(`boom-before-serverless`)
    await bot.stop()
  })

  it(`_runServerless wires handlerBotUpdate that routes POST updates`, async () => {
    const order: string[] = []
    class HookBot extends TestGramstax {
      override async hookBeforeStart() {
        order.push(`before`)
      }
      override async hookAfterStart() {
        order.push(`after`)
      }
    }
    const bot = new HookBot({token: `test`, deploy: `test`, templateManager: new TemplateManager({path: [TEST_DIR]}), log: false})
    const {realBot, handleUpdate} = mockGrammyBot()
    bot.bot = realBot as never
    await bot.ready
    order.length = 0
    await bot._runServerless(`std/http`)
    expect(order).toEqual([`before`, `after`])
    const handler = (bot as unknown as {handlerBotUpdate: (req: Request) => Promise<Response>}).handlerBotUpdate
    expect(typeof handler).toBe(`function`)
    const res = await handler(
      new Request(`http://localhost/`, {method: `POST`, headers: {"Content-Type": `application/json`}, body: JSON.stringify({update_id: 1})})
    )
    expect(res.status).toBe(200)
    expect(handleUpdate).toHaveBeenCalled()
    await bot.stop()
  })

  it(`rejects unknown deploy values`, () => {
    expect(
      () => new TestGramstax({token: `test`, deploy: `bogus`, templateManager: new TemplateManager({path: [TEST_DIR]}), log: false})
    ).toThrow(/deploy/)
  })
})
