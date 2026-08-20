import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../setup"

const intent = `start/balance`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: StartBalancePage`, () => {
  it(`show balance`, async () => {
    const res = await e2e.sendCallbackQuery(intent, enUser)
    const resId = await e2e.sendCallbackQuery(intent, idUser)
    expect(res.length).toBeGreaterThan(0)
    expect(resId.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
    expect(resId[0]!.body?.text).toBeDefined()
  })
})
