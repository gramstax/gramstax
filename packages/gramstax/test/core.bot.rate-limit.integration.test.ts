import {afterAll, beforeAll, describe, expect, it} from "bun:test"
import {existsSync, mkdtempSync, writeFileSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {Ctx} from "~/core/ctx"
import {TemplateManager} from "~/template/manager"

const TEST_PAGES_DIR = join(import.meta.dir, `rate-limit-integration-pages`)

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

class PleaseWaitPage extends Ctx {
  static data = this.buildData({name: `please-wait`})

  static template = `
    <g-base id="please-wait">
      <g-message>Please wait a moment...</g-message>
    </g-base>
  `

  gshow = {
    show: async () => {
      await this.renderText({data: {}, AGBaseId: `please-wait`})
    }
  }
}

class RateLimitBot extends Gramstax {
  blockedCount = 0

  override async hookRateLimited(ctx: Ctx) {
    this.blockedCount++
    await new PleaseWaitPage(ctx).gshow.show()
  }
}

function createBot(overrides: Record<string, unknown> = {}): RateLimitBot {
  const dir = mkdtempSync(join(tmpdir(), `gramstax-ratelimit-`))
  writeFileSync(
    join(dir, `please-wait.html`),
    `<g-base id="please-wait"><g-message>Please wait a moment...</g-message></g-base>`
  )
  const tm = new TemplateManager({path: [dir]})
  return new RateLimitBot({
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
    } as any,
    ...overrides
  } as never)
}

function buildText(text: string): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: 1,
      chat: {id: 123456789, type: `private`},
      date: Math.floor(Date.now() / 1000),
      from: {id: 123456789, is_bot: false, first_name: `User`},
      text
    }
  }
}

describe(`rate limiting — full Gramstax pipeline integration`, () => {
  it(`renders the hook page through the real chain when the limit is exceeded`, async () => {
    const bot = createBot({rateLimit: {windowMs: 60000, max: 1}})

    // Under the limit: update passes through the middleware untouched.
    await bot.bot.handleUpdate(buildText(`first`) as never)
    expect(bot.blockedCount).toBe(0)
    expect(bot.e2e!.lastCall(`sendMessage`)).toBeUndefined()

    // Exceeded: middleware drops the update and the hook renders the page.
    await bot.bot.handleUpdate(buildText(`second`) as never)
    expect(bot.blockedCount).toBe(1)
    const sent = bot.e2e!.lastCall(`sendMessage`) as {body?: {text?: string}} | undefined
    expect(sent).toBeDefined()
    expect(sent?.body?.text).toContain(`Please wait a moment...`)
  })

  it(`never blocks when rateLimit params are absent`, async () => {
    const bot = createBot()
    await bot.bot.handleUpdate(buildText(`a`) as never)
    await bot.bot.handleUpdate(buildText(`b`) as never)
    expect(bot.blockedCount).toBe(0)
    expect(bot.e2e!.lastCall(`sendMessage`)).toBeUndefined()
  })
})