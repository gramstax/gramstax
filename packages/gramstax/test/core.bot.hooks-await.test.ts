import {beforeAll, afterAll, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"

const TEST_PAGES_DIR = join(import.meta.dir, `hooks-await-test-pages`)

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

function createBot(cfg: Record<string, unknown> = {}) {
  const tm = new TemplateManager({path: [TEST_PAGES_DIR]})
  return new Gramstax({
    token: `test`,
    deploy: `test`,
    templateManager: tm,
    log: false,
    ...cfg
  } as never)
}

function botInfo() {
  return {id: 1, is_bot: true, first_name: `Bot`, username: `test_bot`}
}

describe(`startup hooks are awaited`, () => {
  it(`awaits hookAfterStart before _onStart resolves`, async () => {
    const order: string[] = []
    class HookBot extends Gramstax {
      override async hookAfterStart() {
        order.push(`after-start`)
        await new Promise((r) => setTimeout(r, 50))
        order.push(`after-start-done`)
      }
    }
    const bot = createBot() as HookBot
    ;(bot as unknown as {hookAfterStart: () => Promise<void>}).hookAfterStart = async () => {
      order.push(`after-start`)
      await new Promise((r) => setTimeout(r, 50))
      order.push(`after-start-done`)
    }

    await (bot as unknown as {_onStart: (b: unknown, m: string, d: string | null) => Promise<void>})._onStart(botInfo(), `polling`, null)

    expect(order).toEqual([`after-start`, `after-start-done`])
  })

  it(`awaits hookBeforeStart before the polling loop starts`, async () => {
    const order: string[] = []
    const bot = createBot()
    ;(bot as unknown as {hookBeforeStart: () => Promise<void>}).hookBeforeStart = async () => {
      order.push(`before-start`)
      await new Promise((r) => setTimeout(r, 20))
      order.push(`before-start-done`)
    }
    ;(bot.bot as unknown as {start: () => Promise<void>}).start = async () => {
      order.push(`started`)
    }

    await (bot as unknown as {_runPolling: () => Promise<void>})._runPolling()
    await new Promise((r) => setTimeout(r, 50))

    expect(order).toEqual([`before-start`, `before-start-done`, `started`])
  })
})