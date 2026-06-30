import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `general-status`

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: GeneralStatusPage`, () => {
  it(`show not-found for unrecognized callback`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    const res = await e2e.sendCallbackQuery(`bad-data`)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(intent, `d`, {isNotFound: true}))
  })
})
