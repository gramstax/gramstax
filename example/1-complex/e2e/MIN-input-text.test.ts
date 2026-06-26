import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, gmsg, type TestEnvironment} from "./setup"

let env: TestEnvironment
const intent = `MIN-input-text`
const asUser = {user: {id: 2002}, chat: {id: 2002}}
const asUser2 = {user: {id: 2003}, chat: {id: 2003}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: MINInputTextPage`, () => {
  it(`echo back text via /MIN-input-text command`, async () => {
    const responses = await env.mockServer.sendText(`/MIN-input-text`, asUser)
    const responsesId = await env.mockServer.sendText(`/MIN-input-text`, {user: {id: 7001, language_code: `id`}, chat: {id: 7001}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `default`, {}))
    expect(responsesId[0]!.body?.text).toBe(gmsg(intent, `default`, {}, `id`))
  })

  it(`echo back user text after /MIN-input-text command`, async () => {
    await env.mockServer.sendText(`/MIN-input-text`, asUser2)
    env.clearRequests()

    const resultResponses = await env.mockServer.sendText(`Hello MIN`, asUser2)

    expect(resultResponses.length).toBeGreaterThan(0)
    expect(resultResponses[0]!.body?.text).toBe(gmsg(intent, `success`, {res: `Hello MIN`}))
  })
})
