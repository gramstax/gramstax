import {describe, expect, it} from "bun:test"
import {readFileSync} from "node:fs"
import {join} from "node:path"
import {CartStore, OrderHistoryStore, OrderStore, ProductCatalog} from "../src/data/store"

describe(`ProductCatalog`, () => {
  it(`paginates subscription products with safe page bounds`, () => {
    const first = ProductCatalog.getPage(0)
    const second = ProductCatalog.getPage(1)
    const overflow = ProductCatalog.getPage(99)

    expect(first.items).toHaveLength(4)
    expect(first.pageNo).toBe(0)
    expect(first.totalPages).toBeGreaterThanOrEqual(2)
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id)
    expect(overflow.pageNo).toBe(first.totalPages - 1)
  })

  it(`returns product details and rejects missing products`, () => {
    const product = ProductCatalog.getById(`netflix-premium-1m`)
    const missing = ProductCatalog.getById(`missing-product`)

    expect(product?.name).toBe(`Netflix Premium`)
    expect(product?.stockStatus).toBe(`available`)
    expect(product?.stockCount).toBeGreaterThan(0)
    expect(missing).toBeNull()
  })

  it(`shows product detail stock count for available products`, () => {
    const product = ProductCatalog.getById(`netflix-premium-1m`)

    expect(product).not.toBeNull()
    expect(ProductCatalog.detailStockLabel(product!)).toBe(`✅ 12 available`)
  })
})

describe(`CartStore`, () => {
  it(`adds available products and totals cart value`, () => {
    const cart = CartStore.addItem({}, `netflix-premium-1m`)
    const next = CartStore.addItem(cart, `netflix-premium-1m`)
    const summary = CartStore.getSummary(next)

    expect(summary.items).toHaveLength(1)
    expect(summary.items[0]?.quantity).toBe(2)
    expect(summary.subtotal).toBe(158000)
    expect(summary.isEmpty).toBe(false)
  })

  it(`does not add out-of-stock or unknown products`, () => {
    const cart = CartStore.addItem({}, `disney-family-1m`)
    const next = CartStore.addItem(cart, `unknown`)
    const summary = CartStore.getSummary(next)

    expect(summary.items).toHaveLength(0)
    expect(summary.isEmpty).toBe(true)
  })

  it(`keeps quantity above zero and removes products explicitly`, () => {
    const cart = CartStore.addItem({}, `spotify-family-1m`)
    const decreased = CartStore.decreaseItem(cart, `spotify-family-1m`)
    const removed = CartStore.removeItem(cart, `spotify-family-1m`)

    expect(CartStore.getSummary(decreased).items[0]?.quantity).toBe(1)
    expect(CartStore.getSummary(removed).isEmpty).toBe(true)
  })
})

describe(`CheckoutPage session routing`, () => {
  it(`keeps checkout free-text state in setSessionFreeText instead of overwriting the session method`, () => {
    const checkoutSource = readFileSync(join(import.meta.dir, `../src/pages/checkout.ts`), `utf8`)

    expect(checkoutSource).not.toContain(`setSession(\`multi_session\``)
    expect(checkoutSource).toContain(`setSessionFreeText({position: \`contact\`}`)
    expect(checkoutSource).toContain(`setSessionFreeText({position: \`confirm\`, contact, notes}`)
  })
})

describe(`OrderStore`, () => {
  it(`creates pending QRIS orders with deadline and mock image metadata`, () => {
    const cart = CartStore.addItem({}, `netflix-premium-1m`)
    const summary = CartStore.getSummary(cart)
    const order = OrderStore.createOrder({userId: 77, summary, contact: `@buyer77`, notes: `Pay soon`, support: `@SubStoreSupport`})

    expect(order.status).toBe(`pending`)
    expect(order.deadlineMinutes).toBe(15)
    expect(order.deadlineAt).toContain(`T`)
    expect(order.qrisImageUrl).toContain(`QRIS`)
    expect(OrderStore.statusLabel(`pending`)).toBe(`⏳ Pending`)
    expect(OrderStore.statusLabel(`done`)).toBe(`✅ Success`)
    expect(OrderStore.statusLabel(`failed`)).toBe(`❌ Failed`)
  })
})

describe(`OrderHistoryStore`, () => {
  it(`prepends created orders and formats recent order history`, () => {
    const cart = CartStore.addItem({}, `netflix-premium-1m`)
    const summary = CartStore.getSummary(cart)
    const first = OrderStore.createOrder({userId: 77, summary, contact: `@buyer77`, notes: `First order`, support: `@SubStoreSupport`})
    const second = OrderStore.createOrder({userId: 77, summary, contact: `@buyer77`, notes: `Second order`, support: `@SubStoreSupport`})
    const history = OrderHistoryStore.addOrder(OrderHistoryStore.addOrder([], first), second)

    expect(history).toHaveLength(2)
    expect(history[0]?.id).toBe(second.id)
    expect(OrderHistoryStore.formatHistory(history)).toContain(second.id)
    expect(OrderHistoryStore.formatHistory(history)).toContain(`⏳ Pending`)
    expect(OrderHistoryStore.formatHistory([])).toBe(`No orders yet.`)
  })

  it(`marks pending orders as failed after their payment deadline`, () => {
    const cart = CartStore.addItem({}, `netflix-premium-1m`)
    const summary = CartStore.getSummary(cart)
    const order = OrderStore.createOrder({userId: 77, summary, contact: `@buyer77`, notes: `Late payment`, support: `@SubStoreSupport`, now: new Date(`2026-01-01T00:00:00.000Z`)})
    const refreshed = OrderHistoryStore.refreshStatuses([order], new Date(`2026-01-01T00:16:00.000Z`))

    expect(refreshed[0]?.status).toBe(`failed`)
    expect(OrderHistoryStore.formatHistory(refreshed)).toContain(`❌ Failed`)
  })
})

describe(`CheckoutPage QRIS media`, () => {
  it(`sends order-created as a QRIS photo with deadline, status, and refresh button`, () => {
    const checkoutSource = readFileSync(join(import.meta.dir, `../src/pages/checkout.ts`), `utf8`)

    expect(checkoutSource).toContain(`editPhoto`)
    expect(checkoutSource).toContain(`refresh`)
    expect(checkoutSource).toContain(`deadlineAt`)
    expect(checkoutSource).toContain(`<g-media type="photo" src="{{qrisImageUrl}}">`)
  })

  it(`refreshes the QRIS order card as media instead of empty text`, () => {
    const checkoutSource = readFileSync(join(import.meta.dir, `../src/pages/checkout.ts`), `utf8`)

    expect(checkoutSource).toContain(`editPhoto`)
    expect(checkoutSource).not.toContain(`await ctx.edit(kb, da, bi)\n  }\n}`)
  })
})
