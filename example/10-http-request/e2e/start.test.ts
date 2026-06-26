/**
 * E2E Tests: StartPage
 *
 * Validates rendered template output via templateManager.getGMessage/getGKeyboard
 * for exact matching instead of fragile partial assertions.
 */
import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, gmsg, gkb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `start`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: StartPage`, () => {
  it(`respond to /start command with HTTP Request Bot welcome message`, async () => {
    const responses = await env.mockServer.sendText(`/start`)
    const responsesId = await env.mockServer.sendText(`/start`, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const reply = responses[0]!
    const replyId = responsesId[0]!
    expect(reply.body?.text).toBe(gmsg(intent, `s1`, {}))
    expect(replyId.body?.text).toBe(gmsg(intent, `s1`, {}, `id`))
    expect(buttonLabels(reply)).toEqual(gkb(intent, `s1`, `inline`, {}))
    expect(buttonLabels(replyId)).toEqual(gkb(intent, `s1`, `inline`, {}, `id`))
  })

  it(`handle multiple sequential interactions: /start -> help -> http-request`, async () => {
    const res1 = await env.mockServer.sendText(`/start`)
    expect(res1[0]?.body?.text).toBe(gmsg(intent, `s1`, {}))

    env.clearRequests()

    const res2 = await env.mockServer.sendCallbackQuery(`help`)
    expect(res2[0]?.body?.text).toBe(gmsg(`help`, `s1`, {}))

    env.clearRequests()

    const res3 = await env.mockServer.sendCallbackQuery(`http-request`)
    expect(res3[0]?.body?.text).toBe(gmsg(`http-request`, `s-method`, {}))
  })
})
