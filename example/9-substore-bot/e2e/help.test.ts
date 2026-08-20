import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "./setup"

beforeEach(() => e2e.clearCalls())
describe(`E2E: HelpPage`, () => {
  it(`show help text`, async () => {
    const res = await e2e.sendCallbackQuery(`help`, enUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toContain(`Store Help`)
  })
  it(`show ID variant`, async () => {
    const res = await e2e.sendCallbackQuery(`help`, idUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toContain(`Bantuan Toko`)
  })
})
