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

  it(`replays the setWebhook secret_token as a header on outbound webhook POSTs`, async () => {
    const seen: Array<string | null> = []
    const webhook = Bun.serve({
      port: 0,
      fetch: (request) => {
        seen.push(request.headers.get(`X-Telegram-Bot-Api-Secret-Token`))
        return new Response(`ok`)
      }
    })
    const server = await startServer(new MockTelegramServer())

    await fetch(`${server.apiRoot}/bot${botToken}/setWebhook`, {
      method: `POST`,
      headers: {"Content-Type": `application/json`},
      body: JSON.stringify({url: `http://127.0.0.1:${webhook.port}/hook`, secret_token: `s3cr3t`})
    })
    await server._postUpdate({update_id: 1})

    expect(seen).toEqual([`s3cr3t`])

    webhook.stop()
  })

  it(`omits the secret header when setWebhook registered no secret_token`, async () => {
    const seen: Array<string | null> = []
    const webhook = Bun.serve({
      port: 0,
      fetch: (request) => {
        seen.push(request.headers.get(`X-Telegram-Bot-Api-Secret-Token`))
        return new Response(`ok`)
      }
    })
    const server = await startServer(new MockTelegramServer())

    await fetch(`${server.apiRoot}/bot${botToken}/setWebhook`, {
      method: `POST`,
      headers: {"Content-Type": `application/json`},
      body: JSON.stringify({url: `http://127.0.0.1:${webhook.port}/hook`})
    })
    await server._postUpdate({update_id: 1})

    expect(seen).toEqual([null])

    webhook.stop()
  })
  const inboundUpdate = (updateId: number, chatId: number) => ({
    update: {
      update_id: updateId,
      message: {message_id: updateId, date: 1, chat: {id: chatId, type: `private`}, from: {id: chatId, is_bot: false, first_name: `B`}, text: `/start`}
    }
  })

  const post = async (server: MockTelegramServer, method: string, body: unknown) => {
    const response = await fetch(`${server.apiRoot}/bot${botToken}/${method}`, {
      method: `POST`,
      headers: {"Content-Type": `application/json`},
      body: JSON.stringify(body)
    })
    return (await response.json()) as {ok: boolean; description?: string; result?: Record<string, unknown>}
  }

  it(`queues an inbound update for a polling bot and serves it on getUpdates`, async () => {
    const server = await startServer(new MockTelegramServer())

    const delivered = await post(server, `__update`, inboundUpdate(1, 5001))
    expect(delivered.ok).toBe(true)
    expect(delivered.result?.delivered).toBe(`polling`)

    const batch = await post(server, `getUpdates`, {offset: 0, limit: 100})
    expect((batch.result as unknown as Array<{update_id: number}>)?.map((u) => u.update_id)).toEqual([1])
  })

  it(`drops consumed updates once the polling loop advances its offset`, async () => {
    const server = await startServer(new MockTelegramServer())
    await post(server, `__update`, inboundUpdate(1, 5001))
    await post(server, `__update`, inboundUpdate(2, 5002))

    await post(server, `getUpdates`, {offset: 2, limit: 100})
    expect(server.pendingUpdates).toHaveLength(1)

    const batch = await post(server, `getUpdates`, {offset: 2, limit: 100})
    expect((batch.result as unknown as Array<{update_id: number}>)?.map((u) => u.update_id)).toEqual([2])
  })

  it(`delivers an inbound update straight to the webhook when one is registered`, async () => {
    const received: Array<Record<string, unknown>> = []
    const webhook = Bun.serve({
      port: 0,
      fetch: async (request) => {
        // The body must be consumed before responding, otherwise Bun closes the
        // connection and the caller's fetch aborts.
        received.push((await request.json()) as Record<string, unknown>)
        return new Response(`ok`)
      }
    })
    const server = await startServer(new MockTelegramServer())
    await post(server, `setWebhook`, {url: `http://127.0.0.1:${webhook.port}/hook`})

    const delivered = await post(server, `__update`, inboundUpdate(7, 5007))
    expect(delivered.ok).toBe(true)
    expect(delivered.result?.delivered).toBe(`webhook`)
    // A webhook bot must not accumulate a polling backlog.
    expect(server.pendingUpdates).toHaveLength(0)

    // The mock numbers updates itself, so the caller's 7 is ignored.
    expect(received[0]?.update_id).toBe(1)

    webhook.stop()
  })

  it(`rejects an inbound update without an update object`, async () => {
    const server = await startServer(new MockTelegramServer())

    const result = await post(server, `__update`, {message: {text: `hi`}})

    expect(result.ok).toBe(false)
    expect(result.description).toContain(`update`)
  })
  it(`reports recorded Bot API method counts and queue depth over __stats`, async () => {
    const server = await startServer(new MockTelegramServer())

    await post(server, `__update`, inboundUpdate(1, 5001))
    await post(server, `getUpdates`, {offset: 0, limit: 100})
    await post(server, `sendMessage`, {chat_id: 5001, text: `hi`})

    const stats = await post(server, `__stats`, {})
    const counts = stats.result?.counts as Record<string, number> | undefined

    expect(stats.ok).toBe(true)
    // `__stats` itself is recorded too, since every request is pushed before dispatch.
    expect(stats.result?.total).toBe(4)
    expect(counts?.__update).toBe(1)
    expect(counts?.getUpdates).toBe(1)
    expect(counts?.sendMessage).toBe(1)
    expect(stats.result?.pending).toBe(1)
    expect(stats.result?.webhookUrl).toBeNull()
  })
  it(`assigns its own monotonic update_id and ignores the caller's`, async () => {
    const server = await startServer(new MockTelegramServer())

    // Caller-supplied ids arrive shuffled, as a concurrent loader produces them.
    const first = await post(server, `__update`, inboundUpdate(30, 5003))
    const second = await post(server, `__update`, inboundUpdate(10, 5001))
    const third = await post(server, `__update`, inboundUpdate(20, 5002))

    expect([first.result?.update_id, second.result?.update_id, third.result?.update_id]).toEqual([1, 2, 3])

    const batch = await post(server, `getUpdates`, {offset: 0, limit: 100})
    expect((batch.result as unknown as Array<{update_id: number}>)?.map((u) => u.update_id)).toEqual([1, 2, 3])

    const fourth = await post(server, `__update`, inboundUpdate(99, 5004))
    expect(fourth.result?.update_id).toBe(4)
  })
})
