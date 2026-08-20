import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../../setup"

const intent = `start/test/sticker`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: TestStickerPage`, () => {
  it(`return a sticker response with expected source`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(intent, enUser)

    const sendStickerReq = e2e.lastCall(`sendSticker`)
    expect(sendStickerReq).toBeDefined()
    expect(sendStickerReq!.body?.sticker).toBe(e2e.gmedia(intent, `default`, {}).src)

    e2e.clearCalls()
    await e2e.sendCallbackQuery(intent, idUser)
    const idReq = e2e.lastCall(`sendSticker`)
    expect(idReq).toBeDefined()
    expect(idReq!.body?.sticker).toBe(e2e.gmedia(intent, `default`, {}, `id`).src)
  })
})
