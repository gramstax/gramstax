import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, resetEnv, type TestEnvironment} from "./setup"

let env: TestEnvironment
const asUser = {user: {id: 951}, chat: {id: 951}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(async () => {
  await resetEnv()
})

describe(`E2E: CartPage`, () => {
  it(`shows empty cart for a new user`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(`cart`, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Your Cart is Empty`)
    expect(responses[0]!.body?.text).toContain(`Browse subscription products`)
  })

  it(`shows cart with items when products are added`, async () => {
    // Pre-populate cart via cacheState
    await env.botCore.cacheState.set(`951:cart`, {"netflix-premium-1m": 1, "spotify-family-1m": 2})

    const responses = await env.mockServer.sendCallbackQuery(`cart`, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Your Cart`)
    expect(responses[0]!.body?.text).toContain(`Netflix Premium`)
    expect(responses[0]!.body?.text).toContain(`Spotify Family`)
    expect(responses[0]!.body?.text).toContain(`Subtotal:`)
  })

  it(`clears cart and shows confirmation`, async () => {
    await env.botCore.cacheState.set(`951:cart`, {"netflix-premium-1m": 1})

    const responses = await env.mockServer.sendCallbackQuery(`cart:s1:clear`, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Cart cleared`)
  })
})
