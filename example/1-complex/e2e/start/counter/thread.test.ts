import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../../setup"

const intent = `start/counter/thread`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: CounterThreadPage`, () => {
  it(`show worker counter with count and timestamp`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(intent, enUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toStartWith(`🧵 Worker counter`)
    expect(responses[0]!.body?.text).toContain(`Count:`)
    expect(responses[0]!.body?.text).toContain(`Timestamp:`)

    const responsesId = await e2e.sendCallbackQuery(intent, idUser)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responsesId[0]!.body?.text).toStartWith(`🧵 Kounter worker`)
    expect(responsesId[0]!.body?.text).toContain(`Kounter:`)
    expect(responsesId[0]!.body?.text).toContain(`Waktu:`)
  })
})
