import {beforeEach, describe, expect, it } from "bun:test"
import {e2e} from "./setup"

const intent = `help`
const asUser = {user: {id: 1003}, chat: {id: 1003}}

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: HelpPage`, () => {
  it(`show help text when navigating from /start -> Help`, async () => {
    await e2e.sendText(`/start`, asUser)
    e2e.clearCalls()

    const res = await e2e.sendCallbackQuery(intent, asUser)
    const resId = await e2e.sendCallbackQuery(intent, {...asUser, user: {id: 1003, language_code: `id`}})

    expect(res.length).toBeGreaterThan(0)
    expect(resId.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {}))
    expect(resId[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {}, `id`))
  })
})
