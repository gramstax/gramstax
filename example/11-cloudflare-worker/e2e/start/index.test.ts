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
    expect(reply.body?.rich_message.html).toContain(`Welcome`)
    expect(replyId.body?.rich_message.html).toContain(`Selamat datang`)
    expect(e2e.extractButtonLabels(reply)).toEqual(e2e.gkb(intent, `default`, `inline`, {}))
    expect(e2e.extractButtonLabels(replyId)).toEqual(e2e.gkb(intent, `default`, `inline`, {}, `id`))
  })

  it(`capture outbound requests in e2e.calls`, async () => {
    await e2e.sendText(`/start`, enUser)

    const sendRichMsgReq = e2e.lastCall(`sendRichMessage`)
    expect(sendRichMsgReq).toBeDefined()
    expect(sendRichMsgReq?.body?.rich_message.html).toContain(`Welcome`)
  })
})
