import {describe, it, expect} from "bun:test"
import {MockTelegramServer} from "~/mock/telegram-server"

describe(`MockTelegramServer`, () => {
  it(`responds to getMe via apiRoot`, async () => {
    const server = new MockTelegramServer({token: `test-token`})
    await server.start()

    const response = await fetch(`${server.apiRoot}/bot${server.token}/getMe`, {method: `POST`})
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

    await server.stop()
  })
})
