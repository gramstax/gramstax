import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, resetEnv, type TestEnvironment, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `stats`
const asUser = {user: {id: 831}, chat: {id: 831}}
const asUserId = {user: {id: 832, language_code: `id`}, chat: {id: 832}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(async () => {
  await resetEnv()
})

describe(`E2E: StatsPage`, () => {
  it(`shows stats with 0 subscribers for new user`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Total subscribers`)
    expect(responses[0]!.body?.text).toContain(`Not subscribed`)
    expect(buttonLabels(responses[0]).length).toBeGreaterThan(0)
  })

  it(`shows ID variant`, async () => {
    await env.mockServer.sendText(`/start`, asUserId)
    env.clearRequests()

    const responsesId = await env.mockServer.sendCallbackQuery(intent, asUserId)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responsesId[0]!.body?.text).toContain(`Total pelanggan`)
    expect(responsesId[0]!.body?.text).toContain(`Belum berlangganan`)
    expect(buttonLabels(responsesId[0]).length).toBeGreaterThan(0)
  })
})
