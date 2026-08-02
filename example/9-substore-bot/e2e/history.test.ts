import {beforeEach, describe, expect, it } from "bun:test"
import {e2e} from "./setup"

beforeEach(() => e2e.clearCalls())
describe(`E2E: HistoryPage`, () => {
  it(`show order history`, async () => {
    const res = await e2e.sendCallbackQuery(`history`)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toContain(`Order History`)
  })
  it(`show ID variant`, async () => {
    const res = await e2e.sendCallbackQuery(`history`, {user: {language_code: `id`}})
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toContain(`Riwayat Pesanan`)
  })
})
