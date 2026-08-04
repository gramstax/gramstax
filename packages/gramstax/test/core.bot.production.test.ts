import {afterAll, beforeAll, describe, expect, it, mock} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {Ctx} from "~/core/ctx"
import {MetricsStore} from "~/helpers/metrics"
import {TemplateManager} from "~/template/manager"

const TEST_PAGES_DIR = join(import.meta.dir, `production-test-pages`)

beforeAll(async () => {
  if (!existsSync(TEST_PAGES_DIR)) {
    await mkdir(TEST_PAGES_DIR, {recursive: true})
  }
})

afterAll(async () => {
  if (existsSync(TEST_PAGES_DIR)) {
    await rm(TEST_PAGES_DIR, {recursive: true, force: true})
  }
})

class ThrowingPage extends Ctx {
  static data = {name: `boom`} as any

  async handleCallbackQueryData() {
    throw new Error(`boom failure`)
  }
}

class CountPage extends Ctx {
  static data = {name: `count`} as any
  static hits = 0

  async handleCallbackQueryData() {
    CountPage.hits += 1
    ;(this as any).temp.isAnswer = true
  }
}

class TestBot extends Gramstax {
  override _pageLoads() {
    return this._buildEmptyPages()
  }

  runPollingLoop(opts: Record<string, unknown>, attempt: number) {
    return this._startPollingLoop(opts, attempt)
  }

  triggerStartupError(error: unknown) {
    return this._onStartupError(error)
  }
}

type TP = ReturnType<TestBot[`_pageLoads`]>

function createBot(params: {skipDuplicateUpdate?: boolean; onUpdateError?: (event: unknown) => void; onUpdate?: (event: unknown) => void; pollingMaxRetries?: number} = {}): {bot: TestBot; pages: TP} {
  const tm = new TemplateManager({path: [TEST_PAGES_DIR]})
  const bot = new TestBot({
    token: `test:token`,
    deploy: `test`,
    log: false,
    templateManager: tm,
    updateTimeoutMs: 0,
    skipDuplicateUpdate: params.skipDuplicateUpdate,
    onUpdateError: params.onUpdateError,
    onUpdate: params.onUpdate,
    pollingMaxRetries: params.pollingMaxRetries,
    botConfig: {
      botInfo: {
        id: 123456789,
        is_bot: true,
        first_name: `Bot`,
        username: `test_bot`
      }
    } as any
  })
  return {bot, pages: bot.pages}
}

function registerPage(bot: TestBot, pages: TP, page: typeof Ctx, name: string) {
  page.data = {name, intentText: name, intentCommandText: name, intentCallbackQueryData: name} as any
  pages.all[name] = page
  bot._pageSorts(page, pages as any, 0)
  bot.pages = pages as any
}

function buildCallbackQuery(data: string, updateId = 1): Record<string, unknown> {
  return {
    update_id: updateId,
    callback_query: {
      id: `cq-${updateId}`,
      from: {id: 42, is_bot: false, first_name: `Tester`},
      chat_instance: `chat-instance`,
      data
    }
  }
}

describe(`MetricsStore`, () => {
  it(`records update counters and latency`, () => {
    const m = new MetricsStore()
    m.recordUpdate(`text`, 5)
    m.recordUpdate(`text`, 15)
    m.recordUpdate(`photo`, 9)

    const snap = m.snapshot()
    expect(snap.counts.updatesTotal).toBe(3)
    expect(snap.byListener.text!).toBe(2)
    expect(snap.byListener.photo!).toBe(1)
    expect(snap.latency.avgMs).toBe(10)
    expect(snap.latency.maxMs).toBe(15)
  })

  it(`exposes zeroed latency before any sample`, () => {
    const m = new MetricsStore()
    const snap = m.snapshot()
    expect(snap.latency.count).toBe(0)
    expect(snap.latency.avgMs).toBe(0)
  })
})

describe(`Gramstax startup config validation`, () => {
  it(`rejects negative updateTimeoutMs`, () => {
    expect(
      () =>
        new Gramstax({
          token: `t`,
          deploy: `test`,
          log: false,
          updateTimeoutMs: -1,
          botConfig: {botInfo: {id: 1, is_bot: true, first_name: `B`, username: `u`}} as any
        } as any)
    ).toThrow(/updateTimeoutMs/)
  })

  it(`rejects invalid webhook deploy URL`, () => {
    expect(
      () =>
        new Gramstax({
          token: `t`,
          deploy: `webhook:not-a-url`,
          log: false
        } as any)
    ).toThrow(/webhook URL/)
  })

  it(`rejects invalid maxQueueSize`, () => {
    expect(
      () =>
        new Gramstax({
          token: `t`,
          deploy: `test`,
          log: false,
          webhookQueue: {maxQueueSize: 0}
        } as any)
    ).toThrow(/maxQueueSize/)
  })
})

