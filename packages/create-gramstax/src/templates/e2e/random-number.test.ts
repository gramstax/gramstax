import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, kb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `random-number`
const asUser = {user: {id: 2003, username: `testuser`}, chat: {id: 2003}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: RandomNumberPage`, () => {
  it(`show generated random number when navigating from /start`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    const responsesId = await env.mockServer.sendCallbackQuery(intent, {user: {id: 6001, username: `pengguna`, language_code: `id`}, chat: {id: 6001}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const edit = responses[0]!
    const editId = responsesId[0]!
    expect(edit.body?.text).toContain(`Random Number`)
    expect(editId.body?.text).toContain(`Angka Acak`)
    expect(buttonLabels(edit)).toEqual(kb(intent, `s1`, `inline`, {}))
    expect(buttonLabels(editId)).toEqual(kb(intent, `s1`, `inline`, {}, `id`))
  })
})
