import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "./setup"

beforeEach(() => e2e.clearCalls())
describe(`E2E: CartPage`, () => {
  it(`show cart contents`, async () => {
    const res = await e2e.sendCallbackQuery(`cart`, enUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
  })
  it(`show ID variant`, async () => {
    const res = await e2e.sendCallbackQuery(`cart`, idUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
  })
})
