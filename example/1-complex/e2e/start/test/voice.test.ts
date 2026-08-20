import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../../setup"

const intent = `start/test/voice`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: TestVoicePage`, () => {
  it(`return a voice media response`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(intent, enUser)

    const sendVoiceReq = e2e.lastCall(`sendVoice`)
    expect(sendVoiceReq).toBeDefined()
    expect(sendVoiceReq!.body?.voice).toBe(e2e.gmedia(intent, `default`, {}).src)

    e2e.clearCalls()
    await e2e.sendCallbackQuery(intent, idUser)
    const sendVoiceIdReq = e2e.lastCall(`sendVoice`)
    expect(sendVoiceIdReq).toBeDefined()
    expect(sendVoiceIdReq!.body?.voice).toBe(e2e.gmedia(intent, `default`, {}, `id`).src)
  })
})
