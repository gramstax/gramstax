import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, msg, kb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `echo`
const asUser = {user: {id: 403}, chat: {id: 403}}
const asUserId = {user: {id: 403, language_code: `id`}, chat: {id: 403}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: EchoPage`, () => {
  it(`navigates from /start via callback:echo and shows tips`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `s1`, {}))
    expect(buttonLabels(responses[0])).toEqual(kb(intent, `s1`, `inline`, {}))
  })

  it(`shows ID variant for callback:echo`, async () => {
    await env.mockServer.sendText(`/start`, asUserId)
    env.clearRequests()

    const responsesId = await env.mockServer.sendCallbackQuery(intent, asUserId)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responsesId[0]!.body?.text).toBe(msg(intent, `s1`, {}, `id`))
    expect(buttonLabels(responsesId[0])).toEqual(kb(intent, `s1`, `inline`, {}, `id`))
  })

  it(`echoes free text back to the user`, async () => {
    // Navigate to echo page first
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent, asUser)
    env.clearRequests()

    // Send free text
    const echoText = `hello world`
    const responses = await env.mockServer.sendText(echoText, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `f-text`, {text: echoText}))
    expect(buttonLabels(responses[0])).toEqual(kb(intent, `s1`, `inline`, {}))
  })
})
