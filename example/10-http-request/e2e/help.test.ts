import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `help`

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: HelpPage`, () => {
  it(`show help text when navigating from /start -> Help`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    const res = await e2e.sendCallbackQuery(intent)
    const resId = await e2e.sendCallbackQuery(intent, {user: {language_code: `id`}})

    expect(res.length).toBeGreaterThan(0)
    expect(resId.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {}))
    expect(resId[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {}, `id`))
  })
})
