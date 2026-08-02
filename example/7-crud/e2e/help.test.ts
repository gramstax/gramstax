import {beforeEach, describe, expect, it } from "bun:test"
import {e2e} from "./setup"

const intent = `help`
const asUser = {user: {id: 761}, chat: {id: 761}}
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: HelpPage`, () => {
  it(`shows help`, async () => {
    await e2e.sendText(`/start`, asUser)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(intent, asUser)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {}))
  })
})
