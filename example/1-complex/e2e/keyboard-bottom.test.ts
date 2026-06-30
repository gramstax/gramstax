import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `keyboard-bottom`
const asUser = {user: {id: 2001}, chat: {id: 2001}}
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: KeyboardBottomPage`, () => {
  it(`show bottom keyboard via /keyboard_bottom command`, async () => {
    const responses = await e2e.sendText(`/keyboard_bottom`, asUser)
    const responsesId = await e2e.sendText(`/keyboard_bottom`, {user: {id: 6001, language_code: `id`}, chat: {id: 6001}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {}))
    expect(responsesId[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {}, `id`))
    expect(responses[0]!.body?.reply_markup?.keyboard).toBeDefined()
    expect(responsesId[0]!.body?.reply_markup?.keyboard).toBeDefined()
  })
})
