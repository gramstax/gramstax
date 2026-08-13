import {afterEach, describe, expect, it } from "bun:test"
import {MockTelegramServer} from "~/mock/telegram-server"

describe(`MockTelegramServer`, () => {
  const servers: MockTelegramServer[] = []
  const botToken = `test-token`

  const createLogger = () => {
    const messages: Record<`info` | `debug` | `success` | `error`, string[]> = {info: [], debug: [], success: [], error: []}
    return {
      messages,
      logger: {
        info: (message: string) => messages.info.push(message),
        debug: (message: string) => messages.debug.push(message),
        success: (message: string) => messages.success.push(message),
        error: (message: string) => messages.error.push(message)
      }
    }
  }

  const startServer = async (server: MockTelegramServer) => {
    servers.push(server)
    await server.start()
    return server
  }

  afterEach(async () => {
    await Promise.all(servers.map((server) => server.stop()))
    servers.length = 0
  })

  it(`responds to getMe via apiRoot`, async () => {
    const server = await startServer(new MockTelegramServer())

    const response = await fetch(`${server.apiRoot}/bot${botToken}/getMe`, {method: `POST`})
    const data = await response.json()

    expect(data).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          is_bot: true,
          username: `mock_gramstax_bot`
        })
      })
    )
    expect(server.botToken).toBe(botToken)
  })

  it(`starts the Telegram API server without requiring token or webhook params`, async () => {
    const server = new MockTelegramServer()
    servers.push(server)

    const apiRoot = await server.start()

    expect(apiRoot).toBe(server.apiRoot)
    expect(server.server).toBeDefined()
  })

  it(`logs server lifecycle, webhook setup, inbound updates, and captured responses`, async () => {
    const {logger, messages} = createLogger()
    const server = await startServer(new MockTelegramServer({log: logger}))
    const webhook = Bun.serve({
      port: 0,
      hostname: `127.0.0.1`,
      fetch: async () => {
        await fetch(`${server.apiRoot}/bot${botToken}/sendMessage`, {
          method: `POST`,
          headers: {"Content-Type": `application/json`},
          body: JSON.stringify({chat_id: 1001, text: `logged response`})
        })
        return new Response(`OK`)
      }
    })
    const webhookUrl = `http://127.0.0.1:${webhook.port}/webhook`

    await fetch(`${server.apiRoot}/bot${botToken}/setWebhook`, {
      method: `POST`,
      headers: {"Content-Type": `application/json`},
      body: JSON.stringify({url: webhookUrl})
    })
    await server.sendText(`/start`)
    await server.stop()

    expect(messages.info.some((message) => message.includes(`Mock Telegram server started`))).toBe(true)
    expect(messages.info.some((message) => message.includes(`Mock Telegram webhook set`))).toBe(true)
    expect(messages.info.some((message) => message.includes(`Mock Telegram update sent`))).toBe(true)
    expect(messages.info.some((message) => message.includes(`Mock Telegram bot responses captured: 1`))).toBe(true)
    expect(messages.debug.some((message) => message.includes(`Mock Telegram API request: setWebhook`))).toBe(true)
    expect(messages.info.some((message) => message.includes(`Mock Telegram server stopped`))).toBe(true)

    webhook.stop()
  })

  it(`stores webhook URL from setWebhook and exposes it through getWebhookInfo`, async () => {
    const server = await startServer(new MockTelegramServer())
    const webhookUrl = `http://127.0.0.1:3000/webhook`

    const setResponse = await fetch(`${server.apiRoot}/bot${botToken}/setWebhook`, {
      method: `POST`,
      headers: {"Content-Type": `application/json`},
      body: JSON.stringify({url: webhookUrl})
    })
    const setData = await setResponse.json()
    const infoResponse = await fetch(`${server.apiRoot}/bot${botToken}/getWebhookInfo`, {method: `POST`})
    const infoData = await infoResponse.json()

    expect(setData).toEqual({ok: true, result: true})
    expect(infoData).toEqual({ok: true, result: {url: webhookUrl}})
    expect(server.webhookUrl).toBe(webhookUrl)
    expect(server.botToken).toBe(botToken)
  })

  it(`rejects setWebhook with a non-loopback host`, async () => {
    const server = await startServer(new MockTelegramServer())

    const setResponse = await fetch(`${server.apiRoot}/bot${botToken}/setWebhook`, {
      method: `POST`,
      headers: {"Content-Type": `application/json`},
      body: JSON.stringify({url: `http://evil.example.com/webhook`})
    })
    const setData = (await setResponse.json()) as {ok: boolean; description?: string}

    expect(setData.ok).toBe(false)
    expect(server.webhookUrl).toBe(``)

    const infoResponse = await fetch(`${server.apiRoot}/bot${botToken}/getWebhookInfo`, {method: `POST`})
    const infoData = await infoResponse.json()
    expect(infoData).toEqual({ok: true, result: {url: ``}})
  })

  it(`records outbound Bot API requests and returns the latest request by method`, async () => {
    const server = await startServer(new MockTelegramServer())

    await fetch(`${server.apiRoot}/bot${botToken}/sendMessage`, {
      method: `POST`,
      headers: {"Content-Type": `application/json`},
      body: JSON.stringify({chat_id: 1001, text: `Hello`})
    })

    expect(server.requests).toHaveLength(1)
    expect(server.lastRequest(`sendMessage`)).toEqual(
      expect.objectContaining({
        method: `sendMessage`,
        body: {chat_id: 1001, text: `Hello`}
      })
    )
  })

  it(`returns bot outbound response records directly from sendText and sendCallbackQuery`, async () => {
    const server = await startServer(new MockTelegramServer())
    const webhook = Bun.serve({
      port: 0,
      hostname: `127.0.0.1`,
      fetch: async (request) => {
        const update = (await request.json()) as Record<string, Record<string, unknown>>
        const text = (update.message?.text || update.callback_query?.data) as string
        await fetch(`${server.apiRoot}/bot${botToken}/sendMessage`, {
          method: `POST`,
          headers: {"Content-Type": `application/json`},
          body: JSON.stringify({chat_id: 1001, text: `bot response: ${text}`})
        })
        return new Response(`OK`)
      }
    })
    server.webhookUrl = `http://127.0.0.1:${webhook.port}/webhook`

    const textResponses = await server.sendText(`/start`)
    const callbackResponses = await server.sendCallbackQuery(`start:refresh`)

    expect(textResponses).toEqual([
      expect.objectContaining({
        method: `sendMessage`,
        body: {chat_id: 1001, text: `bot response: /start`}
      })
    ])
    expect(callbackResponses).toEqual([
      expect.objectContaining({
        method: `sendMessage`,
        body: {chat_id: 1001, text: `bot response: start:refresh`}
      })
    ])

    webhook.stop()
  })

  it(`waits for async webhook processing before returning bot response records`, async () => {
    const server = await startServer(new MockTelegramServer())
    const webhook = Bun.serve({
      port: 0,
      hostname: `127.0.0.1`,
      fetch: async () => {
        setTimeout(() => {
          fetch(`${server.apiRoot}/bot${botToken}/sendMessage`, {
            method: `POST`,
            headers: {"Content-Type": `application/json`},
            body: JSON.stringify({chat_id: 1001, text: `async bot response`})
          })
        }, 20)
        return new Response(`OK`)
      }
    })
    server.webhookUrl = `http://127.0.0.1:${webhook.port}/webhook`

    const responses = await server.sendText(`hello`, {responseTimeoutMs: 250})

    expect(responses).toEqual([
      expect.objectContaining({
        method: `sendMessage`,
        body: {chat_id: 1001, text: `async bot response`}
      })
    ])

    webhook.stop()
  })

  it(`returns only user-facing bot responses and skips internal Bot API calls`, async () => {
    const server = await startServer(new MockTelegramServer())
    const webhook = Bun.serve({
      port: 0,
      hostname: `127.0.0.1`,
      fetch: async () => {
        await fetch(`${server.apiRoot}/bot${botToken}/getMe`, {method: `POST`, headers: {"Content-Type": `application/json`}, body: JSON.stringify({})})
        await fetch(`${server.apiRoot}/bot${botToken}/sendMessage`, {
          method: `POST`,
          headers: {"Content-Type": `application/json`},
          body: JSON.stringify({chat_id: 1001, text: `visible response`})
        })
        return new Response(`OK`)
      }
    })
    server.webhookUrl = `http://127.0.0.1:${webhook.port}/webhook`

    const responses = await server.sendText(`hello`)

    expect(responses).toEqual([
      expect.objectContaining({
        method: `sendMessage`,
        body: {chat_id: 1001, text: `visible response`}
      })
    ])
    expect(server.requests.map((request) => request.method)).toContain(`getMe`)

    webhook.stop()
  })

  it(`returns outbound bot response records from all routed Telegram message update helpers`, async () => {
    const server = await startServer(new MockTelegramServer())
    const webhook = Bun.serve({
      port: 0,
      hostname: `127.0.0.1`,
      fetch: async (request) => {
        const update = (await request.json()) as Record<string, Record<string, unknown>>
        const message = update.message as Record<string, unknown>
        const updateType = Object.keys(message).filter((key) => [`photo`, `video`, `audio`, `document`, `animation`, `voice`, `video_note`, `sticker`, `location`, `contact`].includes(key))[0] || `text`
        await fetch(`${server.apiRoot}/bot${botToken}/sendMessage`, {
          method: `POST`,
          headers: {"Content-Type": `application/json`},
          body: JSON.stringify({chat_id: 1001, text: updateType})
        })
        return new Response(`OK`)
      }
    })
    server.webhookUrl = `http://127.0.0.1:${webhook.port}/webhook`

    const responses = [
      await server.sendText(`/start abc`),
      await server.sendPhoto({caption: `photo caption`}),
      await server.sendVideo({caption: `video caption`}),
      await server.sendAudio({caption: `audio caption`}),
      await server.sendDocument({caption: `document caption`}),
      await server.sendAnimation({caption: `animation caption`}),
      await server.sendVoice({caption: `voice caption`}),
      await server.sendVideoNote(),
      await server.sendSticker(),
      await server.sendLocation({latitude: 1.23, longitude: 4.56}),
      await server.sendContact({phone_number: `+620000000`, first_name: `Tester`})
    ]

    expect(responses.map((response) => (response[0]?.body as Record<string, unknown>).text)).toEqual([`text`, `photo`, `video`, `audio`, `document`, `animation`, `voice`, `video_note`, `sticker`, `location`, `contact`])

    webhook.stop()
  })
})
