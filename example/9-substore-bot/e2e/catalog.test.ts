import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "./setup"

beforeEach(() => e2e.clearCalls())
describe(`E2E: CatalogPage`, () => {
  it(`show product catalog`, async () => {
    const res = await e2e.sendCallbackQuery(`catalog`, enUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toContain(`Subscription Catalog`)
  })
  it(`show ID variant`, async () => {
    const res = await e2e.sendCallbackQuery(`catalog`, idUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toContain(`Katalog Langganan`)
  })
})
