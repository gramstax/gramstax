import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, gmedia, type TestEnvironment} from "./setup"

let env: TestEnvironment
const intent = `test-media-group`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: TestMediaGroupPage`, () => {
  it(`return a media group response`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    await env.mockServer.sendCallbackQuery(intent)

    const sendMediaGroupReq = env.mockServer.lastRequest(`sendMediaGroup`)
    expect(sendMediaGroupReq).toBeDefined()
    expect(sendMediaGroupReq!.body?.media).toBeDefined()
    expect(Array.isArray(sendMediaGroupReq!.body?.media)).toBe(true)
    expect(sendMediaGroupReq!.body?.media!.length).toBeGreaterThan(0)
    // editPhotoGroup filters mediaGroup to only photos
    sendMediaGroupReq!.body?.media!.forEach((item: any) => {
      expect(item.type).toBe(`photo`)
    })

    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent, {user: {language_code: `id`}})
    const sendMediaGroupIdReq = env.mockServer.lastRequest(`sendMediaGroup`)
    expect(sendMediaGroupIdReq).toBeDefined()
    expect(sendMediaGroupIdReq!.body?.media![0]?.caption).toBe(gmedia(intent, `s1`, {}, `id`).mediaGroup![0]?.caption)
  })
})
