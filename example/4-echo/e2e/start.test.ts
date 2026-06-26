import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, msg, kb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `start`
const asUser = {user: {id: 401}, chat: {id: 401}}
const asUserId = {user: {id: 401, language_code: `id`}, chat: {id: 401}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: StartPage`, () => {
  it(`responds to /start command with welcome message and inline keyboard`, async () => {
    const responses = await env.mockServer.sendText(`/start`, asUser)
    const responsesId = await env.mockServer.sendText(`/start`, asUserId)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `s1`, {}))
    expect(responsesId[0]!.body?.text).toBe(msg(intent, `s1`, {}, `id`))
    expect(buttonLabels(responses[0])).toEqual(kb(intent, `s1`, `inline`, {}))
    expect(buttonLabels(responsesId[0])).toEqual(kb(intent, `s1`, `inline`, {}, `id`))
  })
})
