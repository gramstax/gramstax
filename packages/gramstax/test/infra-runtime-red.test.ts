import {afterEach, describe, expect, it} from "bun:test"
import {CacheExternal} from "~/cache/external"
import {MockTelegramServer} from "~/mock/telegram-server"
import {UpdateQueue} from "~/update/queue"

const botToken = `red-token`

describe(`infra-runtime-red`, () => {
  const servers: MockTelegramServer[] = []

  afterEach(async () => {
    await Promise.all(servers.map((server) => server.stop()))
    servers.length = 0
  })

  const post = async (server: MockTelegramServer, method: string, body: unknown) => {
    const response = await fetch(`${server.apiRoot}/bot${botToken}/${method}`, {
      method: `POST`,
      headers: {"Content-Type": `application/json`},
      body: JSON.stringify(body)
    })
    return {status: response.status, data: (await response.json()) as {ok: boolean; result?: any; description?: string}}
  }

  it(`B1 returns message-shaped results for send* and true for answer/edit/delete`, async () => {
    const server = new MockTelegramServer()
    servers.push(server)
    await server.start()

    const sent = await post(server, `sendMessage`, {chat_id: 7, text: `hi`})
    expect(sent.data.ok).toBe(true)
    expect(typeof sent.data.result?.message_id).toBe(`number`)
    expect(typeof sent.data.result?.date).toBe(`number`)
    expect(sent.data.result?.chat).toEqual(expect.objectContaining({id: 7}))

    const photo = await post(server, `sendPhoto`, {chat_id: 9})
    expect(photo.data.result?.chat).toEqual(expect.objectContaining({id: 9}))

    const answered = await post(server, `answerCallbackQuery`, {callback_query_id: `x`})
    expect(answered.data).toEqual({ok: true, result: true})
    const edited = await post(server, `editMessageText`, {chat_id: 7, message_id: 1, text: `e`})
    expect(edited.data).toEqual({ok: true, result: true})
    const deleted = await post(server, `deleteMessage`, {chat_id: 7, message_id: 1})
    expect(deleted.data).toEqual({ok: true, result: true})
  })

  it(`B2 maps handler errors to {ok:false} with HTTP 200`, async () => {
    const server = new MockTelegramServer({
      handlers: {
        boom: () => {
          throw new Error(`kaput`)
        },
        boomAsync: async () => {
          throw new Error(`async-kaput`)
        }
      }
    })
    servers.push(server)
    await server.start()

    const sync = await post(server, `boom`, {})
    expect(sync.status).toBe(200)
    expect(sync.data.ok).toBe(false)
    expect(sync.data.description).toContain(`kaput`)

    const asyncResult = await post(server, `boomAsync`, {})
    expect(asyncResult.status).toBe(200)
    expect(asyncResult.data.ok).toBe(false)
    expect(asyncResult.data.description).toContain(`async-kaput`)
  })

  it(`B3 exposes an explicit documented user-response allowlist`, async () => {
    expect(Array.isArray(MockTelegramServer.userResponsePrefixes)).toBe(true)
    expect(MockTelegramServer.userResponsePrefixes).toEqual(expect.arrayContaining([`send`, `edit`, `answer`, `delete`]))
    expect(MockTelegramServer.userResponseMethods).toEqual(expect.arrayContaining([`pinChatMessage`, `unpinChatMessage`, `setMessageReaction`]))
  })

  it(`B4 stop({clear:true}) clears logs and reset() restores pristine state`, async () => {
    const server = new MockTelegramServer()
    servers.push(server)
    server.requests.push({method: `sendMessage`, body: {}, url: `u`, requestMethod: `POST`, headers: {}})
    server.updates.push({update_id: 1})
    server.webhookUrl = `http://127.0.0.1:9/hook`
    await server.stop({clear: true})
    expect(server.requests).toHaveLength(0)
    expect(server.updates).toHaveLength(0)

    server.requests.push({method: `sendMessage`, body: {}, url: `u`, requestMethod: `POST`, headers: {}})
    server.updates.push({update_id: 2})
    server.webhookUrl = `http://127.0.0.1:9/hook`
    server.reset()
    expect(server.requests).toHaveLength(0)
    expect(server.updates).toHaveLength(0)
    expect(server.webhookUrl).toBe(``)
  })

  it(`B5 clearAll() clears requests and updates together`, async () => {
    const server = new MockTelegramServer()
    servers.push(server)
    server.requests.push({method: `sendMessage`, body: {}, url: `u`, requestMethod: `POST`, headers: {}})
    server.updates.push({update_id: 1})
    server.clearAll()
    expect(server.requests).toHaveLength(0)
    expect(server.updates).toHaveLength(0)
  })

  it(`B6 retains File name/type for multipart uploads`, async () => {
    const server = new MockTelegramServer()
    servers.push(server)
    await server.start()

    const form = new FormData()
    form.append(`chat_id`, `7`)
    form.append(`document`, new File([`hello`], `hello.txt`, {type: `text/plain`}))
    const response = await fetch(`${server.apiRoot}/bot${botToken}/sendDocument`, {method: `POST`, body: form})
    expect(response.status).toBe(200)
    const body = server.lastRequest(`sendDocument`)?.body as Record<string, unknown>
    const file = body?.document as File
    expect(file?.name).toBe(`hello.txt`)
    expect(file?.type).toBe(`text/plain`)
  })

  it(`B7 enforces the documented loopback-only webhook policy`, async () => {
    const server = new MockTelegramServer()
    servers.push(server)
    await server.start()

    const bad = await post(server, `setWebhook`, {url: `http://evil.example.com/hook`})
    expect(bad.data.ok).toBe(false)
    expect(bad.data.description).toContain(`127.0.0.1`)

    const good = await post(server, `setWebhook`, {url: `http://127.0.0.1:9/hook`})
    expect(good.data).toEqual({ok: true, result: true})
  })

  describe(`A8 missing inbound helpers`, () => {
    const withEcho = async (run: (server: MockTelegramServer) => Promise<void>) => {
      const server = new MockTelegramServer()
      servers.push(server)
      await server.start()
      const echo = Bun.serve({port: 0, hostname: `127.0.0.1`, fetch: async () => new Response(`OK`)})
      try {
        server.webhookUrl = `http://127.0.0.1:${echo.port}/hook`
        await run(server)
      } finally {
        echo.stop()
      }
    }
    const lastUpdate = (server: MockTelegramServer) => server.updates[server.updates.length - 1] as Record<string, Record<string, unknown>>

    it(`sendEditedText posts an edited_message update`, async () => {
      await withEcho(async (server) => {
        await server.sendEditedText(`new text`, {responseTimeoutMs: 0})
        expect(lastUpdate(server).edited_message?.text).toBe(`new text`)
      })
    })

    it(`sendNewChatMembers posts a new_chat_members service message`, async () => {
      await withEcho(async (server) => {
        await server.sendNewChatMembers({responseTimeoutMs: 0})
        expect(Array.isArray(lastUpdate(server).message?.new_chat_members)).toBe(true)
      })
    })

    it(`sendChannelPost posts a channel_post update`, async () => {
      await withEcho(async (server) => {
        await server.sendChannelPost(`channel hi`, {responseTimeoutMs: 0})
        expect(lastUpdate(server).channel_post?.text).toBe(`channel hi`)
      })
    })

    it(`sendPollAnswer posts a poll_answer update`, async () => {
      await withEcho(async (server) => {
        await server.sendPollAnswer(`poll-1`, [0], {responseTimeoutMs: 0})
        expect(lastUpdate(server).poll_answer?.poll_id).toBe(`poll-1`)
      })
    })

    it(`sendInlineQuery posts an inline_query update`, async () => {
      await withEcho(async (server) => {
        await server.sendInlineQuery(`query`, {responseTimeoutMs: 0})
        expect(lastUpdate(server).inline_query?.query).toBe(`query`)
      })
    })

    it(`sendChosenInlineResult posts a chosen_inline_result update`, async () => {
      await withEcho(async (server) => {
        await server.sendChosenInlineResult(`result-1`, `query`, {responseTimeoutMs: 0})
        expect(lastUpdate(server).chosen_inline_result?.result_id).toBe(`result-1`)
      })
    })

    it(`sendChatMemberUpdate posts a chat_member transition`, async () => {
      await withEcho(async (server) => {
        await server.sendChatMemberUpdate({oldStatus: `kicked`, newStatus: `member`, responseTimeoutMs: 0})
        const member = lastUpdate(server).chat_member as Record<string, Record<string, unknown>>
        expect(member?.old_chat_member?.status).toBe(`kicked`)
        expect(member?.new_chat_member?.status).toBe(`member`)
      })
    })

    it(`sendMyChatMemberUpdate posts a my_chat_member transition`, async () => {
      await withEcho(async (server) => {
        await server.sendMyChatMemberUpdate({oldStatus: `left`, newStatus: `member`, responseTimeoutMs: 0})
        const member = lastUpdate(server).my_chat_member as Record<string, Record<string, unknown>>
        expect(member?.old_chat_member?.status).toBe(`left`)
        expect(member?.new_chat_member?.status).toBe(`member`)
      })
    })
  })

  it(`C1 throws for unknown storage URLs but keeps the forceStore path`, async () => {
    expect(() => new CacheExternal(`postgres://localhost:5432/db`)).toThrow()
    const memory = new CacheExternal<string>(`memory`)
    await memory.set(`k`, `v`)
    const stored = await memory.get(`k`)
    expect(stored).toBe(`v`)
    const custom = new CacheExternal<string>(`postgres://localhost:5432/db`, undefined, undefined, {forceStore: new Map()})
    await custom.set(`k`, `v`)
    const storedCustom = await custom.get(`k`)
    expect(storedCustom).toBe(`v`)
  })

  it(`C2 refreshLruCache guards non-Map stores and returns a promise`, async () => {
    const backing = new Map<string, unknown>()
    const fake = {
      get: async (key: string) => backing.get(key),
      set: async (key: string, value: unknown) => {
        backing.set(key, value)
      },
      delete: async (key: string) => backing.delete(key),
      clear: async () => {
        backing.clear()
      }
    }
    const custom = new CacheExternal<string>(`memory`, undefined, undefined, {forceStore: fake})
    await custom.set(`k`, `v`)
    const guarded = await custom.get(`k`)
    expect(guarded).toBe(`v`)
    await custom.refreshLruCache()
  })

  it(`C2 refreshLruCache awaits get and respects maxLength`, async () => {
    const cache = new CacheExternal<string>(`memory`, undefined, `c2`)
    await cache.set(`a`, `va`)
    await cache.set(`b`, `vb`)
    await cache.set(`c`, `vc`)
    const seen: string[] = []
    const originalGet = cache.get.bind(cache)
    cache.get = (async (key: string) => {
      seen.push(key)
      return await originalGet(key)
    }) as typeof cache.get
    const pending = cache.refreshLruCache(2)
    expect(pending).toBeInstanceOf(Promise)
    await pending
    expect(seen).toHaveLength(2)
    cache.get = originalGet
  })

  it(`C3 disconnect() resolves and TTL is stored in milliseconds`, async () => {
    const cache = new CacheExternal(`memory`, 60000, `c3`)
    expect(cache.opts.ttl).toBe(60000)
    await cache.disconnect()
  })

  it(`C3 store failures reject instead of hanging`, async () => {
    const failing = {
      get: async () => {
        throw new Error(`redis down`)
      },
      set: async () => {
        throw new Error(`redis down`)
      },
      delete: async () => true,
      clear: async () => undefined
    }
    const cache = new CacheExternal(`memory`, undefined, undefined, {forceStore: failing})
    const guard = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`hang`)), 2000))
    await expect(Promise.race([cache.get(`k`), guard])).rejects.toThrow(`redis down`)
  })

  it(`D1 close() rejects blocked enqueuers without losing buffered data`, async () => {
    const queue = new UpdateQueue<{id: number}>(1)
    await queue.enqueue({id: 1})
    const blocked = queue.enqueue({id: 2})
    queue.close()
    await expect(blocked).rejects.toThrow(`closed`)
    expect(await queue.dequeue()).toEqual({id: 1})
    expect(await queue.dequeue()).toBeUndefined()
  })

  it(`D2 closed queues drain buffered items before resolving undefined`, async () => {
    const queue = new UpdateQueue<number>(3)
    await queue.enqueue(1)
    await queue.enqueue(2)
    queue.close()
    expect(await queue.dequeue()).toBe(1)
    expect(await queue.dequeue()).toBe(2)
    expect(await queue.dequeue()).toBeUndefined()
    expect(await queue.dequeue()).toBeUndefined()
  })

  it(`D3 abort listener is cleaned up after a blocked enqueue succeeds`, async () => {
    const queue = new UpdateQueue<number>(1)
    await queue.enqueue(1)
    const controller = new AbortController()
    const pending = queue.enqueue(2, controller.signal)
    expect(queue.getStats().waitingEnqueue).toBe(1)
    expect(await queue.dequeue()).toBe(1)
    await pending
    controller.abort()
    await Promise.resolve()
    expect(queue.length).toBe(1)
    expect(await queue.dequeue()).toBe(2)
  })

  it(`D4 tryEnqueue() never blocks`, async () => {
    const queue = new UpdateQueue<number>(1)
    expect(queue.tryEnqueue(1)).toBe(true)
    expect(queue.tryEnqueue(2)).toBe(false)
    expect(await queue.dequeue()).toBe(1)
    expect(queue.tryEnqueue(2)).toBe(true)
    queue.close()
    expect(queue.tryEnqueue(3)).toBe(false)
  })

  it(`D4 dequeue(signal?) honors abort`, async () => {
    const queue = new UpdateQueue<number>(1)
    const controller = new AbortController()
    const pending = queue.dequeue(controller.signal)
    const guard = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`dequeue hung`)), 500))
    controller.abort()
    await expect(Promise.race([pending, guard])).rejects.toThrow(`abort`)
    const already = new AbortController()
    already.abort()
    const guard2 = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`dequeue hung`)), 500))
    await expect(Promise.race([queue.dequeue(already.signal), guard2])).rejects.toThrow(`abort`)
  })

  it(`D5 rejects invalid maxSize`, async () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => new UpdateQueue(bad)).toThrow()
    }
  })

  it(`D5 double close is safe`, async () => {
    const queue = new UpdateQueue<number>(1)
    queue.close()
    queue.close()
    expect(queue.isClosed).toBe(true)
    expect(await queue.dequeue()).toBeUndefined()
    await expect(queue.enqueue(1)).rejects.toThrow(`closed`)
  })

  it(`D5 enqueue hands off directly to a waiting dequeuer`, async () => {
    const queue = new UpdateQueue<string>(1)
    const pending = queue.dequeue()
    const guard = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`dequeue hung`)), 500))
    await queue.enqueue(`hi`)
    await expect(Promise.race([pending, guard])).resolves.toBe(`hi`)
    expect(queue.length).toBe(0)
  })
})
