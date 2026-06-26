import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, gmsg, gkb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `sum-number`
const asUser = {user: {id: 2004, username: `testuser`}, chat: {id: 2004}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: SumNumberPage`, () => {
  it(`complete two-step sum flow and show result`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const step1 = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(step1.length).toBeGreaterThan(0)
    expect(step1[0]!.body?.text).toBe(gmsg(intent, `s1`, {}))
    env.clearRequests()

    const step2 = await env.mockServer.sendText(`23`, asUser)
    expect(step2.length).toBeGreaterThan(0)
    expect(step2[0]!.body?.text).toBe(gmsg(intent, `s2`, {}))
    env.clearRequests()

    const result = await env.mockServer.sendText(`10`, asUser)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]!.body?.text).toContain(`Result Sum`)
    expect(result[0]!.body?.text).toContain(`33`)
    expect(buttonLabels(result[0])).toEqual(gkb(intent, `s`, `inline`, {}))
  })

  it(`re-prompt step 1 on invalid (non-numeric) input`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    await env.mockServer.sendCallbackQuery(intent, asUser)
    env.clearRequests()

    const retry = await env.mockServer.sendText(`not-a-number`, asUser)
    expect(retry.length).toBeGreaterThan(0)
    expect(retry[0]!.body?.text).toBe(gmsg(intent, `s1`, {}))
  })
})
