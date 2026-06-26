import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, gmsg, gkb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `withdraw`

function makeUser(id: number, languageCode?: string) {
  return languageCode ? {user: {id, language_code: languageCode}, chat: {id}} : {user: {id}, chat: {id}}
}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: WithdrawPage`, () => {
  it(`shows withdraw form on callback`, async () => {
    const user = makeUser(6311)
    await env.mockServer.sendText(`/start`, user)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`deposit`, user)
    env.clearRequests()
    await env.mockServer.sendText(`100000`, user)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, user)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `s1`, {}))
    expect(buttonLabels(responses[0])).toEqual(gkb(intent, `s1`, `inline`, {}))
  })

  it(`completes withdrawal flow successfully`, async () => {
    const user = makeUser(6312)
    await env.mockServer.sendText(`/start`, user)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`deposit`, user)
    env.clearRequests()
    await env.mockServer.sendText(`100000`, user)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent, user)
    env.clearRequests()

    const responses = await env.mockServer.sendText(`40000`, user)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `s`, {amount: `40.000`, balance: `60.000`}))
    expect(buttonLabels(responses[0])).toEqual(gkb(intent, `s`, `inline`, {amount: `40.000`, balance: `60.000`}))
  })

  it(`shows insufficient funds when withdrawal exceeds balance`, async () => {
    const user = makeUser(6313)
    await env.mockServer.sendText(`/start`, user)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent, user)
    env.clearRequests()

    const responses = await env.mockServer.sendText(`999999`, user)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `w-insufficient`, {balance: `0`}))
  })

  it(`shows invalid amount for non-numeric input`, async () => {
    const user = makeUser(6314)
    await env.mockServer.sendText(`/start`, user)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent, user)
    env.clearRequests()

    const responses = await env.mockServer.sendText(`abc`, user)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `w-invalid`, {amount: `abc`}))
  })

  it(`shows ID variant for form and success`, async () => {
    const user = makeUser(6321, `id`)
    // Deposit ID user first
    await env.mockServer.sendText(`/start`, user)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`deposit`, user)
    env.clearRequests()
    await env.mockServer.sendText(`100000`, user)
    env.clearRequests()

    // ID variant form
    const formResponses = await env.mockServer.sendCallbackQuery(intent, user)
    expect(formResponses[0]!.body?.text).toBe(gmsg(intent, `s1`, {}, `id`))
    expect(buttonLabels(formResponses[0])).toEqual(gkb(intent, `s1`, `inline`, {}, `id`))

    env.clearRequests()

    // ID variant success
    const responses = await env.mockServer.sendText(`30000`, user)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `s`, {amount: `30.000`, balance: `70.000`}, `id`))
    expect(buttonLabels(responses[0])).toEqual(gkb(intent, `s`, `inline`, {amount: `30.000`, balance: `70.000`}, `id`))
  })
})
