import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, gmsg, type TestEnvironment} from "./setup"

let env: TestEnvironment
const intent = `block-import`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: BlockImportPage`, () => {
  it(`show block import demo with random value`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    Math.random = () => 1 // overrides math.random()
    const responses = await env.mockServer.sendCallbackQuery(intent)
    const responsesId = await env.mockServer.sendCallbackQuery(intent, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `s1`, {number: Math.random()}))
    expect(responsesId[0]!.body?.text).toBe(gmsg(intent, `s1`, {number: Math.random()}, `id`))
  })
})
