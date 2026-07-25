/** Extract text from a captured API call (handles both sendMessage and sendRichMessage). */

import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

beforeEach(() => {
  e2e.clearCalls()
})

describe(`E2E: Full exploration flow`, () => {
  it(`go from counter to input text to photo and back home`, async () => {
    await e2e.sendText(`/start`)
    e2e.clearCalls()

    // Counter page
    const counterResponses = await e2e.sendCallbackQuery(`start-counter`)
    expect(counterResponses.length).toBeGreaterThan(0)
    expect(counterResponses[0]!.body?.text).toBe(e2e.gmsg(`start-counter`, `s1`, {count: `0`}))

    const counterIdResponses = await e2e.sendCallbackQuery(`start-counter`, {user: {language_code: `id`}})
    expect(counterIdResponses.length).toBeGreaterThan(0)
    expect(counterIdResponses[0]!.body?.text).toBe(e2e.gmsg(`start-counter`, `s1`, {count: `0`}, `id`))

    e2e.clearCalls()

    // Increase counter
    const increaseResponses = await e2e.sendCallbackQuery(`start-counter:I`)
    expect(increaseResponses.length).toBeGreaterThan(0)
    expect(increaseResponses[0]!.body?.text).toBe(e2e.gmsg(`start-counter`, `s1`, {count: `1`}))

    e2e.clearCalls()

    // Input text page — form
    const inputPageResponses = await e2e.sendCallbackQuery(`start-input-text`)
    expect(inputPageResponses.length).toBeGreaterThan(0)
    expect(inputPageResponses[0]!.body?.text).toBe(e2e.gmsg(`start-input-text`, `s1`, {}))

    e2e.clearCalls()

    // Send text — get result
    const inputResultResponses = await e2e.sendText(`Hello Flow`)
    expect(inputResultResponses.length).toBeGreaterThan(0)
    expect(inputResultResponses[0]!.body?.text).toBe(e2e.gmsg(`start-input-text`, `s`, {res: `Hello Flow`}))

    e2e.clearCalls()

    // Photo page — returns editMessageMedia
    const photoResponses = await e2e.sendCallbackQuery(`start-test-photo`)
    expect(photoResponses.length).toBeGreaterThan(0)
    const editMediaReq = e2e.lastCall(`editMessageMedia`)
    expect(editMediaReq).toBeDefined()
    expect(editMediaReq!.body?.media?.type).toBe(`photo`)
    expect(editMediaReq!.body?.media?.media).toBe(e2e.gmedia(`start-test-photo`, `s1`, {}).src)
    expect(editMediaReq!.body?.media?.caption).toBe(e2e.gmedia(`start-test-photo`, `s1`, {}).caption)

    e2e.clearCalls()

    // Navigate back home via Back button
    const backResponses = await e2e.sendCallbackQuery(`start`)
    const backMessageResponse = backResponses.find((response: any) => typeof e2e.extractText(response) === `string`)
    expect(backResponses.length).toBeGreaterThan(0)
    expect(e2e.extractText(backMessageResponse!)).toContain(`gramstax`)
  })
})
