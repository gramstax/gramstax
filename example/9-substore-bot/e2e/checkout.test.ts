import {beforeEach, describe, expect, it} from "bun:test"
import {bot, e2e, flowUser, flowUserId, resetEnv} from "./setup"

const intent = `checkout`
beforeEach(async () => {
  await resetEnv()
})
describe(`E2E: CheckoutPage`, () => {
  it(`shows empty cart warning`, async () => {
    const res = await e2e.sendCallbackQuery(intent, flowUser)
    expect(res[0]!.body?.text).toContain(`Empty cart`)
  })
  it(`shows contact input with cart summary`, async () => {
    await bot.cacheState.set(`4101:cart`, {"netflix-premium-1m": 1})
    const res = await e2e.sendCallbackQuery(intent, flowUser)
    expect(res[0]!.body?.text).toContain(`Checkout Details`)
  })
  it(`shows confirm screen after valid contact`, async () => {
    await bot.cacheState.set(`4101:cart`, {"netflix-premium-1m": 1})
    await e2e.sendCallbackQuery(intent, flowUser)
    e2e.clearCalls()
    const res = await e2e.sendText(`@testuser\nDeliver now`, flowUser)
    expect(res[0]!.body?.text).toContain(`Confirm Order`)
  })
  it(`confirms purchase`, async () => {
    await bot.cacheState.set(`4101:cart`, {"netflix-premium-1m": 1})
    await e2e.sendCallbackQuery(intent, flowUser)
    e2e.clearCalls()
    await e2e.sendText(`@testuser\nPay later`, flowUser)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(`${intent}:confirm`, flowUser)
    const photo = res.find((r: {method: string}) => r.method === `editMessageMedia`)
    expect(photo).toBeDefined()
    expect(String(photo!.body?.media?.caption ?? ``)).toContain(`Order Created`)
  })
  it(`cancels checkout`, async () => {
    await bot.cacheState.set(`4101:cart`, {"netflix-premium-1m": 1})
    await e2e.sendCallbackQuery(intent, flowUser)
    e2e.clearCalls()
    await e2e.sendText(`@testuser`, flowUser)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(`${intent}:cancel`, flowUser)
    expect(res[0]!.body?.text).toContain(`Checkout cancelled`)
  })
  it(`shows empty cart warning ID variant`, async () => {
    const res = await e2e.sendCallbackQuery(intent, flowUserId)
    expect(res[0]!.body?.text).toContain(`Keranjang kosong`)
  })
  it(`shows contact input with cart summary ID variant`, async () => {
    await bot.cacheState.set(`5101:cart`, {"netflix-premium-1m": 1})
    const res = await e2e.sendCallbackQuery(intent, flowUserId)
    expect(res[0]!.body?.text).toContain(`Detail Checkout`)
  })
  it(`shows confirm screen after valid contact ID variant`, async () => {
    await bot.cacheState.set(`5101:cart`, {"netflix-premium-1m": 1})
    await e2e.sendCallbackQuery(intent, flowUserId)
    e2e.clearCalls()
    const res = await e2e.sendText(`@testuser\nDeliver now`, flowUserId)
    expect(res[0]!.body?.text).toContain(`Konfirmasi Pesanan`)
  })
  it(`confirms purchase ID variant`, async () => {
    await bot.cacheState.set(`5101:cart`, {"netflix-premium-1m": 1})
    await e2e.sendCallbackQuery(intent, flowUserId)
    e2e.clearCalls()
    await e2e.sendText(`@testuser\nPay later`, flowUserId)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(`${intent}:confirm`, flowUserId)
    const photo = res.find((r: {method: string}) => r.method === `editMessageMedia`)
    expect(photo).toBeDefined()
    expect(String(photo!.body?.media?.caption ?? ``)).toContain(`Pesanan Dibuat`)
  })
  it(`cancels checkout ID variant`, async () => {
    await bot.cacheState.set(`5101:cart`, {"netflix-premium-1m": 1})
    await e2e.sendCallbackQuery(intent, flowUserId)
    e2e.clearCalls()
    await e2e.sendText(`@testuser`, flowUserId)
    e2e.clearCalls()
    const res = await e2e.sendCallbackQuery(`${intent}:cancel`, flowUserId)
    expect(res[0]!.body?.text).toContain(`Checkout dibatalkan`)
  })
})
