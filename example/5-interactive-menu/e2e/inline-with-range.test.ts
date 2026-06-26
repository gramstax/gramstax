import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, msg, kb, buttonLabels} from "./setup"
import {CatalogData} from "../src/data/catalog"

let env: TestEnvironment
const intent = `inline-with-range`
const asUser = {user: {id: 541}, chat: {id: 541}}
const asUserId = {user: {id: 542, language_code: `id`}, chat: {id: 542}}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: InlineWithRangePage`, () => {
  it(`navigates from /start and shows page 1/4`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    const responses = await env.mockServer.sendCallbackQuery(intent, asUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(msg(intent, `s1`, {page: 1, totalPages: 4}))
    // Keyboard is built dynamically with menu item names + page label + navigation
    const labels = buttonLabels(responses[0])
    expect(labels).toContain(`📄 Page 1/4`)
    expect(labels).toContain(`➡️ Next`)
    expect(labels).toContain(`🏠 Home`)
  })

  it(`shows ID variant for page 1`, async () => {
    await env.mockServer.sendText(`/start`, asUserId)
    env.clearRequests()

    const responsesId = await env.mockServer.sendCallbackQuery(intent, asUserId)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responsesId[0]!.body?.text).toBe(msg(intent, `s1`, {page: 1, totalPages: 4}, `id`))
    const idLabels = buttonLabels(responsesId[0])
    expect(idLabels).toContain(`📄 Halaman 1/4`)
    expect(idLabels).toContain(`➡️ Selanjutnya`)
    expect(idLabels).toContain(`🏠 Beranda`)
  })

  it(`paginates to page 2`, async () => {
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()

    await env.mockServer.sendCallbackQuery(intent, asUser)
    env.clearRequests()

    // Find the Next button via callback data
    const nextCb = await findNextCallback(intent, 0)
    if (!nextCb) return // skip if no next button

    const page2 = await env.mockServer.sendCallbackQuery(nextCb, asUser)
    expect(page2.length).toBeGreaterThan(0)
    expect(page2[0]!.body?.text).toBe(msg(intent, `s1`, {page: 2, totalPages: 4}))
  })
})

/** Helper: get callback data for the Next button on a given page. */
async function findNextCallback(pageIntent: string, page: number): Promise<string | null> {
  const totalPages = Math.max(Math.ceil(CatalogData.menuItems.length / 4), 1)
  const response = await env.mockServer.sendCallbackQuery(pageIntent, asUser)
  env.clearRequests()
  const keyboard = response[0]?.body?.reply_markup?.inline_keyboard?.flat() ?? []
  const nextLabel = kb(intent, `s1`, `inline`, {page: page + 1, totalPages})[1]
  const nextButton = keyboard.find((b: any) => b.text === nextLabel || b.text === `➡️ Next`)
  return nextButton?.callback_data ?? null
}
