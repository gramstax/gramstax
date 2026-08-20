import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../setup"

const _intent = `start`

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StartPage`, () => {
  it(`respond to /start`, async () => {
    const res = await e2e.sendText(`/start`, enUser)
    const resId = await e2e.sendText(`/start`, idUser)
    expect(res.length).toBeGreaterThan(0)
    expect(resId.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
    expect(resId[0]!.body?.text).toBeDefined()
  })
})
