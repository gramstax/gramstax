import {PageBase} from "~/base/page"
import {type CartState, CartStore, OrderStore, ProductCatalog} from "~/data/store"
import {CatalogPage} from "./catalog"
import {CheckoutPage} from "./checkout"
import {StartPage} from "./start"

class Base {
  static index = `i`
  static empty = `e`
  static infoCleared = `i-cleared`
}

export class CartPage extends PageBase {
  static data = this.buildData((step?: string, action?: string, productId?: string) => [step, action, productId])

  async handleCallbackQueryData() {
    await this.bindex.show(true)
  }

  async handleArgsCallbackQueryData() {
    const [step, action, productId] = this.callbackQueryDataArgs
    if (step === Base.index) {
      await this.bindex.process(action, productId)
    }
  }

  bindex = {
    show: async (isEdit = true) => {
      const cart = ((await this.cacheState.get(`${this.from!.id}:cart`)) ?? {}) as CartState
      const summary = CartStore.getSummary(cart)
      if (summary.isEmpty) {
        return await this.bempty.show()
      }

      const bi = Base.index
      const kb = this.inlineKeyboard(
        (k, l) => {
          summary.items.forEach((item) => {
            k.text(`${l[0]!} ${item.product.name}`, this.data.callbackQueryData(bi, `inc`, item.product.id))
            k.text(l[1]!, this.data.callbackQueryData(bi, `dec`, item.product.id))
            k.text(l[2]!, this.data.callbackQueryData(bi, `remove`, item.product.id))
            k.row()
          })

          k.text(l[3]!, CheckoutPage.data.callbackQueryData())
          k.text(l[4]!, this.data.callbackQueryData(bi, `clear`))
          k.row()

          return k.text(l[5]!, CatalogPage.data.callbackQueryData()).text(l[6]!, StartPage.data.callbackQueryData())
        },
        {AGBaseId: bi}
      )
      const da = {
        items: OrderStore.formatCart(summary),
        subtotal: ProductCatalog.formatPrice(summary.subtotal)
      }

      await this.renderAuto(kb, da, bi, null, isEdit)
    },
    process: async (action?: string, productId?: string) => {
      const cart = ((await this.cacheState.get(`${this.from!.id}:cart`)) ?? {}) as CartState

      let next = cart
      if (action === `inc` && productId) {
        next = CartStore.addItem(cart, productId)
      } else if (action === `dec` && productId) {
        next = CartStore.decreaseItem(cart, productId)
      } else if (action === `remove` && productId) {
        next = CartStore.removeItem(cart, productId)
      } else if (action === `clear`) {
        next = CartStore.clear()
        await this.cacheState.set(`${this.from!.id}:cart`, next)
        return await this.binfoCleared.show()
      }

      await this.cacheState.set(`${this.from!.id}:cart`, next)
      await this.bindex.show(true)
    }
  }

  bempty = {
    show: async () => {
      const kb = this.inlineKeyboardT([CatalogPage, StartPage], `1`, Base.empty)
      await this.renderEdit(kb, {}, Base.empty)
    }
  }

  binfoCleared = {
    show: async () => {
      const kb = this.inlineKeyboardT([CatalogPage, StartPage], `1`, Base.infoCleared)
      await this.renderEdit(kb, {}, Base.infoCleared)
    }
  }

  static template = `
    <g-base id="${Base.index}">
      <g-keyboard type="inline">➕, ➖, 🗑️ Remove, 💳 Checkout, 🧹 Clear, 🔎 Browse Products, 🏠 Home</g-keyboard>
      <g-keyboard type="inline" lang="id">➕, ➖, 🗑️ Hapus, 💳 Bayar, 🧹 Kosongkan, 🔎 Jelajahi, 🏠 Beranda</g-keyboard>
      <g-message>
        🛒 Your Cart

        {{items}}

        Subtotal: {{subtotal}}

        Adjust quantities or continue to checkout.
      </g-message>
      <g-message lang="id">
        🛒 Keranjang Anda

        {{items}}

        Subtotal: {{subtotal}}

        Sesuaikan jumlah atau lanjutkan ke pembayaran.
      </g-message>
    </g-base>
    <g-base id="${Base.empty}">
      <g-keyboard type="inline">🔎 Browse Products, 🏠 Home</g-keyboard>
      <g-keyboard type="inline" lang="id">🔎 Jelajahi, 🏠 Beranda</g-keyboard>
      <g-message>
        🛒 Your Cart is Empty

        Browse subscription products and add your favorites before checkout.
      </g-message>
      <g-message lang="id">
        🛒 Keranjang Kosong

        Jelajahi produk langganan dan tambahkan favorit Anda sebelum checkout.
      </g-message>
    </g-base>
    <g-base id="${Base.infoCleared}">
      <g-keyboard type="inline">🔎 Browse Products, 🏠 Home</g-keyboard>
      <g-keyboard type="inline" lang="id">🔎 Jelajahi, 🏠 Beranda</g-keyboard>
      <g-message>
        🧹 Cart cleared

        Your cart is empty now. You can continue browsing anytime.
      </g-message>
      <g-message lang="id">
        🧹 Keranjang dikosongkan

        Keranjang Anda kosong sekarang. Anda dapat melanjutkan belanja kapan saja.
      </g-message>
    </g-base>
  `
}
