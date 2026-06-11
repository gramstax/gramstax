import {Env} from "~/env"
import {PageBase} from "~/base/page"
import {CartPage} from "./cart"
import {StartPage} from "./start"
import {CatalogPage} from "./catalog"
import {HistoryPage} from "./history"
import {CartStore, type CartState, type OrderRecord, OrderHistoryStore, OrderStore, ProductCatalog} from "~/data/store"

type CheckoutSession = {
  position?: `contact` | `confirm`
  contact?: string
  notes?: string
}

class Base {
  static step1 = `s1`
  static confirm = `c`
  static success = `s`
  static refresh = `refresh`
  static warnEmpty = `w-empty`
  static warnInvalid = `w-invalid`
  static infoCancel = `i-cancel`
  static infoMissing = `i-missing`
}

class Helper {
  static async getCart(ctx: CheckoutPage): Promise<CartState> {
    return ((await ctx.cacheState.get(`${ctx.userId}:cart`)) ?? {}) as CartState
  }

  static async setCart(ctx: CheckoutPage, cart: CartState) {
    await ctx.cacheState.set(`${ctx.userId}:cart`, cart)
  }

  static async getHistory(ctx: CheckoutPage): Promise<OrderRecord[]> {
    return ((await ctx.cacheState.get(`${ctx.userId}:orders`)) ?? []) as OrderRecord[]
  }

  static async setHistory(ctx: CheckoutPage, history: OrderRecord[]) {
    await ctx.cacheState.set(`${ctx.userId}:orders`, history)
  }

  static getSession(ctx: CheckoutPage): CheckoutSession {
    return (ctx.temp.session?.params as CheckoutSession) ?? {}
  }

  static splitContactNotes(input: string) {
    const [contactLine, ...noteLines] = input.split(`\n`).map((line) => line.trim())
    return {
      contact: contactLine ?? ``,
      notes: noteLines.filter(Boolean).join(`\n`) || `No additional notes.`
    }
  }

  static isValidContact(contact: string): boolean {
    return contact.length >= 5 && (/^@?[a-zA-Z0-9_]{5,}$/.test(contact) || /^\+?[0-9][0-9\s-]{7,}$/.test(contact) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))
  }

  static kbCart(ctx: CheckoutPage, bi?: string) {
    return ctx.inlineKeyboardT([CartPage, CatalogPage.data.callbackData(Base.step1, `page`, `0`)], `2`, bi)
  }

  static kbConfirm(ctx: CheckoutPage, bi?: string) {
    return ctx.inlineKeyboardT([ctx.data.callbackData(`confirm`), ctx.data.callbackData(`cancel`), CartPage], `2`, bi)
  }

  static kbHome(ctx: CheckoutPage, bi?: string) {
    return ctx.inlineKeyboardT([HistoryPage, StartPage, CatalogPage.data.callbackData(Base.step1, `page`, `0`)], `2`, bi)
  }

  static kbSuccess(ctx: CheckoutPage, orderId: string, bi?: string) {
    return ctx.inlineKeyboardT([ctx.data.callbackData(Base.refresh, orderId), HistoryPage, StartPage, CatalogPage.data.callbackData(Base.step1, `page`, `0`)], `2`, bi)
  }
}

