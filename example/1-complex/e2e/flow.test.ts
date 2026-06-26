import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, gmsg, gmedia} from "./setup"

let env: TestEnvironment

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: Full exploration flow`, () => {
  it(`go from counter to input text to photo and back home`, async () => {
    await env.mockServer.sendText(`/start`)
    env.clearRequests()

    // Counter page
    const counterResponses = await env.mockServer.sendCallbackQuery(`counter`)
    expect(counterResponses.length).toBeGreaterThan(0)
    expect(counterResponses[0]!.body?.text).toBe(gmsg(`counter`, `s1`, {count: `0`}))

    const counterIdResponses = await env.mockServer.sendCallbackQuery(`counter`, {user: {language_code: `id`}})
    expect(counterIdResponses.length).toBeGreaterThan(0)
    expect(counterIdResponses[0]!.body?.text).toBe(gmsg(`counter`, `s1`, {count: `0`}, `id`))

    env.clearRequests()

    // Increase counter
    const increaseResponses = await env.mockServer.sendCallbackQuery(`counter:I`)
    expect(increaseResponses.length).toBeGreaterThan(0)
    expect(increaseResponses[0]!.body?.text).toBe(gmsg(`counter`, `s1`, {count: `1`}))

    env.clearRequests()

    // Input text page — form
    const inputPageResponses = await env.mockServer.sendCallbackQuery(`input-text`)
    expect(inputPageResponses.length).toBeGreaterThan(0)
    expect(inputPageResponses[0]!.body?.text).toBe(gmsg(`input-text`, `s1`, {}))

    env.clearRequests()

    // Send text — get result
    const inputResultResponses = await env.mockServer.sendText(`Hello Flow`)
    expect(inputResultResponses.length).toBeGreaterThan(0)
    expect(inputResultResponses[0]!.body?.text).toBe(gmsg(`input-text`, `s`, {res: `Hello Flow`}))

    env.clearRequests()

    // Photo page — returns editMessageMedia
    const photoResponses = await env.mockServer.sendCallbackQuery(`test-photo`)
    expect(photoResponses.length).toBeGreaterThan(0)
    const editMediaReq = env.mockServer.lastRequest(`editMessageMedia`)
    expect(editMediaReq).toBeDefined()
    expect(editMediaReq!.body?.media?.type).toBe(`photo`)
    expect(editMediaReq!.body?.media?.media).toBe(gmedia(`test-photo`, `s1`, {}).src)
    expect(editMediaReq!.body?.media?.caption).toBe(gmedia(`test-photo`, `s1`, {}).caption)

    env.clearRequests()

    // Navigate back home via Back button
    const backResponses = await env.mockServer.sendCallbackQuery(`start`)
    const backMessageResponse = backResponses.find((response) => typeof response.body?.text === `string`)
    expect(backResponses.length).toBeGreaterThan(0)
    expect(backMessageResponse?.body?.text).toContain(`Welcome`)
  })
})
