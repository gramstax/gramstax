import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, msg, kb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `history`
const asUser = {user: {id: 651}, chat: {id: 651}}
const asUserId = {user: {id: 652, language_code: `id`}, chat: {id: 652}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: HistoryPage`, () => {
  it(`shows empty history for new user`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `s1`, {history: `No transactions available.`}))
    expect(buttonLabels(responses[0])).toEqual(kb(intent, `s1`, `inline`, {history: `No transactions available.`}))
  })

  it(`shows transactions after deposit`, async () => {
    // Deposit funds
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`deposit`, asUser)
    env.clearRequests()
    await env.mockServer.sendText(`1000`, asUser)
    env.clearRequests()

    // Check history
    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Recent transactions`)
    expect(responses[0]!.body?.text).toContain(`Deposit`)
    expect(responses[0]!.body?.text).toContain(`+1.000`)
  })

  it(`shows ID variant`, async () => {
    await env.mockServer.sendText(`/start`, asUserId)
    env.clearRequests()

    const responsesId = await env.mockServer.sendCallbackQuery(intent, asUserId)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responsesId[0]!.body?.text).toBe(msg(intent, `s1`, {history: `No transactions available.`}, `id`))
    expect(buttonLabels(responsesId[0])).toEqual(kb(intent, `s1`, `inline`, {history: `No transactions available.`}, `id`))
  })
})
