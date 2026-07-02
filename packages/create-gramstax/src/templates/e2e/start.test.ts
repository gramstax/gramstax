import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `start`
const asUser = {user: {id: 2001, username: `testuser`}, chat: {id: 2001}}

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StartPage`, () => {
  it(`respond to /start command with welcome message and full keyboard`, async () => {
    const responses = await e2e.sendText(`/start`, asUser)
    const responsesId = await e2e.sendText(`/start`, {user: {id: 5001, username: `pengguna`, language_code: `id`}, chat: {id: 5001}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const reply = responses[0]!
    const replyId = responsesId[0]!
    expect(reply.body?.rich_message.html).toContain(`Welcome`)
    expect(replyId.body?.rich_message.html).toContain(`Selamat datang`)
    expect(e2e.extractButtonLabels(reply)).toEqual(e2e.gkb(intent, `s1`, `inline`, {}))
    expect(e2e.extractButtonLabels(replyId)).toEqual(e2e.gkb(intent, `s1`, `inline`, {}, `id`))
  })

  it(`capture outbound requests in e2e.calls`, async () => {
    await e2e.sendText(`/start`, asUser)

    const sendRichMsgReq = e2e.lastCall(`sendRichMessage`)
    expect(sendRichMsgReq).toBeDefined()
    expect(sendRichMsgReq?.body?.rich_message.html).toContain(`Welcome`)
  })
})
