import {beforeEach, describe, expect, it } from "bun:test"
import {e2e} from "./setup"

const intent = `start`
const asUser = {user: {id: 701}, chat: {id: 701}}
const asUserId = {user: {id: 702, language_code: `id`}, chat: {id: 702}}
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: StartPage`, () => {
  it(`responds to /start with menu`, async () => {
    const res = await e2e.sendText(`/start`, asUser)
    const resId = await e2e.sendText(`/start`, asUserId)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {}))
    expect(resId[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {}, `id`))
  })
  it(`responds to callback`, async () => {
    const res = await e2e.sendCallbackQuery(intent, asUser)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {}))
  })
})
