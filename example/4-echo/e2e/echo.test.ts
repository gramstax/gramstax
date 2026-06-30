import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: EchoPage`, () => {
  it(`echo back text via handleFreeText`, async () => {
    const res = await e2e.sendText(`hello bot`)
    const resId = await e2e.sendText(`hai bot`, {user: {language_code: `id`}})
    expect(res.length).toBeGreaterThan(0)
    expect(resId.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBe(`hello bot`)
    expect(resId[0]!.body?.text).toBe(`hai bot`)
  })
})
