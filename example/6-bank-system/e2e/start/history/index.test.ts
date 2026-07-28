import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "../../setup"

const intent = `start/history`
const asUser = {user: {id: 651}, chat: {id: 651}}
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: StartHistoryPage`, () => {
  it(`show history`, async () => {
    await e2e.sendText(`/start`, asUser)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(intent, asUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
  })
})
