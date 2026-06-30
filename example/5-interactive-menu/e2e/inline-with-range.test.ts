import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `inline-with-range`

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: Inline-with-rangePage`, () => {
  it(`load page`, async () => {
    const res = await e2e.sendText(`/inline-with-range`)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
  })
})
