import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `block-import`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: BlockImportPage`, () => {
  it(`show block import demo with random value`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    Math.random = () => 1 // overrides math.random()
    const responses = await e2e.sendCallbackQuery(intent)
    const responsesId = await e2e.sendCallbackQuery(intent, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {number: Math.random()}))
    expect(responsesId[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {number: Math.random()}, `id`))
  })
})
