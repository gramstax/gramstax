import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, resetEnv, type TestEnvironment, ADMIN_USER, ADMIN_CHAT} from "./setup"

let env: TestEnvironment
const intent = `broadcast`
const regularUser = {user: {id: 1001, language_code: `en`}, chat: {id: 1001}}
const adminUser = {user: ADMIN_USER, chat: ADMIN_CHAT}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(async () => {
  await resetEnv()
})

describe(`E2E: BroadcastPage`, () => {
  it(`blocks non-admin users from accessing broadcast`, async () => {
    const responses = await env.mockServer.sendCallbackQuery(intent, regularUser)
    expect(responses.length).toBe(0)
  })

  it(`admin accesses broadcast form`, async () => {
    const responses = await env.mockServer.sendCallbackQuery(intent, adminUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Broadcast Message`)
    expect(responses[0]!.body?.text).toContain(`Current draft:`)
  })

  it(`admin sends text draft and gets confirm screen`, async () => {
    await env.mockServer.sendCallbackQuery(intent, adminUser)
    env.clearRequests()

    const responses = await env.mockServer.sendText(`Hello subscribers!`, adminUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Confirm broadcast text`)
    expect(responses[0]!.body?.text).toContain(`Hello subscribers!`)
  })

  it(`admin confirms send and gets success`, async () => {
    await env.mockServer.sendCallbackQuery(intent, adminUser)
    env.clearRequests()

    // Send text to create draft
    const confirmResponses = await env.mockServer.sendText(`Test broadcast message`, adminUser)
    expect(confirmResponses.length).toBeGreaterThan(0)
    expect(confirmResponses[0]!.body?.text).toContain(`Confirm broadcast text`)

    // Find the Send button
    const keyboard = confirmResponses[0]?.body?.reply_markup?.inline_keyboard
    const sendButton = keyboard?.flat().find((b: any) => b.text?.includes(`Send`))
    expect(sendButton?.callback_data).toBeDefined()

    env.clearRequests()

    // Click Send
    const responses = await env.mockServer.sendCallbackQuery(sendButton!.callback_data!, adminUser)
    expect(responses.length).toBeGreaterThan(0)
    const editReply = responses.find((r: any) => r.method === `editMessageText`)
    expect(editReply).toBeDefined()
    expect(editReply!.body?.text).toContain(`Broadcast sent`)
  })

  it(`admin cancels broadcast`, async () => {
    await env.mockServer.sendCallbackQuery(intent, adminUser)
    env.clearRequests()
    await env.mockServer.sendText(`Draft to cancel`, adminUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(`broadcast:s1:cancel`, adminUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Broadcast cancelled`)
  })
})
