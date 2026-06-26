/**
 * E2E Tests: HelpPage
 *
 * Validates rendered template output via templateManager.getGMessage
 * for exact matching instead of fragile partial assertions.
 */
import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, gmsg} from "./setup"

let env: TestEnvironment
const intent = `help`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: HelpPage`, () => {
  it(`show help text when user clicks Help button`, async () => {
    // Navigate from start to establish session context
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent)
    const responsesId = await env.mockServer.sendCallbackQuery(intent, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const edit = responses[0]!
    const editId = responsesId[0]!
    expect(edit.body?.text).toBe(gmsg(intent, `s1`, {}))
    expect(editId.body?.text).toBe(gmsg(intent, `s1`, {}, `id`))
  })

  it(`show help text via /help command`, async () => {
    const responses = await env.mockServer.sendText(`/help`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply.body?.text).toBe(gmsg(intent, `s1`, {}))
  })
})
