import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, gmsg, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `category`
const asUser = {user: {id: 531}, chat: {id: 531}}
const asUserId = {user: {id: 532, language_code: `id`}, chat: {id: 532}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: CategoryPage`, () => {
  it(`navigates from /start via callback:category and shows category list`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `s1`, {}))
    // Keyboard is built dynamically with category names + back button
    const labels = buttonLabels(responses[0])
    expect(labels).toContain(`Tools`)
    expect(labels).toContain(`Guides`)
    expect(labels).toContain(`Updates`)
    expect(labels).toContain(`⬅️ Back`)
  })

  it(`shows ID variant for callback:category`, async () => {
    await env.mockServer.sendText(`/start`, asUserId)
    env.clearRequests()

    const responsesId = await env.mockServer.sendCallbackQuery(intent, asUserId)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responsesId[0]!.body?.text).toBe(gmsg(intent, `s1`, {}, `id`))
    const idLabels = buttonLabels(responsesId[0])
    expect(idLabels).toContain(`Tools`)
    expect(idLabels).toContain(`Guides`)
    expect(idLabels).toContain(`Updates`)
    expect(idLabels).toContain(`⬅️ Kembali`)
  })
})
