import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test"
import {Bot} from "grammy"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"
import {UpdateDispatcher} from "~/update/dispatcher"

const TEST_DIR = join(import.meta.dir, `bot_views_dispatcher`)

const getFreePort = async (): Promise<number> => {
  const server = Bun.serve({port: 0, hostname: `127.0.0.1`, fetch: () => new Response()})
  const port = server.port ?? 0
  server.stop(true)
  return port
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const waitFor = async (predicate: () => boolean, timeoutMs: number): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return true
    await sleep(5)
  }
  return predicate()
}

class TestGramstax extends Gramstax {
  override _pageLoads() {
    return {routeStatic: {handleCommandText: {}}, routeDynamic: []} as any
  }

  override async _onStart(): Promise<void> {
    return
  }
}

describe(`Gramstax webhook dispatcher`, () => {
  let bot: TestGramstax
  let templateManager: TemplateManager
  let baseUrl: string
  let warns: Array<string>
  let events: Array<string>
  let started: number
  let handler: (update: unknown) => Promise<void>
  let releaseHandler: () => void

  const makeBot = async (queue: Record<string, unknown>, onHandler: (update: unknown) => Promise<void>): Promise<void> => {
    await mkdir(TEST_DIR, {recursive: true})
    templateManager = new TemplateManager({path: [TEST_DIR]})
    bot = new TestGramstax({token: `test`, deploy: `test`, log: false, templateManager})
    ;(bot as any).webhook.queue = queue
    ;(bot as any).log = {
      warn: (message: string) => warns.push(message),
      error: () => {},
      info: () => {},
      debug: () => {},
      success: () => {}
    }
    handler = onHandler
    started = 0
    warns = []
    events = []
    releaseHandler = () => {}

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
    realBot.handleUpdate = mock(async (update: unknown) => {
      started += 1
      return handler(update)
    })
    bot.bot = realBot

    const port = await getFreePort()
    baseUrl = `http://127.0.0.1:${port}`
    await bot._runWebhook(`${baseUrl}/webhook`)
  }

  const post = async (updateId: number, chatId = 99): Promise<Response> => {
    const update = {update_id: updateId, message: {message_id: updateId, date: 1, chat: {id: chatId, type: `private` as const}, from: {id: 7}, text: `u${updateId}`}}
    return fetch(`${baseUrl}/webhook`, {method: `POST`, headers: {"Content-Type": `application/json`}, body: JSON.stringify(update)})
  }

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
  })

  afterEach(async () => {
    releaseHandler()
    ;(bot as any)?.webhook.server?.stop(true)
    await (bot as any)?.stop?.()
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
  })

  it(`awaits in-flight handlers before destroying templates on stop`, async () => {
    await makeBot({enabled: true, maxQueueSize: 100, workerCount: 2, perChatConcurrency: 1, drainTimeoutMs: 5_000}, async () => {
      events.push(`handle:start`)
      await sleep(250)
      events.push(`handle:end`)
    })
    const realDestroy = templateManager.destroy.bind(templateManager)
    templateManager.destroy = async () => {
      events.push(`destroy`)
      await realDestroy()
    }

    expect((await post(1)).status).toBe(200)
    expect(await waitFor(() => started === 1, 2_000)).toBe(true)

    await bot.stop()

    // The drain must land between the handler and the teardown, otherwise
    // templateManager.destroy() runs while an update is still being handled.
    expect(events).toEqual([`handle:start`, `handle:end`, `destroy`])
  })

  it(`counts and warns about updates left behind when the drain times out`, async () => {
    await makeBot({enabled: true, maxQueueSize: 100, workerCount: 1, perChatConcurrency: 0, drainTimeoutMs: 60}, async () => {
      await new Promise<void>((resolve) => {
        releaseHandler = resolve
      })
    })

    for (const id of [1, 2, 3]) {
      expect((await post(id)).status).toBe(200)
    }
    expect(await waitFor(() => started === 1, 2_000)).toBe(true)

    await bot.stop()

    // One worker + one hanging handler => updates 2 and 3 are still buffered.
    expect(bot.metrics.counts.dropped).toBe(2)
    expect(warns.some((message) => message.includes(`drain timed out`))).toBe(true)
    expect(warns.some((message) => message.includes(`2 update(s) discarded`))).toBe(true)
  })

  it(`composes UpdateDispatcher instead of its own worker pool`, async () => {
    await makeBot({enabled: true, maxQueueSize: 100, workerCount: 2, perChatConcurrency: 1, drainTimeoutMs: 250}, async () => {})

    expect((bot as any).webhook.dispatcher).toBeInstanceOf(UpdateDispatcher)
    expect(bot.getWebhookQueueStats()?.drainTimeoutMs).toBe(250)
    expect((Gramstax.prototype as any)._startWebhookWorker).toBeUndefined()
    expect((Gramstax.prototype as any)._releaseWebhookChat).toBeUndefined()

    await bot.stop()
  })
})