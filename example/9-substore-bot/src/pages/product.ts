import {PageBase} from "~/base/page"
import {CartStore, type CartState, ProductCatalog} from "~/data/store"
import {CartPage} from "./cart"
import {CatalogPage} from "./catalog"
import {CheckoutPage} from "./checkout"

class Base {
  static step1 = `s1`
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
    return ctx.inlineKeyboardT([ctx.data.callbackData(`buy`, productId), ctx.data.callbackData(`add`, productId), CartPage, CatalogPage.data.callbackData(`page`, `0`)], `2-1`, bi)
  }

  static kbBack(ctx: ProductPage, bi?: string) {
    return ctx.inlineKeyboardT([CatalogPage.data.callbackData(`page`, `0`), CartPage], `2`, bi)
  }
}

class Alert {
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

class Main {
  static async showStep1Form(ctx: ProductPage, productId: string) {
    const product = ProductCatalog.getById(productId)
    if (!product) {
      return await Alert.showWarnMissing(ctx)
    }

    const bi = Base.step1
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

  static async processStep1Answer(ctx: ProductPage, action?: string, productId?: string) {
    if (!productId) {
      return await Alert.showWarnMissing(ctx)
    }

    const product = ProductCatalog.getById(productId)
    if (!product) {
      return await Alert.showWarnMissing(ctx)
    }

    if (product.stockStatus !== `available`) {
      return await Alert.showWarnStock(ctx, productId)
    }

    const cart = await Helper.getCart(ctx)
    const next = CartStore.addItem(cart, productId)
    await Helper.setCart(ctx, next)

    if (action === `buy`) {
      await new CheckoutPage(ctx).showStep1Form(true)
    } else if (action === `add`) {
      await Alert.showInfoAdded(ctx, productId)
    }
  }
}

export class ProductPage extends PageBase {
  static data = this.buildData((action?: string, productId?: string) => [action, productId])

  async handleArgsCallbackData() {
    const [action, productId] = this.callbackDataArgs
    if (action === `detail` && productId) {
      await Main.showStep1Form(this, productId)
    } else {
      await Main.processStep1Answer(this, action, productId)
    }
  }

  static template = `
    <base id="${Base.step1}">
      <keyboard>✅ Buy Now, ➕ Add Cart, 🛒 Cart, ⬅️ Back</keyboard>
      <message>
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
      </message>
    </base>

    <base id="${Base.infoAdded}">
      <keyboard>🔎 Browse Products, 🛒 Cart</keyboard>
      <message>
        ✅ Added to cart

        {{name}} is now in your cart. You can continue shopping or review the cart whenever you're ready.
      </message>
    </base>

    <base id="${Base.warnStock}">
      <keyboard>🔎 Browse Products, 🛒 Cart</keyboard>
      <message>
        ⛔ Out of stock

        {{name}} is currently unavailable. Please choose another product or check again later.
      </message>
    </base>

    <base id="${Base.warnMissing}">
      <keyboard>🔎 Browse Products, 🛒 Cart</keyboard>
      <message>
        ⚠️ Product not found

        We could not find that subscription product. Please return to the catalog.
      </message>
    </base>
  `
}
