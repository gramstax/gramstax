import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, gmsg, type TestEnvironment, gkb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `counter`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: CounterPage`, () => {
  it(`increase counter then decrease back to initial value`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    // Navigate to counter and record starting count
    const initialResponses = await env.mockServer.sendCallbackQuery(intent)
    const initialResponsesId = await env.mockServer.sendCallbackQuery(intent, {user: {language_code: `id`}})
    expect(initialResponses.length).toBeGreaterThan(0)
    expect(initialResponsesId.length).toBeGreaterThan(0)
    expect(initialResponsesId[0]!.body?.text).toBe(gmsg(intent, `s1`, {count: `0`}, `id`))
    expect(buttonLabels(initialResponsesId[0])).toEqual(gkb(intent, `s1`, `inline`, {count: `0`}, `id`))

    const initialText = initialResponses[0]!.body?.text
    expect(initialText).toContain(`Current count:`)
    const initialMatch = initialText.match(/Current count: (\d+)/)
    expect(initialMatch).not.toBeNull()
    const initialCount = parseInt(initialMatch![1]!, 10)
    expect(buttonLabels(initialResponses[0])).toEqual(gkb(intent, `s1`, `inline`, {}))

    env.clearRequests()

    // Increase by 1
    const incResponses = await env.mockServer.sendCallbackQuery(`${intent}:I`)
    expect(incResponses.length).toBeGreaterThan(0)
    expect(incResponses[0]!.body?.text).toContain(`Current count: ${initialCount + 1}`)
    expect(buttonLabels(incResponses[0])).toEqual(gkb(intent, `s1`, `inline`, {}))

    env.clearRequests()

    // Decrease back to initial
    const decResponses = await env.mockServer.sendCallbackQuery(`${intent}:D`)
    expect(decResponses.length).toBeGreaterThan(0)
    expect(decResponses[0]!.body?.text).toContain(`Current count: ${initialCount}`)
    expect(buttonLabels(decResponses[0])).toEqual(gkb(intent, `s1`, `inline`, {}))
  })
})
