import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, msg, kb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `input-text`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: InputTextPage`, () => {
  it(`show input form and echo back user text`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    // Navigate to input-text
    const pageResponses = await env.mockServer.sendCallbackQuery(intent)
    const pageResponsesId = await env.mockServer.sendCallbackQuery(intent, {user: {language_code: `id`}})
    expect(pageResponses.length).toBeGreaterThan(0)
    expect(pageResponsesId.length).toBeGreaterThan(0)
    expect(pageResponses[0]!.body?.text).toBe(msg(intent, `s1`, {}))
    expect(pageResponsesId[0]!.body?.text).toBe(msg(intent, `s1`, {}, `id`))
    expect(buttonLabels(pageResponses[0])).toEqual(kb(intent, `s1`, `inline`, {}))
    expect(buttonLabels(pageResponsesId[0])).toEqual(kb(intent, `s1`, `inline`, {}, `id`))

    env.clearRequests()

    // Send text
    const resultResponses = await env.mockServer.sendText(`Hello World`)
    expect(resultResponses.length).toBeGreaterThan(0)
    expect(resultResponses[0]!.body?.text).toBe(msg(intent, `s`, {res: `Hello World`}))
    expect(buttonLabels(resultResponses[0])).toEqual(kb(intent, `s`, `inline`, {}))
  })
})
