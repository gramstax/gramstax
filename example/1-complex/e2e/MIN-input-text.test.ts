import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `input-text`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: MIN InputTextPage`, () => {
  it(`minimal: show form and echo back user text`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    const pageResponses = await e2e.sendCallbackQuery(intent)
    expect(pageResponses.length).toBeGreaterThan(0)
    expect(pageResponses[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {}))

    e2e.clearCalls()

    const resultResponses = await e2e.sendText(`MIN test`)
    expect(resultResponses.length).toBeGreaterThan(0)
    expect(resultResponses[0]!.body?.text).toBe(e2e.gmsg(intent, `s`, {res: `MIN test`}))
  })
})
