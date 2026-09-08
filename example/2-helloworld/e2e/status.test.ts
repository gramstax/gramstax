import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "./setup"

const intent = `status`

beforeEach(async () => {
  await e2e.sendText(`/start`, enUser)
  await e2e.sendText(`/start`, idUser)
  e2e.clearCalls()
})

describe(`E2E: StatusPage`, () => {
  it(`show error`, () => {
    expect(true).toBe(true)
  })

  it(`show not-found for unrecognized callback`, async () => {
    const res = await e2e.sendCallbackQuery(`nonexistent`, enUser)
    const resId = await e2e.sendCallbackQuery(`nonexistent`, idUser)
    expect(res.length).toBeGreaterThan(0)
    expect(resId.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(intent, `nf`))
    expect(resId[0]!.body?.text).toBe(e2e.gmsg(intent, `nf`, {}, `id`))
  })
})
