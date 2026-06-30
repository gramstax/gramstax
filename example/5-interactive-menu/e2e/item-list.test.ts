import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `item-list`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: ItemListPage`, () => {
  it(`show item list`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(intent)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
  })
})
