import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser, resetEnv} from "./setup"

const intent = `delete`
beforeEach(async () => {
  e2e.clearCalls()
  await resetEnv(4001)
  await resetEnv(5001)
})
describe(`E2E: DeletePage`, () => {
  it(`shows delete form`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(intent, enUser)
    const resId = await e2e.sendCallbackQuery(intent, idUser)
    expect(res.length).toBeGreaterThan(0)
    expect(resId.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
    expect(resId[0]!.body?.text).toBeDefined()
  })
})
