import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, gmsg, gkb, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `create`
const asUser = {user: {id: 731}, chat: {id: 731}}
const asUserId = {user: {id: 732, language_code: `id`}, chat: {id: 732}}

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

describe(`E2E: CreatePage`, () => {
  it(`shows create form on callback`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `s1`, {}))
    expect(buttonLabels(responses[0])).toEqual(gkb(intent, `s1`, `inline`, {}))
  })

  it(`creates item via full flow: title → description → success`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()
    await env.mockServer.sendCallbackQuery(intent, asUser)
    env.clearRequests()

    // Step 1: send title
    const titleResponses = await env.mockServer.sendText(`Coffee Beans`, asUser)
    expect(titleResponses.length).toBeGreaterThan(0)
    expect(titleResponses[0]!.body?.text).toBe(gmsg(intent, `s2`, {title: `Coffee Beans`}))

    env.clearRequests()

    // Step 2: send description
    const descResponses = await env.mockServer.sendText(`Medium roast, 250g`, asUser)
    expect(descResponses.length).toBeGreaterThan(0)
    const createdText = descResponses[0]!.body?.text ?? ``
    expect(createdText).toContain(`Item created`)
    expect(createdText).toContain(`Coffee Beans`)
    expect(createdText).toContain(`Medium roast, 250g`)
    expect(extractItemId(createdText)).not.toBeNull()
  })

  it(`shows ID variant for form and success`, async () => {
    await env.mockServer.sendText(`/start`, asUserId)
    env.clearRequests()
    const formResponses = await env.mockServer.sendCallbackQuery(intent, asUserId)
    expect(formResponses[0]!.body?.text).toBe(gmsg(intent, `s1`, {}, `id`))
    expect(buttonLabels(formResponses[0])).toEqual(gkb(intent, `s1`, `inline`, {}, `id`))

    env.clearRequests()

    const titleResponses = await env.mockServer.sendText(`Barang Tes`, asUserId)
    expect(titleResponses[0]!.body?.text).toBe(gmsg(intent, `s2`, {title: `Barang Tes`}, `id`))
  })
})
