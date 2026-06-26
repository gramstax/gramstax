/**
 * E2E Tests: GeneralStatusPage
 *
 * Validates the "Route not found" error display via templateManager.getGMessage
 * for exact matching. Uses unrecognized callback queries since
 * HttpRequestPage.handleFreeText catches ALL text input.
 */
import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, gmsg} from "./setup"

let env: TestEnvironment
const intent = `general-status`

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: GeneralStatusPage`, () => {
  it(`show 'Route not found' for unrecognized callback query`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(`nonexistent-callback-data`)
    const responsesId = await env.mockServer.sendCallbackQuery(`nonexistent-callback-data`, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const reply = responses[0]!
    const replyId = responsesId[0]!
    expect(reply.body?.text).toBe(gmsg(intent, `d`, {isNotFound: true}))
    expect(replyId.body?.text).toBe(gmsg(intent, `d`, {isNotFound: true}, `id`))
  })

  it(`show 'Route not found' for another unrecognized callback`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(`no-page-handles-this`)
    const responsesId = await env.mockServer.sendCallbackQuery(`no-page-handles-this`, {user: {language_code: `id`}})

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    const reply = responses[0]!
    const replyId = responsesId[0]!
    expect(reply.body?.text).toBe(gmsg(intent, `d`, {isNotFound: true}))
    expect(replyId.body?.text).toBe(gmsg(intent, `d`, {isNotFound: true}, `id`))
  })
})
