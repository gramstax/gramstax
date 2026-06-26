import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, resetEnv, type TestEnvironment} from "./setup"

let env: TestEnvironment
const asUser = {user: {id: 961}, chat: {id: 961}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(async () => {
  await resetEnv()
})

describe(`E2E: CheckoutPage`, () => {
  it(`shows empty cart warning when cart is empty`, async () => {
    const responses = await env.mockServer.sendCallbackQuery(`checkout`, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Empty cart`)
  })

  it(`shows contact input form with cart summary`, async () => {
    await env.botCore.cacheState.set(`961:cart`, {"netflix-premium-1m": 1})

    const responses = await env.mockServer.sendCallbackQuery(`checkout`, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Checkout Details`)
    expect(responses[0]!.body?.text).toContain(`Netflix Premium`)
    expect(responses[0]!.body?.text).toContain(`Subtotal: Rp 79.000`)
  })

  it(`shows confirm order screen after valid contact`, async () => {
    await env.botCore.cacheState.set(`961:cart`, {"netflix-premium-1m": 1})
    await env.mockServer.sendCallbackQuery(`checkout`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendText(`@testuser\nPlease deliver ASAP`, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Confirm Order`)
    expect(responses[0]!.body?.text).toContain(`Contact: @testuser`)
  })

  it(`confirms purchase and receives order confirmation`, async () => {
    await env.botCore.cacheState.set(`961:cart`, {"netflix-premium-1m": 1})
    await env.mockServer.sendCallbackQuery(`checkout`, asUser)
    env.clearRequests()
    await env.mockServer.sendText(`@testuser\nDeliver after payment`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(`checkout:confirm`, asUser)
    expect(responses.length).toBeGreaterThan(0)
    const photoResponse = responses.find((r: any) => r.method === `editMessageMedia`)
    expect(photoResponse).toBeDefined()
    const caption = String(photoResponse!.body?.media?.caption ?? ``)
    expect(caption).toContain(`Order Created`)
    expect(caption).toContain(`Order ID: SUB-`)
    expect(caption).toContain(`Total: Rp 79.000`)
  })

  it(`cancels checkout`, async () => {
    await env.botCore.cacheState.set(`961:cart`, {"netflix-premium-1m": 1})
    await env.mockServer.sendCallbackQuery(`checkout`, asUser)
    env.clearRequests()
    await env.mockServer.sendText(`@testuser`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(`checkout:cancel`, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Checkout cancelled`)
  })
})
