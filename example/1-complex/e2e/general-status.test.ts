import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, msg} from "./setup"

let env: TestEnvironment
const intent = `general-status`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: GeneralStatusPage`, () => {
  it(`show 'Route not found' for unrecognized callback query`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(`nonexistent-callback-data`)
    const responsesId = await env.mockServer.sendCallbackQuery(`nonexistent-callback-data`, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const reply = responses[0]!
    const replyId = responsesId[0]!
    expect(reply).toBeDefined()
    expect(replyId).toBeDefined()
    expect(reply.body?.text).toBe(msg(intent, `d`, {isNotFound: true}))
    expect(replyId.body?.text).toBe(msg(intent, `d`, {isNotFound: true}, `id`))
  })
})
