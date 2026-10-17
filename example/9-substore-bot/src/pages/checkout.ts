import {PageBase} from "~/base/page"
import {type CartState, CartStore, OrderHistoryStore, type OrderRecord, OrderStore, ProductCatalog} from "~/data/store"
import {Env} from "~/env"
import {CartPage} from "./cart"
import {CatalogPage} from "./catalog"
import {HistoryPage} from "./history"
import {StartPage} from "./start"

type ISPCheckout = {
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

export class CheckoutPage extends PageBase {
  static data = this.buildData((action?: string, orderId?: string) => [action, orderId])

  async handleCallbackQueryData() {
    await this.gindex.show()
  }

  async handleArgsCallbackQueryData() {
    const [action, orderId] = this.callbackQueryDataArgs
    if (action === `confirm`) {
      await this.gconfirm.process()
    } else if (action === Base.refresh) {
      await this.grefresh.process(orderId)
    } else if (action === `cancel`) {
      await this.ginfoCancel.show()
    }
  }

  async handleSessionFreeText() {
    await this.gindex.process()
  }

  helper = {
    getCart: async () => {
      return ((await this.cacheState.get(`${this.from!.id!}:cart`)) ?? {}) as CartState
    },
    setCart: async (cart: CartState) => {
      await this.cacheState.set(`${this.from!.id!}:cart`, cart)
    },
    getHistory: async () => {
      return ((await this.cacheState.get(`${this.from!.id!}:orders`)) ?? []) as OrderRecord[]
    },
    setHistory: async (history: OrderRecord[]) => {
      await this.cacheState.set(`${this.from!.id!}:orders`, history)
    },
    getSessionParams: () => {
      return (this.temp.session?.params as ISPCheckout) ?? {}
    },
    splitContactNotes: (input: string) => {
      const [contactLine, ...noteLines] = input.split(`\n`).map((line) => line.trim())
      return {
        contact: contactLine ?? ``,
        notes: noteLines.filter(Boolean).join(`\n`) || `No additional notes.`
      }
    },
    isValidContact: (contact: string) => {
      return contact.length >= 5 && (/^@?[a-zA-Z0-9_]{5,}$/.test(contact) || /^\+?[0-9][0-9\s-]{7,}$/.test(contact) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))
    },
    cartKeyboard: (baseId?: string) => {
      return this.inlineKeyboardT([CartPage, CatalogPage], `2`, baseId)
    },
    confirmKeyboard: (baseId?: string) => {
      return this.inlineKeyboardT([this.data.callbackQueryData(`confirm`), this.data.callbackQueryData(`cancel`), CartPage], `2`, baseId)
    },
    homeKeyboard: (baseId?: string) => {
      return this.inlineKeyboardT([HistoryPage, StartPage, CatalogPage], `2`, baseId)
    },
    successKeyboard: (orderId: string, baseId?: string) => {
      return this.inlineKeyboardT([this.data.callbackQueryData(Base.refresh, orderId), HistoryPage, StartPage, CatalogPage], `2`, baseId)
    }
  }
  gindex = {
    show: async () => {
      const cart = await this.helper.getCart()
      const summary = CartStore.getSummary(cart)
      if (summary.isEmpty) {
        return await this.gwarnEmpty.show()
      }

      await this.setSessionFreeText({position: `contact`})
      await this.renderText({
        AGBaseId: Base.index,
        keyboard: this.helper.cartKeyboard(Base.index),
        data: {
          items: OrderStore.formatCart(summary),
          subtotal: ProductCatalog.formatPrice(summary.subtotal)
        }
      })
    },
    process: async () => {
      const {position} = this.helper.getSessionParams()
      if (position !== `contact`) return

      const input = this.msg!.text!.trim()
      const {contact, notes} = this.helper.splitContactNotes(input)
      if (!this.helper.isValidContact(contact)) {
        await this.setSessionFreeText({position: `contact`})
        return await this.gwarnInvalid.show(contact)
      }

      const cart = await this.helper.getCart()
      const summary = CartStore.getSummary(cart)
      if (summary.isEmpty) {
        return await this.gwarnEmpty.show()
      }

      await this.setSessionFreeText({position: `confirm`, contact, notes})
      await this.gconfirm.show(OrderStore.formatCart(summary), ProductCatalog.formatPrice(summary.subtotal), contact, notes)
    }
  }
  gconfirm = {
    show: async (items: string, subtotal: string, contact: string, notes: string) => {
      await this.renderText({AGBaseId: Base.confirm, keyboard: this.helper.confirmKeyboard(Base.confirm), data: {items, subtotal, contact, notes}})
    },
    process: async () => {
      const cart = await this.helper.getCart()
      const summary = CartStore.getSummary(cart)
      const session = this.helper.getSessionParams()
      const order = OrderStore.createOrder({
        userId: this.from!.id,
        summary,
        contact: session.contact || `-`,
        notes: session.notes || `No additional notes.`,
        support: Env.STORE_ADMIN_USERNAME
      })
      const history = await this.helper.getHistory()
      await this.helper.setHistory(OrderHistoryStore.addOrder(history, order))
      await this.helper.setCart(CartStore.clear())
      await this.clearSession()
      await this.gsuccess.show(order)
    }
  }
  grefresh = {
    process: async (orderId?: string) => {
      const refreshedHistory = OrderHistoryStore.refreshStatuses(await this.helper.getHistory())
      await this.helper.setHistory(refreshedHistory)
      const order = orderId ? refreshedHistory.find((item) => item.id === orderId) : refreshedHistory[0]
      if (!order) {
        return await this.ginfoMissing.show()
      }
      await this.gsuccess.show(order)
    }
  }
  gsuccess = {
    show: async (order: OrderRecord) => {
      await this.renderPhoto({
        AGBaseId: Base.success,
        keyboard: this.helper.successKeyboard(order.id, Base.success),
        data: {
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
        },
        mode: "edit"
      })
    },
    process: () => {}
  }
  gwarnEmpty = {
    show: async () => {
      await this.renderText({AGBaseId: Base.warnEmpty, keyboard: this.helper.cartKeyboard(Base.warnEmpty)})
    },
    process: () => {}
  }
  gwarnInvalid = {
    show: async (contact: string) => {
      await this.setSessionFreeText({position: `contact`})
      await this.renderText({AGBaseId: Base.warnInvalid, keyboard: this.helper.cartKeyboard(Base.warnInvalid), data: {contact}})
    },
    process: () => {}
  }
  ginfoCancel = {
    show: async () => {
      await this.clearSession()
      await this.renderText({AGBaseId: Base.infoCancel, keyboard: this.helper.homeKeyboard(Base.infoCancel)})
    },
    process: () => {}
  }
  ginfoMissing = {
    show: async () => {
      await this.renderText({AGBaseId: Base.infoMissing, keyboard: this.helper.homeKeyboard(Base.infoMissing)})
    },
    process: () => {}
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
