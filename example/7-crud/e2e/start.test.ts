import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, msg, kb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `start`
const asUser = {user: {id: 701}, chat: {id: 701}}
const asUserId = {user: {id: 702, language_code: `id`}, chat: {id: 702}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: StartPage`, () => {
  it(`responds to /start with CRUD menu and inline keyboard`, async () => {
    const responses = await env.mockServer.sendText(`/start`, asUser)
    const responsesId = await env.mockServer.sendText(`/start`, asUserId)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `s1`, {}))
    expect(responsesId[0]!.body?.text).toBe(msg(intent, `s1`, {}, `id`))
    expect(buttonLabels(responses[0])).toEqual(kb(intent, `s1`, `inline`, {}))
    expect(buttonLabels(responsesId[0])).toEqual(kb(intent, `s1`, `inline`, {}, `id`))
  })

  it(`responds to callback:start`, async () => {
    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `s1`, {}))
  })
})
