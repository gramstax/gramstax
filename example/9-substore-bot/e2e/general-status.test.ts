import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, resetEnv, type TestEnvironment, gmsg, gkb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `general-status`
const asUser = {user: {id: 921}, chat: {id: 921}}
const asUserId = {user: {id: 922, language_code: `id`}, chat: {id: 922}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(async () => {
  await resetEnv()
})

describe(`E2E: GeneralStatusPage`, () => {
  it(`shows action not found for unrecognized commands`, async () => {
    const responses = await env.mockServer.sendText(`/unknown`, asUser)
    const responsesId = await env.mockServer.sendText(`/unknown`, asUserId)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `nf`, {}))
    expect(responsesId[0]!.body?.text).toBe(gmsg(intent, `nf`, {}, `id`))
    expect(buttonLabels(responses[0])).toEqual(gkb(intent, `nf`, `inline`, {}))
    expect(buttonLabels(responsesId[0])).toEqual(gkb(intent, `nf`, `inline`, {}, `id`))
  })
})
