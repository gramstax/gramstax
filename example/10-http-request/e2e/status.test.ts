import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "./setup"

const intent = `status`

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: StatusPage`, () => {
  it(`show 'Route not found' for unrecognized callback query`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()

    const res = await e2e.sendCallbackQuery(`nonexistent-callback-data`, enUser)
    const resId = await e2e.sendCallbackQuery(`nonexistent-callback-data`, idUser)

    expect(res.length).toBeGreaterThan(0)
    expect(resId.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(intent, `nf`))
    expect(resId[0]!.body?.text).toBe(e2e.gmsg(intent, `nf`, {}, `id`))
  })
})
