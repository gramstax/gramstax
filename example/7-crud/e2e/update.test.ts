import {beforeEach, describe, expect, it } from "bun:test"
import {e2e, resetDb} from "./setup"

const intent = `update`
const asUser = {user: {id: 741}, chat: {id: 741}}
beforeEach(async () => {
  e2e.clearCalls()
  await resetDb(741)
})
describe(`E2E: UpdatePage`, () => {
  it(`shows update form`, async () => {
    await e2e.sendText(`/start`, asUser)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(intent, asUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
  })
})
