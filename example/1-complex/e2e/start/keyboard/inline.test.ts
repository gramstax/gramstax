import {describe, expect, it} from "bun:test"
import {bot} from "../../setup"

describe(`E2E: KeyboardInlinePage`, () => {
  it(`load as a registered page in the bot`, () => {
    expect(bot.pages.all[`start/keyboard/inline`]).toBeDefined()
  })
})
