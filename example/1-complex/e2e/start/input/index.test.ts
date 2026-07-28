import {describe, it, expect} from "bun:test"
import {bot} from "../../setup"

describe(`E2E: InputPage`, () => {
  it(`load as a registered page in the bot`, () => {
    const allPages = bot.pages.all
    expect(allPages[`start/input`]).toBeDefined()
  })
})
