import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `list`
const asUser = {user: {id: 721}, chat: {id: 721}}
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: ListPage`, () => {
  it(`shows empty list`, async () => {
    const res = await e2e.sendCallbackQuery(intent, asUser)
    expect(res.length).toBeGreaterThan(0)
  })
})
