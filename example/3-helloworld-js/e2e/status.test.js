import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "./setup"

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StatusPage`, () => {
  it(`show route not found for unrecognized text command`, async () => {
    const responses = await e2e.sendText(`/unknown`, enUser)
    const responsesId = await e2e.sendText(`/unknown`, idUser)

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0].body?.text).toBe(e2e.gmsg(`status`, `nf`))
    expect(responsesId[0].body?.text).toBe(e2e.gmsg(`status`, `nf`, {}, `id`))
  })

  it(`sendPhoto trigger route not found response`, async () => {
    const responses = await e2e.sendPhoto({caption: `test photo`, ...enUser})
    const responsesId = await e2e.sendPhoto({caption: `test photo`, ...idUser})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]?.body?.text).toBe(e2e.gmsg(`status`, `nf`))
    expect(responsesId[0]?.body?.text).toBe(e2e.gmsg(`status`, `nf`, {}, `id`))
  })
})
