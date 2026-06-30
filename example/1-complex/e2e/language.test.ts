import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `language`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: LanguagePage`, () => {
  it(`show language selection menu with language options`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(intent)
    const responsesId = await e2e.sendCallbackQuery(intent, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {}))
    expect(responsesId[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {}, `id`))
  })
})
