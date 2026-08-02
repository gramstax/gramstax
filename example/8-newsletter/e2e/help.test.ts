import {beforeEach, describe, expect, it } from "bun:test"
import {e2e} from "./setup"

const intent = `help`

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: HelpPage`, () => {
  it(`show help`, async () => {
    const res = await e2e.sendCallbackQuery(intent)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {}))
  })
})
