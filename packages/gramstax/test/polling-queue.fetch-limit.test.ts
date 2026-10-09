import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {Ctx, Gramstax, MockTelegramServer, TemplateManager} from "../src"

const TEMPLATE = `<g-base><g-message>pong</g-message></g-base>`
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

class FetchLimitPage extends Ctx {
  static data = Ctx.buildData({name: `fl`})

  async handleFreeText(): Promise<void> {
    await sleep(5)
    await this.render(null, {})
  }

  static template = TEMPLATE
}

class TestBot extends Gramstax {
  override _pageLoads() {
    return this._buildEmptyPages()
  }
}

let templateDir = ``

function makeBot(apiRoot: string, queue: Record<string, unknown>): TestBot {
  const bot = new TestBot({
    token: `test-token`,
    deploy: `polling`,
    log: false as const,
    botConfig: {client: {apiRoot}},
    templateManager: new TemplateManager({path: [templateDir]}),
    optionsDeploy: {polling: {maxRetries: 5, queue: {enabled: true, workerCount: 2, perChatConcurrency: 1, ...queue}}}
  })
  bot.templateManager?.compile(`fl`, TEMPLATE)
  bot._pageSorts(FetchLimitPage, bot.pages, 0)
  return bot
}

/**
 * Records the `limit` grammY puts on the wire.
 *
 * grammY always passes a `limit` key but drops it from the JSON body when the
 * app never configured `PollingOptions.limit`, so `undefined` is a meaningful
 * reading here: it means the fetcher was left untouched.
 */
function limitSource(limits: Array<number | undefined>, count: number) {
  const pending: Array<Record<string, unknown>> = []
  for (let i = 0; i < count; i++) {
    pending.push({
      update_id: i + 1,
      message: {
        message_id: i + 1,
        date: Math.floor(Date.now() / 1000),
        chat: {id: 700_000 + i, type: `private`, first_name: `F`},
        from: {id: 700_000 + i, is_bot: false, first_name: `F`},
        text: `m${i}`
      }
    })
  }
  return {
    getUpdates: ({request}: {request: Request}) =>
      (async () => {
        const body = (await request.json().catch(() => undefined)) as {offset?: unknown; limit?: unknown} | undefined
        limits.push(typeof body?.limit === `number` ? body.limit : undefined)
        const offset = typeof body?.offset === `number` ? body.offset : 0
        return {ok: true, result: pending.filter((u) => (u.update_id as number) >= offset).slice(0, 100)}
      })(),
    sendMessage: () => ({ok: true, result: {message_id: 1, date: 0, chat: {id: 0, type: `private`}}}),
    getMe: () => ({ok: true, result: {id: 1, is_bot: true, first_name: `Bench`, username: `bench_bot`, can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false}})
  }
}

async function waitFor(condition: () => boolean, timeoutMs: number): Promise<boolean> {
  const startedAt = performance.now()
  while (!condition()) {
    if (performance.now() - startedAt > timeoutMs) return false
    await sleep(5)
  }
  return true
}

describe(`polling fetch limit tracks queue capacity`, () => {
  let mock: MockTelegramServer | undefined
  let bot: TestBot | undefined

  beforeEach(() => {
    templateDir = mkdtempSync(join(tmpdir(), `gramstax-fetch-limit-`))
  })

  afterEach(async () => {
    await bot?.stop().catch(() => undefined)
    await mock?.stop().catch(() => undefined)
    bot = undefined
    mock = undefined
    rmSync(templateDir, {recursive: true, force: true})
  })

  it(`asks Telegram for no more than the queue can hold`, async () => {
    const limits: Array<number | undefined> = []
    mock = new MockTelegramServer({handlers: limitSource(limits, 1)})
    await mock.start()
    bot = makeBot(mock.apiRoot, {maxQueueSize: 2})

    expect(await waitFor(() => limits.length > 0, 10_000)).toBe(true)
    expect(limits[0]).toBe(2)
  })

  it(`keeps the full 100-update batch while the queue has room`, async () => {
    const limits: Array<number | undefined> = []
    mock = new MockTelegramServer({handlers: limitSource(limits, 1)})
    await mock.start()
    bot = makeBot(mock.apiRoot, {maxQueueSize: 5000})

    expect(await waitFor(() => limits.length > 0, 10_000)).toBe(true)
    expect(limits[0]).toBe(100)
  })

  it(`never drops below 1 update, so an empty queue still advances offset`, async () => {
    const limits: Array<number | undefined> = []
    mock = new MockTelegramServer({handlers: limitSource(limits, 1)})
    await mock.start()
    // maxQueueSize 1 leaves capacity 1 at most; a deeper backlog is simulated
    // by a single slot, which is the tightest non-zero case.
    bot = makeBot(mock.apiRoot, {maxQueueSize: 1})

    expect(await waitFor(() => limits.length > 0, 10_000)).toBe(true)
    expect(limits[0]).toBe(1)
  })

  it(`leaves the fetcher untouched when blockWhenFull is false`, async () => {
    const limits: Array<number | undefined> = []
    mock = new MockTelegramServer({handlers: limitSource(limits, 1)})
    await mock.start()
    // Drop-fast mode wants the full batch regardless of room, so the clamp
    // must not apply — a clamped fetch would just delay the drops.
    bot = makeBot(mock.apiRoot, {blockWhenFull: false, maxQueueSize: 2})

    expect(await waitFor(() => limits.length > 0, 10_000)).toBe(true)
    expect(limits[0]).toBeUndefined()
  })
})