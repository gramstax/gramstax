import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, msg, kb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `keyboard-bottom`
const asUser = {user: {id: 2001}, chat: {id: 2001}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: KeyboardBottomPage`, () => {
  it(`show bottom keyboard via /keyboard_bottom command`, async () => {
    const responses = await env.mockServer.sendText(`/keyboard_bottom`, asUser)
    const responsesId = await env.mockServer.sendText(`/keyboard_bottom`, {user: {id: 6001, language_code: `id`}, chat: {id: 6001}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `s1`, {}))
    expect(responsesId[0]!.body?.text).toBe(msg(intent, `s1`, {}, `id`))
    expect(responses[0]!.body?.reply_markup?.keyboard).toBeDefined()
    expect(responsesId[0]!.body?.reply_markup?.keyboard).toBeDefined()
  })
})
