import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test"
import {Bot} from "grammy"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"

const TEST_DIR = join(import.meta.dir, `bot_views_secret`)
const SECRET = `s3cr3t-token`

const getFreePort = async (): Promise<number> => {
  const server = Bun.serve({port: 0, hostname: `127.0.0.1`, fetch: () => new Response()})
  const port = server.port ?? 0
  server.stop(true)
  return port
}

class TestGramstax extends Gramstax {
  override _pageLoads() {
    return {routeStatic: {handleCommandText: {}}, routeDynamic: []} as any
  }

  override async _onStart(): Promise<void> {
    return
  }
}

describe(`Gramstax webhook secret token`, () => {
  let bot: TestGramstax
  let baseUrl: string
  let setWebhookMock: ReturnType<typeof mock>

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
    await mkdir(TEST_DIR, {recursive: true})

    const templateManager = new TemplateManager({path: [TEST_DIR]})
    bot = new TestGramstax({
      token: `test`,
      deploy: `test`,
      templateManager,
      log: false
    })
    ;(bot as any).webhook.secretToken = SECRET

    setWebhookMock = mock(() => true)
    const realBot = new Bot(`test`) as any
    Object.defineProperty(realBot, `api`, {
      value: {
        getWebhookInfo: mock(() => ({url: ``})),
        setWebhook: setWebhookMock,
        getMe: mock(() => ({id: 1, is_bot: true, first_name: `Test`, username: `test`}))
      },
      writable: true
    })
    realBot.init = mock(() => Promise.resolve())
    realBot.handleUpdate = mock(async () => new Response(`OK`, {status: 200}))
    bot.bot = realBot

    const port = await getFreePort()
    baseUrl = `http://127.0.0.1:${port}`
    await bot._runWebhook(`${baseUrl}/webhook`)
  })

  afterEach(async () => {
    ;(bot as any).webhook.server?.stop()
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
  })

  it(`registers secret_token on setWebhook when webhookSecretToken is set`, () => {
    expect(setWebhookMock).toHaveBeenCalledWith(`${baseUrl}/webhook`, {secret_token: SECRET})
  })

  it(`rejects POST without secret header with 401`, async () => {
    const res = await fetch(`${baseUrl}/webhook`, {method: `POST`, body: JSON.stringify({update_id: 1})})
    expect(res.status).toBe(401)
  })

  it(`rejects POST with wrong secret header with 401`, async () => {
    const res = await fetch(`${baseUrl}/webhook`, {
      method: `POST`,
      headers: {"X-Telegram-Bot-Api-Secret-Token": `wrong-secret`},
      body: JSON.stringify({update_id: 1})
    })
    expect(res.status).toBe(401)
  })

  it(`accepts POST with correct secret header`, async () => {
    const res = await fetch(`${baseUrl}/webhook`, {
      method: `POST`,
      headers: {"X-Telegram-Bot-Api-Secret-Token": SECRET},
      body: JSON.stringify({update_id: 1, message: {}})
    })
    expect(res.status).toBe(200)
  })

  it(`rejects GET /stats without secret header with 401`, async () => {
    const res = await fetch(`${baseUrl}/stats`)
    expect(res.status).toBe(401)
  })

  it(`rejects GET /health without secret header with 401`, async () => {
    const res = await fetch(`${baseUrl}/health`)
    expect(res.status).toBe(401)
  })

  it(`rejects GET /stats_queue without secret header with 401`, async () => {
    const res = await fetch(`${baseUrl}/stats_queue`)
    expect(res.status).toBe(401)
  })

  it(`accepts GET /stats with correct secret header`, async () => {
    const res = await fetch(`${baseUrl}/stats`, {headers: {"X-Telegram-Bot-Api-Secret-Token": SECRET}})
    expect(res.status).toBe(200)
  })
})

describe(`handlerBotUpdate secret guard (unit)`, () => {
  const GUARD_DIR = join(import.meta.dir, `bot_guard_unit`)
  const ok = async () => new Response(`OK`, {status: 200})

  beforeEach(async () => {
    if (existsSync(GUARD_DIR)) {
      await rm(GUARD_DIR, {recursive: true, force: true})
    }
    await mkdir(GUARD_DIR, {recursive: true})
  })

  afterEach(async () => {
    if (existsSync(GUARD_DIR)) {
      await rm(GUARD_DIR, {recursive: true, force: true})
    }
  })

  function guardBot(): TestGramstax {
    return new TestGramstax({
      token: `test`,
      deploy: `test`,
      templateManager: new TemplateManager({path: [GUARD_DIR]}),
      log: false
    })
  }

  function webhookRequest(secret?: string): Request {
    const headers: Record<string, string> = {"Content-Type": `application/json`}
    if (secret !== undefined) headers[`X-Telegram-Bot-Api-Secret-Token`] = secret
    return new Request(`https://example.com/webhook`, {method: `POST`, headers, body: JSON.stringify({update_id: 1})})
  }

  it(`passes plain update objects through untouched when secret is set`, async () => {
    const bot = guardBot()
    let called = 0
    const guarded = bot._withSecretGuard((async () => {
      called++
      return ok()
    }) as (...args: unknown[]) => Promise<unknown>, SECRET)
    const res = (await guarded({update_id: 1})) as Response
    expect(called).toBe(1)
    expect(res.status).toBe(200)
  })

  it(`returns handler unwrapped when no secret is configured`, async () => {
    const bot = guardBot()
    let called = 0
    const inner = (async () => {
      called++
      return ok()
    }) as (...args: unknown[]) => Promise<unknown>
    const guarded = bot._withSecretGuard(inner, undefined)
    const res = (await guarded(webhookRequest())) as Response
    expect(called).toBe(1)
    expect(res.status).toBe(200)
  })

  it(`401s Request without secret header when secret is set`, async () => {
    const bot = guardBot()
    let called = 0
    const guarded = bot._withSecretGuard((async () => {
      called++
      return ok()
    }) as (...args: unknown[]) => Promise<unknown>, SECRET)
    const res = (await guarded(webhookRequest())) as Response
    expect(called).toBe(0)
    expect(res.status).toBe(401)
  })

  it(`401s Request with wrong secret and passes correct secret`, async () => {
    const bot = guardBot()
    let called = 0
    const guarded = bot._withSecretGuard((async () => {
      called++
      return ok()
    }) as (...args: unknown[]) => Promise<unknown>, SECRET)
    const wrong = (await guarded(webhookRequest(`wrong-secret`))) as Response
    expect(wrong.status).toBe(401)
    const right = (await guarded(webhookRequest(SECRET))) as Response
    expect(right.status).toBe(200)
    expect(called).toBe(1)
  })
})
