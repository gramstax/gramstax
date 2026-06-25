import {join} from "node:path"
import {BotCore} from "../src/core/bot"
import {TemplateManager} from "gramstax"
import {MockTelegramServer} from "gramstax"

export interface TestEnvironment {
  mockServer: MockTelegramServer
  botCore: BotCore
  httpServerUrl: string
  clearRequests: () => void
}

let sharedEnv: TestEnvironment | null = null

export async function getEnv(): Promise<TestEnvironment> {
  if (sharedEnv) return sharedEnv

  const mockServer = new MockTelegramServer({log: false})
  await mockServer.start()

  // Start a local HTTP test server for the bot to fetch
  const testServer = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url)

      if (url.pathname === `/echo`) {
        if (req.method === `POST`) {
          const body = await req.text()
          return new Response(JSON.stringify({echoed: body, received: true}), {
            status: 200,
            headers: {"Content-Type": `application/json`}
          })
        }
        return new Response(`Method not allowed`, {status: 405})
      }

      if (url.pathname === `/echo-headers`) {
        const authHeader = req.headers.get(`authorization`)
        return new Response(JSON.stringify({authorization: authHeader, received: true}), {
          status: 200,
          headers: {"Content-Type": `application/json`}
        })
      }

      if (url.pathname === `/test`) {
        return new Response(JSON.stringify({message: `Hello from test server`, ok: true}), {
          status: 200,
          headers: {"Content-Type": `application/json`, "X-Custom": `test-header`}
        })
      }

      if (url.pathname === `/not-found`) {
        return new Response(`Not Found`, {status: 404})
      }

      if (url.pathname === `/html`) {
        return new Response(`<h1>Hello HTML</h1>`, {
          status: 200,
          headers: {"Content-Type": `text/html`}
        })
      }

      return new Response(`OK`, {status: 200})
    }
  })

  const httpServerUrl = `http://127.0.0.1:${testServer.port}`

  const templateManager = new TemplateManager({path: [join(import.meta.dir, `../src/pages`)]})
  const cwd = process.cwd()
  process.chdir(join(import.meta.dir, `..`))

  const botCore = new BotCore({
    deploy: `webhook:http://127.0.0.1:3004/webhook/e2e-10-http-request`,
    token: `test-token`,
    log: false,
    templateManager,
    botConfig: {client: {apiRoot: mockServer.apiRoot}}
  })

  process.chdir(cwd)

  const startedAt = Date.now()
  while (!mockServer.webhookUrl && Date.now() - startedAt < 5000) {
    await new Promise((r) => setTimeout(r, 50))
  }

  sharedEnv = {
    mockServer,
    botCore,
    httpServerUrl,
    clearRequests: () => mockServer.clearRequests()
  }

  return sharedEnv
}

/** Render expected message text for a page template via templateManager.getMessage. */
export function msg(page: string, baseId: string, data?: Record<string, any>, lang = `default`): string {
  return sharedEnv!.botCore.templateManager.getMessage(page, baseId, lang, data)
}

/** Render expected keyboard labels for a page template via templateManager.getKeyboard. */
export function kb(page: string, baseId: string, type: `inline` | `bottom` = `inline`, data?: Record<string, any>, lang = `default`): string[] {
  return sharedEnv!.botCore.templateManager.getKeyboard(page, baseId, lang, type, data)
}

/** Extract flattened button label strings from a Telegram API response body. */
export function buttonLabels(resp: any): string[] {
  return resp?.body?.reply_markup?.inline_keyboard?.flat().map((b: any) => b.text) ?? []
}

export function media(page: string, baseId: string, data?: Record<string, any>, lang = `default`): Record<string, any> {
  return sharedEnv!.botCore.templateManager.getMedia(page, baseId, lang, data)
}
