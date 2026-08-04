import {beforeEach, describe, expect, it } from "bun:test"
import {e2e} from "../../setup"

const intent = `start/test/video-note`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: TestVideoNotePage`, () => {
  it(`return a video note response`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(intent)

    const sendVideoNoteReq = e2e.lastCall(`sendVideoNote`)
    expect(sendVideoNoteReq).toBeDefined()
    expect(sendVideoNoteReq!.body?.video_note).toBe(e2e.gmedia(intent, `default`, {}).src)

    e2e.clearCalls()
    await e2e.sendCallbackQuery(intent, {user: {language_code: `id`}})
    const sendVideoNoteIdReq = e2e.lastCall(`sendVideoNote`)
    expect(sendVideoNoteIdReq).toBeDefined()
    expect(sendVideoNoteIdReq!.body?.video_note).toBe(e2e.gmedia(intent, `default`, {}, `id`).src)
  })
})
