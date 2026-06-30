import {describe, it, expect} from "bun:test"
import {bot} from "./setup"

describe(`E2E: BlankPage`, () => {
  it(`load as a registered page`, () => {
    expect(bot.pages.all[`blank`]).toBeDefined()
  })
})
