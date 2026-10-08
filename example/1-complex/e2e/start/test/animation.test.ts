import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../../setup"

const intent = `start/test/animation`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: TestAnimationPage`, () => {
  it(`return an animation media response`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(intent, enUser)
    const responsesId = await e2e.sendCallbackQuery(intent, idUser)

    expect(responses[0]).toBeDefined()
    expect(responsesId[0]).toBeDefined()
    expect(e2e.bodyOf<{media?: {type?: string; media?: unknown; caption?: string}}>(responses[0]!)?.media?.type).toBe(`animation`)
    expect(e2e.bodyOf<{media?: {type?: string; media?: unknown; caption?: string}}>(responsesId[0]!)?.media?.type).toBe(`animation`)
    expect(e2e.bodyOf<{media?: {type?: string; media?: unknown; caption?: string}}>(responses[0]!)?.media?.media).toBe(e2e.gmedia(intent, `i`, {}).src)
    expect(e2e.bodyOf<{media?: {type?: string; media?: unknown; caption?: string}}>(responsesId[0]!)?.media?.media).toBe(e2e.gmedia(intent, `i`, {}, `id`).src)
    expect(e2e.bodyOf<{media?: {type?: string; media?: unknown; caption?: string}}>(responses[0]!)?.media?.caption).toBe(e2e.gmedia(intent, `i`, {}).caption)
    expect(e2e.bodyOf<{media?: {type?: string; media?: unknown; caption?: string}}>(responsesId[0]!)?.media?.caption).toBe(e2e.gmedia(intent, `i`, {}, `id`).caption)
  })
})
