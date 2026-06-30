import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup.js"

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: GeneralStatusPage`, () => {
  it(`show route not found for unrecognized text command`, async () => {
    const responses = await e2e.sendText(`/unknown`)
    const responsesId = await e2e.sendText(`/unknown`, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0].body?.text).toBe(e2e.gmsg(`general-status`, `d`, {isNotFound: true}))
    expect(responsesId[0].body?.text).toBe(e2e.gmsg(`general-status`, `d`, {isNotFound: true}, `id`))
  })

  it(`sendPhoto trigger route not found response`, async () => {
    const responses = await e2e.sendPhoto({caption: `test photo`})

    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]?.body?.text).toBe(e2e.gmsg(`general-status`, `d`, {isNotFound: true}))
  })
})
