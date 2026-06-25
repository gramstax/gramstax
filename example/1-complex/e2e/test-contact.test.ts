import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, media, type TestEnvironment} from "./setup"

let env: TestEnvironment
const intent = `test-contact`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: TestContactPage`, () => {
  it(`return a contact response with phone and name`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    await env.mockServer.sendCallbackQuery(intent)

    const sendContactReq = env.mockServer.lastRequest(`sendContact`)
    expect(sendContactReq).toBeDefined()
    expect(sendContactReq!.body?.phone_number).toBe(`442071234567`)
    expect(sendContactReq!.body?.first_name).toBe(`England`)

    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent, {user: {language_code: `id`}})
    const idReq = env.mockServer.lastRequest(`sendContact`)
    expect(idReq).toBeDefined()
    expect(idReq!.body?.phone_number).toBe(media(intent, `s1`, {}, `id`).phone)
    expect(idReq!.body?.first_name).toBe(media(intent, `s1`, {}, `id`).first_name)
  })
})