class Main {
  static async showStep1Form(ctx: CheckoutPage, edit = true) {
    const cart = await Helper.getCart(ctx)
    const summary = CartStore.getSummary(cart)
    if (summary.isEmpty) {
      return await Main.showWarnEmpty(ctx)
    }

    await ctx.setSessionFreeText({position: `contact`})
    const bi = Base.step1
    const kb = Helper.kbCart(ctx, bi)
    const da = {
      items: OrderStore.formatCart(summary),
      subtotal: ProductCatalog.formatPrice(summary.subtotal)
    }
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async showConfirmForm(ctx: CheckoutPage, input: string) {
    const {contact, notes} = Helper.splitContactNotes(input)
    if (!Helper.isValidContact(contact)) {
      return await Main.showWarnInvalid(ctx, contact)
    }

    const cart = await Helper.getCart(ctx)
    const summary = CartStore.getSummary(cart)
    if (summary.isEmpty) {
      return await Main.showWarnEmpty(ctx)
    }

    await ctx.setSessionFreeText({position: `confirm`, contact, notes})
    const bi = Base.confirm
    const kb = Helper.kbConfirm(ctx, bi)
    const da = {
      items: OrderStore.formatCart(summary),
      subtotal: ProductCatalog.formatPrice(summary.subtotal),
      contact,
      notes
    }
    await ctx.reply(kb, da, bi)
  }

  static async processStep1Answer(ctx: CheckoutPage, action?: string) {
    if (action === `confirm`) {
      return await Main.showSuccess(ctx)
    } else if (action === Base.refresh) {
      return await Main.showRefreshedStatus(ctx, ctx.callbackDataArgs[1])
    } else if (action === `cancel`) {
      return await Main.showInfoCancel(ctx)
    }
  }

  static async showWarnEmpty(ctx: CheckoutPage) {
    const bi = Base.warnEmpty
    const kb = Helper.kbCart(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async showWarnInvalid(ctx: CheckoutPage, contact = ``) {
    await ctx.setSessionFreeText({position: `contact`})
    const bi = Base.warnInvalid
    const kb = Helper.kbCart(ctx, bi)
    const da = {contact}
    await ctx.reply(kb, da, bi)
  }

  static async showInfoCancel(ctx: CheckoutPage) {
    await ctx.clearSession()
    const bi = Base.infoCancel
    const kb = Helper.kbHome(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async showInfoMissing(ctx: CheckoutPage) {
    const bi = Base.infoMissing
    const kb = Helper.kbHome(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async showSuccess(ctx: CheckoutPage) {
    const cart = await Helper.getCart(ctx)
    const summary = CartStore.getSummary(cart)
    const session = Helper.getSession(ctx)
    const order = OrderStore.createOrder({
      userId: ctx.userId,
      summary,
      contact: session.contact || `-`,
      notes: session.notes || `No additional notes.`,
      support: Env.STORE_ADMIN_USERNAME
    })
    const history = await Helper.getHistory(ctx)
    const bi = Base.success
    const kb = Helper.kbSuccess(ctx, order.id, bi)
    const da = {
      orderId: order.id,
      items: OrderStore.formatCart(summary),
      subtotal: ProductCatalog.formatPrice(order.subtotal),
      contact: order.contact,
      notes: order.notes,
      support: order.support,
      statusLabel: OrderStore.statusLabel(order.status),
      deadlineMinutes: String(order.deadlineMinutes),
      deadlineAt: order.deadlineAt,
      timeNow: new Date(),
      qrisImageUrl: order.qrisImageUrl
    }
    await Helper.setHistory(ctx, OrderHistoryStore.addOrder(history, order))
    await Helper.setCart(ctx, CartStore.clear())
    await ctx.clearSession()
    await ctx.editPhoto(kb, da, bi)
  }

  static async showRefreshedStatus(ctx: CheckoutPage, orderId?: string) {
    const refreshedHistory = OrderHistoryStore.refreshStatuses(await Helper.getHistory(ctx))
    await Helper.setHistory(ctx, refreshedHistory)
    const order = orderId ? refreshedHistory.find((item) => item.id === orderId) : refreshedHistory[0]
    if (!order) {
      return await Main.showInfoMissing(ctx)
    }

    const bi = Base.success
    const kb = Helper.kbSuccess(ctx, order.id, bi)
    const da = {
      orderId: order.id,
      items: OrderStore.formatCart({items: order.items, subtotal: order.subtotal, isEmpty: order.items.length === 0}),
      subtotal: ProductCatalog.formatPrice(order.subtotal),
      contact: order.contact,
      notes: order.notes,
      support: order.support,
      statusLabel: OrderStore.statusLabel(order.status),
      deadlineMinutes: String(order.deadlineMinutes),
      deadlineAt: order.deadlineAt,
      timeNow: new Date(),
      qrisImageUrl: order.qrisImageUrl
    }
    await ctx.editPhoto(kb, da, bi)
  }
}

export class CheckoutPage extends PageBase {
  static data = this.buildData((action?: string, orderId?: string) => [action, orderId])

  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  async handleArgsCallbackData() {
    const [action] = this.callbackDataArgs
    await Main.processStep1Answer(this, action)
  }

  async handleSessionFreeText() {
    const {position} = Helper.getSession(this)
    if (position === `contact`) {
      await Main.showConfirmForm(this, this.msgText.trim())
    }
  }

  async showStep1Form(edit = true) {
    await Main.showStep1Form(this, edit)
  }

  static template = `
    <base id="${Base.step1}">
      <keyboard>🛒 Cart, 🔎 Browse Products</keyboard>
      <message>
        💳 Checkout Details

        Your order:
        {{items}}

        Subtotal: {{subtotal}}

        Send your contact on the first line, then optional notes on the next line.
        Example:
        @yourusername
        Please deliver after payment confirmation.
      </message>
    </base>

    <base id="${Base.confirm}">
      <keyboard>✅ Confirm, ❌ Cancel, 🛒 Cart</keyboard>
      <message>
        ✅ Confirm Order

        Items:
        {{items}}

        Subtotal: {{subtotal}}
        Contact: {{contact}}
        Notes: {{notes}}

        Confirm when the details are correct.
      </message>
    </base>

    <base id="${Base.success}">
      <keyboard>🔄 refresh, 🧾 History, 🏠 Home, 🔎 Browse Products</keyboard>
      <media type="photo" src="{{qrisImageUrl}}">
        🎉 Order Created

        Order ID: {{orderId}}
        Status: {{statusLabel}}
        Payment deadline: {{deadlineMinutes}} minutes
        Deadline at: {{deadlineAt}}
        Timenow: {{timeNow}}

        Items:
        {{items}}

        Total: {{subtotal}}
        Contact: {{contact}}
        Notes: {{notes}}

        💳 Payment Method: QRIS
        QRIS only: scan the store QRIS code using DANA, ShopeePay, or any QRIS-supported banking app. After payment, send proof to {{support}} with your Order ID.
      </media>
    </base>

    <base id="${Base.warnEmpty}">
      <keyboard>🛒 Cart, 🔎 Browse Products</keyboard>
      <message>
        🛒 Empty cart

        Add at least one available subscription before checkout.
      </message>
    </base>

    <base id="${Base.warnInvalid}">
      <keyboard>🛒 Cart, 🔎 Browse Products</keyboard>
      <message>
        ⚠️ Contact needed

        We could not use "{{contact}}" as contact information. Send a Telegram username, email, or WhatsApp number with at least 5 characters.
      </message>
    </base>

    <base id="${Base.infoCancel}">
      <keyboard>🏠 Home, 🔎 Browse Products</keyboard>
      <message>
        ❌ Checkout cancelled

        Your cart is preserved. You can continue shopping or checkout again later.
      </message>
    </base>

    <base id="${Base.infoMissing}">
      <keyboard>🧾 History, 🏠 Home, 🔎 Browse Products</keyboard>
      <message>
        ⚠️ Order not found

        Open history to review your latest orders, then try refresh again from an active order card.
      </message>
    </base>
  `
}
