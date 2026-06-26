import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, resetEnv, type TestEnvironment, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `help`
const asUser = {user: {id: 911}, chat: {id: 911}}
const asUserId = {user: {id: 912, language_code: `id`}, chat: {id: 912}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(async () => {
  await resetEnv()
})

describe(`E2E: HelpPage`, () => {
  it(`navigates from /start via callback:help and shows help text`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Store Help`)
    expect(buttonLabels(responses[0]).length).toBeGreaterThan(0)
  })

  it(`shows ID variant`, async () => {
    await env.mockServer.sendText(`/start`, asUserId)
    env.clearRequests()

    const responsesId = await env.mockServer.sendCallbackQuery(intent, asUserId)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responsesId[0]!.body?.text).toContain(`Bantuan Toko`)
    expect(buttonLabels(responsesId[0]).length).toBeGreaterThan(0)
  })
})
