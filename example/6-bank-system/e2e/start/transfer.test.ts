import {beforeEach, describe, expect, it } from "bun:test"
import {e2e} from "../setup"

const intent = `start/transfer`
const asUser = {user: {id: 641}, chat: {id: 641}}
const asUserId = {user: {id: 642, language_code: `id`}, chat: {id: 642}}
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: StartTransferPage`, () => {
  it(`shows form on callback`, async () => {
    await e2e.sendText(`/start`, asUser)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(intent, asUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
  })
  it(`completes transfer`, async () => {
    await e2e.sendText(`/start`, asUser)
    e2e.clearCalls()
    await e2e.sendCallbackQuery(`deposit`, asUser)
    e2e.clearCalls()
    await e2e.sendText(`2000`, asUser)
    e2e.clearCalls()
    await e2e.sendCallbackQuery(intent, asUser)
    e2e.clearCalls()
    const res = await e2e.sendText(`1000 99999`, asUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
  })
  it(`blocks self-transfer`, async () => {
    await e2e.sendText(`/start`, asUser)
    e2e.clearCalls()
    await e2e.sendCallbackQuery(intent, asUser)
    e2e.clearCalls()
    const res = await e2e.sendText(`1000 641`, asUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
  })
  it(`shows ID variant`, async () => {
    await e2e.sendText(`/start`, asUserId)
    e2e.clearCalls()
    await e2e.sendCallbackQuery(`deposit`, asUserId)
    e2e.clearCalls()
    await e2e.sendText(`5000`, asUserId)
    e2e.clearCalls()
    const form = await e2e.sendCallbackQuery(intent, asUserId)
    expect(form.length).toBeGreaterThan(0)
    expect(form[0]!.body?.text).toBeDefined()
  })
})
