import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, gmedia, type TestEnvironment} from "./setup"

let env: TestEnvironment
const intent = `test-location`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: TestLocationPage`, () => {
  it(`return a location response`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    await env.mockServer.sendCallbackQuery(intent)

    const sendLocationReq = env.mockServer.lastRequest(`sendLocation`)
    expect(sendLocationReq).toBeDefined()
    expect(typeof sendLocationReq!.body?.latitude).toBe(`number`)
    expect(typeof sendLocationReq!.body?.longitude).toBe(`number`)

    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent, {user: {language_code: `id`}})
    const idReq = env.mockServer.lastRequest(`sendLocation`)
    expect(idReq).toBeDefined()
    expect(idReq!.body?.latitude).toBe(parseInt(gmedia(intent, `s1`, {}, `id`).latitude))
    expect(idReq!.body?.longitude).toBe(parseInt(gmedia(intent, `s1`, {}, `id`).longitude))
  })
})
