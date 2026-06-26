import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, gmsg} from "./setup"

let env: TestEnvironment
const intent = `general-status`
const asUser = {user: {id: 8001, username: `testuser`}, chat: {id: 8001}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: GeneralStatusPage`, () => {
  it(`show 'Route not found' for unrecognized callback query`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(`nonexistent-callback-data`, asUser)
    const responsesId = await env.mockServer.sendCallbackQuery(`nonexistent-callback-data`, {user: {id: 8002, username: `pengguna`, language_code: `id`}, chat: {id: 8002}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const reply = responses[0]!
    const replyId = responsesId[0]!
    expect(reply).toBeDefined()
    expect(replyId).toBeDefined()
    expect(reply.body?.text).toBe(gmsg(intent, `d`, {isNotFound: true}))
    expect(replyId.body?.text).toBe(gmsg(intent, `d`, {isNotFound: true}, `id`))
  })
})
