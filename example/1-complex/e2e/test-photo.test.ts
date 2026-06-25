import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, media, type TestEnvironment} from "./setup"

let env: TestEnvironment
const intent = `test-photo`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: TestPhotoPage`, () => {
  it(`return a photo media response`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    await env.mockServer.sendCallbackQuery(intent)

    const editMediaReq = env.mockServer.lastRequest(`editMessageMedia`)
    expect(editMediaReq).toBeDefined()
    expect(editMediaReq!.body?.media?.type).toBe(`photo`)
    expect(editMediaReq!.body?.media?.media).toBe(media(intent, `s1`, {}).src)
    expect(editMediaReq!.body?.media?.caption).toBe(media(intent, `s1`, {}).caption)

    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent, {user: {language_code: `id`}})
    const editMediaIdReq = env.mockServer.lastRequest(`editMessageMedia`)
    expect(editMediaIdReq).toBeDefined()
    expect(editMediaIdReq!.body?.media?.caption).toBe(media(intent, `s1`, {}, `id`).caption)
  })
})
