import {describe, it, expect} from "bun:test"
import {bot} from "../../setup"

describe(`E2E: KeyboardInlinePage`, () => {
  it(`load as a registered page in the bot`, () => {
    const allPages = bot.pages.all
    expect(allPages[`start/keyboard/inline`]).toBeDefined()
  })
})
