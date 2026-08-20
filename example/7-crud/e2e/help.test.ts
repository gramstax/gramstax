import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "./setup"

const intent = `help`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: HelpPage`, () => {
  it(`shows help`, async () => {
    await e2e.sendText(`/start`, enUser)
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(intent, enUser)
    const resId = await e2e.sendCallbackQuery(intent, idUser)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {}))
    expect(resId[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {}, `id`))
  })
})
