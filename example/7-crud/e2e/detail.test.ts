import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser, resetEnv} from "./setup"

const intent = `detail`
beforeEach(async () => {
  e2e.clearCalls()
  await resetEnv(4001)
  await resetEnv(5001)
})
describe(`E2E: DetailPage`, () => {
  it(`shows detail form`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(intent, enUser)
    const resId = await e2e.sendCallbackQuery(intent, idUser)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(intent, `i`, {}))
    expect(resId[0]!.body?.text).toBe(e2e.gmsg(intent, `i`, {}, `id`))
  })
})
