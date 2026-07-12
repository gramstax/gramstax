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
  static index = `i`
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
    return ctx.inlineKeyboardT([CartPage, CatalogPage], `2`, bi)
  }

  static kbConfirm(ctx: CheckoutPage, bi?: string) {
    return ctx.inlineKeyboardT([ctx.data.callbackData(`confirm`), ctx.data.callbackData(`cancel`), CartPage], `2`, bi)
  }

  static kbHome(ctx: CheckoutPage, bi?: string) {
    return ctx.inlineKeyboardT([HistoryPage, StartPage, CatalogPage], `2`, bi)
  }

  static kbSuccess(ctx: CheckoutPage, orderId: string, bi?: string) {
    return ctx.inlineKeyboardT([ctx.data.callbackData(Base.refresh, orderId), HistoryPage, StartPage, CatalogPage], `2`, bi)
  }
}

class Main {
  static async showIndex(ctx: CheckoutPage, edit = true) {
    const cart = await Helper.getCart(ctx)
    const summary = CartStore.getSummary(cart)
    if (summary.isEmpty) {
      return await Main.showWarnEmpty(ctx)
    }

    await ctx.setSessionFreeText({position: `contact`})
    const bi = Base.index
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

  static async processIndex(ctx: CheckoutPage, action?: string) {
    if (action === `confirm`) {
      await Main.showSuccess(ctx)
    } else if (action === Base.refresh) {
      await Main.showRefreshedStatus(ctx, ctx.callbackDataArgs[1])
    } else if (action === `cancel`) {
      await Main.showInfoCancel(ctx)
    }
  }

  static async showConfirm(ctx: CheckoutPage, input: string) {
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
    await Main.showIndex(this, true)
  }

  async handleArgsCallbackData() {
    const [action] = this.callbackDataArgs
    await Main.processIndex(this, action)
  }

  async handleSessionFreeText() {
    const {position} = Helper.getSession(this)
    if (position === `contact`) {
      await Main.showConfirm(this, this.msgText.trim())
    }
  }

  async showIndex(edit = true) {
    await Main.showIndex(this, edit)
  }

  static template = `
    <g-base id="${Base.index}">
      <g-keyboard type="inline">🛒 Cart, 🔎 Browse Products</g-keyboard>
      <g-keyboard type="inline" lang="id">🛒 Keranjang, 🔎 Jelajahi</g-keyboard>
      <g-message>
        💳 Checkout Details

        Your order:
        {{items}}

        Subtotal: {{subtotal}}

        Send your contact on the first line, then optional notes on the next line.
        Example:
        @yourusername
        Please deliver after payment confirmation.
      </g-message>
      <g-message lang="id">
        💳 Detail Checkout

        Pesanan Anda:
        {{items}}

        Subtotal: {{subtotal}}

        Kirim kontak di baris pertama, lalu catatan opsional di baris berikutnya.
        Contoh:
        @namauser
        Tolong kirim setelah konfirmasi pembayaran.
      </g-message>
    </g-base>

    <g-base id="${Base.confirm}">
      <g-keyboard type="inline">✅ Confirm, ❌ Cancel, 🛒 Cart</g-keyboard>
      <g-keyboard type="inline" lang="id">✅ Konfirmasi, ❌ Batal, 🛒 Keranjang</g-keyboard>
      <g-message>
        ✅ Confirm Order

        Items:
        {{items}}

        Subtotal: {{subtotal}}
        Contact: {{contact}}
        Notes: {{notes}}

        Confirm when the details are correct.
      </g-message>
      <g-message lang="id">
        ✅ Konfirmasi Pesanan

        Item:
        {{items}}

        Subtotal: {{subtotal}}
        Kontak: {{contact}}
        Catatan: {{notes}}

        Konfirmasi jika detail sudah benar.
      </g-message>
    </g-base>

    <g-base id="${Base.success}">
      <g-keyboard type="inline">🔄 refresh, 🧾 History, 🏠 Home, 🔎 Browse Products</g-keyboard>
      <g-keyboard type="inline" lang="id">🔄 refresh, 🧾 Riwayat, 🏠 Beranda, 🔎 Jelajahi</g-keyboard>
      <g-media type="photo" src="{{qrisImageUrl}}">
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
      </g-media>
      <g-media lang="id" type="photo" src="{{qrisImageUrl}}">
        🎉 Pesanan Dibuat

        ID Pesanan: {{orderId}}
        Status: {{statusLabel}}
        Batas pembayaran: {{deadlineMinutes}} menit
        Tenggat: {{deadlineAt}}
        Waktu: {{timeNow}}

        Item:
        {{items}}

        Total: {{subtotal}}
        Kontak: {{contact}}
        Catatan: {{notes}}

        💳 Metode Pembayaran: QRIS
        QRIS saja: scan kode QRIS toko menggunakan DANA, ShopeePay, atau aplikasi perbankan yang mendukung QRIS. Setelah pembayaran, kirim bukti ke {{support}} dengan ID Pesanan Anda.
      </g-media>
    </g-base>

    <g-base id="${Base.warnEmpty}">
      <g-keyboard type="inline">🛒 Cart, 🔎 Browse Products</g-keyboard>
      <g-keyboard type="inline" lang="id">🛒 Keranjang, 🔎 Jelajahi</g-keyboard>
      <g-message>
        🛒 Empty cart

        Add at least one available subscription before checkout.
      </g-message>
      <g-message lang="id">
        🛒 Keranjang kosong

        Tambah setidaknya satu langganan tersedia sebelum checkout.
      </g-message>
    </g-base>

    <g-base id="${Base.warnInvalid}">
      <g-keyboard type="inline">🛒 Cart, 🔎 Browse Products</g-keyboard>
      <g-keyboard type="inline" lang="id">🛒 Keranjang, 🔎 Jelajahi</g-keyboard>
      <g-message>
        ⚠️ Contact needed

        We could not use "{{contact}}" as contact information. Send a Telegram username, email, or WhatsApp number with at least 5 characters.
      </g-message>
      <g-message lang="id">
        ⚠️ Kontak diperlukan

        Tidak dapat menggunakan "{{contact}}" sebagai kontak. Kirim username Telegram, email, atau nomor WhatsApp minimal 5 karakter.
      </g-message>
    </g-base>

    <g-base id="${Base.infoCancel}">
      <g-keyboard type="inline">🏠 Home, 🔎 Browse</g-keyboard>
      <g-keyboard type="inline" lang="id">🏠 Beranda, 🔎 Jelajahi</g-keyboard>
      <g-message>
        ❌ Checkout cancelled

        Your cart is preserved. You can continue shopping or checkout again later.
      </g-message>
      <g-message lang="id">
        ❌ Checkout dibatalkan

        Keranjang Anda tetap disimpan. Anda dapat melanjutkan belanja atau checkout lagi nanti.
      </g-message>
    </g-base>

    <g-base id="${Base.infoMissing}">
      <g-keyboard type="inline">🧾 History, 🏠 Home, 🔎 Browse Products</g-keyboard>
      <g-keyboard type="inline" lang="id">🧾 Riwayat, 🏠 Beranda, 🔎 Jelajahi</g-keyboard>
      <g-message>
        ⚠️ Order not found

        Open history to review your latest orders, then try refresh again from an active order card.
      </g-message>
      <g-message lang="id">
        ⚠️ Pesanan tidak ditemukan

        Buka riwayat untuk lihat pesanan terbaru, lalu coba refresh lagi dari kartu pesanan aktif.
      </g-message>
    </g-base>
  `
}
