import {describe, it, expect, beforeAll, beforeEach} from "bun:test"
import {getEnv, type TestEnvironment, msg, kb, buttonLabels} from "./setup"
import {CatalogData} from "../src/data/catalog"
import {ItemDetailPage} from "../src/pages/item-detail"

let env: TestEnvironment
const intent = `item-detail`
const asUser = {user: {id: 581}, chat: {id: 581}}
const asUserId = {user: {id: 582, language_code: `id`}, chat: {id: 582}}

function getButtonByText(buttons: any[], text: string) {
  return buttons.find((b: any) => b.text === text)
}

beforeAll(async () => {
  env = await getEnv()
})

beforeEach(() => {
  env.clearRequests()
})

describe(`E2E: ItemDetailPage`, () => {
  it(`navigates from category through item list to item detail`, async () => {
    const category = CatalogData.list[0]!
    const item = category.items[0]!

    // Navigate to category
    await env.mockServer.sendText(`/start`, asUser)
    env.clearRequests()
    const catResponses = await env.mockServer.sendCallbackQuery(`category`, asUser)
    const catButton = getButtonByText(
      catResponses[0]?.body?.reply_markup?.inline_keyboard?.flat() ?? [],
      category.name,
    )
    expect(catButton?.callback_data).toBeDefined()

    env.clearRequests()

    // Navigate to item list
    const itemListResponses = await env.mockServer.sendCallbackQuery(catButton!.callback_data!, asUser)
    const detailCallback = ItemDetailPage.data.callbackData(`detail`, category.id, item.id)

    const detailButton = getButtonByText(
      itemListResponses[0]?.body?.reply_markup?.inline_keyboard?.flat() ?? [],
      item.name,
    )
    expect(detailButton?.callback_data).toBe(detailCallback)

    env.clearRequests()

    // Navigate to item detail
    const detailResponses = await env.mockServer.sendCallbackQuery(detailCallback, asUser)
    expect(detailResponses.length).toBeGreaterThan(0)
    expect(detailResponses[0]!.body?.text).toBe(msg(intent, `s1`, {name: item.name, description: item.description}))
    expect(buttonLabels(detailResponses[0])).toEqual(kb(intent, `s1`, `inline`, {name: item.name, description: item.description}))
  })

  it(`shows ID variant for item detail`, async () => {
    const category = CatalogData.list[0]!
    const item = category.items[0]!

    await env.mockServer.sendText(`/start`, asUserId)
    env.clearRequests()
    const catResponses = await env.mockServer.sendCallbackQuery(`category`, asUserId)
    const catButton = getButtonByText(
      catResponses[0]?.body?.reply_markup?.inline_keyboard?.flat() ?? [],
      category.name,
    )
    env.clearRequests()

    await env.mockServer.sendCallbackQuery(catButton!.callback_data!, asUserId)
    env.clearRequests()

    const detailCallback = ItemDetailPage.data.callbackData(`detail`, category.id, item.id)
    const detailResponses = await env.mockServer.sendCallbackQuery(detailCallback, asUserId)
    expect(detailResponses.length).toBeGreaterThan(0)
    expect(detailResponses[0]!.body?.text).toBe(
      msg(intent, `s1`, {name: item.name, description: item.description}, `id`),
    )
    expect(buttonLabels(detailResponses[0])).toEqual(
      kb(intent, `s1`, `inline`, {name: item.name, description: item.description}, `id`),
    )
  })
})
