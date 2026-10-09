import {afterAll, beforeAll, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"

const TEST_PAGES_DIR = join(import.meta.dir, `fallback-guard-pages`)

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

function createTestBot(cfg: Record<string, unknown> = {}) {
  const tm = new TemplateManager({path: [TEST_PAGES_DIR]})
  return new Gramstax({
    token: `test`,
    deploy: `test`,
    templateManager: tm,
    log: false,
    botConfig: {
      botInfo: {
        id: 123456789,
        is_bot: true,
        first_name: `Bot`,
        username: `test_bot`
      }
    } as never,
    ...cfg
  } as never)
}

const stubCtx = {} as never

describe(`fallback page hooks cannot take down the update`, () => {
  it(`invokes hookErrorPage when the handler throws`, async () => {
    const bot = createTestBot()
    const seen: Array<unknown> = []
    bot.hookErrorPage = async (_ctx: unknown, data?: {error?: unknown}) => {
      seen.push(data?.error)
    }
    // biome-ignore lint/suspicious/noExplicitAny: route stub
    ;(bot as any)._pageRoutes = async () => {
      throw new Error(`handler boom`)
    }

    await bot._handleCtx(stubCtx, `text`, true, `trace-1`)

    expect(seen.length).toBe(1)
    expect(bot.metrics.counts.updatesFailed).toBe(1)
  })

  it(`contains a throw from hookErrorPage and still finishes the update`, async () => {
    const bot = createTestBot()
    bot.hookErrorPage = async () => {
      throw new Error(`error page boom`)
    }
    let afterRouteCalls = 0
    bot.hookAfterRoute = async () => {
      afterRouteCalls += 1
    }
    // biome-ignore lint/suspicious/noExplicitAny: route stub
    ;(bot as any)._pageRoutes = async () => {
      throw new Error(`handler boom`)
    }

    await bot._handleCtx(stubCtx, `text`, true, `trace-2`)

    expect(afterRouteCalls).toBe(1)
    expect(bot.metrics.counts.updatesFailed).toBe(1)
  })

  it(`contains a throw from hookNotFoundPage and still finishes the update`, async () => {
    const bot = createTestBot()
    bot.hookNotFoundPage = async () => {
      throw new Error(`not found page boom`)
    }
    let afterRouteCalls = 0
    bot.hookAfterRoute = async () => {
      afterRouteCalls += 1
    }
    // biome-ignore lint/suspicious/noExplicitAny: route stub
    ;(bot as any)._pageRoutes = async () => ({state: `no-match`})

    await bot._handleCtx(stubCtx, `text`, true, `trace-3`)

    expect(afterRouteCalls).toBe(1)
  })

  it(`falls through to hookErrorPage when hookNotFoundPage itself fails`, async () => {
    const bot = createTestBot()
    bot.hookNotFoundPage = async () => {
      throw new Error(`not found page boom`)
    }
    const errorSeen: Array<unknown> = []
    bot.hookErrorPage = async (_ctx: unknown, data?: {error?: unknown}) => {
      errorSeen.push(data?.error)
    }
    // biome-ignore lint/suspicious/noExplicitAny: route stub
    ;(bot as any)._pageRoutes = async () => ({state: `no-match`})

    await bot._handleCtx(stubCtx, `text`, true, `trace-4`)

    expect(errorSeen.length).toBe(1)
  })

  it(`reaches neither hook on a matched route`, async () => {
    const bot = createTestBot()
    let errorPageCalls = 0
    let notFoundCalls = 0
    bot.hookErrorPage = async () => {
      errorPageCalls += 1
    }
    bot.hookNotFoundPage = async () => {
      notFoundCalls += 1
    }
    // biome-ignore lint/suspicious/noExplicitAny: route stub
    ;(bot as any)._pageRoutes = async () => ({state: `matched`})

    await bot._handleCtx(stubCtx, `text`, true, `trace-5`)

    expect(errorPageCalls).toBe(0)
    expect(notFoundCalls).toBe(0)
  })

  it(`routes a throw from hookBeforeRoute to hookErrorPage`, async () => {
    const bot = createTestBot()
    bot.hookBeforeRoute = async () => {
      throw new Error(`guard boom`)
    }
    const errorSeen: Array<unknown> = []
    bot.hookErrorPage = async (_ctx: unknown, data?: {error?: unknown}) => {
      errorSeen.push(data?.error)
    }
    let routeCalls = 0
    // biome-ignore lint/suspicious/noExplicitAny: route stub
    ;(bot as any)._pageRoutes = async () => {
      routeCalls += 1
      return {state: `matched`}
    }

    await bot._handleCtx(stubCtx, `text`, true, `trace-6`)

    expect(errorSeen.length).toBe(1)
    expect(routeCalls).toBe(0)
    expect(bot.metrics.counts.updatesFailed).toBe(1)
  })

  it(`still short-circuits when hookBeforeRoute returns false`, async () => {
    const bot = createTestBot()
    bot.hookBeforeRoute = async () => false
    let routeCalls = 0
    // biome-ignore lint/suspicious/noExplicitAny: route stub
    ;(bot as any)._pageRoutes = async () => {
      routeCalls += 1
      return {state: `matched`}
    }

    await bot._handleCtx(stubCtx, `text`, true, `trace-7`)

    expect(routeCalls).toBe(0)
    expect(bot.metrics.counts.blocked).toBe(1)
  })

  it(`contains a throw from hookAfterRoute and still records the update`, async () => {
    const bot = createTestBot()
    bot.hookAfterRoute = async () => {
      throw new Error(`after route boom`)
    }
    const before = bot.metrics.snapshot().counts.updatesTotal
    // biome-ignore lint/suspicious/noExplicitAny: route stub
    ;(bot as any)._pageRoutes = async () => ({state: `matched`})

    await bot._handleCtx(stubCtx, `text`, true, `trace-8`)

    expect(bot.metrics.snapshot().counts.updatesTotal).toBe(before + 1)
  })
})