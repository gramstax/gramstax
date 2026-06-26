import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, gmsg, gkb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `help`
const asUser = {user: {id: 7001, username: `testuser`}, chat: {id: 7001}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: HelpPage`, () => {
  it(`show help text when navigating from /start -> Help`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    const responsesId = await env.mockServer.sendCallbackQuery(intent, {user: {id: 7002, username: `pengguna`, language_code: `id`}, chat: {id: 7002}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const edit = responses[0]!
    const editId = responsesId[0]!
    expect(edit.body?.text).toBe(gmsg(intent, `s1`, {}))
    expect(editId.body?.text).toBe(gmsg(intent, `s1`, {}, `id`))
    expect(buttonLabels(edit)).toEqual(gkb(intent, `s1`, `inline`, {}))
    expect(buttonLabels(editId)).toEqual(gkb(intent, `s1`, `inline`, {}, `id`))
  })
})
