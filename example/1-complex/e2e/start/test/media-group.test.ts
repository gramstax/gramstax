import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../../setup"

const intent = `start/test/media-group`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: TestMediaGroupPage`, () => {
  it(`return a media group response`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(intent, enUser)

    const sendMediaGroupReq = e2e.lastCall(`sendMediaGroup`)
    expect(sendMediaGroupReq).toBeDefined()
    expect(sendMediaGroupReq!.body?.media).toBeDefined()
    expect(Array.isArray(sendMediaGroupReq!.body?.media)).toBe(true)
    expect(e2e.bodyOf<{media: Array<{type?: string; caption?: string}>}>(sendMediaGroupReq!)?.media.length).toBeGreaterThan(0)
    e2e.bodyOf<{media: Array<{type?: string; caption?: string}>}>(sendMediaGroupReq!)?.media.forEach((item: {type?: string; caption?: string}) => {
      expect(item.type).toBe(`photo`)
    })

    e2e.clearCalls()
    await e2e.sendCallbackQuery(intent, idUser)
    const sendMediaGroupIdReq = e2e.lastCall(`sendMediaGroup`)
    expect(sendMediaGroupIdReq).toBeDefined()
    expect(e2e.bodyOf<{media: Array<{type?: string; caption?: string}>}>(sendMediaGroupIdReq!)?.media[0]?.caption).toBe(e2e.gmedia(intent, `default`, {}, `id`).mediaGroup![0]?.caption)
  })
})
