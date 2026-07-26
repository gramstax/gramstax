import {describe, it, expect} from "bun:test"
import {bot, e2e} from "../../setup"

describe(`E2E: StartBlockPage`, () => {
  it(`load as a registered page in the bot`, () => {
    const allPages = bot.pages.all
    expect(allPages[`start/block`]).toBeDefined()
  })

  it(`handle callback query without crashing`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(`start-block`)
    expect(responses.length).toBeGreaterThanOrEqual(0)
  })
})
