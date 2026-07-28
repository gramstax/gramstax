import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "../../setup"

const intent = `start/test/animation`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: TestAnimationPage`, () => {
  it(`return an animation media response`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(intent)

    const editMediaReq = e2e.lastCall(`editMessageMedia`)
    expect(editMediaReq).toBeDefined()
    expect(editMediaReq!.body?.media?.type).toBe(`animation`)
    expect(editMediaReq!.body?.media?.media).toBe(e2e.gmedia(intent, `i`, {}).src)
    expect(editMediaReq!.body?.media?.caption).toBe(e2e.gmedia(intent, `i`, {}).caption)

    e2e.clearCalls()
    await e2e.sendCallbackQuery(intent, {user: {language_code: `id`}})
    const editMediaIdReq = e2e.lastCall(`editMessageMedia`)
    expect(editMediaIdReq).toBeDefined()
    expect(editMediaIdReq!.body?.media?.caption).toBe(e2e.gmedia(intent, `i`, {}, `id`).caption)
  })
})
