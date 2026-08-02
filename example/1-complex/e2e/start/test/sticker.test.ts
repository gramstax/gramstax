import {beforeEach, describe, expect, it } from "bun:test"
import {e2e} from "../../setup"

const intent = `start/test/sticker`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: TestStickerPage`, () => {
  it(`return a sticker response with expected source`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(intent)

    const sendStickerReq = e2e.lastCall(`sendSticker`)
    expect(sendStickerReq).toBeDefined()
    expect(sendStickerReq!.body?.sticker).toBe(e2e.gmedia(intent, `default`, {}).src)

    e2e.clearCalls()
    await e2e.sendCallbackQuery(intent, {user: {language_code: `id`}})
    const idReq = e2e.lastCall(`sendSticker`)
    expect(idReq).toBeDefined()
    expect(idReq!.body?.sticker).toBe(e2e.gmedia(intent, `default`, {}, `id`).src)
  })
})
