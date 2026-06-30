import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const _intent = `start`
const asUser = {user: {id: 601}, chat: {id: 601}}

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StartPage`, () => {
  it(`respond to /start`, async () => {
    const res = await e2e.sendText(`/start`, asUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
  })
})
