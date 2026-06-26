import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, msg} from "./setup"

let env: TestEnvironment
const intent = `detail`
const asUser = {user: {id: 751}, chat: {id: 751}}

function extractItemId(text: string): string | null {
  const match = text.match(/#\s*(\d+)/)
  return match ? match[1]! : null
}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: DetailPage`, () => {
  it(`shows item details when valid ID is provided`, async () => {
    // Create an item first
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(`create`, asUser)
    env.clearRequests()
    await env.mockServer.sendText(`Test Item`, asUser)
    env.clearRequests()
    const createResponses = await env.mockServer.sendText(`Test description`, asUser)
    const createdText = createResponses[0]!.body?.text ?? ``
    const itemId = extractItemId(createdText)
    expect(itemId).not.toBeNull()
    env.clearRequests()

    // Navigate to detail form
    await env.mockServer.sendCallbackQuery(intent, asUser)
    env.clearRequests()

    // Send item ID
    const responses = await env.mockServer.sendText(itemId!, asUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply.body?.text).toContain(`Item #${itemId}`)
    expect(reply.body?.text).toContain(`Test Item`)
    expect(reply.body?.text).toContain(`Test description`)
  })

  it(`shows not found for non-existent ID`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendText(`99999`, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `i-notfound`, {id: `99999`}))
  })
})
