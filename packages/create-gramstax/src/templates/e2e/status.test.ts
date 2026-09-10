import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "./setup"

const intent = `status`

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StatusPage`, () => {
  it(`show 'Route not found' for unrecognized callback query`, async () => {
    await e2e.sendText(`/start`, enUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(`nonexistent-callback-data`, enUser)
    const responsesId = await e2e.sendCallbackQuery(`nonexistent-callback-data`, idUser)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const reply = responses[0]!
    const replyId = responsesId[0]!
    expect(reply).toBeDefined()
    expect(replyId).toBeDefined()
    expect(reply.body?.text).toBe(e2e.gmsg(intent, `nf`))
    expect(replyId.body?.text).toBe(e2e.gmsg(intent, `nf`, {}, `id`))
  })
})
