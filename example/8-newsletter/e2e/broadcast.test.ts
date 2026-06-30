import {describe, it, expect, beforeEach} from "bun:test"
import {e2e, resetEnv, ADMIN_USER, ADMIN_CHAT} from "./setup"

const intent = `broadcast`
const regularUser = {user: {id: 1001, language_code: `en`}, chat: {id: 1001}}
const adminUser = {user: ADMIN_USER, chat: ADMIN_CHAT}
beforeEach(async () => {
  await resetEnv()
})
describe(`E2E: BroadcastPage`, () => {
  it(`blocks non-admin`, async () => {
    const res = await e2e.sendCallbackQuery(intent, regularUser)
    expect(res.length).toBe(0)
  })
  it(`admin accesses form`, async () => {
    const res = await e2e.sendCallbackQuery(intent, adminUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toContain(`Broadcast Message`)
  })
  it(`admin sends draft and confirms`, async () => {
    await e2e.sendCallbackQuery(intent, adminUser)
    e2e.clearCalls()
    const textRes = await e2e.sendText(`Hello subscribers!`, adminUser)
    expect(textRes[0]!.body?.text).toContain(`Confirm broadcast`)
    const kb = textRes[0]?.body?.reply_markup?.inline_keyboard
    const sendBtn = kb?.flat().find((b: any) => b.text?.includes(`Send`))
    expect(sendBtn?.callback_data).toBeDefined()
    e2e.clearCalls()
    const confirmRes = await e2e.sendCallbackQuery(sendBtn!.callback_data!, adminUser)
    expect(confirmRes.find((r: any) => r.method === `editMessageText`)).toBeDefined()
  })
  it(`admin cancels broadcast`, async () => {
    await e2e.sendCallbackQuery(intent, adminUser)
    e2e.clearCalls()
    await e2e.sendText(`Draft`, adminUser)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(`${intent}:s1:cancel`, adminUser)
    expect(res[0]!.body?.text).toStartWith(`✖️ Broadcast cancelled.`)
  })
})
