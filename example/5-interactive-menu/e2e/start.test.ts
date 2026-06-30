import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `start`
const asUser = {user: {id: 501}, chat: {id: 501}}
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: StartPage`, () => {
  it(`respond to /start with menu`, async () => {
    await e2e.sendText(`/start`, asUser)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(intent, asUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {}))
  })
})
