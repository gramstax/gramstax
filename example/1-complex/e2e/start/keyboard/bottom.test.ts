import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../../setup"

const intent = `start/keyboard/bottom`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: KeyboardBottomPage`, () => {
  it(`show bottom keyboard via /keyboard_bottom command`, async () => {
    const responses = await e2e.sendText(`/keyboard_bottom`, enUser)
    const responsesId = await e2e.sendText(`/keyboard_bottom`, idUser)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(e2e.gmsg(intent, `i`, {}))
    expect(responsesId[0]!.body?.text).toBe(e2e.gmsg(intent, `i`, {}, `id`))
    expect(e2e.bodyOf<{reply_markup?: {keyboard?: Array<Array<{text?: unknown}>>}}>(responses[0]!)?.reply_markup?.keyboard).toBeDefined()
    expect(e2e.bodyOf<{reply_markup?: {keyboard?: Array<Array<{text?: unknown}>>}}>(responsesId[0]!)?.reply_markup?.keyboard).toBeDefined()
  })
})
