import {describe, it, expect} from "bun:test"
import {join} from "node:path"
import {env} from "../src/env"
import {createMockTelegramServer} from "../src/telegram-mock-server"
import {BotCore} from "../src/core/bot"
import {TemplateManager} from "gramstax"

describe(`grammy apiRoot override`, () => {
  it(`routes API calls to local mock server`, async () => {
    const {apiRoot, close} = createMockTelegramServer(env.TELEGRAM_BOT_TOKEN)
    const templateManager = new TemplateManager({path: [join(import.meta.dir, `../src/pages`)]})
    const cwd = process.cwd()
    process.chdir(join(import.meta.dir, `..`))

    const botCore = new BotCore({
      deploy: `test`,
      token: env.TELEGRAM_BOT_TOKEN,
      log: false,
      templateManager,
      botConfig: {client: {apiRoot}}
    })

    const data = await botCore.bot.api.getMe()

    expect(data).toEqual(
      expect.objectContaining({
        is_bot: true,
        username: `mock_gramstax_bot`
      })
    )

    process.chdir(cwd)
    close()
  })
})
