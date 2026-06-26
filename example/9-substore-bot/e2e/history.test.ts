import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, resetEnv, type TestEnvironment} from "./setup"

let env: TestEnvironment
const intent = `history`
const asUser = {user: {id: 971}, chat: {id: 971}}
const asUserId = {user: {id: 972, language_code: `id`}, chat: {id: 972}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(async () => {
  await resetEnv()
})

describe(`E2E: HistoryPage`, () => {
  it(`shows no orders yet for new user`, async () => {
    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Order History`)
    expect(responses[0]!.body?.text).toContain(`No orders yet`)
  })

  it(`shows order history after purchase`, async () => {
    // Do a purchase first
    await env.botCore.cacheState.set(`971:cart`, {"netflix-premium-1m": 1})
    await env.mockServer.sendCallbackQuery(`checkout`, asUser)
    env.clearRequests()
    await env.mockServer.sendText(`@testuser`, asUser)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`checkout:confirm`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Order History`)
    expect(responses[0]!.body?.text).toContain(`SUB-`)
    expect(responses[0]!.body?.text).toContain(`Rp 79.000`)
  })

  it(`shows ID variant for empty history`, async () => {
    const responsesId = await env.mockServer.sendCallbackQuery(intent, asUserId)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responsesId[0]!.body?.text).toContain(`Riwayat Pesanan`)
  })
})
