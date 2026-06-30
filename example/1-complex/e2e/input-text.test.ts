import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `input-text`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: InputTextPage`, () => {
  it(`show input form and echo back user text`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    // Navigate to input-text
    const pageResponses = await e2e.sendCallbackQuery(intent)
    const pageResponsesId = await e2e.sendCallbackQuery(intent, {user: {language_code: `id`}})
    expect(pageResponses.length).toBeGreaterThan(0)
    expect(pageResponsesId.length).toBeGreaterThan(0)
    expect(pageResponses[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {}))
    expect(pageResponsesId[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {}, `id`))
    expect(e2e.buttonLabels(pageResponses[0])).toEqual(e2e.gkb(intent, `s1`, `inline`, {}))
    expect(e2e.buttonLabels(pageResponsesId[0])).toEqual(e2e.gkb(intent, `s1`, `inline`, {}, `id`))

    e2e.clearCalls()

    // Send text
    const resultResponses = await e2e.sendText(`Hello World`)
    expect(resultResponses.length).toBeGreaterThan(0)
    expect(resultResponses[0]!.body?.text).toBe(e2e.gmsg(intent, `s`, {res: `Hello World`}))
    expect(e2e.buttonLabels(resultResponses[0])).toEqual(e2e.gkb(intent, `s`, `inline`, {}))
  })
})
