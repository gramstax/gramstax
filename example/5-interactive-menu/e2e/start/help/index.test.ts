import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "../../setup"

const intent = `start/help`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: HelpPage`, () => {
  it(`show help text`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(intent)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {}))
  })
})
