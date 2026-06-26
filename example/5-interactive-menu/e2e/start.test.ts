import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, msg, kb, buttonLabels, bottomButtonLabels} from "./setup"

let env: TestEnvironment
const intent = `start`
const asUser = {user: {id: 501}, chat: {id: 501}}
const asUserId = {user: {id: 501, language_code: `id`}, chat: {id: 501}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: StartPage`, () => {
  it(`responds to /start with main menu and inline keyboard`, async () => {
    const responses = await env.mockServer.sendText(`/start`, asUser)
    const responsesId = await env.mockServer.sendText(`/start`, asUserId)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    // First response is the main menu (inline)
    expect(responses[0]!.body?.text).toBe(msg(intent, `s1`, {}))
    expect(responsesId[0]!.body?.text).toBe(msg(intent, `s1`, {}, `id`))
    expect(buttonLabels(responses[0])).toEqual(kb(intent, `s1`, `inline`, {}))
    expect(buttonLabels(responsesId[0])).toEqual(kb(intent, `s1`, `inline`, {}, `id`))
  })

  it(`shows quick actions bottom keyboard as second response`, async () => {
    const responses = await env.mockServer.sendText(`/start`, asUser)
    const responsesId = await env.mockServer.sendText(`/start`, asUserId)

    // Second response is the quick actions bottom keyboard
    expect(responses.length).toBeGreaterThan(1)
    expect(responsesId.length).toBeGreaterThan(1)
    expect(responses[1]!.body?.text).toBe(msg(intent, `i-quick`, {}))
    expect(responsesId[1]!.body?.text).toBe(msg(intent, `i-quick`, {}, `id`))
    expect(bottomButtonLabels(responses[1])).toEqual(kb(intent, `i-quick`, `bottom`, {}))
    expect(bottomButtonLabels(responsesId[1])).toEqual(kb(intent, `i-quick`, `bottom`, {}, `id`))
  })
})
