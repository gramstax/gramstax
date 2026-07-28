import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "../../setup"

const intent = `start/balance`
const asUser = {user: {id: 611}, chat: {id: 611}}
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: StartBalancePage`, () => {
  it(`show balance`, async () => {
    const res = await e2e.sendCallbackQuery(intent, asUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
  })
})
