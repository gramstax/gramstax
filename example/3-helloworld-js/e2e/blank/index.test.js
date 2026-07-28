import {describe, it, expect} from "bun:test"
import {bot} from "../setup.js"

describe(`E2E: BlankPage`, () => {
  it(`load as a registered page in the bot`, () => {
    const allPages = bot.pages.all
    expect(allPages[`blank`]).toBeDefined()
  })
})
