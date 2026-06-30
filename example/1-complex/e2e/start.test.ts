import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

/** Extract text from a captured API call (handles both sendMessage and sendRichMessage). */

const intent = `start`
const asUser = {user: {id: 2003}, chat: {id: 2003}}
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: StartPage`, () => {
  it(`respond to /start command with welcome message and full keyboard`, async () => {
    const responses = await e2e.sendText(`/start`, asUser)
    const responsesId = await e2e.sendText(`/start`, {user: {id: 5001, language_code: `id`}, chat: {id: 5001}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const reply = responses[0]!
    const replyId = responsesId[0]!
    expect(e2e.extractText(reply)).toContain(`Gramstax`)
    expect(e2e.extractText(replyId)).toContain(`gramstax`)
    expect(e2e.extractButtonLabels(reply)).toEqual(e2e.gkb(intent, `s1`, `inline`, {}))
    expect(e2e.extractButtonLabels(replyId)).toEqual(e2e.gkb(intent, `s1`, `inline`, {}, `id`))
  })

  it(`capture outbound requests in e2e.calls`, async () => {
    await e2e.sendText(`/start`, asUser)

    const sendReq = e2e.lastCall()
    expect(sendReq).toBeDefined()
    expect(e2e.extractText(sendReq)).toContain(`Gramstax`)
  })
})
