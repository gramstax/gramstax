import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment} from "./setup"

let env: TestEnvironment
const intent = `counter-thread`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: CounterThreadPage`, () => {
  it(`show worker counter with count and timestamp`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent)

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`🧵 Worker counter`)
    expect(responses[0]!.body?.text).toContain(`Count:`)
    expect(responses[0]!.body?.text).toContain(`Timestamp:`)

    const responsesId = await env.mockServer.sendCallbackQuery(intent, {user: {language_code: `id`}})
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responsesId[0]!.body?.text).toContain(`🧵 Kounter worker`)
    expect(responsesId[0]!.body?.text).toContain(`Kounter:`)
    expect(responsesId[0]!.body?.text).toContain(`Waktu:`)
  })
})
