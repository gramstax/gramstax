import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {Ctx, Gramstax, MockTelegramServer, TemplateManager, UpdateDispatcher} from "../src"

const TEMPLATE = `<g-base><g-message>pong</g-message></g-base>`
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Tracks how many handlers are in flight so tests can assert on real overlap. */
let live = 0
let peak = 0

class PollingQueuePage extends Ctx {
  static data = Ctx.buildData({name: `pq`})

  async handleFreeText(): Promise<void> {
    live += 1
    peak = Math.max(peak, live)
    try {
      await sleep(20)
      await this.renderText({data: {}})
    } finally {
      live -= 1
    }
  }

  static template = TEMPLATE
}

class TestBot extends Gramstax {
  override _pageLoads() {
    return this._buildEmptyPages()
  }
}

let templateDir = ``

function makeBot(apiRoot: string, optionsDeploy?: Record<string, unknown>, deploy: `polling` | `test` = `test`): TestBot {
  const bot = new TestBot({
    token: `test-token`,
    deploy,
    log: false as const,
    botConfig: {client: {apiRoot}},
    templateManager: new TemplateManager({path: [templateDir]}),
    ...(optionsDeploy === undefined ? {} : {optionsDeploy})
  })
  bot.templateManager?.compile(`pq`, TEMPLATE)
  bot._pageSorts(PollingQueuePage, bot.pages, 0)
  return bot
}

