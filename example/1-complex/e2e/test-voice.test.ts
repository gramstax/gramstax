import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, gmedia, type TestEnvironment} from "./setup"

let env: TestEnvironment
const intent = `test-voice`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: TestVoicePage`, () => {
  it(`return a voice media response`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    await env.mockServer.sendCallbackQuery(intent)

    const sendVoiceReq = env.mockServer.lastRequest(`sendVoice`)
    expect(sendVoiceReq).toBeDefined()
    expect(sendVoiceReq!.body?.voice).toBe(gmedia(intent, `s1`, {}).src)

    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent, {user: {language_code: `id`}})
    const sendVoiceIdReq = env.mockServer.lastRequest(`sendVoice`)
    expect(sendVoiceIdReq).toBeDefined()
    expect(sendVoiceIdReq!.body?.voice).toBe(gmedia(intent, `s1`, {}, `id`).src)
  })
})
