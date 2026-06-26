import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, gkb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `start`
const asUser = {user: {id: 2001, username: `testuser`}, chat: {id: 2001}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: StartPage`, () => {
  it(`respond to /start command with welcome message and full keyboard`, async () => {
    const responses = await env.mockServer.sendText(`/start`, asUser)
    const responsesId = await env.mockServer.sendText(`/start`, {user: {id: 5001, username: `pengguna`, language_code: `id`}, chat: {id: 5001}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const reply = responses[0]!
    const replyId = responsesId[0]!
    expect(reply.body?.text).toContain(`Welcome`)
    expect(replyId.body?.text).toContain(`Selamat datang`)
    expect(buttonLabels(reply)).toEqual(gkb(intent, `s1`, `inline`, {}))
    expect(buttonLabels(replyId)).toEqual(gkb(intent, `s1`, `inline`, {}, `id`))
  })

  it(`capture outbound requests in mockServer.requests`, async () => {
    await env.mockServer.sendText(`/start`, asUser)

    const sendMessageReq = env.mockServer.lastRequest(`sendMessage`)
    expect(sendMessageReq).toBeDefined()
    expect(sendMessageReq?.body?.text).toContain(`Welcome`)
  })
})
