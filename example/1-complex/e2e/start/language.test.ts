import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../setup"

const intent = `start/language`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: LanguagePage`, () => {
  it(`show language selection menu with language options`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(intent, enUser)
    const responsesId = await e2e.sendCallbackQuery(intent, idUser)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {}))
    expect(responsesId[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {}, `id`))
  })
})
