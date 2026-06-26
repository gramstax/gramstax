import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, resetDb, type TestEnvironment, gmsg, gkb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `list`
const asUser = {user: {id: 741}, chat: {id: 741}}
const asUserId = {user: {id: 742, language_code: `id`}, chat: {id: 742}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(async () => {
  env.clearRequests()
  await resetDb(asUser.user.id)
})

describe(`E2E: ListPage`, () => {
  it(`shows empty state when no items exist`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `i-empty`, {}))
    expect(buttonLabels(responses[0])).toEqual(gkb(intent, `i-empty`, `inline`, {}))
  })

  it(`shows items after creating some`, async () => {
    // Create items first
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`create`, asUser)
    env.clearRequests()
    await env.mockServer.sendText(`Item A`, asUser)
    env.clearRequests()
    await env.mockServer.sendText(`Description A`, asUser)
    env.clearRequests()

    await env.mockServer.sendCallbackQuery(`create`, asUser)
    env.clearRequests()
    await env.mockServer.sendText(`Item B`, asUser)
    env.clearRequests()
    await env.mockServer.sendText(`Description B`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toContain(`Cached items`)
    expect(responses[0]!.body?.text).toContain(`Item A`)
    expect(responses[0]!.body?.text).toContain(`Item B`)
    expect(responses[0]!.body?.text).toContain(`Page 1/1`)
  })

  it(`shows ID variant for empty state`, async () => {
    await env.mockServer.sendText(`/start`, asUserId)
    env.clearRequests()

    const responsesId = await env.mockServer.sendCallbackQuery(intent, asUserId)
    expect(responsesId[0]!.body?.text).toBe(gmsg(intent, `i-empty`, {}, `id`))
    expect(buttonLabels(responsesId[0])).toEqual(gkb(intent, `i-empty`, `inline`, {}, `id`))
  })
})
