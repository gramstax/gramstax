import {afterAll, beforeAll, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"

const TEST_PAGES_DIR = join(import.meta.dir, `throttler-test-pages`)

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

const createBot = (overrides: Record<string, unknown> = {}): Gramstax => {
  const tm = new TemplateManager({path: [TEST_PAGES_DIR]})
  return new Gramstax({
    token: `test`,
    deploy: `test`,
    templateManager: tm,
    log: false,
    botConfig: {botInfo: {id: 123456789, is_bot: true, first_name: `Bot`, username: `test_bot`}} as any,
    ...overrides
  } as never)
}

const transformerCount = (bot: Gramstax) => (bot.bot.api.config as unknown as {installedTransformers: () => unknown[]}).installedTransformers().length

describe(`outgoing throttle via @grammyjs/transformer-throttler`, () => {
  it(`mounts apiThrottler when throttle params provided (more transformers than baseline)`, () => {
    const baseCount = transformerCount(createBot())

    const withThrottle = createBot({throttle: {global: {limit: 20, interval: 1000}}})
    const withCount = transformerCount(withThrottle)

    expect(withCount).toBeGreaterThan(baseCount)
  })

  it(`baseline (no throttle) has installedTransformers (autoRetry)`, () => {
    expect(transformerCount(createBot())).toBeGreaterThan(0)
  })
})