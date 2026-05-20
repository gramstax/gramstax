import {Env} from "../src/env"
import {join} from "node:path"
import {BotCore} from "../src/core/bot"
import {TemplateManager} from "gramstax"
import {MockTelegramServer} from "gramstax"
import {describe, it, expect} from "bun:test"

describe(`grammy apiRoot override`, () => {
  it(`routes API calls to local mock server`, async () => {
    const mockServer = new MockTelegramServer()
    await mockServer.start()
    const templateManager = new TemplateManager({path: [join(import.meta.dir, `../src/pages`)]})
    const cwd = process.cwd()
    process.chdir(join(import.meta.dir, `..`))

    const botCore = new BotCore({
      deploy: `test`,
      token: Env.TELEGRAM_BOT_TOKEN,
      log: false,
      templateManager,
      botConfig: {client: {apiRoot: mockServer.apiRoot}}
    })

    const data = await botCore.bot.api.getMe()

    expect(data).toEqual(
      expect.objectContaining({
        is_bot: true,
        username: `mock_gramstax_bot`
      })
    )

    process.chdir(cwd)
    await mockServer.stop()
  })
})
