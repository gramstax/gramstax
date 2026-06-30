import {describe, it, expect, beforeEach} from "bun:test"
import {e2e, resetDb} from "./setup"

const intent = `create`
const asUser = {user: {id: 711}, chat: {id: 711}}
beforeEach(async () => {
  e2e.clearCalls()
  await resetDb(711)
})
describe(`E2E: CreatePage`, () => {
  it(`shows create form`, async () => {
    await e2e.sendText(`/start`, asUser)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(intent, asUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {}))
  })
})
