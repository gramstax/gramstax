import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "./setup"

beforeEach(() => e2e.clearCalls())
describe(`E2E: ProductPage`, () => {
  it(`requires intent args to show product`, async () => {
    const res = await e2e.sendCallbackQuery(`product`, enUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toContain(`Action not found`)
  })
  it(`show ID variant`, async () => {
    const res = await e2e.sendCallbackQuery(`product`, idUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toContain(`Tindakan tidak ditemukan`)
  })
})
