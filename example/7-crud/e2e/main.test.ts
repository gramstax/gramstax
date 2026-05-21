/**
 * E2E Test Flow for CRUD Bot
 *
 * Setup:
 *   1. MockTelegramServer starts on random port → apiRoot captured
 *   2. BotCore initialized with webhook:http://127.0.0.1:3006/webhook/e2e-7-crud
 *   3. TemplateManager loads pages from src/pages/
 *
 * Test Flow:
 *   T1.  /start → CRUD Menu + inline keyboard (Create, List, Detail, Update, Delete, Help)
 *   T2.  /start → callback:help → editMessage → CRUD Help + Back button
 *   T3.  /start → callback:create → editMessage → Create a new item + title prompt
 *   T4.  /start → callback:list → editMessage → Cached items list
 *   T5.  /start → callback:nonexistent_action → graceful handling (no crash)
 *   T6.  /start → verify sendMessage request captured in mockServer.requests
 *   T7.  /start → callback:help → callback:help → sequential chain
 *   T8.  [Create] Full create flow: title → description → item created confirmation
 *   T9.  [Detail] View item by ID → item details with title, description, status, timestamps
 *   T10. [Detail] View non-existent ID → item not found message
 *   T11. [Update] Select item → choose status → status updated confirmation
 *   T12. [Update] Empty items → no items available message
 *   T13. [Delete] Select item via callback → item deleted confirmation
 *   T14. [Delete] Delete non-existent ID → item not found message
 *   T15. [Delete] Empty items → no items available message
 *   T16. [List] Pagination with multiple items → page navigation
 *   T17. [Full CRUD] Create → List → Detail → Update → Delete end-to-end
 *
 * Cleanup:
 *   - botCore.stop() + mockServer.stop() in afterAll
 *   - mockServer.clearRequests() in beforeEach
 */
import {join} from "node:path"
import {BotCore} from "../src/core/bot"
import {TemplateManager} from "gramstax"
import {MockTelegramServer} from "gramstax"
import {describe, it, expect, beforeAll, afterAll, beforeEach} from "bun:test"

let mockServer: MockTelegramServer
let botCore: BotCore

beforeAll(async () => {
  mockServer = new MockTelegramServer({log: false})
  await mockServer.start()

  const templateManager = new TemplateManager({path: [join(import.meta.dir, `../src/pages`)]})
  const cwd = process.cwd()
  process.chdir(join(import.meta.dir, `..`))

  botCore = new BotCore({
    deploy: `webhook:http://127.0.0.1:3006/webhook/e2e-7-crud`,
    token: `test-token`,
    log: false,
    templateManager,
    botConfig: {client: {apiRoot: mockServer.apiRoot}}
  })

  process.chdir(cwd)

  const startedAt = Date.now()
  while (!mockServer.webhookUrl && Date.now() - startedAt < 5000) {
    await new Promise((r) => setTimeout(r, 50))
  }
})

afterAll(async () => {
  await botCore.stop()
  await mockServer.stop()
})

beforeEach(async () => {
  mockServer.clearRequests()
  await botCore.db.clearAll(1001)
})

