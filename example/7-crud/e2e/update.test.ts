import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, resetDb, type TestEnvironment, msg, kb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `update`
const asUser = {user: {id: 761}, chat: {id: 761}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(async () => {
  env.clearRequests()
  await resetDb(asUser.user.id)
})

describe(`E2E: UpdatePage`, () => {
  it(`shows empty message when no items exist`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `i-empty`, {}))
    expect(buttonLabels(responses[0])).toEqual(kb(intent, `i-empty`, `inline`, {}))
  })

  it(`selects item and updates status to done`, async () => {
    // Create an item first
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`create`, asUser)
    env.clearRequests()
    await env.mockServer.sendText(`Update Test`, asUser)
    env.clearRequests()
    await env.mockServer.sendText(`Will update status`, asUser)
    env.clearRequests()

    // Navigate to update page
    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toContain(`Select an item to update`)

    // Find the item button
    const keyboard = edit.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    const itemButton = keyboard.flat().find((b: any) => b.text?.startsWith(`📝`))
    expect(itemButton).toBeDefined()
    const itemCallback = itemButton?.callback_data
    expect(itemCallback).toBeDefined()
    env.clearRequests()

    // Click the item to see status options
    const selectResponses = await env.mockServer.sendCallbackQuery(itemCallback!, asUser)
    expect(selectResponses.length).toBeGreaterThan(0)
    expect(selectResponses[0]!.body?.text).toContain(`Current status:`)

    // Find the Done button
    const statusKb = selectResponses[0]!.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(statusKb)).toBe(true)
    const doneButton = statusKb.flat().find((b: any) => b.text?.includes(`Done`))
    expect(doneButton).toBeDefined()
    const doneCallback = doneButton?.callback_data
    expect(doneCallback).toBeDefined()
    env.clearRequests()

    // Click Done
    const statusResponses = await env.mockServer.sendCallbackQuery(doneCallback!, asUser)
    expect(statusResponses.length).toBeGreaterThan(0)
    expect(statusResponses[0]!.body?.text).toContain(`Status updated`)
    expect(statusResponses[0]!.body?.text).toContain(`done`)
  })
})
