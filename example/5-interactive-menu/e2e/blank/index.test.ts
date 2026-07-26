import {describe, it, expect} from "bun:test"
import {bot} from "../setup"

describe(`E2E: BlankPage`, () => {
  it(`load as registered page in the bot`, () => {
    const allPages = bot.pages.all
    expect(allPages[`blank`]).toBeDefined()
  })
})
