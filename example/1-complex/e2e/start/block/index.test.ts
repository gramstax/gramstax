import {describe, expect, it} from "bun:test"
import {bot, e2e, enUser} from "../../setup"

describe(`E2E: StartBlockPage`, () => {
  it(`load as a registered page in the bot`, () => {
    expect(bot.pages.all[`start/block`]).toBeDefined()
  })

  it(`handle callback query without crashing`, async () => {
    await e2e.sendText(`/start`, enUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(`start-block`, enUser)
    expect(responses.length).toBeGreaterThanOrEqual(0)
  })
})
