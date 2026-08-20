import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "./setup"

const intent = `start`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: StartPage`, () => {
  it(`responds to /start with menu`, async () => {
    const res = await e2e.sendText(`/start`, enUser)
    const resId = await e2e.sendText(`/start`, idUser)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {}))
    expect(resId[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {}, `id`))
  })
  it(`responds to callback`, async () => {
    const res = await e2e.sendCallbackQuery(intent, enUser)
    expect(res[0]!.body?.text).toBe(e2e.gmsg(intent, `default`, {}))
  })
})
