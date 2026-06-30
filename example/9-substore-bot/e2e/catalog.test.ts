import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"
beforeEach(() => e2e.clearCalls())
describe(`E2E: CatalogPage`, () => {
  it(`show product catalog`, async () => {
    const res = await e2e.sendCallbackQuery(`catalog`)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toContain(`Subscription Catalog`)
  })
  it(`show ID variant`, async () => {
    const res = await e2e.sendCallbackQuery(`catalog`, {user: {language_code: `id`}})
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toContain(`Katalog Langganan`)
  })
})
