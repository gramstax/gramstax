import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StartPage`, () => {
  it(`respond to /start command with welcome message`, async () => {
    const res = await e2e.sendText(`/start`)

    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(`start`, `s1`, {}))
  })
})
