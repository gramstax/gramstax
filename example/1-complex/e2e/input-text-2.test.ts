import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, msg, kb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `input-text-2`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: InputText2Page`, () => {
  it(`echo back unrecognized text via handleFreeText`, async () => {
    const responses = await env.mockServer.sendText(`/unknown`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply.body?.text).toBe(msg(intent, `s`, {res: `/unknown`}))
  })

  it(`show form and echo back text in session flow`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    const pageResponses = await env.mockServer.sendCallbackQuery(intent)
    const pageResponsesId = await env.mockServer.sendCallbackQuery(intent, {user: {language_code: `id`}})
    expect(pageResponses.length).toBeGreaterThan(0)
    expect(pageResponsesId.length).toBeGreaterThan(0)
    expect(pageResponses[0]!.body?.text).toBe(msg(intent, `s1`, {}))
    expect(pageResponsesId[0]!.body?.text).toBe(msg(intent, `s1`, {}, `id`))
    expect(buttonLabels(pageResponses[0])).toEqual(kb(intent, `s1`, `inline`, {}))
    expect(buttonLabels(pageResponsesId[0])).toEqual(kb(intent, `s1`, `inline`, {}, `id`))

    env.clearRequests()

    const resultResponses = await env.mockServer.sendText(`Echo this`)
    expect(resultResponses.length).toBeGreaterThan(0)
    expect(resultResponses[0]!.body?.text).toBe(msg(intent, `s`, {res: `Echo this`}))
  })
})
