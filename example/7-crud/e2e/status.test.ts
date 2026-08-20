import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser} from "./setup"

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StatusPage`, () => {
  it(`show not-found`, async () => {
    await e2e.sendText(`/start`, enUser)
    e2e.clearCalls()

    const res = await e2e.sendCallbackQuery(`bad`, enUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(`status`, `nf`))
  })
})
