import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `general-status`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E:`, () => {
  it(`load page`, async () => {
    const res = await e2e.sendCallbackQuery(intent)
    expect(res.length).toBeGreaterThan(0)
  })
})
