import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, gmsg, gkb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `block-switch`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: BlockSwitchPage`, () => {
  it(`show initial switch state as Inactive (status 0)`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent)
    const responsesId = await env.mockServer.sendCallbackQuery(intent, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `s1`, {status: `0`}))
    expect(responsesId[0]!.body?.text).toBe(gmsg(intent, `s1`, {status: `0`}, `id`))
    expect(buttonLabels(responses[0])).toEqual(gkb(intent, `s1`, `inline`, {status: `0`}))
    expect(buttonLabels(responsesId[0])).toEqual(gkb(intent, `s1`, `inline`, {status: `0`}, `id`))
  })

  it(`toggle switch to Active (status 1)`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(`${intent}:s1:1`)

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `s1`, {status: `1`}))
    expect(buttonLabels(responses[0])).toEqual(gkb(intent, `s1`, `inline`, {status: `1`}))
  })

  it(`toggle back to Inactive (status 0)`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`${intent}:s1:1`)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(`${intent}:s1:0`)

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `s1`, {status: `0`}))
    expect(buttonLabels(responses[0])).toEqual(gkb(intent, `s1`, `inline`, {status: `0`}))
  })
})
