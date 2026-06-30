import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `test-error`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: TestErrorPage`, () => {
  it(`show error page when page throws an error`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(intent)
    const responsesId = await e2e.sendCallbackQuery(intent, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const reply = responses[0]!
    const replyId = responsesId[0]!
    expect(reply).toBeDefined()
    expect(replyId).toBeDefined()
    expect(reply.body?.text).toBe(e2e.gmsg(`general-status`, `d`, {isNotFound: false}))
    expect(replyId.body?.text).toBe(e2e.gmsg(`general-status`, `d`, {isNotFound: false}, `id`))
  })
})
