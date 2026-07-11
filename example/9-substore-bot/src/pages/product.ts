import {PageBase} from "~/base/page"
import {CartPage} from "./cart"
import {CatalogPage} from "./catalog"
import {CheckoutPage} from "./checkout"
import {CartStore, type CartState, ProductCatalog} from "~/data/store"

class Base {
  static index = `i`
  static infoAdded = `i-added`
  static warnStock = `w-stock`
  static warnMissing = `w-missing`
}

class Helper {
  static async getCart(ctx: ProductPage): Promise<CartState> {
    return ((await ctx.cacheState.get(`${ctx.userId}:cart`)) ?? {}) as CartState
  }

  static async setCart(ctx: ProductPage, cart: CartState) {
    await ctx.cacheState.set(`${ctx.userId}:cart`, cart)
  }

  static kb(ctx: ProductPage, productId: string, bi?: string) {
    return ctx.inlineKeyboardT([ctx.data.callbackData(`buy`, productId), ctx.data.callbackData(`add`, productId), CartPage, CatalogPage], `2-1`, bi)
  }

  static kbBack(ctx: ProductPage, bi?: string) {
    return ctx.inlineKeyboardT([CatalogPage, CartPage], `2`, bi)
  }
}

class Main {
  static async showIndex(ctx: ProductPage, productId: string) {
    const product = ProductCatalog.getById(productId)
    if (!product) {
      return await Main.showWarnMissing(ctx)
    }

    const bi = Base.index
    const kb = Helper.kb(ctx, productId, bi)
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
    await ctx.edit(kb, da, bi)
  }

  static async processIndex(ctx: ProductPage, action?: string, productId?: string) {
    if (!productId) {
      return await Main.showWarnMissing(ctx)
    }

    const product = ProductCatalog.getById(productId)
    if (!product) {
      return await Main.showWarnMissing(ctx)
    }

    if (product.stockStatus !== `available`) {
      return await Main.showWarnStock(ctx, productId)
    }

    const cart = await Helper.getCart(ctx)
    const next = CartStore.addItem(cart, productId)
    await Helper.setCart(ctx, next)

    if (action === `buy`) {
      await new CheckoutPage(ctx).showIndex(true)
    } else if (action === `add`) {
      await Main.showInfoAdded(ctx, productId)
    }
  }

  static async showInfoAdded(ctx: ProductPage, productId: string) {
    const product = ProductCatalog.getById(productId)
    const bi = Base.infoAdded
    const kb = Helper.kbBack(ctx, bi)
    const da = {name: product?.name ?? `Selected product`}
    await ctx.edit(kb, da, bi)
  }

  static async showWarnStock(ctx: ProductPage, productId: string) {
    const product = ProductCatalog.getById(productId)
    const bi = Base.warnStock
    const kb = Helper.kbBack(ctx, bi)
    const da = {name: product?.name ?? `This product`}
    await ctx.edit(kb, da, bi)
  }

  static async showWarnMissing(ctx: ProductPage) {
    const bi = Base.warnMissing
    const kb = Helper.kbBack(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }
}

export class ProductPage extends PageBase {
  static data = this.buildData((action?: string, productId?: string) => [action, productId])

  async handleArgsCallbackData() {
    const [action, productId] = this.callbackDataArgs
    if (action === `detail` && productId) {
      await Main.showIndex(this, productId)
    } else {
      await Main.processIndex(this, action, productId)
    }
  }

  static template = `
    <g-base id="${Base.index}">
      <g-keyboard>✅ Buy Now, ➕ Add Cart, 🛒 Cart, ⬅️ Back</g-keyboard>
      <g-keyboard lang="id">✅ Beli, ➕ Tambah, 🛒 Keranjang, ⬅️ Kembali</g-keyboard>
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
      <g-keyboard>🔎 Browse, 🛒 Cart</g-keyboard>
      <g-keyboard lang="id">🔎 Jelajahi, 🛒 Keranjang</g-keyboard>
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
      <g-keyboard>🔎 Browse, 🛒 Cart</g-keyboard>
      <g-keyboard lang="id">🔎 Jelajahi, 🛒 Keranjang</g-keyboard>
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
      <g-keyboard>🔎 Browse Products, 🛒 Cart</g-keyboard>
      <g-keyboard lang="id">🔎 Jelajahi, 🛒 Keranjang</g-keyboard>
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
