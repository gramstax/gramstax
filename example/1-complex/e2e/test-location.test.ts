import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = `test-location`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: TestLocationPage`, () => {
  it(`return a location response with coordinates`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(intent)

    const sendLocationReq = e2e.lastCall(`sendLocation`)
    expect(sendLocationReq).toBeDefined()
    expect(typeof sendLocationReq!.body?.latitude).toBe(`number`)
    expect(typeof sendLocationReq!.body?.longitude).toBe(`number`)
  })
})