/** Serve `count` updates to the fetcher, honouring `offset` like Telegram does. */
function updateSource(count: number, chatPerUser: boolean) {
  const pending: Array<Record<string, unknown>> = []
  for (let i = 0; i < count; i++) {
    const uid = chatPerUser ? 0 : i
    pending.push({
      update_id: i + 1,
      message: {
        message_id: i + 1,
        date: Math.floor(Date.now() / 1000),
        chat: {id: 500_000 + uid, type: `private`, first_name: `P`},
        from: {id: 500_000 + uid, is_bot: false, first_name: `P`},
        text: `m${i}`
      }
    })
  }
  return {
    getUpdates: ({request}: {request: Request}) =>
      (async () => {
        const body = (await request.json().catch(() => undefined)) as {offset?: unknown} | undefined
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

function sentCount(mock: MockTelegramServer): number {
  return mock.requests.filter((r) => r.method === `sendMessage`).length
}

const pollQueue = (extra?: Record<string, unknown>) => ({enabled: true, workerCount: 4, perChatConcurrency: 1, maxQueueSize: 500, ...extra})

describe("polling queue dispatch", () => {
  let mock: MockTelegramServer | undefined
  let bot: TestBot | undefined

  beforeEach(() => {
    live = 0
    peak = 0
    templateDir = mkdtempSync(join(tmpdir(), `gramstax-polling-queue-`))
  })

  afterEach(async () => {
    await bot?.stop().catch(() => undefined)
    await mock?.stop().catch(() => undefined)
    bot = undefined
    mock = undefined
    rmSync(templateDir, {recursive: true, force: true})
  })

  it(`keeps the sequential path when no queue is configured`, async () => {
    mock = new MockTelegramServer({handlers: updateSource(1, false)})
    await mock.start()
    bot = makeBot(mock.apiRoot)

    const started: Array<Record<string, unknown>> = []
    // biome-ignore lint/suspicious/noExplicitAny: stub the grammY loop
    ;(bot as any).bot.start = async (opts: Record<string, unknown>) => {
      started.push(opts)
    }
    await bot._runPolling()

    expect(started.length).toBe(1)
    expect(started[0]?.allowed_updates).toBeDefined()
    expect((bot as unknown as {polling: {dispatcher?: unknown}}).polling.dispatcher).toBeUndefined()
    expect(peak).toBe(0)
  })

  it(`dispatches concurrently once the queue is enabled`, async () => {
    mock = new MockTelegramServer({handlers: updateSource(8, false)})
    await mock.start()
    bot = makeBot(mock.apiRoot, {polling: {maxRetries: 5, queue: pollQueue()}}, `polling`)

    const started = await waitFor(() => (bot as unknown as {polling: {dispatcher?: unknown}}).polling.dispatcher !== undefined, 10_000)
    expect(started).toBe(true)
    expect((bot as unknown as {polling: {dispatcher?: unknown}}).polling.dispatcher).toBeInstanceOf(UpdateDispatcher)
    const drained = await waitFor(() => sentCount(mock!) >= 8, 15_000)
    expect(drained).toBe(true)
    // distinct chats may overlap — this is the whole point of the queue
    expect(peak).toBeGreaterThan(1)
  })

  it(`never overlaps two updates for the same chat`, async () => {
    mock = new MockTelegramServer({handlers: updateSource(6, true)})
    await mock.start()
    bot = makeBot(mock.apiRoot, {polling: {maxRetries: 5, queue: pollQueue()}}, `polling`)

    const drained = await waitFor(() => sentCount(mock!) >= 6, 15_000)
    expect(drained).toBe(true)
    expect(peak).toBe(1)
  })

  it(`handles every update on a saturated queue instead of dropping`, async () => {
    mock = new MockTelegramServer({handlers: updateSource(6, false)})
    await mock.start()
    // maxQueueSize 1 with one worker forces the queue to saturate, so the
    // fetcher has to backpressure rather than discard.
    bot = makeBot(mock.apiRoot, {polling: {maxRetries: 5, queue: pollQueue({maxQueueSize: 1, workerCount: 1})}}, `polling`)

    const drained = await waitFor(() => sentCount(mock!) >= 6, 15_000)
    expect(drained).toBe(true)
    expect(bot.metrics.snapshot().counts.blocked).toBe(0)
    expect(bot.getWebhookQueueStats()).toBeNull()
  })

  it(`drops nothing even when blockWhenFull asks it to`, async () => {
    mock = new MockTelegramServer({handlers: updateSource(6, false)})
    await mock.start()
    // `blockWhenFull` is webhook-only; polling ignores it because grammY has
    // already advanced its offset past anything it fetched.
    bot = makeBot(mock.apiRoot, {polling: {maxRetries: 5, queue: pollQueue({blockWhenFull: false, maxQueueSize: 1, workerCount: 1})}}, `polling`)

    const drained = await waitFor(() => sentCount(mock!) >= 6, 15_000)
    expect(drained).toBe(true)
    expect(bot.metrics.snapshot().counts.blocked).toBe(0)
    expect(peak).toBe(1)
  })

  it(`keeps updates Telegram buffered during downtime by default`, async () => {
    mock = new MockTelegramServer({handlers: updateSource(1, false)})
    await mock.start()
    bot = makeBot(mock.apiRoot)

    const started: Array<Record<string, unknown>> = []
    // biome-ignore lint/suspicious/noExplicitAny: stub the grammY loop
    ;(bot as any).bot.start = async (opts: Record<string, unknown>) => {
      started.push(opts)
    }
    await bot._runPolling()

    // Replaying the backlog is the default: Telegram holds it for up to 24h.
    expect(started[0]?.drop_pending_updates).toBe(false)
  })

  it(`discards the downtime backlog only when explicitly opted in`, async () => {
    mock = new MockTelegramServer({handlers: updateSource(1, false)})
    await mock.start()
    bot = makeBot(mock.apiRoot, {polling: {maxRetries: 5, dropPendingUpdates: true, queue: pollQueue()}}, `polling`)

    const started: Array<Record<string, unknown>> = []
    // biome-ignore lint/suspicious/noExplicitAny: stub the grammY loop
    ;(bot as any).bot.start = async (opts: Record<string, unknown>) => {
      started.push(opts)
    }
    await bot._runPolling()

    expect(started[0]?.drop_pending_updates).toBe(true)
  })

  it(`rejects an invalid polling queue at construction`, () => {
    mock = new MockTelegramServer({handlers: updateSource(1, false)})
    // Same three range checks the runtime guard applies to the webhook queue —
    // blockWhenFull and waiterTimeoutMs stay a config-file concern, as before.
    const cases: Array<[Record<string, unknown>, RegExp]> = [
      [{workerCount: 0}, /positive number/],
      [{maxQueueSize: 0}, /positive number/],
      [{enqueueTimeoutMs: -1}, /non-negative number/]
    ]
    for (const [queue, expected] of cases) {
      expect(() => makeBot(`http://127.0.0.1:1`, {polling: {maxRetries: 5, queue: pollQueue(queue)}}, `polling`)).toThrow(expected)
    }
  })

  it(`keeps polling stats separate from webhook stats`, async () => {
    mock = new MockTelegramServer({handlers: updateSource(4, false)})
    await mock.start()
    bot = makeBot(mock.apiRoot, {polling: {maxRetries: 5, queue: pollQueue()}}, `polling`)

    await waitFor(() => sentCount(mock!) >= 4, 15_000)

    expect(bot.getWebhookQueueStats()).toBeNull()
    expect(bot.getPollingQueueStats()?.enabled).toBe(true)
    expect(bot.getPollingQueueStats()?.workerCount).toBe(4)
  })

  it(`reports the configured drain budget, defaulting to 10s`, async () => {
    mock = new MockTelegramServer({handlers: updateSource(4, false)})
    await mock.start()
    bot = makeBot(mock.apiRoot, {polling: {maxRetries: 5, queue: pollQueue({drainTimeoutMs: 250})}}, `polling`)

    await waitFor(() => sentCount(mock!) >= 4, 15_000)
    expect(bot.getPollingQueueStats()?.drainTimeoutMs).toBe(250)

    await bot.stop().catch(() => undefined)
    const defaulted = makeBot(mock.apiRoot, {polling: {maxRetries: 5, queue: pollQueue()}}, `polling`)
    await waitFor(() => sentCount(mock!) >= 4, 15_000)
    expect(defaulted.getPollingQueueStats()?.drainTimeoutMs).toBe(10_000)
    await defaulted.stop().catch(() => undefined)
  })
})