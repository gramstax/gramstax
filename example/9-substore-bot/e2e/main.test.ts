/**
 * E2E Test Flow for SubStore Bot
 *
 * Setup:
 *   1. MockTelegramServer starts on random port → apiRoot captured
 *   2. BotCore initialized with webhook:http://127.0.0.1:3008/webhook/e2e-9-substore-bot
 *   3. TemplateManager loads pages from src/pages/
 *
 * Test Flow:
 *   T1.  /start → SubStore Bot + inline keyboard (Browse Products, Cart, History, Help)
 *   T2.  /start → callback:help → editMessage → Store Help + Browse Products + Home buttons
 *   T3.  /start → callback:catalog:s1:page:0 → editMessage → Subscription Catalog + products available + pagination keyboard
 *   T4.  /unknown → Action not found
 *   T5.  /start → verify sendMessage request captured in mockServer.requests
 *   T6.  /start → callback:help → text:gibberish → Action not found (sequential chain)
 *   T7.  [Product] View product detail → name, price, stock, benefits + Buy Now/Add Cart buttons
 *   T8.  [Product] Add to cart → Added to cart confirmation
 *   T9.  [Product] Out of stock product → Out of stock warning
 *   T10. [Cart] View cart with items → items list + subtotal + inc/dec/remove/checkout buttons
 *   T11. [Cart] Increase item quantity → updated cart
 *   T12. [Cart] Decrease item quantity → updated cart
 *   T13. [Cart] Remove item → updated cart
 *   T14. [Cart] Clear cart → Cart cleared confirmation
 *   T15. [Cart] Empty cart → Empty cart message
 *   T16. [Checkout] Empty cart → Empty cart warning
 *   T17. [Checkout] Contact input → Confirm order screen with items, subtotal, contact, notes
 *   T18. [Checkout] Confirm purchase → QRIS image (editPhoto) + order details
 *   T19. [Checkout] Cancel checkout → Checkout cancelled message
 *   T20. [History] View order history after purchase → order list with status
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
    deploy: `webhook:http://127.0.0.1:3008/webhook/e2e-9-substore-bot`,
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
  await botCore.cacheState.clear()
})

describe(`E2E: SubStore Bot via MockTelegramServer (webhook)`, () => {
  it(`responds to /start command with SubStore Bot welcome and navigation`, async () => {
    const responses = await mockServer.sendText(`/start`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]
    expect(reply).toBeDefined()
    expect(reply!.body?.text).toContain(`SubStore Bot`)

    const keyboard = reply!.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    expect(keyboard.length).toBeGreaterThan(0)

    const allButtons = keyboard.flat()
    const buttonLabels = allButtons.map((b: any) => b.text)
    expect(buttonLabels).toContain(`🔎 Browse Products`)
    expect(buttonLabels).toContain(`🛒 Cart`)
    expect(buttonLabels).toContain(`🧾 History`)
    expect(buttonLabels).toContain(`❓ Help`)
  })

  it(`navigates to Help page and shows back button`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`help`)

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]
    expect(edit!.body?.text).toContain(`Help`)

    const keyboard = edit!.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    const allButtons = keyboard.flat()
    const buttonLabels = allButtons.map((b: any) => b.text)
    expect(buttonLabels).toContain(`🔎 Browse Products`)
    expect(buttonLabels).toContain(`🏠 Home`)
  })

  it(`navigates to Catalog page and shows product listing`, async () => {
    await mockServer.sendText(`/start`)
    mockServer.clearRequests()

    const responses = await mockServer.sendCallbackQuery(`catalog:s1:page:0`)

    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]
    expect(edit!.body?.text).toContain(`Subscription Catalog`)
    expect(edit!.body?.text).toContain(`products available`)

    const keyboard = edit!.body?.reply_markup?.inline_keyboard
    expect(Array.isArray(keyboard)).toBe(true)
    expect(keyboard.length).toBeGreaterThan(0)
  })

  it(`shows route not found for unrecognized input`, async () => {
    const responses = await mockServer.sendText(`/unknown`)

    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]
    expect(reply).toBeDefined()
    expect(reply!.body?.text).toContain(`Action not found`)
  })

  it(`captures outbound requests in mockServer.requests`, async () => {
    await mockServer.sendText(`/start`)

    const sendMessageReq = mockServer.lastRequest(`sendMessage`)
    expect(sendMessageReq).toBeDefined()
    expect(sendMessageReq?.body?.text).toContain(`SubStore Bot`)
  })

  it(`handles multiple sequential interactions`, async () => {
    const res1 = await mockServer.sendText(`/start`)
    expect(res1[0]?.body?.text).toContain(`SubStore Bot`)

    mockServer.clearRequests()

    const res2 = await mockServer.sendCallbackQuery(`help`)
    expect(res2[0]?.body?.text).toContain(`Help`)

    mockServer.clearRequests()

    const res3 = await mockServer.sendText(`gibberish`)
    expect(res3[0]?.body?.text).toContain(`Action not found`)
  })

  describe(`ProductPage`, () => {
    it(`shows product detail with name, price, stock and action buttons`, async () => {
      await mockServer.sendCallbackQuery(`catalog:s1:page:0`)
      mockServer.clearRequests()

      const responses = await mockServer.sendCallbackQuery(`product:detail:netflix-premium-1m`)

      expect(responses.length).toBeGreaterThan(0)
      const edit = responses[0]!
      expect(edit.body?.text).toContain(`Netflix Premium`)
      expect(edit.body?.text).toContain(`Service: Netflix`)
      expect(edit.body?.text).toContain(`Duration: 1 month`)
      expect(edit.body?.text).toContain(`Price: Rp 79.000`)
      expect(edit.body?.text).toContain(`12 available`)

      const keyboard = edit.body?.reply_markup?.inline_keyboard
      expect(Array.isArray(keyboard)).toBe(true)
      const buttonLabels = keyboard.flat().map((b: any) => b.text)
      expect(buttonLabels).toContain(`✅ Buy Now`)
      expect(buttonLabels).toContain(`➕ Add Cart`)
    })

    it(`adds product to cart and shows confirmation`, async () => {
      await mockServer.sendCallbackQuery(`catalog:s1:page:0`)
      mockServer.clearRequests()

      await mockServer.sendCallbackQuery(`product:detail:spotify-family-1m`)
      mockServer.clearRequests()

      const responses = await mockServer.sendCallbackQuery(`product:add:spotify-family-1m`)

      expect(responses.length).toBeGreaterThan(0)
      const edit = responses[0]!
      expect(edit.body?.text).toContain(`Added to cart`)
      expect(edit.body?.text).toContain(`Spotify Family`)
    })

    it(`shows out of stock warning for unavailable product`, async () => {
      await mockServer.sendCallbackQuery(`catalog:s1:page:0`)
      mockServer.clearRequests()

      await mockServer.sendCallbackQuery(`product:detail:disney-family-1m`)
      mockServer.clearRequests()

      const responses = await mockServer.sendCallbackQuery(`product:buy:disney-family-1m`)

      expect(responses.length).toBeGreaterThan(0)
      const edit = responses[0]!
      expect(edit.body?.text).toContain(`Out of stock`)
    })
  })

  describe(`CartPage`, () => {
    it(`shows cart with items, subtotal and action buttons`, async () => {
      await botCore.cacheState.set(`1001:cart`, {"netflix-premium-1m": 1, "spotify-family-1m": 2})

      const responses = await mockServer.sendCallbackQuery(`cart`)

      expect(responses.length).toBeGreaterThan(0)
      const edit = responses[0]!
      expect(edit.body?.text).toContain(`Your Cart`)
      expect(edit.body?.text).toContain(`Netflix Premium`)
      expect(edit.body?.text).toContain(`Spotify Family`)
      expect(edit.body?.text).toContain(`Subtotal:`)

      const keyboard = edit.body?.reply_markup?.inline_keyboard
      expect(Array.isArray(keyboard)).toBe(true)
      const buttonLabels = keyboard.flat().map((b: any) => b.text)
      expect(buttonLabels.some((l: string) => l.startsWith(`➕`))).toBe(true)
      expect(buttonLabels).toContain(`➖`)
      expect(buttonLabels).toContain(`🗑️ Remove`)
      expect(buttonLabels).toContain(`💳 Checkout`)
      expect(buttonLabels).toContain(`🧹 Clear`)
    })

    it(`shows empty cart message when no items`, async () => {
      await botCore.cacheState.set(`1001:cart`, {})

      const responses = await mockServer.sendCallbackQuery(`cart`)

      expect(responses.length).toBeGreaterThan(0)
      const edit = responses[0]!
      expect(edit.body?.text).toContain(`Your Cart is Empty`)

      const keyboard = edit.body?.reply_markup?.inline_keyboard
      expect(Array.isArray(keyboard)).toBe(true)
      const buttonLabels = keyboard.flat().map((b: any) => b.text)
      expect(buttonLabels).toContain(`🔎 Browse Products`)
      expect(buttonLabels).toContain(`🏠 Home`)
    })

    it(`increases item quantity in cart`, async () => {
      await botCore.cacheState.set(`1001:cart`, {"netflix-premium-1m": 1})

      const responses = await mockServer.sendCallbackQuery(`cart:s1:inc:netflix-premium-1m`)

      expect(responses.length).toBeGreaterThan(0)
      const edit = responses[0]!
      expect(edit.body?.text).toContain(`Your Cart`)
      expect(edit.body?.text).toContain(`Rp 158.000`)
    })

    it(`removes item from cart`, async () => {
      await botCore.cacheState.set(`1001:cart`, {"netflix-premium-1m": 1, "spotify-family-1m": 1})

      const responses = await mockServer.sendCallbackQuery(`cart:s1:remove:netflix-premium-1m`)

      expect(responses.length).toBeGreaterThan(0)
      const edit = responses[0]!
      expect(edit.body?.text).toContain(`Your Cart`)
      expect(edit.body?.text).toContain(`Spotify Family`)
      expect(edit.body?.text).not.toContain(`Netflix Premium`)
    })

    it(`clears cart and shows cleared confirmation`, async () => {
      await botCore.cacheState.set(`1001:cart`, {"netflix-premium-1m": 1})

      const responses = await mockServer.sendCallbackQuery(`cart:s1:clear`)

      expect(responses.length).toBeGreaterThan(0)
      const edit = responses[0]!
      expect(edit.body?.text).toContain(`Cart cleared`)
      expect(edit.body?.text).toContain(`Your cart is empty now`)
    })
  })

  describe(`CheckoutPage`, () => {
    it(`shows empty cart warning when cart is empty`, async () => {
      await botCore.cacheState.set(`1001:cart`, {})

      const responses = await mockServer.sendCallbackQuery(`checkout`)

      expect(responses.length).toBeGreaterThan(0)
      const edit = responses[0]!
      expect(edit.body?.text).toContain(`Empty cart`)
      expect(edit.body?.text).toContain(`Add at least one available subscription`)
    })

    it(`shows contact input form with cart summary`, async () => {
      await botCore.cacheState.set(`1001:cart`, {"netflix-premium-1m": 1})

      const responses = await mockServer.sendCallbackQuery(`checkout`)

      expect(responses.length).toBeGreaterThan(0)
      const edit = responses[0]!
      expect(edit.body?.text).toContain(`Checkout Details`)
      expect(edit.body?.text).toContain(`Netflix Premium`)
      expect(edit.body?.text).toContain(`Subtotal: Rp 79.000`)
      expect(edit.body?.text).toContain(`Send your contact`)
    })

    it(`shows confirm order screen after valid contact input`, async () => {
      await botCore.cacheState.set(`1001:cart`, {"netflix-premium-1m": 1})
      await mockServer.sendCallbackQuery(`checkout`)
      mockServer.clearRequests()

      const responses = await mockServer.sendText(`@testuser\nPlease deliver ASAP`)

      expect(responses.length).toBeGreaterThan(0)
      const reply = responses[0]!
      expect(reply.body?.text).toContain(`Confirm Order`)
      expect(reply.body?.text).toContain(`Netflix Premium`)
      expect(reply.body?.text).toContain(`Contact: @testuser`)
      expect(reply.body?.text).toContain(`Notes: Please deliver ASAP`)

      const keyboard = reply.body?.reply_markup?.inline_keyboard
      expect(Array.isArray(keyboard)).toBe(true)
      const buttonLabels = keyboard.flat().map((b: any) => b.text)
      expect(buttonLabels).toContain(`✅ Confirm`)
      expect(buttonLabels).toContain(`❌ Cancel`)
    })

    it(`rejects invalid contact and asks again`, async () => {
      await botCore.cacheState.set(`1001:cart`, {"netflix-premium-1m": 1})
      await mockServer.sendCallbackQuery(`checkout`)
      mockServer.clearRequests()

      const responses = await mockServer.sendText(`ab`)

      expect(responses.length).toBeGreaterThan(0)
      const reply = responses[0]!
      expect(reply.body?.text).toContain(`Contact needed`)
      expect(reply.body?.text).toContain(`ab`)
    })

    it(`confirms purchase and receives QRIS image with order details`, async () => {
      await botCore.cacheState.set(`1001:cart`, {"netflix-premium-1m": 1})

      await mockServer.sendCallbackQuery(`checkout`)
      mockServer.clearRequests()

      await mockServer.sendText(`@testuser\nDeliver after payment`)
      mockServer.clearRequests()

      const responses = await mockServer.sendCallbackQuery(`checkout:confirm`, {responseTimeoutMs: 3000})

      expect(responses.length).toBeGreaterThan(0)

      const photoResponse = responses.find((r) => r.method === `editMessageMedia`)
      expect(photoResponse).toBeDefined()
      expect(photoResponse!.body?.media?.type).toBe(`photo`)
      const caption = photoResponse!.body?.media?.caption ?? ``
      expect(String(caption)).toContain(`Order Created`)
      expect(String(caption)).toContain(`Order ID: SUB-`)
      expect(String(caption)).toContain(`Status: ⏳ Pending`)
      expect(String(caption)).toContain(`Payment Method: QRIS`)
      expect(String(caption)).toContain(`Netflix Premium`)
      expect(String(caption)).toContain(`Total: Rp 79.000`)
      expect(String(caption)).toContain(`Contact: @testuser`)
      expect(String(caption)).toContain(`Deliver after payment`)
      const mediaSrc = photoResponse!.body?.media?.media ?? ``
      expect(String(mediaSrc)).toContain(`qrserver.com`)

      const keyboard = photoResponse!.body?.reply_markup?.inline_keyboard
      expect(Array.isArray(keyboard)).toBe(true)
      const buttonLabels = keyboard.flat().map((b: any) => b.text)
      expect(buttonLabels).toContain(`🔄 refresh`)
      expect(buttonLabels).toContain(`🧾 History`)
      expect(buttonLabels).toContain(`🏠 Home`)
      expect(buttonLabels).toContain(`🔎 Browse Products`)
    })

    it(`cancels checkout and preserves cart`, async () => {
      await botCore.cacheState.set(`1001:cart`, {"netflix-premium-1m": 1})
      await mockServer.sendCallbackQuery(`checkout`)
      mockServer.clearRequests()

      await mockServer.sendText(`@testuser`)
      mockServer.clearRequests()

      const responses = await mockServer.sendCallbackQuery(`checkout:cancel`, {responseTimeoutMs: 3000})

      expect(responses.length).toBeGreaterThan(0)
      const edit = responses[0]!
      expect(edit.body?.text).toContain(`Checkout cancelled`)
      expect(edit.body?.text).toContain(`Your cart is preserved`)
    })
  })

  describe(`HistoryPage`, () => {
    it(`shows order history after purchase`, async () => {
      await botCore.cacheState.set(`1001:cart`, {"netflix-premium-1m": 1})
      await mockServer.sendCallbackQuery(`checkout`)
      mockServer.clearRequests()

      await mockServer.sendText(`@testuser`)
      mockServer.clearRequests()

      await mockServer.sendCallbackQuery(`checkout:confirm`, {responseTimeoutMs: 3000})
      mockServer.clearRequests()

      const responses = await mockServer.sendCallbackQuery(`history`)

      expect(responses.length).toBeGreaterThan(0)
      const edit = responses[0]!
      expect(edit.body?.text).toContain(`Order History`)
      expect(edit.body?.text).toContain(`SUB-`)
      expect(edit.body?.text).toContain(`Rp 79.000`)
      expect(edit.body?.text).toContain(`QRIS`)
      expect(edit.body?.text).toContain(`Pending`)
    })

    it(`shows no orders yet for new user`, async () => {
      await botCore.cacheState.set(`1001:orders`, [])

      const responses = await mockServer.sendCallbackQuery(`history`)

      expect(responses.length).toBeGreaterThan(0)
      const edit = responses[0]!
      expect(edit.body?.text).toContain(`Order History`)
      expect(edit.body?.text).toContain(`No orders yet`)
    })
  })
})
