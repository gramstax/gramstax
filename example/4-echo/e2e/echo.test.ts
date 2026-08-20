import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "./setup"

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: EchoPage`, () => {
  it(`echo back text via handleFreeText`, async () => {
    const res = await e2e.sendText(`hello bot`, enUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBe(`hello bot`)
  })

  it(`echo back ID variant`, async () => {
    const res = await e2e.sendText(`hai bot`, idUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBe(`hai bot`)
  })
})