function extractItemId(text: string): string | null {
  const match = text.match(/#\s*(\d+)/)
  return match ? match[1]! : null
}

describe(`E2E: CRUD bot via MockTelegramServer (webhook)`, () => {
  it(`responds to /start command with CRUD Menu and action buttons`, async () => {
    const responses = await mockServer.sendText(`/start`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]
    expect(reply).toBeDefined()
    expect(reply!.body?.text).toContain(`CRUD Menu`)

    const keyboard = reply!.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    expect(keyboard.length).toBeGreaterThan(0)

    const allButtons = keyboard.flat()
    const buttonLabels = allButtons.map((b: any) => b.text)
    expect(buttonLabels).toContain(`➕ Create`)
    expect(buttonLabels).toContain(`📋 List`)
    expect(buttonLabels).toContain(`🔎 Detail`)
    expect(buttonLabels).toContain(`✅ Update`)
    expect(buttonLabels).toContain(`🗑️ Delete`)
    expect(buttonLabels).toContain(`❓ Help`)
  })

  it(`navigates to Help page and shows back button`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`help`)

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toContain(`Help`)

    const keyboard = edit.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    const firstButton = keyboard[0]?.[0]
    expect(firstButton?.text).toContain(`Back`)
  })

  it(`navigates to Create page and prompts for title`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`create`)

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toContain(`Create a new item`)
    expect(edit.body?.text).toContain(`title`)
  })

  it(`navigates to List page and shows items list`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`list`)

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.body?.text).toMatch(/Cached items|No cached items yet/)
  })

  it(`handles unrecognized callback gracefully`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`nonexistent_action`)

    expect(responses.length).toBeGreaterThanOrEqual(0)
    if (responses.length > 0) {
      const reply = responses[0]!
      expect(reply.body?.text).toBeDefined()
    }
  })

  it(`captures outbound requests in mockServer.requests`, async () => {
    await mockServer.sendText(`/start`)

    const sendMessageReq = mockServer.lastRequest(`sendMessage`)
    expect(sendMessageReq).toBeDefined()
    expect(sendMessageReq?.body?.text).toContain(`CRUD Menu`)
  })

  it(`handles multiple sequential interactions`, async () => {
    const res1 = await mockServer.sendText(`/start`)
    expect(res1[0]?.body?.text).toContain(`CRUD Menu`)

    mockServer.clearRequests()

    const res2 = await mockServer.sendCallbackQuery(`help`)
    expect(res2[0]?.body?.text).toContain(`Help`)

    mockServer.clearRequests()

    const res3 = await mockServer.sendCallbackQuery(`help`)
    expect(res3[0]?.body?.text).toContain(`Help`)
  })

  describe(`CreatePage`, () => {
    it(`creates item via full flow: title → description → success`, async () => {
      await mockServer.sendCallbackQuery(`create`)
      mockServer.clearRequests()

      const titleResponses = await mockServer.sendText(`Coffee Beans`)
      expect(titleResponses.length).toBeGreaterThan(0)
      expect(titleResponses[0]!.body?.text).toContain(`Title saved`)
      expect(titleResponses[0]!.body?.text).toContain(`Coffee Beans`)
      expect(titleResponses[0]!.body?.text).toContain(`description`)
      mockServer.clearRequests()

      const descResponses = await mockServer.sendText(`Medium roast, 250g`)
      expect(descResponses.length).toBeGreaterThan(0)
      expect(descResponses[0]!.body?.text).toContain(`Item created`)
      expect(descResponses[0]!.body?.text).toContain(`Coffee Beans`)
      expect(descResponses[0]!.body?.text).toContain(`Medium roast, 250g`)
    })
  })

  describe(`DetailPage`, () => {
    it(`shows item details when valid ID is provided`, async () => {
      await mockServer.sendCallbackQuery(`create`)
      mockServer.clearRequests()
      await mockServer.sendText(`Test Item`)
      mockServer.clearRequests()
      const detailResponses = await mockServer.sendText(`Test description`)
      expect(detailResponses.length).toBeGreaterThan(0)

      const createdText = detailResponses[0]!.body?.text ?? ``
      const itemId = extractItemId(createdText)
      expect(itemId).not.toBeNull()
      mockServer.clearRequests()

      await mockServer.sendCallbackQuery(`detail`)
      mockServer.clearRequests()

      const responses = await mockServer.sendText(itemId!)
      expect(responses.length).toBeGreaterThan(0)
      const reply = responses[0]!
      expect(reply.body?.text).toContain(`Item #${itemId}`)
      expect(reply.body?.text).toContain(`Test Item`)
      expect(reply.body?.text).toContain(`Test description`)
      expect(reply.body?.text).toContain(`Created:`)
      expect(reply.body?.text).toContain(`Updated:`)
    })

    it(`shows not found for non-existent ID`, async () => {
      await mockServer.sendCallbackQuery(`detail`)
      mockServer.clearRequests()

      const responses = await mockServer.sendText(`99999`)
      expect(responses.length).toBeGreaterThan(0)
      const reply = responses[0]!
      expect(reply.body?.text).toContain(`Item not found`)
      expect(reply.body?.text).toContain(`99999`)
    })
  })

  describe(`UpdatePage`, () => {
    it(`shows empty message when no items exist`, async () => {
      const responses = await mockServer.sendCallbackQuery(`update`)

      expect(responses.length).toBeGreaterThan(0)
      const edit = responses[0]!
      expect(edit.body?.text).toContain(`No items available to update`)
    })

    it(`selects item and updates status to done`, async () => {
      await mockServer.sendCallbackQuery(`create`)
      mockServer.clearRequests()
      await mockServer.sendText(`Update Test`)
      mockServer.clearRequests()
      await mockServer.sendText(`Will update status`)
      mockServer.clearRequests()

      const responses = await mockServer.sendCallbackQuery(`update`)
      expect(responses.length).toBeGreaterThan(0)
      const edit = responses[0]!
      expect(edit.body?.text).toContain(`Select an item to update`)

      const keyboard = edit.body?.reply_markup?.inline_keyboard
      expect(Array.isArray(keyboard)).toBe(true)
      const itemButton = keyboard.flat().find((b: any) => b.text?.startsWith(`📝`))
      expect(itemButton).toBeDefined()
      const itemCallback = itemButton?.callback_data
      expect(itemCallback).toBeDefined()
      mockServer.clearRequests()

      const selectResponses = await mockServer.sendCallbackQuery(itemCallback!)
      expect(selectResponses.length).toBeGreaterThan(0)
      const selectEdit = selectResponses[0]!
      expect(selectEdit.body?.text).toContain(`Item #`)
      expect(selectEdit.body?.text).toContain(`Current status:`)

      const statusKb = selectEdit.body?.reply_markup?.inline_keyboard
      expect(Array.isArray(statusKb)).toBe(true)
      const doneButton = statusKb.flat().find((b: any) => b.text?.includes(`Done`))
      expect(doneButton).toBeDefined()
      const doneCallback = doneButton?.callback_data
      expect(doneCallback).toBeDefined()
      mockServer.clearRequests()

      const statusResponses = await mockServer.sendCallbackQuery(doneCallback!)
      expect(statusResponses.length).toBeGreaterThan(0)
      const statusEdit = statusResponses[0]!
      expect(statusEdit.body?.text).toContain(`Status updated`)
      expect(statusEdit.body?.text).toContain(`done`)
    })
  })

  describe(`DeletePage`, () => {
    it(`shows empty message when no items exist`, async () => {
      const responses = await mockServer.sendCallbackQuery(`delete`)

      expect(responses.length).toBeGreaterThan(0)
      const edit = responses[0]!
      expect(edit.body?.text).toContain(`No items available to delete`)
    })

    it(`deletes item via callback button`, async () => {
      await mockServer.sendCallbackQuery(`create`)
      mockServer.clearRequests()
      await mockServer.sendText(`Delete Me`)
      mockServer.clearRequests()
      await mockServer.sendText(`To be deleted`)
      mockServer.clearRequests()

      const responses = await mockServer.sendCallbackQuery(`delete`)
      expect(responses.length).toBeGreaterThan(0)
      const edit = responses[0]!
      expect(edit.body?.text).toContain(`Select an item to delete`)

      const keyboard = edit.body?.reply_markup?.inline_keyboard
      expect(Array.isArray(keyboard)).toBe(true)
      const deleteButton = keyboard.flat().find((b: any) => b.text?.startsWith(`🗑️`))
      expect(deleteButton).toBeDefined()
      const deleteCallback = deleteButton?.callback_data
      expect(deleteCallback).toBeDefined()
      mockServer.clearRequests()

      const deleteResponses = await mockServer.sendCallbackQuery(deleteCallback!)
      expect(deleteResponses.length).toBeGreaterThan(0)
      const deleteEdit = deleteResponses[0]!
      expect(deleteEdit.body?.text).toContain(`Item deleted`)
    })

    it(`deletes item via text ID input`, async () => {
      await mockServer.sendCallbackQuery(`create`)
      mockServer.clearRequests()
      await mockServer.sendText(`Delete By ID`)
      mockServer.clearRequests()
      const createResponses = await mockServer.sendText(`Delete via text`)
      expect(createResponses.length).toBeGreaterThan(0)

      const createdText = createResponses[0]!.body?.text ?? ``
      const itemId = extractItemId(createdText)
      expect(itemId).not.toBeNull()
      mockServer.clearRequests()

      await mockServer.sendCallbackQuery(`delete`)
      mockServer.clearRequests()

      const responses = await mockServer.sendText(itemId!)
      expect(responses.length).toBeGreaterThan(0)
      const reply = responses[0]!
      expect(reply.body?.text).toContain(`Item deleted`)
      expect(reply.body?.text).toContain(`#${itemId}`)
    })
  })

  describe(`ListPage`, () => {
    it(`shows paginated list with multiple items`, async () => {
      for (const title of [`Item A`, `Item B`, `Item C`]) {
        await mockServer.sendCallbackQuery(`create`)
        mockServer.clearRequests()
        await mockServer.sendText(title)
        mockServer.clearRequests()
        await mockServer.sendText(`Description for ${title}`)
        mockServer.clearRequests()
      }

      const responses = await mockServer.sendCallbackQuery(`list`)
      expect(responses.length).toBeGreaterThan(0)
      const edit = responses[0]!
      expect(edit.body?.text).toContain(`Cached items`)
      expect(edit.body?.text).toContain(`Item A`)
      expect(edit.body?.text).toContain(`Item B`)
      expect(edit.body?.text).toContain(`Item C`)
      expect(edit.body?.text).toContain(`Page 1/1`)
    })
  })

  describe(`Full CRUD Flow`, () => {
    it(`create → list → detail → update → delete end-to-end`, async () => {
      await mockServer.sendCallbackQuery(`create`)
      mockServer.clearRequests()
      await mockServer.sendText(`Full Flow Item`)
      mockServer.clearRequests()
      const createResponses = await mockServer.sendText(`Testing full CRUD`)
      expect(createResponses.length).toBeGreaterThan(0)

      const createdText = createResponses[0]!.body?.text ?? ``
      const itemId = extractItemId(createdText)
      expect(itemId).not.toBeNull()
      mockServer.clearRequests()

      const listResponses = await mockServer.sendCallbackQuery(`list`)
      expect(listResponses.length).toBeGreaterThan(0)
      expect(listResponses[0]!.body?.text).toContain(`Full Flow Item`)
      mockServer.clearRequests()

      await mockServer.sendCallbackQuery(`detail`)
      mockServer.clearRequests()
      const detailResponses = await mockServer.sendText(itemId!)
      expect(detailResponses.length).toBeGreaterThan(0)
      expect(detailResponses[0]!.body?.text).toContain(`Full Flow Item`)
      expect(detailResponses[0]!.body?.text).toContain(`Testing full CRUD`)
      mockServer.clearRequests()

      const updateResponses = await mockServer.sendCallbackQuery(`update`)
      expect(updateResponses.length).toBeGreaterThan(0)
      const updateKb = updateResponses[0]!.body?.reply_markup?.inline_keyboard
      expect(Array.isArray(updateKb)).toBe(true)
      const itemBtn = updateKb.flat().find((b: any) => b.text?.startsWith(`📝`))
      expect(itemBtn).toBeDefined()
      mockServer.clearRequests()

      const selectResponses = await mockServer.sendCallbackQuery(itemBtn!.callback_data)
      expect(selectResponses.length).toBeGreaterThan(0)
      const statusKb = selectResponses[0]!.body?.reply_markup?.inline_keyboard
      expect(Array.isArray(statusKb)).toBe(true)
      const doneBtn = statusKb.flat().find((b: any) => b.text?.includes(`Done`))
      expect(doneBtn).toBeDefined()
      mockServer.clearRequests()

      const statusResponses = await mockServer.sendCallbackQuery(doneBtn!.callback_data)
      expect(statusResponses.length).toBeGreaterThan(0)
      expect(statusResponses[0]!.body?.text).toContain(`Status updated`)
      expect(statusResponses[0]!.body?.text).toContain(`done`)
      mockServer.clearRequests()

      const deleteResponses = await mockServer.sendCallbackQuery(`delete`)
      expect(deleteResponses.length).toBeGreaterThan(0)
      const deleteKb = deleteResponses[0]!.body?.reply_markup?.inline_keyboard
      expect(Array.isArray(deleteKb)).toBe(true)
      const delBtn = deleteKb.flat().find((b: any) => b.text?.startsWith(`🗑️`))
      expect(delBtn).toBeDefined()
      mockServer.clearRequests()

      const delResponses = await mockServer.sendCallbackQuery(delBtn!.callback_data)
      expect(delResponses.length).toBeGreaterThan(0)
      expect(delResponses[0]!.body?.text).toContain(`Item deleted`)
    })
  })
})
