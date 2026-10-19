import {afterAll, beforeAll, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {metricsToPrometheus} from "~/helpers/metrics"
import {TemplateManager} from "~/template/manager"

const TEST_PAGES_DIR = join(import.meta.dir, `metrics-outcome-pages`)

/**
 * The shape `_pageRoutes` reports. Mirroring it here keeps the stub below
 * cast-free, so no type suppression is needed to replace routing.
 */
type TRouteResult = {state: `matched` | `no-match` | `no-handler` | `blocked`}

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

function createTestBot() {
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
    } as never
  } as never)
}

const stubCtx = {} as never

function stubRoute(bot: Gramstax, next: () => TRouteResult): void {
  bot._pageRoutes = async () => next()
}

function stubRouteSequence(bot: Gramstax, states: Array<TRouteResult[`state`]>): void {
  const remaining = [...states]
  bot._pageRoutes = async () => ({state: remaining.shift() ?? `no-match`})
}

/**
 * `_pageRoutes` computes exactly four outcomes and `_handleCtx` already holds
 * one of them in its local `state`. These tests pin each outcome to its
 * counter, because a counter that is declared, documented and never
 * incremented is worse than a missing one: it reports zero forever, and
 * `metricsToPrometheus` skips zero-valued counters, so it never appears.
 */
describe(`route outcomes reach their counters`, () => {
  const outcomes = [
    {state: `matched`, counter: `matched`},
    {state: `no-match`, counter: `noMatch`},
    {state: `no-handler`, counter: `noHandler`}
  ] as const

  for (const {state, counter} of outcomes) {
    it(`records a \`${state}\` outcome in counts.${counter}`, async () => {
      const bot = createTestBot()
      stubRoute(bot, () => ({state}))

      await bot._handleCtx(stubCtx, `text`, true, `trace-${counter}`)

      expect(bot.metrics.counts[counter]).toBe(1)
      expect(bot.metrics.snapshot().counts[counter]).toBe(1)
    })
  }

  it(`keeps the outcome counters independent across updates`, async () => {
    const bot = createTestBot()
    stubRouteSequence(bot, [`matched`, `no-match`, `no-handler`, `matched`])

    for (let i = 0; i < 4; i++) {
      await bot._handleCtx(stubCtx, `text`, true, `trace-seq-${i}`)
    }

    expect(bot.metrics.counts.matched).toBe(2)
    expect(bot.metrics.counts.noMatch).toBe(1)
    expect(bot.metrics.counts.noHandler).toBe(1)
    expect(bot.metrics.counts.updatesTotal).toBe(4)
  })

  it(`does not count an outcome twice when the update is routed once`, async () => {
    const bot = createTestBot()
    stubRoute(bot, () => ({state: `no-handler`}))

    await bot._handleCtx(stubCtx, `text`, true, `trace-once`)

    expect(bot.metrics.counts.noHandler).toBe(1)
    expect(bot.metrics.counts.matched).toBe(0)
    expect(bot.metrics.counts.noMatch).toBe(0)
  })

  it(`leaves the outcome counters alone when the route throws`, async () => {
    const bot = createTestBot()
    bot._pageRoutes = async () => {
      throw new Error(`handler boom`)
    }

    await bot._handleCtx(stubCtx, `text`, true, `trace-throw`)

    expect(bot.metrics.counts.updatesFailed).toBe(1)
    expect(bot.metrics.counts.matched).toBe(0)
    expect(bot.metrics.counts.noMatch).toBe(0)
    expect(bot.metrics.counts.noHandler).toBe(0)
  })

  it(`emits a non-zero outcome in the Prometheus exposition`, async () => {
    const bot = createTestBot()
    stubRoute(bot, () => ({state: `no-handler`}))

    await bot._handleCtx(stubCtx, `text`, true, `trace-prom`)

    const text = metricsToPrometheus(bot.metrics.snapshot())

    // `metricsToPrometheus` skips zero-valued counters, so these lines only
    // appear once the counter is actually incremented.
    expect(text).toContain(`gramstax_updates_noHandler_total 1`)
    expect(text).not.toContain(`gramstax_updates_matched_total`)
    expect(text).not.toContain(`gramstax_updates_noMatch_total`)
  })
})
