import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, gmsg, gkb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `delete`
const asUser = {user: {id: 771}, chat: {id: 771}}
const asUserId = {user: {id: 772, language_code: `id`}, chat: {id: 772}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: DeletePage`, () => {
  it(`shows empty message when no items exist`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `i-empty`, {}))
    expect(buttonLabels(responses[0])).toEqual(gkb(intent, `i-empty`, `inline`, {}))
  })

  it(`shows ID variant for empty state`, async () => {
    await env.mockServer.sendText(`/start`, asUserId)
    env.clearRequests()

    const responsesId = await env.mockServer.sendCallbackQuery(intent, asUserId)
    expect(responsesId[0]!.body?.text).toBe(gmsg(intent, `i-empty`, {}, `id`))
    expect(buttonLabels(responsesId[0])).toEqual(gkb(intent, `i-empty`, `inline`, {}, `id`))
  })

  it(`deletes item via callback button`, async () => {
    // Create an item first
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`create`, asUser)
    env.clearRequests()
    await env.mockServer.sendText(`Delete Me`, asUser)
    env.clearRequests()
    await env.mockServer.sendText(`To be deleted`, asUser)
    env.clearRequests()

    // Navigate to delete page
    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toContain(`Select an item to delete`)

    // Find item button
    const keyboard = edit.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    const deleteButton = keyboard.flat().find((b: any) => b.text?.startsWith(`🗑️`))
    expect(deleteButton).toBeDefined()
    const deleteCallback = deleteButton?.callback_data
    expect(deleteCallback).toBeDefined()
    env.clearRequests()

    // Click delete
    const deleteResponses = await env.mockServer.sendCallbackQuery(deleteCallback!, asUser)
    expect(deleteResponses.length).toBeGreaterThan(0)
    expect(deleteResponses[0]!.body?.text).toContain(`Item deleted`)
  })
})
