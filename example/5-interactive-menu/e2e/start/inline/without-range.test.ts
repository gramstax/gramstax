import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "../../setup"

const intent = `start/inline/without-range`

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StartInlineWithoutRangePage`, () => {
  it(`load as a registered page`, () => {
    expect(e2e.bot.pages.all[intent]).toBeDefined()
  })
})
