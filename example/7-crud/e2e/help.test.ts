import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, gmsg, gkb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `help`
const asUser = {user: {id: 711}, chat: {id: 711}}
const asUserId = {user: {id: 712, language_code: `id`}, chat: {id: 712}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: HelpPage`, () => {
  it(`navigates from /start via callback:help and shows help text`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `s1`, {}))
    expect(buttonLabels(responses[0])).toEqual(gkb(intent, `s1`, `inline`, {}))
  })

  it(`shows ID variant`, async () => {
    await env.mockServer.sendText(`/start`, asUserId)
    env.clearRequests()

    const responsesId = await env.mockServer.sendCallbackQuery(intent, asUserId)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responsesId[0]!.body?.text).toBe(gmsg(intent, `s1`, {}, `id`))
    expect(buttonLabels(responsesId[0])).toEqual(gkb(intent, `s1`, `inline`, {}, `id`))
  })
})
