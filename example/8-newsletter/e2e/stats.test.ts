import {beforeEach, describe, expect, it } from "bun:test"
import {e2e} from "./setup"

const intent = `stats`

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StatsPage`, () => {
  it(`show stats`, async () => {
    const res = await e2e.sendCallbackQuery(intent)
    expect(res.length).toBeGreaterThan(0)
  })
})
