import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../../setup"

const intent = `start/counter`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: CounterPage`, () => {
  it(`increase counter then decrease back to initial value`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    // Navigate to counter and record starting count
    const initialResponses = await e2e.sendCallbackQuery(intent, enUser)
    const initialResponsesId = await e2e.sendCallbackQuery(intent, idUser)
    expect(initialResponses.length).toBeGreaterThan(0)
    expect(initialResponsesId.length).toBeGreaterThan(0)
    expect(initialResponses[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {count: `0`}))
    expect(initialResponsesId[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {count: `0`}, `id`))
    expect(e2e.extractButtonLabels(initialResponses[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {count: `0`}))
    expect(e2e.extractButtonLabels(initialResponsesId[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {count: `0`}, `id`))

    const initialText = initialResponses[0]!.body?.text as string
    const initialTextId = initialResponsesId[0]!.body?.text as string
    expect(initialText).toContain(`Current count:`)
    expect(initialTextId).toContain(`Jumlah saat ini:`)

    const initialMatch = initialText.match(/Current count: (\d+)/)
    const initialMatchId = initialTextId.match(/Jumlah saat ini: (\d+)/)
    expect(initialMatch).not.toBeNull()
    expect(initialMatchId).not.toBeNull()

    const initialCount = parseInt(initialMatch![1]!, 10)
    const initialCountId = parseInt(initialMatchId![1]!, 10)
    expect(e2e.extractButtonLabels(initialResponses[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {}))
    expect(e2e.extractButtonLabels(initialResponsesId[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {}, `id`))
    e2e.clearCalls()

    // Increase by 1
    const incResponses = await e2e.sendCallbackQuery(`${intent}:I`, enUser)
    const incResponsesId = await e2e.sendCallbackQuery(`${intent}:I`, idUser)
    expect(incResponses.length).toBeGreaterThan(0)
    expect(incResponses[0]!.body?.text).toContain(`Current count: ${initialCount + 1}`)
    expect(incResponsesId[0]!.body?.text).toContain(`Jumlah saat ini: ${initialCountId + 1}`)
    expect(e2e.extractButtonLabels(incResponses[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {}))
    expect(e2e.extractButtonLabels(incResponsesId[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {}, `id`))
    e2e.clearCalls()

    // Decrease back to initial
    const decResponses = await e2e.sendCallbackQuery(`${intent}:D`, enUser)
    const decResponsesId = await e2e.sendCallbackQuery(`${intent}:D`, idUser)
    expect(decResponses.length).toBeGreaterThan(0)
    expect(decResponsesId.length).toBeGreaterThan(0)
    expect(decResponses[0]!.body?.text).toContain(`Current count: ${initialCount}`)
    expect(decResponsesId[0]!.body?.text).toContain(`Jumlah saat ini: ${initialCountId}`)
    expect(e2e.extractButtonLabels(decResponses[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {}))
    expect(e2e.extractButtonLabels(decResponsesId[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {}, `id`))
  })
})
