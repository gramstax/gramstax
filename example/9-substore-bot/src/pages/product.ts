import {PageBase} from "~/base/page"
import {type CartState, CartStore, ProductCatalog} from "~/data/store"
import {CartPage} from "./cart"
import {CatalogPage} from "./catalog"
import {CheckoutPage} from "./checkout"

class Base {
  static index = `i`
  static infoAdded = `i-added`
  static warnStock = `w-stock`
  static warnMissing = `w-missing`
}

export class ProductPage extends PageBase {
  static data = this.buildData((action?: string, productId?: string) => [action, productId])

  async handleArgsCallbackQueryData() {
    const [action, productId] = this.callbackQueryDataArgs
    if (action === `detail` && productId) {
      await this.gindex.show(productId)
    } else {
      await this.gindex.process(action, productId)
    }
  }

  gindex = {
    show: async (productId: string) => {
      const product = ProductCatalog.getById(productId)
      if (!product) {
        return await this.gwarnMissing.show()
      }

      const kb = this.inlineKeyboardT([this.data.callbackQueryData(`buy`, productId), this.data.callbackQueryData(`add`, productId), CartPage, CatalogPage], `2-1`, Base.index)
      const da = {
        name: product.name,
        service: product.service,
        duration: product.duration,
        accountType: product.accountType,
        stock: ProductCatalog.detailStockLabel(product),
        price: ProductCatalog.formatPrice(product.price),
        description: product.description,
        benefits: product.benefits.map((benefit) => `• ${benefit}`).join(`\n`),
        delivery: product.deliveryEstimate
      }
      await this.renderAuto(kb, da, Base.index)
    },
    process: async (action?: string, productId?: string) => {
      if (!productId) {
        return await this.gwarnMissing.show()
      }

      const product = ProductCatalog.getById(productId)
      if (!product) {
        return await this.gwarnMissing.show()
      }

      if (product.stockStatus !== `available`) {
        return await this.gwarnStock.show(productId)
      }

      const cart = ((await this.cacheState.get(`${this.from!.id}:cart`)) ?? {}) as CartState
      const next = CartStore.addItem(cart, productId)
      await this.cacheState.set(`${this.from!.id}:cart`, next)

      if (action === `buy`) {
        await new CheckoutPage(this).gindex.show()
      } else if (action === `add`) {
        await this.ginfoAdded.show(productId)
      }
    }
  }

  ginfoAdded = {
    show: async (productId: string) => {
      const product = ProductCatalog.getById(productId)
      const kb = this.inlineKeyboardT([CatalogPage, CartPage], `2`, Base.infoAdded)
      const da = {name: product?.name ?? `Selected product`}
      await this.renderAuto(kb, da, Base.infoAdded)
    }
  }

  gwarnStock = {
    show: async (productId: string) => {
      const product = ProductCatalog.getById(productId)
      const kb = this.inlineKeyboardT([CatalogPage, CartPage], `2`, Base.warnStock)
      const da = {name: product?.name ?? `This product`}
      await this.renderAuto(kb, da, Base.warnStock)
    }
  }

  gwarnMissing = {
    show: async () => {
      const kb = this.inlineKeyboardT([CatalogPage, CartPage], `2`, Base.warnMissing)
      await this.renderAuto(kb, {}, Base.warnMissing)
    }
  }

  static template = `
    <g-base id="${Base.index}">
      <g-keyboard type="inline">✅ Buy Now, ➕ Add Cart, 🛒 Cart, ⬅️ Back</g-keyboard>
      <g-keyboard type="inline" lang="id">✅ Beli, ➕ Tambah, 🛒 Keranjang, ⬅️ Kembali</g-keyboard>
      <g-message>
        📦 {{name}}

        Service: {{service}}
        Duration: {{duration}}
        Account type: {{accountType}}
        Stock: {{stock}}
        Price: {{price}}
        Delivery: {{delivery}}

        {{description}}

        Benefits:
        {{benefits}}
      </g-message>
      <g-message lang="id">
        📦 {{name}}

        Layanan: {{service}}
        Durasi: {{duration}}
        Tipe akun: {{accountType}}
        Stok: {{stock}}
        Harga: {{price}}
        Pengiriman: {{delivery}}

        {{description}}

        Manfaat:
        {{benefits}}
      </g-message>
    </g-base>
    <g-base id="${Base.infoAdded}">
      <g-keyboard type="inline">🔎 Browse, 🛒 Cart</g-keyboard>
      <g-keyboard type="inline" lang="id">🔎 Jelajahi, 🛒 Keranjang</g-keyboard>
      <g-message>
        ✅ Added to cart

        {{name}} is now in your cart. You can continue shopping or review the cart whenever you're ready.
      </g-message>
      <g-message lang="id">
        ✅ Ditambahkan ke keranjang

        {{name}} sekarang di keranjang Anda. Anda dapat melanjutkan belanja atau lihat keranjang kapan saja.
      </g-message>
    </g-base>
    <g-base id="${Base.warnStock}">
      <g-keyboard type="inline">🔎 Browse, 🛒 Cart</g-keyboard>
      <g-keyboard type="inline" lang="id">🔎 Jelajahi, 🛒 Keranjang</g-keyboard>
      <g-message>
        ⛔ Out of stock

        {{name}} is currently unavailable. Please choose another product or check again later.
      </g-message>
      <g-message lang="id">
        ⛔ Stok habis

        {{name}} sedang tidak tersedia. Silakan pilih produk lain atau cek lagi nanti.
      </g-message>
    </g-base>
    <g-base id="${Base.warnMissing}">
      <g-keyboard type="inline">🔎 Browse Products, 🛒 Cart</g-keyboard>
      <g-keyboard type="inline" lang="id">🔎 Jelajahi, 🛒 Keranjang</g-keyboard>
      <g-message>
        ⚠️ Product not found

        We could not find that subscription product. Please return to the catalog.
      </g-message>
      <g-message lang="id">
        ⚠️ Produk tidak ditemukan

        Kami tidak dapat menemukan produk langganan tersebut. Silakan kembali ke katalog.
      </g-message>
    </g-base>
  `
}
