import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"
import {resetDb} from "./setup"

const intent = `detail`
const asUser = {user: {id: 731}, chat: {id: 731}}
beforeEach(async () => {
  e2e.clearCalls()
  await resetDb(731)
})
describe(`E2E: DetailPage`, () => {
  it(`shows detail form`, async () => {
    await e2e.sendText(`/start`, asUser)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(intent, asUser)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(intent, `s1`, {}))
  })
})
