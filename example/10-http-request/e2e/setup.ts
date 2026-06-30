import {join} from "node:path"
import {BotCore} from "../src/core/bot"
import {TemplateManager} from "gramstax"
export type {ITE2eApiCall, ITE2eUpdateOptions} from "gramstax"

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

export const httpServerUrl = `http://127.0.0.1:${testServer.port}`

export const bot = new BotCore({
  deploy: `test`,
  token: `test`,
  log: false,
  templateManager: new TemplateManager({
    path: [join(import.meta.dir, `../src/pages`)]
  })
})
export const e2e = bot.e2e!
