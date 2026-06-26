import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, gmsg, gkb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `help`
const asUser = {user: {id: 402}, chat: {id: 402}}
const asUserId = {user: {id: 402, language_code: `id`}, chat: {id: 402}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: HelpPage`, () => {
  it(`responds to /help command with help text`, async () => {
    const responses = await env.mockServer.sendText(`/help`, asUser)
    const responsesId = await env.mockServer.sendText(`/help`, asUserId)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `s1`, {}))
    expect(responsesId[0]!.body?.text).toBe(gmsg(intent, `s1`, {}, `id`))
    expect(buttonLabels(responses[0])).toEqual(gkb(intent, `s1`, `inline`, {}))
    expect(buttonLabels(responsesId[0])).toEqual(gkb(intent, `s1`, `inline`, {}, `id`))
  })

  it(`navigates from /start via callback:help and shows edit`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `s1`, {}))
    // callback:help uses ctx.edit, so reply_markup may differ from reply-based
    expect(buttonLabels(responses[0])).toEqual(gkb(intent, `s1`, `inline`, {}))
  })

  it(`shows ID variant for callback:help`, async () => {
    await env.mockServer.sendText(`/start`, asUserId)
    env.clearRequests()

    const responsesId = await env.mockServer.sendCallbackQuery(intent, asUserId)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responsesId[0]!.body?.text).toBe(gmsg(intent, `s1`, {}, `id`))
    expect(buttonLabels(responsesId[0])).toEqual(gkb(intent, `s1`, `inline`, {}, `id`))
  })
})
