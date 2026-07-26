import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "../../setup"

const intent = `start/counter`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: CounterPage`, () => {
  it(`increase counter then decrease back to initial value`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    // Navigate to counter and record starting count
    const initialResponses = await e2e.sendCallbackQuery(intent)
    const initialResponsesId = await e2e.sendCallbackQuery(intent, {user: {language_code: `id`}})
    expect(initialResponses.length).toBeGreaterThan(0)
    expect(initialResponsesId.length).toBeGreaterThan(0)
    expect(initialResponsesId[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {count: `0`}, `id`))
    expect(e2e.extractButtonLabels(initialResponsesId[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {count: `0`}, `id`))

    const initialText = initialResponses[0]!.body?.text as string
    expect(initialText).toContain(`Current count:`)
    const initialMatch = initialText.match(/Current count: (\d+)/)
    expect(initialMatch).not.toBeNull()
    const initialCount = parseInt(initialMatch![1]!, 10)
    expect(e2e.extractButtonLabels(initialResponses[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {}))

    e2e.clearCalls()

    // Increase by 1
    const incResponses = await e2e.sendCallbackQuery(`${intent}:I`)
    expect(incResponses.length).toBeGreaterThan(0)
    expect(incResponses[0]!.body?.text).toContain(`Current count: ${initialCount + 1}`)
    expect(e2e.extractButtonLabels(incResponses[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {}))

    e2e.clearCalls()

    // Decrease back to initial
    const decResponses = await e2e.sendCallbackQuery(`${intent}:D`)
    expect(decResponses.length).toBeGreaterThan(0)
    expect(decResponses[0]!.body?.text).toContain(`Current count: ${initialCount}`)
    expect(e2e.extractButtonLabels(decResponses[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {}))
  })
})
