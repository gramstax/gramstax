import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../../setup"

const intent = `start/test/video-note`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: TestVideoNotePage`, () => {
  it(`return a video note response`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(intent, enUser)

    const sendVideoNoteReq = e2e.lastCall(`sendVideoNote`)
    expect(sendVideoNoteReq).toBeDefined()
    expect(sendVideoNoteReq!.body?.video_note).toBe(e2e.gmedia(intent, `default`, {}).src)

    e2e.clearCalls()
    await e2e.sendCallbackQuery(intent, idUser)
    const sendVideoNoteIdReq = e2e.lastCall(`sendVideoNote`)
    expect(sendVideoNoteIdReq).toBeDefined()
    expect(sendVideoNoteIdReq!.body?.video_note).toBe(e2e.gmedia(intent, `default`, {}, `id`).src)
  })
})
