import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser} from "./setup"

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: InfoPage`, () => {
  it(`respond to /info`, async () => {
    const res = await e2e.sendText(`/info`, enUser)
    expect(res.length).toBeGreaterThan(0)
    expect((res[0] as any).body.text).toContain(`no filesystem touched`)
  })
})
