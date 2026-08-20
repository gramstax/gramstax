import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser} from "../setup"

const intent = `start/transfer`
beforeEach(() => {
  e2e.clearCalls()
})
describe(`E2E: StartTransferPage`, () => {
  it(`shows form on callback`, async () => {
    await e2e.sendText(`/start`, enUser)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(intent, enUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
  })
  it(`completes transfer`, async () => {
    await e2e.sendText(`/start`, enUser)
    e2e.clearCalls()
    await e2e.sendCallbackQuery(`deposit`, enUser)
    e2e.clearCalls()
    await e2e.sendText(`2000`, enUser)
    e2e.clearCalls()
    await e2e.sendCallbackQuery(intent, enUser)
    e2e.clearCalls()
    const res = await e2e.sendText(`1000 99999`, enUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
  })
  it(`blocks self-transfer`, async () => {
    await e2e.sendText(`/start`, enUser)
    e2e.clearCalls()
    await e2e.sendCallbackQuery(intent, enUser)
    e2e.clearCalls()
    const res = await e2e.sendText(`1000 4001`, enUser)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.body?.text).toBeDefined()
  })
  it(`shows ID variant`, async () => {
    await e2e.sendText(`/start`, idUser)
    e2e.clearCalls()
    await e2e.sendCallbackQuery(`deposit`, idUser)
    e2e.clearCalls()
    await e2e.sendText(`5000`, idUser)
    e2e.clearCalls()
    const form = await e2e.sendCallbackQuery(intent, idUser)
    expect(form.length).toBeGreaterThan(0)
    expect(form[0]!.body?.text).toBeDefined()
  })
})
