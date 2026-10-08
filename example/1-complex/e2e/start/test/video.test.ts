import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../../setup"

const intent = `start/test/video`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: TestVideoPage`, () => {
  it(`return a video media response`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(intent, enUser)

    const editMediaReq = e2e.lastCall(`editMessageMedia`)
    expect(editMediaReq).toBeDefined()
    expect(e2e.bodyOf<{media?: {type?: string; media?: unknown; caption?: string}}>(editMediaReq!)?.media?.type).toBe(`video`)
    expect(e2e.bodyOf<{media?: {type?: string; media?: unknown; caption?: string}}>(editMediaReq!)?.media?.media).toBe(e2e.gmedia(intent, `default`, {}).src)
    expect(e2e.bodyOf<{media?: {type?: string; media?: unknown; caption?: string}}>(editMediaReq!)?.media?.caption).toBe(e2e.gmedia(intent, `default`, {}).caption)

    e2e.clearCalls()
    await e2e.sendCallbackQuery(intent, idUser)
    const editMediaIdReq = e2e.lastCall(`editMessageMedia`)
    expect(editMediaIdReq).toBeDefined()
    expect(e2e.bodyOf<{media?: {type?: string; media?: unknown; caption?: string}}>(editMediaIdReq!)?.media?.caption).toBe(e2e.gmedia(intent, `default`, {}, `id`).caption)
  })
})
