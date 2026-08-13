import {PageBase} from "~/base/page"
import {type CartState, CartStore, OrderHistoryStore, type OrderRecord, OrderStore, ProductCatalog} from "~/data/store"
import {Env} from "~/env"
import {CartPage} from "./cart"
import {CatalogPage} from "./catalog"
import {HistoryPage} from "./history"
import {StartPage} from "./start"

type ICheckoutSession = {
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
    return ((await ctx.cacheState.get(`${ctx.from!.id!}:cart`)) ?? {}) as CartState
  }

  static async setCart(ctx: CheckoutPage, cart: CartState) {
    await ctx.cacheState.set(`${ctx.from!.id!}:cart`, cart)
  }

  static async getHistory(ctx: CheckoutPage): Promise<OrderRecord[]> {
    return ((await ctx.cacheState.get(`${ctx.from!.id!}:orders`)) ?? []) as OrderRecord[]
  }

  static async setHistory(ctx: CheckoutPage, history: OrderRecord[]) {
    await ctx.cacheState.set(`${ctx.from!.id!}:orders`, history)
  }

  static getSession(ctx: CheckoutPage): ICheckoutSession {
    return (ctx.temp.session?.params as ICheckoutSession) ?? {}
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
    return ctx.inlineKeyboardT([ctx.data.callbackQueryData(`confirm`), ctx.data.callbackQueryData(`cancel`), CartPage], `2`, bi)
  }

  static kbHome(ctx: CheckoutPage, bi?: string) {
    return ctx.inlineKeyboardT([HistoryPage, StartPage, CatalogPage], `2`, bi)
  }

  static kbSuccess(ctx: CheckoutPage, orderId: string, bi?: string) {
    return ctx.inlineKeyboardT([ctx.data.callbackQueryData(Base.refresh, orderId), HistoryPage, StartPage, CatalogPage], `2`, bi)
  }
}

export class CheckoutPage extends PageBase {
  static data = this.buildData((action?: string, orderId?: string) => [action, orderId])

  async handleCallbackQueryData() {
    await this.bindex.show()
  }

  async handleArgsCallbackQueryData() {
    const [action, orderId] = this.callbackQueryDataArgs
    if (action === `confirm`) {
      await this.bconfirm.process()
    } else if (action === Base.refresh) {
      await this.brefresh.process(orderId)
    } else if (action === `cancel`) {
      await this.binfoCancel.show()
    }
  }

  async handleSessionFreeText() {
    await this.bindex.process()
  }

  bindex = {
    show: async () => {
      const cart = await Helper.getCart(this)
      const summary = CartStore.getSummary(cart)
      if (summary.isEmpty) {
        return await this.bwarnEmpty.show()
      }

      await this.setSessionFreeText({position: `contact`})
      const kb = Helper.kbCart(this, Base.index)
      const da = {
        items: OrderStore.formatCart(summary),
        subtotal: ProductCatalog.formatPrice(summary.subtotal)
      }
      await this.renderAuto(kb, da, Base.index)
    },
    process: async () => {
      const {position} = Helper.getSession(this)
      if (position !== `contact`) return

      const input = this.msg!.text!.trim()
      const {contact, notes} = Helper.splitContactNotes(input)
      if (!Helper.isValidContact(contact)) {
        await this.setSessionFreeText({position: `contact`})
        return await this.bwarnInvalid.show(contact)
      }

      const cart = await Helper.getCart(this)
      const summary = CartStore.getSummary(cart)
      if (summary.isEmpty) {
        return await this.bwarnEmpty.show()
      }

      await this.setSessionFreeText({position: `confirm`, contact, notes})
      await this.bconfirm.show(OrderStore.formatCart(summary), ProductCatalog.formatPrice(summary.subtotal), contact, notes)
    }
  }

  bconfirm = {
    show: async (items: string, subtotal: string, contact: string, notes: string) => {
      const kb = Helper.kbConfirm(this, Base.confirm)
      const da = {items, subtotal, contact, notes}
      await this.renderAuto(kb, da, Base.confirm)
    },
    process: async () => {
      const cart = await Helper.getCart(this)
      const summary = CartStore.getSummary(cart)
      const session = Helper.getSession(this)
      const order = OrderStore.createOrder({
        userId: this.from!.id,
        summary,
        contact: session.contact || `-`,
        notes: session.notes || `No additional notes.`,
        support: Env.STORE_ADMIN_USERNAME
      })
      const history = await Helper.getHistory(this)
      await Helper.setHistory(this, OrderHistoryStore.addOrder(history, order))
      await Helper.setCart(this, CartStore.clear())
      await this.clearSession()
      await this.bsuccess.show(order)
    }
  }

  brefresh = {
    process: async (orderId?: string) => {
      const refreshedHistory = OrderHistoryStore.refreshStatuses(await Helper.getHistory(this))
      await Helper.setHistory(this, refreshedHistory)
      const order = orderId ? refreshedHistory.find((item) => item.id === orderId) : refreshedHistory[0]
      if (!order) {
        return await this.binfoMissing.show()
      }
      await this.bsuccess.show(order)
    }
  }

  bsuccess = {
    show: async (order: OrderRecord) => {
      const kb = Helper.kbSuccess(this, order.id, Base.success)
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
      await this.renderEditPhoto(kb, da, Base.success)
    }
  }

  bwarnEmpty = {
    show: async () => {
      const kb = Helper.kbCart(this, Base.warnEmpty)
      await this.renderAuto(kb, {}, Base.warnEmpty)
    }
  }

  bwarnInvalid = {
    show: async (contact: string) => {
      await this.setSessionFreeText({position: `contact`})
      const kb = Helper.kbCart(this, Base.warnInvalid)
      const da = {contact}
      await this.renderAuto(kb, da, Base.warnInvalid)
    }
  }

  binfoCancel = {
    show: async () => {
      await this.clearSession()
      const kb = Helper.kbHome(this, Base.infoCancel)
      await this.renderAuto(kb, {}, Base.infoCancel)
    }
  }

  binfoMissing = {
    show: async () => {
      const kb = Helper.kbHome(this, Base.infoMissing)
      await this.renderAuto(kb, {}, Base.infoMissing)
    }
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
