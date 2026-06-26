import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, msg, buttonLabels} from "./setup"

let env: TestEnvironment
const intent = `inline-without-range`
const asUser = {user: {id: 551}, chat: {id: 551}}
const asUserId = {user: {id: 552, language_code: `id`}, chat: {id: 552}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: InlineWithoutRangePage`, () => {
  it(`navigates from /start and shows page 1`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `s1`, {page: 1}))
    // Keyboard is built dynamically with menu item names + page label + navigation
    const labels = buttonLabels(responses[0])
    expect(labels).toContain(`📄 Page 1`)
    expect(labels).toContain(`➡️ Next`)
    expect(labels).toContain(`🏠 Home`)
  })

  it(`shows ID variant for page 1`, async () => {
    await env.mockServer.sendText(`/start`, asUserId)
    env.clearRequests()

    const responsesId = await env.mockServer.sendCallbackQuery(intent, asUserId)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responsesId[0]!.body?.text).toBe(msg(intent, `s1`, {page: 1}, `id`))
    const idLabels = buttonLabels(responsesId[0])
    expect(idLabels).toContain(`📄 Halaman 1`)
    expect(idLabels).toContain(`➡️ Selanjutnya`)
    expect(idLabels).toContain(`🏠 Beranda`)
  })
})
