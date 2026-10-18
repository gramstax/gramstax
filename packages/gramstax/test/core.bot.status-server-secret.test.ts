import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"

const TEST_DIR = join(import.meta.dir, `bot_status_secret`)
const SECRET = `s3cr3t-token`

const getFreePort = async (): Promise<number> => {
  const server = Bun.serve({port: 0, hostname: `127.0.0.1`, fetch: () => new Response()})
  const port = server.port ?? 0
  server.stop(true)
  return port
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

class TestGramstax extends Gramstax {
  override _pageLoads() {
    return {routeStatic: {handleCommandText: {}}, routeDynamic: []} as any
  }

  override async _onStart(): Promise<void> {
    return
  }
}

describe(`Gramstax status server secret gate`, () => {
  let bot: TestGramstax
  let baseUrl: string

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
    await mkdir(TEST_DIR, {recursive: true})

    const templateManager = new TemplateManager({path: [TEST_DIR]})
    const port = await getFreePort()
    baseUrl = `http://127.0.0.1:${port}`

    bot = new TestGramstax({
      token: `test`,
      deploy: `test`,
      statusServerPort: port,
      statusServerHostname: `127.0.0.1`,
      templateManager,
      log: false
    })
    ;(bot as any).webhook.secretToken = SECRET

    // _startStatusServer is async (dynamic Bun import) — wait until bound
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        const res = await fetch(`${baseUrl}/health`)
        if (res.status === 200) break
      } catch {}
      await wait(50)
    }
  })

  afterEach(async () => {
    await bot.stop()
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
  })

  it(`keeps GET /health public even when secret is set`, async () => {
    const res = await fetch(`${baseUrl}/health`)
    expect(res.status).toBe(200)
    const body = await res.json() as {status: string}
    expect(body.status).toBe(`ok`)
  })

  it(`rejects GET /stats without secret header with 401 when secret is set`, async () => {
    const res = await fetch(`${baseUrl}/stats`)
    expect(res.status).toBe(401)
  })

  it(`rejects GET /metrics without secret header with 401 when secret is set`, async () => {
    const res = await fetch(`${baseUrl}/metrics`)
    expect(res.status).toBe(401)
  })

  it(`accepts GET /stats with correct secret header`, async () => {
    const res = await fetch(`${baseUrl}/stats`, {headers: {"X-Telegram-Bot-Api-Secret-Token": SECRET}})
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body).toHaveProperty(`counts`)
  })

  it(`accepts GET /metrics with correct secret header`, async () => {
    const res = await fetch(`${baseUrl}/metrics`, {headers: {"X-Telegram-Bot-Api-Secret-Token": SECRET}})
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain(`gramstax_`)
  })

  it(`rejects GET /stats with wrong secret with 401`, async () => {
    const res = await fetch(`${baseUrl}/stats`, {headers: {"X-Telegram-Bot-Api-Secret-Token": `wrong-secret`}})
    expect(res.status).toBe(401)
  })
})

describe(`Gramstax status server without secret`, () => {
  let bot: TestGramstax
  let baseUrl: string

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
    await mkdir(TEST_DIR, {recursive: true})

    const templateManager = new TemplateManager({path: [TEST_DIR]})
    const port = await getFreePort()
    baseUrl = `http://127.0.0.1:${port}`

    bot = new TestGramstax({
      token: `test`,
      deploy: `test`,
      statusServerPort: port,
      statusServerHostname: `127.0.0.1`,
      templateManager,
      log: false
    })

    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        const res = await fetch(`${baseUrl}/health`)
        if (res.status === 200) break
      } catch {}
      await wait(50)
    }
  })

  afterEach(async () => {
    await bot.stop()
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
  })

  it(`allows GET /stats and /metrics without secret when no secret is configured`, async () => {
    const stats = await fetch(`${baseUrl}/stats`)
    expect(stats.status).toBe(200)
    const metrics = await fetch(`${baseUrl}/metrics`)
    expect(metrics.status).toBe(200)
  })
})
