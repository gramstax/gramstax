import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, msg, kb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `balance`
const asUser = {user: {id: 611}, chat: {id: 611}}
const asUserId = {user: {id: 612, language_code: `id`}, chat: {id: 612}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: BalancePage`, () => {
  it(`shows account balance with 0 for new user`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `s1`, {balance: `0`}))
    expect(buttonLabels(responses[0])).toEqual(kb(intent, `s1`, `inline`, {balance: `0`}))
  })

  it(`shows ID variant`, async () => {
    await env.mockServer.sendText(`/start`, asUserId)
    env.clearRequests()

    const responsesId = await env.mockServer.sendCallbackQuery(intent, asUserId)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responsesId[0]!.body?.text).toBe(msg(intent, `s1`, {balance: `0`}, `id`))
    expect(buttonLabels(responsesId[0])).toEqual(kb(intent, `s1`, `inline`, {balance: `0`}, `id`))
  })
})
