import {describe, it, expect, beforeEach} from "bun:test"
import {e2e, resetEnv, bot} from "./setup"

const intent = `checkout`
const asUser = {user: {id: 961}, chat: {id: 961}}
beforeEach(async () => {
  await resetEnv()
})
describe(`E2E: CheckoutPage`, () => {
  it(`shows empty cart warning`, async () => {
    const res = await e2e.sendCallbackQuery(intent, asUser)
    expect(res[0]!.body?.text).toContain(`Empty cart`)
  })
  it(`shows contact input with cart summary`, async () => {
    await bot.cacheState.set(`961:cart`, {"netflix-premium-1m": 1})
    const res = await e2e.sendCallbackQuery(intent, asUser)
    expect(res[0]!.body?.text).toContain(`Checkout Details`)
  })
  it(`shows confirm screen after valid contact`, async () => {
    await bot.cacheState.set(`961:cart`, {"netflix-premium-1m": 1})
    await e2e.sendCallbackQuery(intent, asUser)
    e2e.clearCalls()
    const res = await e2e.sendText(`@testuser\nDeliver now`, asUser)
    expect(res[0]!.body?.text).toContain(`Confirm Order`)
  })
  it(`confirms purchase`, async () => {
    await bot.cacheState.set(`961:cart`, {"netflix-premium-1m": 1})
    await e2e.sendCallbackQuery(intent, asUser)
    e2e.clearCalls()
    await e2e.sendText(`@testuser\nPay later`, asUser)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(`${intent}:confirm`, asUser)
    const photo = res.find((r: any) => r.method === `editMessageMedia`)
    expect(photo).toBeDefined()
    expect(String(photo!.body?.media?.caption ?? ``)).toContain(`Order Created`)
  })
  it(`cancels checkout`, async () => {
    await bot.cacheState.set(`961:cart`, {"netflix-premium-1m": 1})
    await e2e.sendCallbackQuery(intent, asUser)
    e2e.clearCalls()
    await e2e.sendText(`@testuser`, asUser)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(`${intent}:cancel`, asUser)
    expect(res[0]!.body?.text).toContain(`Checkout cancelled`)
  })
})
