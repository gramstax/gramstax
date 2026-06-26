import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, gmsg, gkb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `general-status`
const asUser = {user: {id: 521}, chat: {id: 521}}
const asUserId = {user: {id: 522, language_code: `id`}, chat: {id: 522}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: GeneralStatusPage`, () => {
  it(`shows route not found for unrecognized commands`, async () => {
    const responses = await env.mockServer.sendText(`/unknown`, asUser)
    const responsesId = await env.mockServer.sendText(`/unknown`, asUserId)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `d`, {isNotFound: true}))
    expect(responsesId[0]!.body?.text).toBe(gmsg(intent, `d`, {isNotFound: true}, `id`))
    expect(buttonLabels(responses[0])).toEqual(gkb(intent, `d`, `inline`, {isNotFound: true}))
    expect(buttonLabels(responsesId[0])).toEqual(gkb(intent, `d`, `inline`, {isNotFound: true}, `id`))
  })
})
