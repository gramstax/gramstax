import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser} from "./setup"

const intent = `sum-number`

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: SumNumberPage`, () => {
  it(`complete two-step sum flow and show result`, async () => {
    await e2e.sendText(`/start`, enUser)
    e2e.clearCalls()

    const step1 = await e2e.sendCallbackQuery(intent, enUser)
    expect(step1.length).toBeGreaterThan(0)
    expect(step1[0]!.body?.text).toBe(e2e.gmsg(intent, `l`, {}))
    e2e.clearCalls()

    // input 1
    const step2 = await e2e.sendText(`23`, enUser)
    expect(step2.length).toBeGreaterThan(0)
    expect(step2[0]!.body?.text).toBe(e2e.gmsg(intent, `r`, {}))
    e2e.clearCalls()

    // input 2
    const result = await e2e.sendText(`10`, enUser)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]!.body?.text).toContain(`Result Sum`)
    expect(result[0]!.body?.text).toContain(`33`)
    expect(e2e.extractButtonLabels(result[0]!)).toEqual(e2e.gkb(intent, `s`, `inline`, {}))
  })

  it(`re-prompt step 1 on invalid (non-numeric) input`, async () => {
    await e2e.sendText(`/start`, enUser)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(intent, enUser)
    e2e.clearCalls()

    const retry = await e2e.sendText(`not-a-number`, enUser)
    expect(retry.length).toBeGreaterThan(0)
    expect(retry[0]!.body?.text).toBe(e2e.gmsg(intent, `l`, {}))
    e2e.clearCalls()

    // recover with valid inputs so no pending-input session leaks
    // into other test files sharing this user
    await e2e.sendText(`23`, enUser)
    e2e.clearCalls()
    const result = await e2e.sendText(`10`, enUser)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]!.body?.text).toContain(`33`)
  })
})
