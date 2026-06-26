import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, resetEnv, type TestEnvironment} from "./setup"

let env: TestEnvironment
const asUser = {user: {id: 941}, chat: {id: 941}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(async () => {
  await resetEnv()
})

describe(`E2E: ProductPage`, () => {
  it(`shows product detail with name, price, stock`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`catalog:s1:page:0`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(`product:detail:netflix-premium-1m`, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Netflix Premium`)
    expect(responses[0]!.body?.text).toContain(`Service: Netflix`)
    expect(responses[0]!.body?.text).toContain(`Price: Rp 79.000`)
    expect(responses[0]!.body?.text).toContain(`12 available`)
  })

  it(`shows out of stock for unavailable product`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`catalog:s1:page:0`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(`product:buy:disney-family-1m`, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Out of stock`)
  })

  it(`adds product to cart and shows confirmation`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`catalog:s1:page:0`, asUser)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`product:detail:spotify-family-1m`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(`product:add:spotify-family-1m`, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Added to cart`)
    expect(responses[0]!.body?.text).toContain(`Spotify Family`)
  })
})
