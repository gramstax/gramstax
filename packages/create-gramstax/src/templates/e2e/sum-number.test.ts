import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `sum-number`
const asUser = {user: {id: 2004, username: `testuser`}, chat: {id: 2004}}

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: SumNumberPage`, () => {
  it(`complete two-step sum flow and show result`, async () => {
    await e2e.sendText(`/start`, asUser)
    e2e.clearCalls()

    const step1 = await e2e.sendCallbackQuery(intent, asUser)
    expect(step1.length).toBeGreaterThan(0)
    expect(step1[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {}))
    e2e.clearCalls()

    const step2 = await e2e.sendText(`23`, asUser)
    expect(step2.length).toBeGreaterThan(0)
    expect(step2[0]!.body?.text).toBe(e2e.gmsg(intent, `s2`, {}))
    e2e.clearCalls()

    const result = await e2e.sendText(`10`, asUser)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]!.body?.text).toContain(`Result Sum`)
    expect(result[0]!.body?.text).toContain(`33`)
    expect(e2e.buttonLabels(result[0])).toEqual(e2e.gkb(intent, `s`, `inline`, {}))
  })

  it(`re-prompt step 1 on invalid (non-numeric) input`, async () => {
    await e2e.sendText(`/start`, asUser)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(intent, asUser)
    e2e.clearCalls()

    const retry = await e2e.sendText(`not-a-number`, asUser)
    expect(retry.length).toBeGreaterThan(0)
    expect(retry[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {}))
  })
})