describe(`skipDuplicateUpdate`, () => {
  it(`processes a duplicate update only once`, async () => {
    const {bot} = createBot({skipDuplicateUpdate: true})
    registerPage(bot, bot.pages, CountPage, `count`)

    CountPage.hits = 0
    const update = buildCallbackQuery(`count`, 7)
    await bot.bot.handleUpdate(update as any)
    await bot.bot.handleUpdate(update as any)

    expect(CountPage.hits).toBe(1)
    expect(bot.metrics.counts.skippedDuplicate).toBe(1)
  })
})

describe(`onUpdateError hook`, () => {
  it(`fires with a structured error event when a page handler throws`, async () => {
    const events: unknown[] = []
    const {bot} = createBot({onUpdateError: (event) => events.push(event)})
    registerPage(bot, bot.pages, ThrowingPage, `boom`)

    await bot.bot.handleUpdate(buildCallbackQuery(`boom`, 2) as any)

    expect(events.length).toBe(1)
    expect((events[0] as {state: string}).state).toBe(`error`)
    expect((events[0] as {listenerName: string}).listenerName).toBe(`callbackquerydata`)
    expect(bot.metrics.counts.updatesFailed).toBe(1)
  })
})

describe(`onUpdate hook`, () => {
  it(`fires with matched and no-match states`, async () => {
    const events: unknown[] = []
    const {bot} = createBot({onUpdate: (event) => events.push(event)})
    registerPage(bot, bot.pages, CountPage, `count`)
    CountPage.hits = 0

    await bot.bot.handleUpdate(buildCallbackQuery(`count`, 3) as any)
    expect(events.length).toBe(1)
    expect((events[0] as {state: string}).state).toBe(`matched`)
    expect((events[0] as {listenerName: string}).listenerName).toBe(`callbackquerydata`)

    await bot.bot.handleUpdate(buildCallbackQuery(`nope`, 4) as any)
    expect(events.length).toBe(2)
    expect((events[1] as {state: string}).state).toBe(`no-match`)
  })
})

describe(`Gramstax polling recovery`, () => {
  it(`gives up after max retries and emits an error event`, async () => {
    const events: unknown[] = []
    const {bot} = createBot({pollingMaxRetries: 0, onUpdateError: (event) => events.push(event)})
    bot.bot.start = mock(async () => {
      throw new Error(`polling down`)
    }) as unknown as typeof bot.bot.start
    bot.bot.stop = mock(async () => {}) as unknown as typeof bot.bot.stop

    await bot.runPollingLoop({}, 0)

    expect(events.length).toBe(1)
    expect((events[0] as {listenerName: string}).listenerName).toBe(`polling`)
    expect((events[0] as {state: string}).state).toBe(`error`)
    expect(bot.metrics.counts.updatesFailed).toBe(1)
  })

  it(`disables drop_pending_updates on retry attempts`, async () => {
    const calls: Array<Record<string, unknown> | undefined> = []
    const {bot} = createBot({pollingMaxRetries: 5})
    bot.bot.start = mock(async (opts?: Record<string, unknown>) => {
      calls.push(opts ? {...opts} : undefined)
      if (calls.length === 1) {
        throw new Error(`transient blip`)
      }
    }) as unknown as typeof bot.bot.start
    bot.bot.stop = mock(async () => {}) as unknown as typeof bot.bot.stop

    await bot.runPollingLoop({}, 0)

    expect(calls.length).toBe(2)
    expect(calls[0]?.drop_pending_updates).toBe(true)
    expect(calls[1]?.drop_pending_updates).toBe(false)
  })
})

describe(`Gramstax startup failure handling`, () => {
  it(`emits an error event and stops on startup failure`, async () => {
    const events: unknown[] = []
    const {bot} = createBot({onUpdateError: (event) => events.push(event)})
    bot.bot.stop = mock(async () => {}) as unknown as typeof bot.bot.stop

    await bot.triggerStartupError(new Error(`webhook setup failed`))

    expect(events.length).toBe(1)
    expect((events[0] as {state: string}).state).toBe(`error`)
    expect(bot.metrics.counts.updatesFailed).toBe(1)
  })
})

describe(`renderBroadcast excludeIds`, () => {
  it(`skips excluded users and counts them separately`, async () => {
    const api = {sendMessage: mock(async () => ({}))}
    const tm = {getGMessage: mock(() => `msg`)} as any
    const ctx = new Ctx({
      ct: {update: {update_id: 1}, api, me: {id: 1, is_bot: true, first_name: `B`, username: `u`}} as any,
      cacheSession: {} as any,
      cacheKeyboard: new Map(),
      templateManager: tm,
      temp: {isAnswer: false, session: {}, data: {}},
      log: undefined
    })
    ;(ctx as unknown as {data: {name: string}}).data = {name: `x`}

    const res = await ctx.renderBroadcast([1, 2, 3], [`en`], null, null, null, null, false, null, null, [2])

    expect(res.successCount).toBe(2)
    expect(res.skippedCount).toBe(1)
    expect(api.sendMessage).toHaveBeenCalledTimes(2)
  })
})