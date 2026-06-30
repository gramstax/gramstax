import {describe, it, expect, beforeEach} from "bun:test"
import {e2e, resetDb} from "./setup"

const intent = `delete`
const asUser = {user: {id: 751}, chat: {id: 751}}
beforeEach(async () => {
  e2e.clearCalls()
  await resetDb(751)
})
describe(`E2E: DeletePage`, () => {
  it(`shows delete form`, async () => {
    await e2e.sendText(`/start`, asUser)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(intent, asUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
  })
})
