import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `start`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: StartPage`, () => {
  it(`respond to /start`, async () => {
    const res = await e2e.sendText(`/${intent}`)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {}))
  })
})
