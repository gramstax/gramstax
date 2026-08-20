import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../../setup"

const intent = `start/test/error`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: TestErrorPage`, () => {
  it(`show error page when page throws an error`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(intent, enUser)
    const responsesId = await e2e.sendCallbackQuery(intent, idUser)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const reply = responses[0]!
    const replyId = responsesId[0]!
    expect(reply).toBeDefined()
    expect(replyId).toBeDefined()
    expect(reply.body?.text).toBe(e2e.gmsg(`status`, `e`))
    expect(replyId.body?.text).toBe(e2e.gmsg(`status`, `e`, {}, `id`))
  })
})
