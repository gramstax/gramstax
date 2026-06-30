import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `general-status`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: GeneralStatusPage`, () => {
  it(`show 'Route not found' for unrecognized callback query`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(`nonexistent-callback-data`)
    const responsesId = await e2e.sendCallbackQuery(`nonexistent-callback-data`, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const reply = responses[0]!
    const replyId = responsesId[0]!
    expect(reply).toBeDefined()
    expect(replyId).toBeDefined()
    expect(reply.body?.text).toBe(e2e.gmsg(intent, `d`, {isNotFound: true}))
    expect(replyId.body?.text).toBe(e2e.gmsg(intent, `d`, {isNotFound: true}, `id`))
  })
})
