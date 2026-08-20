import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../../setup"

const intent = `start/test/document`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: TestDocumentPage`, () => {
  it(`return a document media response`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(intent, enUser)

    const editMediaReq = e2e.lastCall(`editMessageMedia`)
    expect(editMediaReq).toBeDefined()
    expect(editMediaReq!.body?.media?.type).toBe(`document`)
    expect(editMediaReq!.body?.media?.media).toBe(e2e.gmedia(intent, `default`, {}).src)
    expect(editMediaReq!.body?.media?.caption).toBe(e2e.gmedia(intent, `default`, {}).caption)

    e2e.clearCalls()
    await e2e.sendCallbackQuery(intent, idUser)
    const editMediaIdReq = e2e.lastCall(`editMessageMedia`)
    expect(editMediaIdReq).toBeDefined()
    expect(editMediaIdReq!.body?.media?.caption).toBe(e2e.gmedia(intent, `default`, {}, `id`).caption)
  })
})
