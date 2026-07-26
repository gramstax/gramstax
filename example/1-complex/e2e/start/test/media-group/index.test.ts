import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "../../../setup"

const intent = `start-test-media-group`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: TestMediaGroupPage`, () => {
  it(`return a media group response`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(intent)

    const sendMediaGroupReq = e2e.lastCall(`sendMediaGroup`)
    expect(sendMediaGroupReq).toBeDefined()
    expect(sendMediaGroupReq!.body?.media).toBeDefined()
    expect(Array.isArray(sendMediaGroupReq!.body?.media)).toBe(true)
    expect(sendMediaGroupReq!.body?.media!.length).toBeGreaterThan(0)
    sendMediaGroupReq!.body?.media!.forEach((item: any) => {
      expect(item.type).toBe(`photo`)
    })

    e2e.clearCalls()
    await e2e.sendCallbackQuery(intent, {user: {language_code: `id`}})
    const sendMediaGroupIdReq = e2e.lastCall(`sendMediaGroup`)
    expect(sendMediaGroupIdReq).toBeDefined()
    expect(sendMediaGroupIdReq!.body?.media![0]?.caption).toBe(e2e.gmedia(intent, `default`, {}, `id`).mediaGroup![0]?.caption)
  })
})
