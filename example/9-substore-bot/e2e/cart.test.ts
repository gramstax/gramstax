import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"
beforeEach(() => e2e.clearCalls())
describe(`E2E: CartPage`, () => {
  it(`show cart contents`, async () => {
    const res = await e2e.sendCallbackQuery(`cart`)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
  })
})
