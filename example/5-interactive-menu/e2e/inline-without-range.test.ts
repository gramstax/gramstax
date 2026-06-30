import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const _intent = `inline-without-range`

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: InlineWithoutRangePage`, () => {
  it(`show inline keyboard without range`, async () => {
    const res = await e2e.sendText(`/inline_no_range`)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
  })
})
