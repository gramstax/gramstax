import {beforeEach, describe, expect, it} from "bun:test"
import {bot, e2e} from "../../setup"

const intent = `start/inline/with-range`

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StartInlineWithRangePage`, () => {
  it(`load as a registered page`, () => {
    expect(bot.pages.all[intent]).toBeDefined()
  })
})
