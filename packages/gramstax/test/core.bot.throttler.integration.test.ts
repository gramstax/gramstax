import {describe, expect, it} from "bun:test"
import {Gramstax} from "~/core/bot"
import {MockTelegramServer} from "~/mock/telegram-server"

const createRawBot = (server: MockTelegramServer, overrides: Record<string, unknown> = {}) => {
  return new Gramstax({
    token: `test`,
    deploy: `raw`,
    log: false,
    botConfig: {
      botInfo: {
        id: 123456789,
        is_bot: true,
        first_name: `Bot`,
        username: `test_bot`
      },
      client: {apiRoot: server.apiRoot}
    } as any,
    ...overrides
  } as never)
}

describe(`outgoing throttle — full pipeline integration`, () => {
  it(`spaces out outgoing API calls when throttle is configured`, async () => {
    const server = new MockTelegramServer({port: 0})
    await server.start()
    const bot = createRawBot(server, {throttle: {global: {limit: 1, interval: 300}}})

    const started = Date.now()
    for (let i = 0; i < 3; i++) {
      await bot.bot.api.sendMessage(123456789, `msg-${i}`)
    }
    const elapsed = Date.now() - started

    expect(server.requests.filter((r) => r.method === `sendMessage`).length).toBe(3)
    expect(elapsed).toBeGreaterThanOrEqual(500)

    await server.stop()
  })

  it(`does not delay outgoing API calls without throttle params`, async () => {
    const server = new MockTelegramServer({port: 0})
    await server.start()
    const bot = createRawBot(server)

    const started = Date.now()
    for (let i = 0; i < 3; i++) {
      await bot.bot.api.sendMessage(123456789, `msg-${i}`)
    }
    const elapsed = Date.now() - started

    expect(server.requests.filter((r) => r.method === `sendMessage`).length).toBe(3)
    expect(elapsed).toBeLessThan(300)

    await server.stop()
  })
})
