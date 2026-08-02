import {beforeEach, describe, expect, it } from "bun:test"
import {e2e} from "./setup"

beforeEach(() => e2e.clearCalls())
describe(`E2E: ProductPage`, () => {
  it(`requires intent args to show product`, async () => {
    const res = await e2e.sendCallbackQuery(`product`)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toContain(`Action not found`)
  })
})
