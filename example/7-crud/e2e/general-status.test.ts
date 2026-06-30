import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: GeneralStatusPage`, () => {
  it(`show not-found`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(`bad`)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(`general-status`, `d`, {isNotFound: true}))
  })
})
