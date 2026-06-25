import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, media, type TestEnvironment} from "./setup"

let env: TestEnvironment
const intent = `test-video-note`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: TestVideoNotePage`, () => {
  it(`return a video note response`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    await env.mockServer.sendCallbackQuery(intent)

    const sendVoiceReq = env.mockServer.lastRequest(`sendVoice`)
    expect(sendVoiceReq).toBeDefined()
    expect(sendVoiceReq!.body?.voice).toBe(media(intent, `s1`, {}).src)

    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent, {user: {language_code: `id`}})
    const sendVoiceIdReq = env.mockServer.lastRequest(`sendVoice`)
    expect(sendVoiceIdReq).toBeDefined()
    expect(sendVoiceIdReq!.body?.voice).toBe(media(intent, `s1`, {}, `id`).src)
  })
})
