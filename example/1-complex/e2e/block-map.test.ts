import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, msg, type TestEnvironment} from "./setup"

let env: TestEnvironment
const intent = `block-map`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: BlockMapPage`, () => {
  it(`show template map demo with random list`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent)

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Template map demo`)
    expect(responses[0]!.body?.text).toContain(`Position:`)
    expect(responses[0]!.body?.text).toContain(`Status: 1`)

    const responsesId = await env.mockServer.sendCallbackQuery(intent, {user: {language_code: `id`}})
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responsesId[0]!.body?.text).toContain(msg(`block-map`, `s1`, {}, `id`).slice(0, 20))
  })
})
