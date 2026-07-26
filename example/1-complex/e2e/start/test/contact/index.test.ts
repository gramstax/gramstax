import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "../../../setup"

const intent = `start-test-contact`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: TestContactPage`, () => {
  it(`return a contact response with phone and name`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    await e2e.sendCallbackQuery(intent)

    const sendContactReq = e2e.lastCall(`sendContact`)
    expect(sendContactReq).toBeDefined()
    expect(sendContactReq!.body?.phone_number).toBe(`442071234567`)
    expect(sendContactReq!.body?.first_name).toBe(`England`)
  })
})
