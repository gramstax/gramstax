import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, msg, kb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `transfer`
const asUser = {user: {id: 641}, chat: {id: 641}}
const asUserId = {user: {id: 642, language_code: `id`}, chat: {id: 642}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: TransferPage`, () => {
  it(`shows transfer form on callback`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `s1`, {}))
    expect(buttonLabels(responses[0])).toEqual(kb(intent, `s1`, `inline`, {}))
  })

  it(`completes transfer flow successfully`, async () => {
    // Deposit funds first
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`deposit`, asUser)
    env.clearRequests()
    await env.mockServer.sendText(`2000`, asUser)
    env.clearRequests()

    // Navigate to transfer form
    await env.mockServer.sendCallbackQuery(intent, asUser)
    env.clearRequests()

    // Send transfer
    const responses = await env.mockServer.sendText(`1000 99999`, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `s`, {amount: `1.000`, balance: `1.000`, target: `#99999`}))
  })

  it(`blocks transfer to own account`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendText(`1000 641`, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `w-self`, {}))
  })

  it(`shows invalid format for malformed input`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendText(`abc`, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `w-invalid`, {amount: `abc`}))
  })

  it(`shows ID variant for form and success`, async () => {
    // Deposit ID user first
    await env.mockServer.sendText(`/start`, asUserId)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`deposit`, asUserId)
    env.clearRequests()
    await env.mockServer.sendText(`5000`, asUserId)
    env.clearRequests()

    // ID variant form
    const formResponses = await env.mockServer.sendCallbackQuery(intent, asUserId)
    expect(formResponses[0]!.body?.text).toBe(msg(intent, `s1`, {}, `id`))
    expect(buttonLabels(formResponses[0])).toEqual(kb(intent, `s1`, `inline`, {}, `id`))

    env.clearRequests()

    // ID variant success
    const responses = await env.mockServer.sendText(`2000 88888`, asUserId)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `s`, {amount: `2.000`, balance: `3.000`, target: `#88888`}, `id`))
    expect(buttonLabels(responses[0])).toEqual(kb(intent, `s`, `inline`, {amount: `2.000`, balance: `3.000`, target: `#88888`}, `id`))
  })
})
