import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "../../setup"

const intent = `start/block/map`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: BlockMapPage`, () => {
  it(`show template map demo with random list`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(intent)

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toStartWith(`<b>🧭 Template map demo</b>`)
    expect(responses[0]!.body?.text).toContain(`Position:`)
    expect(responses[0]!.body?.text).toContain(`Status: 1`)

    const responsesId = await e2e.sendCallbackQuery(intent, {user: {language_code: `id`}})
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responsesId[0]!.body?.text).toStartWith(`<b>🧭 Demo map template</b>`)
  })
})
