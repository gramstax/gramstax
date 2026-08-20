import {describe, expect, it} from "bun:test"
import {bot} from "../../setup"

describe(`E2E: InputPage`, () => {
  it(`load as a registered page in the bot`, () => {
    expect(bot.pages.all[`start/input`]).toBeDefined()
  })
})
