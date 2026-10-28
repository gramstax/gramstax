import {beforeEach, describe, expect, it} from "bun:test"
import {bot, e2e, enUser} from "./setup"

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: BlankPage`, () => {
  it(`load as a registered page in the bot`, () => {
    const allPages = bot.pages.all
    expect(allPages.blank).toBeDefined()
  })

  it(`answers a blank callback`, async () => {
    const responses = await e2e.sendCallbackQuery(`blank`, enUser)
    expect(responses.map((call) => call.method)).toContain(`answerCallbackQuery`)
  })
})
