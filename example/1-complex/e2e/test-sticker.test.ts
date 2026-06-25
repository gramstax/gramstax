import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, media, type TestEnvironment} from "./setup"

let env: TestEnvironment
const intent = `test-sticker`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: TestStickerPage`, () => {
  it(`return a sticker response`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    await env.mockServer.sendCallbackQuery(intent)

    const sendStickerReq = env.mockServer.lastRequest(`sendSticker`)
    expect(sendStickerReq).toBeDefined()
    expect(sendStickerReq!.body?.sticker).toBe(media(intent, `s1`, {}).src)

    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent, {user: {language_code: `id`}})
    const sendStickerIdReq = env.mockServer.lastRequest(`sendSticker`)
    expect(sendStickerIdReq).toBeDefined()
    expect(sendStickerIdReq!.body?.sticker).toBe(media(intent, `s1`, {}, `id`).src)
  })
})
