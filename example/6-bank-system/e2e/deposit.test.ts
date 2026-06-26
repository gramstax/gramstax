import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, msg, kb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `deposit`
const asUser = {user: {id: 621}, chat: {id: 621}}
const asUserId = {user: {id: 622, language_code: `id`}, chat: {id: 622}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: DepositPage`, () => {
  it(`shows deposit form on callback`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `s1`, {}))
    expect(buttonLabels(responses[0])).toEqual(kb(intent, `s1`, `inline`, {}))
  })

  it(`completes deposit flow successfully`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendText(`100000`, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `s`, {amount: `100.000`, balance: `100.000`}))
    expect(buttonLabels(responses[0])).toEqual(kb(intent, `s`, `inline`, {amount: `100.000`, balance: `100.000`}))
  })

  it(`shows ID variant for form and success`, async () => {
    // ID variant form
    await env.mockServer.sendText(`/start`, asUserId)
    env.clearRequests()
    const formResponses = await env.mockServer.sendCallbackQuery(intent, asUserId)
    expect(formResponses[0]!.body?.text).toBe(msg(intent, `s1`, {}, `id`))
    expect(buttonLabels(formResponses[0])).toEqual(kb(intent, `s1`, `inline`, {}, `id`))

    env.clearRequests()

    // ID variant success
    const responses = await env.mockServer.sendText(`50000`, asUserId)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `s`, {amount: `50.000`, balance: `50.000`}, `id`))
    expect(buttonLabels(responses[0])).toEqual(kb(intent, `s`, `inline`, {amount: `50.000`, balance: `50.000`}, `id`))
  })

  it(`shows invalid amount for non-numeric input`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendText(`abc`, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `w-invalid`, {amount: `abc`}))
  })
})
