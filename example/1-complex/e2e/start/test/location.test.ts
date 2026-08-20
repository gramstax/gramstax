import {beforeEach, describe, expect, it } from "bun:test"
import {e2e, enUser} from "../../setup"

const intent = `start/test/location`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: TestLocationPage`, () => {
  it(`return a location response with coordinates`, async () => {
    await e2e.sendText(`/start`, enUser)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(intent, enUser)

    const sendLocationReq = e2e.lastCall(`sendLocation`)
    expect(sendLocationReq).toBeDefined()
    expect(typeof sendLocationReq!.body?.latitude).toBe(`number`)
    expect(typeof sendLocationReq!.body?.longitude).toBe(`number`)
  })
})
