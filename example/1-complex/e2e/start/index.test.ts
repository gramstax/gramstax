import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../setup"

const intent = `start`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: StartPage`, () => {
  it(`respond to /start command with welcome message and full keyboard`, async () => {
    const responses = await e2e.sendText(`/start`, enUser)
    const responsesId = await e2e.sendText(`/start`, idUser)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const reply = responses[0]!
    const replyId = responsesId[0]!
    expect(e2e.extractText(reply)).toContain(`gramstax`)
    expect(e2e.extractText(replyId)).toContain(`gramstax`)
    expect(e2e.extractButtonLabels(reply)).toEqual(e2e.gkb(intent, `i`, `inline`, {}))
    expect(e2e.extractButtonLabels(replyId)).toEqual(e2e.gkb(intent, `i`, `inline`, {}, `id`))
  })

  it(`capture outbound requests in e2e.calls`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)

    const sendReq = e2e.lastCall()
    expect(sendReq).toBeDefined()
    expect(e2e.extractText(sendReq!)).toContain(`gramstax`)
  })
})
