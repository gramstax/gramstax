import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, gmsg} from "./setup.js"

let env

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: GeneralStatusPage`, () => {
  it(`show route not found for unrecognized text command`, async () => {
    const responses = await env.mockServer.sendText(`/unknown`)
    const responsesId = await env.mockServer.sendText(`/unknown`, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0].body?.text).toBe(gmsg(`general-status`, `d`, {isNotFound: true}))
    expect(responsesId[0].body?.text).toBe(gmsg(`general-status`, `d`, {isNotFound: true}, `id`))
  })

  it(`sendPhoto trigger route not found response`, async () => {
    const responses = await env.mockServer.sendPhoto({caption: `test photo`})

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]?.body?.text).toBe(gmsg(`general-status`, `d`, {isNotFound: true}))
  })
})
