import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, resetEnv, type TestEnvironment, buttonLabels} from "./setup"

let env: TestEnvironment
const asUser = {user: {id: 931}, chat: {id: 931}}
const asUserId = {user: {id: 932, language_code: `id`}, chat: {id: 932}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(async () => {
  await resetEnv()
})

describe(`E2E: CatalogPage`, () => {
  it(`shows product listing on page 1`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(`catalog:s1:page:0`, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Subscription Catalog`)
    expect(responses[0]!.body?.text).toContain(`products available`)
    expect(buttonLabels(responses[0]).length).toBeGreaterThan(0)
  })

  it(`shows ID variant`, async () => {
    await env.mockServer.sendText(`/start`, asUserId)
    env.clearRequests()

    const responsesId = await env.mockServer.sendCallbackQuery(`catalog:s1:page:0`, asUserId)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responsesId[0]!.body?.text).toContain(`Katalog Langganan`)
    expect(buttonLabels(responsesId[0]).length).toBeGreaterThan(0)
  })
})
