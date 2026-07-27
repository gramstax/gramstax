import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "../../setup"

const _intent = `start/inline-with-range`

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: InlineWithRangePage`, () => {
  it(`show inline keyboard with range`, async () => {
    const res = await e2e.sendText(`/inline_range`)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
  })
})
