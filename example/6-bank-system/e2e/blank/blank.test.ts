import {describe, it, expect} from "bun:test"
import {bot} from "../setup"

describe(`E2E: BlankPage (sub)`, () => {
  it(`load as registered page`, () => {
    expect(bot.pages.all[`blank/blank`]).toBeDefined()
  })
})
