import {beforeEach, describe, expect, it} from "bun:test"
import {ADMIN_CHAT, ADMIN_USER, e2e, enUser, resetEnv} from "./setup"

const intent = `broadcast`
const adminUser = {user: ADMIN_USER, chat: ADMIN_CHAT}
const adminUserId = {user: {...ADMIN_USER, language_code: `id`}, chat: ADMIN_CHAT}
beforeEach(async () => {
  await resetEnv()
})
describe(`E2E: BroadcastPage`, () => {
  it(`blocks non-admin`, async () => {
    const res = await e2e.sendCallbackQuery(intent, enUser)
    expect(res.length).toBe(0)
  })
  it(`admin accesses form`, async () => {
    const res = await e2e.sendCallbackQuery(intent, adminUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toContain(`Broadcast Message`)
  })
  it(`admin accesses form ID variant`, async () => {
    const res = await e2e.sendCallbackQuery(intent, adminUserId)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toContain(`Pesan Siaran`)
  })
  it(`admin sends draft and confirms`, async () => {
    await e2e.sendCallbackQuery(intent, adminUser)
    e2e.clearCalls()
    const textRes = await e2e.sendText(`Hello subscribers!`, adminUser)
    expect(textRes[0]!.body?.text).toContain(`Confirm broadcast`)
    const sendBtn = e2e.bodyOf<{reply_markup?: {inline_keyboard?: Array<Array<{text?: string; callback_data?: string}>>}}>(textRes[0])?.reply_markup?.inline_keyboard?.flat().find((b: {text?: string; callback_data?: string}) => b.text?.includes(`Send`))
    expect(sendBtn?.callback_data).toBeDefined()
    e2e.clearCalls()
    const confirmRes = await e2e.sendCallbackQuery(sendBtn!.callback_data!, adminUser)
    expect(confirmRes.find((r: {method: string}) => r.method === `editMessageText`)).toBeDefined()
  })
  it(`admin cancels broadcast`, async () => {
    await e2e.sendCallbackQuery(intent, adminUser)
    e2e.clearCalls()
    await e2e.sendText(`Draft`, adminUser)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(`${intent}:i:cancel`, adminUser)
    expect(res[0]!.body?.text).toStartWith(`✖️ Broadcast cancelled.`)
  })
})
