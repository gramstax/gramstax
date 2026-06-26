import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, gmsg, buttonLabels} from "./setup"
import {CatalogData} from "../src/data/catalog"

let env: TestEnvironment
const intent = `item-list`
const asUser = {user: {id: 571}, chat: {id: 571}}
const asUserId = {user: {id: 572, language_code: `id`}, chat: {id: 572}}

function getButtonByText(buttons: any[], text: string) {
  return buttons.find((b: any) => b.text === text)
}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: ItemListPage`, () => {
  it(`navigates from category to item list and shows items`, async () => {
    const category = CatalogData.list[0]!

    // Navigate to category page
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()
    const catResponses = await env.mockServer.sendCallbackQuery(`category`, asUser)

    // Find Tools button and get its callback
    const catButton = getButtonByText(catResponses[0]?.body?.reply_markup?.inline_keyboard?.flat() ?? [], category.name)
    expect(catButton?.callback_data).toBeDefined()

    env.clearRequests()

    // Click the category → should navigate to ItemListPage
    const itemResponses = await env.mockServer.sendCallbackQuery(catButton!.callback_data!, asUser)
    expect(itemResponses.length).toBeGreaterThan(0)
    expect(itemResponses[0]!.body?.text).toBe(gmsg(intent, `s1`, {category: category.name}))
    // Keyboard should have category items + Prev/Next/Back
    const itemLabels = buttonLabels(itemResponses[0])
    expect(itemLabels).toContain(category.items[0]!.name)
    expect(itemLabels).toContain(category.items[1]!.name)
    expect(itemLabels).toContain(category.items[2]!.name)
  })

  it(`shows ID variant for item list`, async () => {
    const category = CatalogData.list[0]!

    await env.mockServer.sendText(`/start`, asUserId)
    env.clearRequests()
    const catResponses = await env.mockServer.sendCallbackQuery(`category`, asUserId)
    const catButton = getButtonByText(catResponses[0]?.body?.reply_markup?.inline_keyboard?.flat() ?? [], category.name)
    expect(catButton?.callback_data).toBeDefined()

    env.clearRequests()

    const itemResponses = await env.mockServer.sendCallbackQuery(catButton!.callback_data!, asUserId)
    expect(itemResponses.length).toBeGreaterThan(0)
    expect(itemResponses[0]!.body?.text).toBe(gmsg(intent, `s1`, {category: category.name}, `id`))
  })
})
